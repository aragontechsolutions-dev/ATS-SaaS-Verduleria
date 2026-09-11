import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { login, type LoginError } from '../lib/api';

/** Email demo pre-cargado desde la URL (?demo=1&email=...). */
function demoEmail(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('demo') === '1' ? (p.get('email') ?? '') : '';
  } catch {
    return '';
  }
}

export function Login() {
  const [email, setEmail] = useState(demoEmail());
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await login(email, password);
      await supabase.auth.setSession(tokens);
    } catch (err) {
      const e2 = err as LoginError;
      if (e2.code === 'LOCKED') {
        setError('Usuario bloqueado por intentos fallidos. Pedile al encargado que te desbloquee.');
      } else if (e2.code === 'BAD_CREDENTIALS') {
        setError(`Credenciales inválidas${typeof e2.remaining === 'number' ? ` · te ${e2.remaining === 1 ? 'queda 1 intento' : `quedan ${e2.remaining} intentos`}` : ''}`);
      } else {
        setError(e2.message || 'No se pudo iniciar sesión');
      }
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <img className="auth__logo" src="/icon.svg" alt="Aragon" />
        <h1 className="auth__title">Comprador</h1>
        <p className="auth__sub">Ingresá con tu usuario para comprar en la UAM</p>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          Contraseña
          <div className="pwd-wrap">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="pwd-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Ocultar' : 'Mostrar'}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="auth__foot">Aragon Tech Solutions · Comprador</p>
    </div>
  );
}
