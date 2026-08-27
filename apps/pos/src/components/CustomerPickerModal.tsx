import { useEffect, useState } from 'react';
import type { PosCustomer, TipoDocumentoCliente } from '../lib/types';
import { esEfactura } from '../lib/types';
import { quickCreateCustomer, searchCustomers } from '../lib/api';

interface Props {
  onPick: (c: PosCustomer) => void;
  onClose: () => void;
}

const DOCS: Array<{ value: TipoDocumentoCliente; label: string }> = [
  { value: 'CI', label: 'CI' },
  { value: 'RUC', label: 'RUC (e-Factura)' },
  { value: 'OTROS', label: 'Otro' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
];

const docLabel = (c: PosCustomer) => (c.documento ? `${c.tipoDocumento} ${c.documento}` : 'Sin documento');

/** Identificación del comprador: buscar un cliente o darlo de alta al vuelo. */
export function CustomerPickerModal({ onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PosCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  // Búsqueda con debounce.
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((r) => { if (vivo) { setRows(r); setError(null); } })
        .catch(() => { if (vivo) setError('No se pudo buscar (¿sin conexión?).'); })
        .finally(() => { if (vivo) setLoading(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="modal-backdrop">
      <div className="modal modal--wide">
        <h3>Identificar comprador</h3>
        <p className="modal__sub">Para e-Factura (RUC) o e-Ticket &gt; 5.000 UI. Opcional en ventas chicas.</p>

        {creando ? (
          <QuickCreate
            onCreated={onPick}
            onCancel={() => setCreando(false)}
            initial={q}
          />
        ) : (
          <>
            <label className="field">
              Buscar por nombre, documento o razón social
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: Rodríguez, 12345678…" autoFocus />
            </label>

            {error && <p className="modal__hint modal__hint--warn">{error}</p>}
            {loading && <p className="modal__hint">Buscando…</p>}

            <div className="cust-list">
              {!loading && rows.length === 0 && <p className="empty">Sin resultados. Podés darlo de alta.</p>}
              {rows.map((c) => (
                <button key={c.id} className="cust-row" onClick={() => onPick(c)}>
                  <span className="cust-row__name">
                    {c.nombre}
                    {esEfactura(c) && <span className="cust-row__tag">e-Factura</span>}
                  </span>
                  <span className="cust-row__doc">{docLabel(c)}</span>
                </button>
              ))}
            </div>

            <div className="modal__actions modal__actions--wrap">
              <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn--primary" onClick={() => setCreando(true)}>+ Nuevo comprador</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuickCreate({
  onCreated,
  onCancel,
  initial,
}: {
  onCreated: (c: PosCustomer) => void;
  onCancel: () => void;
  initial: string;
}) {
  // Si lo tipeado en la búsqueda son solo dígitos, lo tomamos como documento.
  const soloDigitos = /^\d+$/.test(initial.trim());
  const [nombre, setNombre] = useState(soloDigitos ? '' : initial.trim());
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoCliente>('CI');
  const [documento, setDocumento] = useState(soloDigitos ? initial.trim() : '');
  const [razonSocial, setRazonSocial] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRuc = tipoDocumento === 'RUC';
  const valido = nombre.trim().length >= 2 && documento.trim().length >= 3;

  async function guardar() {
    if (!valido || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const c = await quickCreateCustomer({
        nombre: nombre.trim(),
        tipoDocumento,
        documento: documento.trim(),
        razonSocial: razonSocial.trim() || undefined,
      });
      onCreated(c);
    } catch {
      setError('No se pudo crear (¿sin conexión?). Requiere estar en línea.');
      setGuardando(false);
    }
  }

  return (
    <div className="cust-new">
      <label className="field">
        Nombre / razón social
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del comprador" autoFocus />
      </label>
      <div className="row2">
        <label className="field">
          Documento
          <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as TipoDocumentoCliente)}>
            {DOCS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Número
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} inputMode="numeric" placeholder={esRuc ? 'RUC' : 'Cédula'} />
        </label>
      </div>
      {esRuc && (
        <label className="field">
          Razón social (opcional)
          <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Razón social para la e-Factura" />
        </label>
      )}
      {esRuc && <p className="modal__hint">Con RUC se emite <strong>e-Factura</strong>.</p>}
      {error && <p className="modal__hint modal__hint--warn">{error}</p>}
      <div className="modal__actions modal__actions--wrap">
        <button className="btn btn--ghost" onClick={onCancel} disabled={guardando}>Volver</button>
        <button className="btn btn--primary" onClick={guardar} disabled={!valido || guardando}>
          {guardando ? 'Guardando…' : 'Usar este comprador'}
        </button>
      </div>
    </div>
  );
}
