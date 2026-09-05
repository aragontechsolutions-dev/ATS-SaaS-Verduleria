import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) console.warn('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');

/** Cliente de Supabase Auth para la PWA del repartidor (login del usuario REPARTIDOR). */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ats.repartidor.auth' },
});
