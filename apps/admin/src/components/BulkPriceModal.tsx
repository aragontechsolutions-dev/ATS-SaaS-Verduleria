import { useState } from 'react';
import { bulkPrices } from '../lib/api';
import type { Categoria } from '../lib/api';

interface Props {
  categorias: Categoria[];
  onClose: () => void;
  onDone: (actualizados: number) => void;
}

export function BulkPriceModal({ categorias, onClose, onDone }: Props) {
  const [operacion, setOperacion] = useState<'PORCENTAJE' | 'FIJO'>('PORCENTAJE');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [redondear, setRedondear] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await bulkPrices({
        operacion,
        valor: parseFloat(valor) || 0,
        categoriaId: categoriaId || undefined,
        redondear: redondear ? parseFloat(redondear) : undefined,
      });
      onDone(r.actualizados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Actualizar precios en masa</h3>
        <p className="modal__sub">Ajustá los precios de mostrador de un saque.</p>

        <div className="segmented">
          <button type="button" className={`seg ${operacion === 'PORCENTAJE' ? 'seg--on' : ''}`} onClick={() => setOperacion('PORCENTAJE')}>Por porcentaje</button>
          <button type="button" className={`seg ${operacion === 'FIJO' ? 'seg--on' : ''}`} onClick={() => setOperacion('FIJO')}>Precio fijo</button>
        </div>

        <div className="row2">
          <label className="field">
            {operacion === 'PORCENTAJE' ? 'Variación (%)' : 'Precio ($)'}
            <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={operacion === 'PORCENTAJE' ? 'ej. 10 o -5' : 'ej. 99'} required />
          </label>
          <label className="field">
            Redondear a
            <select value={redondear} onChange={(e) => setRedondear(e.target.value)}>
              <option value="">Sin redondeo</option>
              <option value="1">$1</option>
              <option value="5">$5</option>
              <option value="10">$10</option>
            </select>
          </label>
        </div>
        <label className="field">
          Aplicar a
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todos los productos</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>Solo {c.nombre}</option>)}
          </select>
        </label>

        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Aplicando…' : 'Aplicar'}</button>
        </div>
      </form>
    </div>
  );
}
