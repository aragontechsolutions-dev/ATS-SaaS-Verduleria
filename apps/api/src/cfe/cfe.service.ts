import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CfeProvider, EstadoDgiResult, CfeTipo as CfeDomainTipo } from '@ats/cfe';
import { CfeError } from '@ats/cfe';
import { CfeTipo, EstadoDgi, type CfeDocument } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import { CFE_PROVIDER } from './cfe.tokens';
import { requiereCfe, saleToCfeInput, tipoCfePorVenta, type SaleConItems } from './cfe.mapper';

/** Mapea el código de estado DGI (string) al enum de Prisma. */
function toEstadoEnum(codigo: string): EstadoDgi {
  switch (codigo) {
    case 'NE':
      return EstadoDgi.NE;
    case 'AE':
      return EstadoDgi.AE;
    case 'BE':
      return EstadoDgi.BE;
    case 'CE':
      return EstadoDgi.CE;
    default:
      return EstadoDgi.NE;
  }
}

const TIPO_DOMINIO_A_PRISMA: Record<string, CfeTipo> = {
  E_TICKET: CfeTipo.E_TICKET,
  NC_E_TICKET: CfeTipo.NC_E_TICKET,
  ND_E_TICKET: CfeTipo.ND_E_TICKET,
  E_FACTURA: CfeTipo.E_FACTURA,
  NC_E_FACTURA: CfeTipo.NC_E_FACTURA,
  ND_E_FACTURA: CfeTipo.ND_E_FACTURA,
  E_REMITO: CfeTipo.E_REMITO,
  E_RESGUARDO: CfeTipo.E_RESGUARDO,
};

