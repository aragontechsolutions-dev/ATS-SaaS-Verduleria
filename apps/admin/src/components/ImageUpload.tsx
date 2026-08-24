import { useState } from 'react';
import { uploadImage } from '../lib/storage';

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Texto de ayuda de la relación de aspecto sugerida. */
  hint?: string;
}

/** Sube una imagen desde el dispositivo (Supabase Storage) o pega una URL. */
export function ImageUpload({ value, onChange, hint }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="imgup">
      {value ? (
        <img className="imgup__prev" src={value} alt="" onError={() => setError('No se pudo mostrar la imagen (¿URL válida?).')} />
      ) : (
        <div className="imgup__ph">Sin imagen</div>
      )}
      <div className="imgup__row">
        <label className={`btn btn--sm btn--ghost ${busy ? 'is-busy' : ''}`}>
          {busy ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} hidden disabled={busy} />
        </label>
        {value && <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange('')}>Quitar</button>}
      </div>
      <input className="imgup__url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="o pegá una URL…" />
      {error && <p className="err">{error}</p>}
      <p className="hint">JPG, PNG o WebP · máx 3 MB.{hint ? ` ${hint}` : ''}</p>
    </div>
  );
}
