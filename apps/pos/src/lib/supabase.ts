import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) {
  // No rompemos el bundle, pero avisamos: sin esto el login no funciona.
  console.warn('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

/**
 * Cliente de Supabase Auth. Persiste la sesión en localStorage y refresca el
 * token automáticamente. El POS usa signInWithPassword y manda el access token
 * de Supabase al backend, que lo verifica y resuelve el tenant.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ats.supabase.auth',
  },
});
