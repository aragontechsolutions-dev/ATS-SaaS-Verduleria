import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoDocumentoCliente } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCustomerDto, ChargeDto, PaymentDto, QuickCustomerDto, UpdateCustomerDto } from './customers.dto';

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Clientes (por defecto solo mayoristas, que son los de cuenta corriente). */
  async list(tenantId: string, soloMayoristas = true) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId, ...(soloMayoristas ? { esMayorista: true } : {}) },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { account: true },
    });
    return customers.map((c) => this.toRow(c));
  }

  /**
   * Búsqueda de clientes para el POS (identificación del comprador). Devuelve
   * solo datos fiscales, no la cuenta corriente. Sin `q` trae los más recientes.
   */
  async search(tenantId: string, q?: string, limit = 20) {
    const term = (q ?? '').trim();
    const where: Prisma.CustomerWhereInput = { tenantId, activo: true };
    if (term) {
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { documento: { contains: term } },
        { razonSocial: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: term ? { nombre: 'asc' } : { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((c) => this.toFiscalRow(c));
  }

  /** Alta rápida desde el POS: cliente no mayorista, solo datos fiscales. */
  async quickCreate(tenantId: string, dto: QuickCustomerDto) {
    const c = await this.prisma.customer.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        esMayorista: false,
        tipoDocumento: dto.tipoDocumento,
        documento: dto.documento,
        razonSocial: dto.razonSocial,
        direccion: dto.direccion,
      },
    });
    return this.toFiscalRow(c);
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    const c = await this.prisma.customer.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        esMayorista: dto.esMayorista ?? true,
        tipoDocumento: dto.tipoDocumento,
        documento: dto.documento,
        razonSocial: dto.razonSocial,
        direccion: dto.direccion,
        telefono: dto.telefono,
        email: dto.email,
        priceListId: dto.priceListId,
        limiteCredito: dto.limiteCredito != null ? new Prisma.Decimal(dto.limiteCredito) : undefined,
      },
      include: { account: true },
    });
    return this.toRow(c);
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.assertCustomer(tenantId, id);
    const c = await this.prisma.customer.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        esMayorista: dto.esMayorista,
        tipoDocumento: dto.tipoDocumento,
        documento: dto.documento,
        razonSocial: dto.razonSocial,
        direccion: dto.direccion,
        telefono: dto.telefono,
        email: dto.email,
        priceListId: dto.priceListId,
        limiteCredito: dto.limiteCredito != null ? new Prisma.Decimal(dto.limiteCredito) : undefined,
        activo: dto.activo,
      },
      include: { account: true },
    });
    return this.toRow(c);
  }

  /** Estado de cuenta: datos del cliente, saldo y movimientos (más recientes primero). */
  async account(tenantId: string, customerId: string, limit = 100) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: { account: { include: { movements: { orderBy: { createdAt: 'desc' }, take: limit } } } },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const saldo = num(customer.account?.saldo);
    const limite = num(customer.limiteCredito);
    return {
      customer: this.toRow(customer),
      saldo,
      limiteCredito: limite,
      disponible: limite > 0 ? Number((limite - saldo).toFixed(2)) : null,
      movimientos: (customer.account?.movements ?? []).map((m) => ({
        id: m.id,
        fecha: m.createdAt,
        monto: num(m.monto),
        tipo: num(m.monto) >= 0 ? 'CARGO' : 'PAGO',
        concepto: m.concepto,
      })),
    };
  }

  /** Registra una cobranza (pago del cliente): baja el saldo. */
  async addPayment(tenantId: string, customerId: string, dto: PaymentDto) {
    await this.assertCustomer(tenantId, customerId);
    return this.prisma.$transaction(async (tx) => {
      const account = await this.ensureAccount(tx, tenantId, customerId);
      const saldo = num(account.saldo) - dto.monto;
      await tx.accountReceivable.update({ where: { id: account.id }, data: { saldo: new Prisma.Decimal(saldo) } });
      await tx.accountMovement.create({
        data: { tenantId, accountId: account.id, monto: new Prisma.Decimal(-dto.monto), concepto: dto.concepto ?? 'Cobranza' },
      });
      return { saldo: Number(saldo.toFixed(2)) };
    });
  }

  /** Cargo manual (deuda fuera de una venta): sube el saldo. */
  async addCharge(tenantId: string, customerId: string, dto: ChargeDto) {
    await this.assertCustomer(tenantId, customerId);
    return this.prisma.$transaction(async (tx) => {
      const account = await this.ensureAccount(tx, tenantId, customerId);
      const saldo = num(account.saldo) + dto.monto;
      await tx.accountReceivable.update({ where: { id: account.id }, data: { saldo: new Prisma.Decimal(saldo) } });
      await tx.accountMovement.create({
        data: { tenantId, accountId: account.id, monto: new Prisma.Decimal(dto.monto), concepto: dto.concepto ?? 'Cargo manual' },
      });
      return { saldo: Number(saldo.toFixed(2)) };
    });
  }

  /** Crea la cuenta si no existe (dentro de una transacción). */
  private async ensureAccount(tx: Prisma.TransactionClient, tenantId: string, customerId: string) {
    const existing = await tx.accountReceivable.findUnique({ where: { customerId } });
    if (existing) return existing;
    return tx.accountReceivable.create({ data: { tenantId, customerId, saldo: new Prisma.Decimal(0) } });
  }

  /** Fila mínima para el POS: solo identificación fiscal del comprador. */
  private toFiscalRow(c: {
    id: string;
    nombre: string;
    tipoDocumento: TipoDocumentoCliente;
    documento: string | null;
    razonSocial: string | null;
  }) {
    return {
      id: c.id,
      nombre: c.nombre,
      tipoDocumento: c.tipoDocumento,
      documento: c.documento,
      razonSocial: c.razonSocial,
    };
  }

  private async assertCustomer(tenantId: string, id: string): Promise<void> {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
  }

  private toRow(c: {
    id: string;
    nombre: string;
    esMayorista: boolean;
    documento: string | null;
    razonSocial: string | null;
    telefono: string | null;
    email: string | null;
    priceListId: string | null;
    limiteCredito: Prisma.Decimal;
    activo: boolean;
    account?: { saldo: Prisma.Decimal } | null;
  }) {
    return {
      id: c.id,
      nombre: c.nombre,
      esMayorista: c.esMayorista,
      documento: c.documento,
      razonSocial: c.razonSocial,
      telefono: c.telefono,
      email: c.email,
      priceListId: c.priceListId,
      limiteCredito: num(c.limiteCredito),
      saldo: num(c.account?.saldo),
      activo: c.activo,
    };
  }
}
