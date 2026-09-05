# Pendientes / Backlog

Tareas anotadas para retomar. No bloqueantes del uso actual.

## CFE / Facturación electrónica

### Branding del PDF fiscal (onboarding a producción)
El PDF fiscal (con QR + CAE) lo **genera FEU (Surtec)**, no nuestro sistema; nosotros
solo lo descargamos (`packages/cfe/src/feu/feu.provider.ts` → `obtenerPdf`). Por eso en
el sandbox sale "ACME Corporation" (datos del RUT de prueba `218617380010`).

Al integrar un cliente real:
- **Razón social / dirección / RUT**: salen automáticamente de lo que DGI/FEU tiene
  registrado para el RUT real. No requiere trabajo nuestro.
- **Logo**: se configura por emisor en la cuenta de Surtec. **Confirmar con Surtec** si
  se sube desde su panel o si existe un endpoint de API para automatizarlo en el
  onboarding del tenant.
- Opcional: permitir logo del cliente en la **boleta térmica 80mm** que sí generamos
  nosotros (`apps/pos/src/lib/boleta.ts` / `escpos.ts`).

### Ubicación de la config CFE (seguridad) — DECISIÓN PENDIENTE
Hoy la config fiscal (RUT emisor, ambiente test/prod, activar emisión) se edita en el
**panel del tenant** (`apps/admin` → Settings). Riesgo: un usuario del tenant puede
romper el cumplimiento por error (cambiar el RUT, pasar a producción antes de tiempo).

Propuesta (ver detalle en la conversación): mover la **edición** de los campos fiscales
sensibles a la **Consola de Aragon** (que ya administra tenants) y dejar el panel del
tenant en **solo lectura** para esos campos. Mantener editable en el panel lo comercial
no fiscal (nombre, dirección, teléfono, email, logo, tienda online, fidelización, caja).
Extra: doble gate para test→prod + audit log de cambios de config fiscal.
