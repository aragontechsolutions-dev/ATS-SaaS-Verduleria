import { supabase } from './supabase';

const BUCKET = 'landing';
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Valida una imagen antes de subirla. Devuelve el mensaje de error, o null si está ok. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'La imagen debe ser JPG, PNG o WebP.';
  if (file.size > MAX_BYTES) {
    return `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es 3 MB.`;
  }
  return null;
}

/** Sube una imagen a Supabase Storage y devuelve su URL pública. */
export async function uploadImage(file: File): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(name, file, { cacheControl: '3600', upsert: false, contentType: file.type });

  if (error) {
    const msg = error.message || '';
    if (/bucket/i.test(msg) && /not found/i.test(msg)) {
      throw new Error('Falta crear el bucket "landing" en Supabase Storage (ver docs).');
    }
    throw new Error(`No se pudo subir la imagen: ${msg}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}
