import { Injectable, NotFoundException } from '@nestjs/common';
import { RegimenFiscal } from '@ats/database';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './settings.dto';

/** Deriva el proveedor CFE y cod_montos_brutos del régimen fiscal. */
function fiscalDefaults(regimen: RegimenFiscal): { provider: string; codMontosBrutos: number } {
  const exento = regimen === RegimenFiscal.MONOTRIBUTO || regimen === RegimenFiscal.MONOTRIBUTO_MIDES;
  return exento
    ? { provider: 'SIN_CFE', codMontosBrutos: 3 } // exceptuado de CFE (ticket interno)
    : { provider: 'FEU', codMontosBrutos: 1 }; // obligado a CFE (IVA incluido)
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
      cfe: tenant.cfeConfig
        ? {
            provider: tenant.cfeConfig.provider,
            ambiente: tenant.cfeConfig.ambiente,
            emisorRut: tenant.cfeConfig.emisorRut,
            sucursalDefault: tenant.cfeConfig.sucursalDefault,
            certificadoEstado: tenant.cfeConfig.certificadoEstado,
          }
        : null,
    };
  }

  async update(tenantId: string, dto: UpdateSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { cfeConfig: true },
    });
    if (!tenant) throw new NotFoundException('Verdulería no encontrada');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        nombre: dto.nombre,
        razonSocial: dto.razonSocial,
        rut: dto.rut,
        regimenFiscal: dto.regimenFiscal,
        direccion: dto.direccion,
        telefono: dto.telefono,
        email: dto.email,
      },
    });

    // Config CFE: se deriva del régimen resultante. El emisorRut cae al RUT.
    const regimen = dto.regimenFiscal ?? tenant.regimenFiscal;
    const { provider, codMontosBrutos } = fiscalDefaults(regimen);
    const emisorRut = dto.emisorRut ?? dto.rut ?? tenant.cfeConfig?.emisorRut ?? tenant.rut ?? '';
    const ambiente = dto.cfeAmbiente ?? tenant.cfeConfig?.ambiente ?? 'test';
    const sucursalDefault = dto.sucursalDefault ?? tenant.cfeConfig?.sucursalDefault ?? 1;

    await this.prisma.cfeTenantConfig.upsert({
      where: { tenantId },
      update: { provider, ambiente, emisorRut, sucursalDefault, codMontosBrutos },
      create: { tenantId, provider, ambiente, emisorRut, sucursalDefault, codMontosBrutos },
    });

    return this.get(tenantId);
  }
}
