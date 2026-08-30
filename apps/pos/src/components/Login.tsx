import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { login, type LoginError } from '../lib/api';

interface Props {
  onLogged: () => void;
  /** Mensaje inicial (ej. usuario inactivo o contraseña actualizada). */
  initialMessage?: string | null;
}

export function Login({ onLogged, initialMessage }: Props) {
  const [email, setEmail] = useState('');
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
      onLogged();
    } catch (err) {
      const e2 = err as LoginError;
      if (e2.code === 'LOCKED') {
        setError('Usuario bloqueado por intentos fallidos. Pedí a tu encargado que te desbloquee.');
      } else if (e2.code === 'BAD_CREDENTIALS') {
        setError(`Credenciales inválidas${typeof e2.remaining === 'number' ? ` · te ${e2.remaining === 1 ? 'queda 1 intento' : `quedan ${e2.remaining} intentos`}` : ''}`);
      } else {
        setError(e2.message || 'No se pudo iniciar sesión');
      }
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <img className="login__logo" src="/icon.svg" alt="Aragon Tech Solutions" />
        <h1 className="login__title">ARAGON POS</h1>
        <p className="login__sub">Ingresá para operar la caja</p>

        {initialMessage && !error && <p className="login__note">{initialMessage}</p>}

        <label className="field">
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          Contraseña
          <div className="pwd-wrap">
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
            <button type="button" className="pwd-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </label>

        {error && <p className="login__err">{error}</p>}

        <button className="btn btn--primary login__btn" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="login__foot">Aragon Tech Solutions · Technology for smarter fresh produce businesses</p>
    </div>
  );
}
