import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Shell } from './components/Shell';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="auth">
        <p style={{ color: '#fff' }}>Cargando…</p>
      </div>
    );
  }
  if (session === null) return <Login />;

  return <Shell email={session.user.email ?? ''} onLogout={() => void supabase.auth.signOut()} />;
}
