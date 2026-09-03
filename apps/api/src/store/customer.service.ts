import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto, AddressDto } from './customer.dto';

export interface CustomerToken {
  customerId: string;
  tenantId: string;
}

/**
 * Cuentas de los clientes de la tienda online (self-service, opcionales). Login
 * propio con email + contraseña (bcrypt) y token JWT firmado por la API — separado
 * del auth del staff (Supabase). Da direcciones guardadas, puntos e historial.
 */
@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private normEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private sign(customerId: string, tenantId: string): string {
    return this.jwt.sign({ sub: customerId, tid: tenantId });
  }

  /** Verifica el header Authorization y devuelve el cliente, o null si no hay/es inválido. */
  verify(authHeader: string | undefined, tenantId: string): CustomerToken | null {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ sub: string; tid: string }>(token);
      if (payload.tid !== tenantId) return null;
      return { customerId: payload.sub, tenantId: payload.tid };
    } catch {
      return null;
    }
  }

  /** Igual que verify pero exige sesión (lanza 401 si falta o es inválida). */
  requireCustomer(authHeader: string | undefined, tenantId: string): CustomerToken {
    const c = this.verify(authHeader, tenantId);
    if (!c) throw new UnauthorizedException('Iniciá sesión para continuar.');
    return c;
  }

  async register(tenantId: string, dto: RegisterDto) {
    const email = this.normEmail(dto.email);
    const existente = await this.prisma.customer.findFirst({
      where: { tenantId, email, esOnline: true },
      select: { id: true },
    });
    if (existente) throw new BadRequestException('Ya existe una cuenta con ese email. Iniciá sesión.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        nombre: dto.nombre.trim(),
        email,
        telefono: dto.telefono?.trim() || null,
        esOnline: true,
        passwordHash,
      },
    });
    return { token: this.sign(customer.id, tenantId), customer: this.publicCustomer(customer) };
  }

  async login(tenantId: string, dto: LoginDto) {
    const email = this.normEmail(dto.email);
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, email, esOnline: true, activo: true },
    });
    if (!customer?.passwordHash || !(await bcrypt.compare(dto.password, customer.passwordHash))) {
      throw new UnauthorizedException('Email o contraseña incorrectos.');
    }
    return { token: this.sign(customer.id, tenantId), customer: this.publicCustomer(customer) };
  }

  async getAccount(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: { addresses: { orderBy: { createdAt: 'asc' } } },
    });
    if (!customer) throw new UnauthorizedException('Sesión inválida.');
    return {
      customer: this.publicCustomer(customer),
      direcciones: customer.addresses.map((a) => ({
        id: a.id,
        etiqueta: a.etiqueta,
        direccion: a.direccion,
        referencia: a.referencia,
      })),
    };
  }

  async addAddress(tenantId: string, customerId: string, dto: AddressDto) {
    await this.prisma.customerAddress.create({
      data: {
        tenantId,
        customerId,
        etiqueta: dto.etiqueta.trim() || 'Casa',
        direccion: dto.direccion.trim(),
        referencia: dto.referencia?.trim() || null,
      },
    });
    return this.getAccount(tenantId, customerId);
  }

  async deleteAddress(tenantId: string, customerId: string, id: string) {
    const addr = await this.prisma.customerAddress.findFirst({ where: { id, tenantId, customerId } });
    if (!addr) throw new BadRequestException('Dirección no encontrada.');
    await this.prisma.customerAddress.delete({ where: { id } });
    return this.getAccount(tenantId, customerId);
  }

  async myOrders(tenantId: string, customerId: string) {
    const orders = await this.prisma.onlineOrder.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { numero: true, codigo: true, estado: true, total: true, createdAt: true, tipoEntrega: true },
    });
    return orders.map((o) => ({
      numero: o.numero,
      codigo: o.codigo,
      estado: o.estado,
      tipoEntrega: o.tipoEntrega,
      total: Number(o.total),
      createdAt: o.createdAt.toISOString(),
    }));
  }

  private publicCustomer(c: { id: string; nombre: string; email: string | null; telefono: string | null; puntos: number }) {
    return { id: c.id, nombre: c.nombre, email: c.email, telefono: c.telefono, puntos: c.puntos };
  }
}
