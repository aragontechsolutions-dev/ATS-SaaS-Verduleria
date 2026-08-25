// Siembra SOLO las reglas del motor de IVA (globales). Seguro para producción:
// no toca tenants ni catálogo, solo la tabla IvaRule (idempotente por término).
//
// Ejecutar: npm run seed:iva -w @ats/database

import { PrismaClient } from '../client';
import { seedIvaRules } from './iva-rules';

const prisma = new PrismaClient();

seedIvaRules(prisma)
  .then((n) => console.log(`✓ Reglas de IVA sembradas/actualizadas: ${n}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
