import { useState } from 'react';
import { createTenant } from '../lib/api';
import type { CreateTenantResult, Plan } from '../lib/api';

interface Props {
  plans: Plan[];
  onClose: () => void;
  onCreated: () => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function NewClientModal({ plans, onClose, onCreated }: Props) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? '');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [rut, setRut] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateTenantResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await createTenant({
        nombre: nombre.trim(),
        slug: (slugTocado ? slug : slugify(nombre)).trim(),
        planCode,
        adminNombre: adminNombre.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword || undefined,
        rut: rut.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
      setSaving(false);
    }
  }

  // Pantalla de éxito: mostramos las credenciales una sola vez.
  if (result) {
    return (
      <div className="modal-backdrop" onClick={onCreated}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>✓ Cliente creado</h3>
          {result.admin.loginCreado ? (
            <>
              <p className="muted">Pasale estas credenciales al cliente (se muestran una sola vez):</p>
              <div className="creds">
                <div><span>Email</span><code>{result.admin.email}</code></div>
                <div><span>Contraseña</span><code>{result.admin.password}</code></div>
              </div>
            </>
          ) : (
            <p className="warn">
              La verdulería quedó creada, pero el login en Supabase no se generó automáticamente
              (falta configurar la service-role key en el backend). Creá el usuario
              <strong> {result.admin.email}</strong> en Supabase → Authentication → Users.
            </p>
          )}
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={onCreated}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Nuevo cliente</h3>
        <label className="field">
          Nombre de la verdulería
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          Identificador (slug)
          <input
            value={slugTocado ? slug : slugify(nombre)}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTocado(true); }}
            required
          />
        </label>
        <label className="field">
          Plan
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.nombre}</option>)}
          </select>
        </label>
        <div className="row2">
          <label className="field">
            Nombre del admin
            <input value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required />
          </label>
          <label className="field">
            RUT (opcional)
            <input value={rut} onChange={(e) => setRut(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Email del admin
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </label>
        <label className="field">
          Contraseña inicial (opcional — si la dejás vacía, se genera una)
          <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} minLength={6} />
        </label>

        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
