import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Repartidor } from './components/Repartidor';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="center">
        <span className="spinner" />
      </div>
    );
  }
  if (session === null) return <Login />;

  return <Repartidor email={session.user.email ?? ''} onLogout={() => void supabase.auth.signOut()} />;
}
