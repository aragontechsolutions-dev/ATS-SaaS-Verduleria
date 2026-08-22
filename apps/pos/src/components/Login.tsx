import { useState } from 'react';
import { login, setToken } from '../lib/api';
import type { LoginResponse } from '../lib/api';

interface Props {
  onLogged: (session: LoginResponse) => void;
}

export function Login({ onLogged }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email.trim(), password);
      setToken(res.accessToken);
      onLogged(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <img className="login__logo" src="/icon.svg" alt="Aragon Tech Solutions" />
        <h1 className="login__title">ARAGON POS</h1>
        <p className="login__sub">Ingresá para operar la caja</p>

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
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
          />
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
