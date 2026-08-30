import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { login, type LoginError } from '../lib/api';

export function Login() {
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
      // onAuthStateChange en App detecta la sesión.
    } catch (err) {
      const e2 = err as LoginError;
      if (e2.code === 'LOCKED') {
        setError('Usuario bloqueado por intentos fallidos. Desbloquealo desde Usuarios (o pedí al soporte de Aragon si sos el admin).');
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
        <h1 className="auth__title">Administración</h1>
        <p className="auth__sub">Panel de tu verdulería</p>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          Contraseña
          <div className="pwd-wrap">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="pwd-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="auth__foot">Aragon Tech Solutions · Panel de administración</p>
    </div>
  );
}
