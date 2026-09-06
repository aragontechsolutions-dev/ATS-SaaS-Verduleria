import { useState } from 'react';
import { setDescuento } from '../lib/api';
import type { TenantRow } from '../lib/api';

interface Props {
  tenant: TenantRow;
  onClose: () => void;
  onSaved: () => void;
}

/** Fecha de hoy + n meses, en YYYY-MM-DD. */
function enMeses(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function DescuentoModal({ tenant, onClose, onSaved }: Props) {
  const [pct, setPct] = useState(tenant.descuento?.pct ?? 50);
  const [hasta, setHasta] = useState(tenant.descuento?.hasta ?? enMeses(12));
  const [motivo, setMotivo] = useState(tenant.descuento?.motivo ?? 'Fundadores de Maldonado');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(quitar = false) {
    setSaving(true);
    setError(null);
    try {
      await setDescuento(tenant.id, quitar ? { pct: null, hasta: null, motivo: null } : { pct, hasta: hasta || null, motivo });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Descuento · {tenant.nombre}</h3>
        <p className="muted">Se aplica sobre el precio del plan al generar cada factura, mientras esté vigente.</p>

        <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => { setPct(50); setHasta(enMeses(12)); setMotivo('Fundadores de Maldonado'); }}>
          🎉 Preset: Fundadores 50% · 12 meses
        </button>

        <div className="row2">
          <label className="field">
            Descuento (%)
            <input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          </label>
          <label className="field">
            Vigente hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Motivo
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Fundadores de Maldonado" />
        </label>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Dejá "Vigente hasta" vacío para un descuento sin vencimiento. El % se aplica a las facturas cuyo período esté dentro de la vigencia.
        </p>

        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          {tenant.descuento && (
            <button type="button" className="btn btn--ghost" onClick={() => void guardar(true)} disabled={saving}>Quitar descuento</button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={() => void guardar(false)} disabled={saving || pct <= 0}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
