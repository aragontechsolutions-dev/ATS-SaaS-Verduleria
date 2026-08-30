import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyPasswordChanged } from '../lib/api';

interface Props {
  email: string;
  /** Se llama tras cambiar la contraseña: vuelve al login con este mensaje. */
  onDone: (mensaje: string) => void;
}

/** Primer acceso: obliga a definir una contraseña nueva y vuelve al login. */
export function ChangePassword({ email, onDone }: Props) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (pass !== pass2) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    setError(null);

    const { error: upErr } = await supabase.auth.updateUser({ password: pass });
    if (upErr) {
      const m = upErr.message.toLowerCase();
      setError(m.includes('different') ? 'Elegí una contraseña distinta a la temporal.' : upErr.message);
      setLoading(false);
      return;
    }
    // Limpia el flag de primer acceso (best-effort) y vuelve al login.
    try { await notifyPasswordChanged(); } catch { /* se reintenta en el próximo acceso */ }
    await supabase.auth.signOut();
    onDone('Contraseña actualizada. Ingresá con tu nueva contraseña.');
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <img className="login__logo" src="/icon.svg" alt="Aragon Tech Solutions" />
        <h1 className="login__title">Cambiá tu contraseña</h1>
        <p className="login__sub">Primer acceso de {email}. Definí una contraseña nueva.</p>

        <label className="field">
          Nueva contraseña
          <div className="pwd-wrap">
            <input type={show ? 'text' : 'password'} autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} required autoFocus />
            <button type="button" className="pwd-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar' : 'Mostrar'}>{show ? '🙈' : '👁'}</button>
          </div>
        </label>
        <label className="field">
          Repetir contraseña
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} required />
        </label>

        {error && <p className="login__err">{error}</p>}

        <button className="btn btn--primary login__btn" type="submit" disabled={loading}>
          {loading ? 'Guardando…' : 'Cambiar y volver al login'}
        </button>
      </form>
      <p className="login__foot">Aragon Tech Solutions · Technology for smarter fresh produce businesses</p>
    </div>
  );
}
