import { useCallback, useEffect, useState } from 'react';
import {
  addCustomerCharge,
  addCustomerPayment,
  createCustomer,
  getCustomerAccount,
  getCustomers,
} from '../lib/api';
import type { Customer, CustomerAccount } from '../lib/api';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

export function MayoristasPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await getCustomers());
      setLocked(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.includes('permisos') || msg.includes('plan') || msg.includes('403')) setLocked(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(m: string) {
    setOkMsg(m);
    window.setTimeout(() => setOkMsg(null), 3000);
  }

  if (locked) {
    return (
      <section className="panel">
        <div className="panel__head"><h2>Mayoristas</h2></div>
        <p className="muted">La cuenta corriente de mayoristas está disponible en el plan Pro o Full.</p>
      </section>
    );
  }

  const totalDeuda = rows.reduce((s, c) => s + Math.max(0, c.saldo), 0);

  return (
    <>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">{okMsg}</div>}

      <section className="panel">
        <div className="panel__head">
          <h2>Mayoristas — cuenta corriente</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="pill">Deuda total: {money.format(totalDeuda)}</span>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>+ Nuevo cliente</button>
          </div>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>RUC / Doc.</th>
                  <th className="num">Saldo</th>
                  <th className="num">Límite</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={c.activo ? '' : 'row--off'}>
                    <td><strong>{c.nombre}</strong>{c.razonSocial && <span className="muted"> · {c.razonSocial}</span>}</td>
                    <td>{c.documento ?? '—'}</td>
                    <td className="num"><span className={c.saldo > 0 ? 'mrg mrg--bad' : 'muted'}>{money.format(c.saldo)}</span></td>
                    <td className="num">{c.limiteCredito > 0 ? money.format(c.limiteCredito) : '—'}</td>
                    <td className="num"><button className="btn btn--sm btn--ghost" onClick={() => setSelId(c.id)}>Cuenta</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="muted">Sin clientes mayoristas. Creá el primero.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Las ventas cobradas con “cuenta corriente” en el POS cargan acá el saldo del cliente automáticamente.</p>
      </section>

      {creating && <NewCustomerModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
      {selId && (
        <AccountModal
          customerId={selId}
          onClose={() => setSelId(null)}
          onChanged={() => void load()}
          flash={flash}
        />
      )}
    </>
  );
}

function NewCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [limite, setLimite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await createCustomer({
        nombre: nombre.trim(),
        esMayorista: true,
        tipoDocumento: 'RUC',
        documento: documento || undefined,
        telefono: telefono || undefined,
        limiteCredito: limite ? parseFloat(limite) : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Nuevo cliente mayorista</h3>
        <label className="field">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required /></label>
        <div className="row2">
          <label className="field">RUC<input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="21…" /></label>
          <label className="field">Teléfono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></label>
        </div>
        <label className="field">Límite de crédito ($)<input type="number" step="1" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="0 = sin límite" /></label>
        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</button>
        </div>
      </form>
    </div>
  );
}

function AccountModal({
  customerId,
  onClose,
  onChanged,
  flash,
}: {
  customerId: string;
  onClose: () => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [acc, setAcc] = useState<CustomerAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'cobranza' | 'cargo' | null>(null);
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setAcc(await getCustomerAccount(customerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [customerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(monto);
    if (Number.isNaN(n) || n <= 0) return;
    setSaving(true);
    try {
      if (mode === 'cobranza') {
        await addCustomerPayment(customerId, { monto: n, concepto: concepto || undefined });
        flash(`Cobranza registrada: ${money.format(n)}.`);
      } else {
        await addCustomerCharge(customerId, { monto: n, concepto: concepto || undefined });
        flash(`Cargo registrado: ${money.format(n)}.`);
      }
      setMode(null);
      setMonto('');
      setConcepto('');
      await reload();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        {!acc ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            <div className="panel__head" style={{ marginBottom: 6 }}>
              <h3>{acc.customer.nombre}</h3>
              <button className="btn btn--sm btn--ghost" onClick={onClose}>Cerrar</button>
            </div>
            {error && <div className="banner banner--err">{error}</div>}

            <section className="tiles" style={{ marginBottom: 14 }}>
              <div className="tile"><span className="tile__label">Saldo</span><span className="tile__value">{money.format(acc.saldo)}</span></div>
              <div className="tile"><span className="tile__label">Límite</span><span className="tile__value">{acc.limiteCredito > 0 ? money.format(acc.limiteCredito) : '—'}</span></div>
              <div className="tile"><span className="tile__label">Disponible</span><span className="tile__value">{acc.disponible != null ? money.format(acc.disponible) : '—'}</span></div>
            </section>

            {mode ? (
              <form className="cat-new" onSubmit={submit}>
                <input className="search" type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={`Monto de ${mode}`} autoFocus />
                <input className="search" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto (opcional)" />
                <button className={`btn ${mode === 'cobranza' ? 'btn--primary' : 'btn--danger'}`} type="submit" disabled={saving}>{saving ? '…' : 'Confirmar'}</button>
                <button className="btn btn--ghost" type="button" onClick={() => setMode(null)}>Cancelar</button>
              </form>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button className="btn btn--primary" onClick={() => setMode('cobranza')}>Registrar cobranza</button>
                <button className="btn btn--ghost" onClick={() => setMode('cargo')}>Registrar cargo</button>
              </div>
            )}

            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {acc.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.fecha).toLocaleDateString('es-UY')}</td>
                      <td>{m.concepto ?? (m.tipo === 'PAGO' ? 'Cobranza' : 'Cargo')}</td>
                      <td className="num"><span className={m.tipo === 'PAGO' ? 'mrg mrg--ok' : ''}>{money.format(m.monto)}</span></td>
                    </tr>
                  ))}
                  {acc.movimientos.length === 0 && <tr><td colSpan={3} className="muted">Sin movimientos.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
