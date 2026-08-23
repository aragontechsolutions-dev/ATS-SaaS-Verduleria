import { useState } from 'react';
import { createUser } from '../lib/api';
import type { CreateUserResult, Role } from '../lib/api';

const ROLES: Role[] = ['CAJERO', 'ENCARGADO', 'DEPOSITO', 'REPARTIDOR', 'COMPRADOR', 'CONTADOR', 'ADMIN'];

export function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('CAJERO');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateUserResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await createUser({ email: email.trim(), nombre: nombre.trim(), role, password: password || undefined });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="modal-backdrop" onClick={onSaved}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>✓ Usuario creado</h3>
          {result.loginCreado ? (
            <>
              <p className="muted">Pasale estas credenciales (se muestran una sola vez):</p>
              <div className="creds">
                <div><span>Email</span><code>{result.email}</code></div>
                <div><span>Contraseña</span><code>{result.password}</code></div>
              </div>
            </>
          ) : (
            <p className="warn">
              El usuario quedó habilitado, pero el login en Supabase no se creó automáticamente
              (falta la service-role key en el backend). Creá <strong>{result.email}</strong> en
              Supabase → Authentication → Users.
            </p>
          )}
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={onSaved}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Nuevo usuario</h3>
        <label className="field">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="row2">
          <label className="field">
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="field">
            Contraseña inicial (opcional)
            <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="se genera si la dejás vacía" />
          </label>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creando…' : 'Crear'}</button>
        </div>
      </form>
    </div>
  );
}
