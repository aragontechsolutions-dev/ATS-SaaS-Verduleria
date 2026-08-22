import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(authError.message.toLowerCase().includes('invalid') ? 'Credenciales inválidas' : authError.message);
      setLoading(false);
    }
    // onAuthStateChange en App cambia la vista al entrar.
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <img className="auth__logo" src="/icon.svg" alt="Aragon" />
        <h1 className="auth__title">Consola Aragon</h1>
        <p className="auth__sub">Panel de plataforma</p>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="auth__foot">Aragon Tech Solutions · Consola de plataforma</p>
    </div>
  );
}
