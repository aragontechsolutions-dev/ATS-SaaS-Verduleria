import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './settings.dto';
import { GATES_OFF, hashCajaPin, normalizeGates } from './settings.security';

/** Fragmento de update para el PIN/puertas de caja según el DTO. */
function cajaSeguridadData(dto: UpdateSettingsDto): Prisma.TenantUpdateInput {
  if (dto.cajaPinClear) {
    return { cajaPinHash: null, cajaGates: { ...GATES_OFF } as Prisma.InputJsonValue };
  }
  const data: Prisma.TenantUpdateInput = {};
  if (dto.cajaPin) data.cajaPinHash = hashCajaPin(dto.cajaPin);
  if (dto.cajaGates !== undefined) data.cajaGates = normalizeGates(dto.cajaGates) as Prisma.InputJsonValue;
  return data;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { cfeConfig: true },
    });
    if (!tenant) throw new NotFoundException('Verdulería no encontrada');
    return {
      nombre: tenant.nombre,
      slug: tenant.slug,
      razonSocial: tenant.razonSocial,
      rut: tenant.rut,
      regimenFiscal: tenant.regimenFiscal,
      direccion: tenant.direccion,
      telefono: tenant.telefono,
      email: tenant.email,
      limiteEfectivoCaja: tenant.limiteEfectivoCaja != null ? Number(tenant.limiteEfectivoCaja) : null,
      loyaltyActivo: tenant.loyaltyActivo,
      loyaltyAcumulaCada: Number(tenant.loyaltyAcumulaCada),
      loyaltyValorPunto: Number(tenant.loyaltyValorPunto),
      tiendaOnlineActiva: tenant.tiendaOnlineActiva,
      cajaSeguridad: {
        // Nunca devolvemos el hash al panel: solo si hay PIN y qué acciones lo exigen.
        tienePin: !!tenant.cajaPinHash,
        gates: normalizeGates(tenant.cajaGates),
      },
      cfe: tenant.cfeConfig
        ? {
            provider: tenant.cfeConfig.provider,
            ambiente: tenant.cfeConfig.ambiente,
            emisorRut: tenant.cfeConfig.emisorRut,
            sucursalDefault: tenant.cfeConfig.sucursalDefault,
            certificadoEstado: tenant.cfeConfig.certificadoEstado,
            emisionActiva: tenant.cfeConfig.emisionActiva,
          }
        : null,
    };
  }

  async update(tenantId: string, dto: UpdateSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Verdulería no encontrada');

    // Datos comerciales y de caja. La config FISCAL (RUT, régimen, ambiente,
    // emisión, sucursal) se gestiona SOLO desde la Consola de Aragon; acá el
    // panel del tenant es de solo lectura para esos campos.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        nombre: dto.nombre,
        razonSocial: dto.razonSocial,
        direccion: dto.direccion,
        telefono: dto.telefono,
        email: dto.email,
        ...(dto.limiteEfectivoCaja !== undefined
          ? { limiteEfectivoCaja: dto.limiteEfectivoCaja && dto.limiteEfectivoCaja > 0 ? dto.limiteEfectivoCaja : null }
          : {}),
        ...(dto.loyaltyActivo !== undefined ? { loyaltyActivo: dto.loyaltyActivo } : {}),
        ...(dto.loyaltyAcumulaCada !== undefined ? { loyaltyAcumulaCada: new Prisma.Decimal(dto.loyaltyAcumulaCada) } : {}),
        ...(dto.loyaltyValorPunto !== undefined ? { loyaltyValorPunto: new Prisma.Decimal(dto.loyaltyValorPunto) } : {}),
        ...(dto.tiendaOnlineActiva !== undefined ? { tiendaOnlineActiva: dto.tiendaOnlineActiva } : {}),
        ...cajaSeguridadData(dto),
      },
    });

    return this.get(tenantId);
  }
}