@Injectable()
export class CfeService {
  private readonly logger = new Logger(CfeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CFE_PROVIDER) private readonly provider: CfeProvider,
  ) {}

  /**
   * Emite (o recupera, si ya existe) el CFE de una venta. Idempotente:
   * usa Sale.idempotencyKey como id_externo, y hace upsert del CfeDocument
   * por (tenantId, idExterno). Reintentar nunca factura dos veces.
   */
  async emitirParaVenta(tenantId: string, saleId: string): Promise<CfeDocument> {
    const sale = (await this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true, customer: true },
    })) as SaleConItems | null;
    if (!sale) throw new NotFoundException('Venta no encontrada');

    // Devolución: referencia al comprobante original (para la nota de crédito).
    if (sale.esDevolucion && sale.referenciaSaleId) {
      const refDoc = await this.prisma.cfeDocument.findFirst({
        where: { tenantId, saleId: sale.referenciaSaleId },
      });
      if (refDoc?.serie && refDoc.numero != null) {
        sale.referenciaCfe = {
          tipo: refDoc.tipo as unknown as CfeDomainTipo,
          serie: refDoc.serie,
          numero: refDoc.numero,
        };
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { cfeConfig: true },
    });
    if (!tenant?.cfeConfig) throw new NotFoundException('El tenant no tiene configuración CFE');

    const cfeConfig = tenant.cfeConfig;
    const emisorRut = cfeConfig.emisorRut;

    // Ticket interno (no fiscal) cuando:
    //  - el régimen está exceptuado de CFE (Monotributo / sin CFE), o
    //  - el admin todavía no activó la emisión electrónica (interruptor de seguridad).
    if (!requiereCfe(tenant.regimenFiscal, cfeConfig.provider) || !cfeConfig.emisionActiva) {
      return this.prisma.cfeDocument.upsert({
        where: { tenantId_idExterno: { tenantId, idExterno: sale.idempotencyKey } },
        update: {},
        create: {
          tenantId,
          saleId: sale.id,
          tipo: CfeTipo.TICKET_INTERNO,
          estado: EstadoDgi.LOCAL,
          idExterno: sale.idempotencyKey,
          importeTotal: Math.abs(Number(sale.total)),
        },
      });
    }

    // Registro local en estado ENVIANDO antes de llamar al proveedor.
    const tipoPrisma = TIPO_DOMINIO_A_PRISMA[tipoCfePorVenta(sale)] ?? CfeTipo.E_TICKET;
    const doc = await this.prisma.cfeDocument.upsert({
      where: { tenantId_idExterno: { tenantId, idExterno: sale.idempotencyKey } },
      update: { estado: EstadoDgi.ENVIANDO },
      create: {
        tenantId,
        saleId: sale.id,
        tipo: tipoPrisma,
        estado: EstadoDgi.ENVIANDO,
        idExterno: sale.idempotencyKey,
      },
    });

    // Si ya se emitió antes (tiene providerId), no reemitir.
    if (doc.providerId) return doc;

    try {
      const input = saleToCfeInput(sale, cfeConfig, tenant.regimenFiscal);
      const result = await this.provider.emitir(emisorRut, input);
      return this.prisma.cfeDocument.update({
        where: { id: doc.id },
        data: {
          estado: EstadoDgi.NE, // recién emitido; DGI aún no acusó (polling)
          providerId: result.providerId,
          serie: result.serie,
          numero: result.numero,
          hash: result.hash,
          caeNumero: result.caeNumero,
          caeRangoInicio: result.caeRangoInicio,
          caeRangoFinal: result.caeRangoFinal,
          caeVencimiento: result.caeVencimiento ? new Date(result.caeVencimiento) : null,
          importeTotal: result.importeTotal ?? Math.abs(Number(sale.total)),
          qrUrl: result.qrUrl,
          ultimoError: null,
        },
      });
    } catch (err) {
      const mensaje = err instanceof CfeError ? err.message : String(err);
      this.logger.error(`Fallo emitiendo CFE de venta ${saleId}: ${mensaje}`);
      return this.prisma.cfeDocument.update({
        where: { id: doc.id },
        data: { estado: EstadoDgi.ERROR, ultimoError: mensaje },
      });
    }
  }

  /** Comprobante emitido para una venta (o null si aún no se emitió). */
  async obtenerPorVenta(tenantId: string, saleId: string): Promise<CfeDocument | null> {
    return this.prisma.cfeDocument.findFirst({ where: { tenantId, saleId } });
  }

  /** Descarga el PDF del CFE (A4 o ticket 80mm). */
  async obtenerPdf(tenantId: string, cfeDocId: string, tipo: 'A4' | 'ticket80' = 'A4') {
    const doc = await this.prisma.cfeDocument.findFirst({ where: { id: cfeDocId, tenantId } });
    if (!doc?.providerId) throw new NotFoundException('CFE sin comprobante emitido');
    const config = await this.prisma.cfeTenantConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('Sin configuración CFE');
    return this.provider.obtenerPdf(config.emisorRut, doc.providerId, tipo);
  }

  /** Reconsulta el estado DGI de un CfeDocument y lo actualiza (usado por el worker). */
  async refrescarEstado(doc: CfeDocument): Promise<CfeDocument> {
    if (!doc.providerId) return doc;
    const config = await this.prisma.cfeTenantConfig.findUnique({ where: { tenantId: doc.tenantId } });
    if (!config) return doc;

    // Día de emisión (hora de Uruguay) para acotar la consulta por fecha.
    const fechaEmision = new Date(doc.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });

    let estado: EstadoDgiResult;
    try {
      estado = await this.provider.consultarEstado(config.emisorRut, doc.providerId, fechaEmision);
    } catch (err) {
      const mensaje = err instanceof CfeError ? err.message : String(err);
      return this.prisma.cfeDocument.update({
        where: { id: doc.id },
        data: { pollingIntentos: { increment: 1 }, ultimoError: mensaje },
      });
    }

    return this.prisma.cfeDocument.update({
      where: { id: doc.id },
      data: {
        estado: toEstadoEnum(estado.codigo),
        pollingIntentos: { increment: 1 },
        ultimoError: estado.esFinal ? null : doc.ultimoError,
      },
    });
  }

  /** CfeDocuments pendientes de acuse DGI (para el worker de polling). */
  async pendientesDePolling(limit = 50): Promise<CfeDocument[]> {
    return this.prisma.cfeDocument.findMany({
      where: { estado: EstadoDgi.NE, providerId: { not: null }, pollingIntentos: { lt: 20 } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }
}
