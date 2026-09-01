import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../lib/api';
import type { RegimenFiscal, Settings } from '../lib/api';
import { Spinner } from './Skeleton';
import { useToast } from '../lib/toast';

const REGIMENES: Array<{ v: RegimenFiscal; label: string }> = [
  { v: 'LITERAL_E', label: 'Literal E (IVA mínimo) — emite CFE' },
  { v: 'IVA_MINIMO', label: 'IVA Mínimo — emite CFE' },
  { v: 'REGIMEN_GENERAL', label: 'Régimen General (IRAE) — emite CFE' },
  { v: 'MONOTRIBUTO', label: 'Monotributo — exento de CFE' },
  { v: 'MONOTRIBUTO_MIDES', label: 'Monotributo MIDES — exento de CFE' },
];

export function SettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Campos del formulario
  const [f, setF] = useState({
    nombre: '', razonSocial: '', rut: '', regimenFiscal: 'LITERAL_E' as RegimenFiscal,
    direccion: '', telefono: '', email: '', cfeAmbiente: 'test' as 'test' | 'produccion',
    emisorRut: '', sucursalDefault: 1, limiteEfectivoCaja: '',
    loyaltyActivo: false, loyaltyAcumulaCada: '', loyaltyValorPunto: '',
  });

  useEffect(() => {
    getSettings()
      .then((data) => {
        setS(data);
        setF({
          nombre: data.nombre ?? '',
          razonSocial: data.razonSocial ?? '',
          rut: data.rut ?? '',
          regimenFiscal: data.regimenFiscal,
          direccion: data.direccion ?? '',
          telefono: data.telefono ?? '',
          email: data.email ?? '',
          cfeAmbiente: data.cfe?.ambiente ?? 'test',
          emisorRut: data.cfe?.emisorRut ?? '',
          sucursalDefault: data.cfe?.sucursalDefault ?? 1,
          limiteEfectivoCaja: data.limiteEfectivoCaja != null ? String(data.limiteEfectivoCaja) : '',
          loyaltyActivo: data.loyaltyActivo,
          loyaltyAcumulaCada: data.loyaltyAcumulaCada ? String(data.loyaltyAcumulaCada) : '',
          loyaltyValorPunto: data.loyaltyValorPunto ? String(data.loyaltyValorPunto) : '',
        });
      })
      .catch((e) => { const m = e instanceof Error ? e.message : String(e); setError(m); toast.error(m); });
  }, [toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { limiteEfectivoCaja, loyaltyAcumulaCada, loyaltyValorPunto, ...rest } = f;
      const data = await updateSettings({
        ...rest,
        sucursalDefault: Number(f.sucursalDefault),
        limiteEfectivoCaja: limiteEfectivoCaja.trim() ? Number(limiteEfectivoCaja.replace(',', '.')) : 0,
        loyaltyAcumulaCada: loyaltyAcumulaCada.trim() ? Number(loyaltyAcumulaCada.replace(',', '.')) : 0,
        loyaltyValorPunto: loyaltyValorPunto.trim() ? Number(loyaltyValorPunto.replace(',', '.')) : 0,
      });
      setS(data);
      toast.success('Cambios guardados correctamente');
    } catch (err) {
      const m = err instanceof Error ? err.message : 'No se pudo guardar';
      setError(m);
      toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (!s && !error) return <p className="loading-row"><Spinner /> Cargando ajustes…</p>;

  const exento = f.regimenFiscal === 'MONOTRIBUTO' || f.regimenFiscal === 'MONOTRIBUTO_MIDES';

  return (
    <form onSubmit={submit}>
      {error && <div className="banner banner--err">{error}</div>}

      <section className="panel">
        <div className="panel__head"><h2>Datos del negocio</h2></div>
        <div className="form-grid">
          <label className="field">Nombre comercial
            <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
          </label>
          <label className="field">Razón social
            <input value={f.razonSocial} onChange={(e) => setF({ ...f, razonSocial: e.target.value })} />
          </label>
          <label className="field">RUT
            <input value={f.rut} onChange={(e) => setF({ ...f, rut: e.target.value })} placeholder="12 dígitos" />
          </label>
          <label className="field">Régimen fiscal
            <select value={f.regimenFiscal} onChange={(e) => setF({ ...f, regimenFiscal: e.target.value as RegimenFiscal })}>
              {REGIMENES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </label>
          <label className="field">Dirección
            <input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
          </label>
          <label className="field">Teléfono
            <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          </label>
          <label className="field">Email
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Caja</h2></div>
        <div className="form-grid">
          <label className="field">Límite de efectivo en caja
            <input
              type="number"
              min={0}
              step="1"
              value={f.limiteEfectivoCaja}
              onChange={(e) => setF({ ...f, limiteEfectivoCaja: e.target.value })}
              placeholder="0 = sin límite"
            />
          </label>
        </div>
        <p className="hint">Cuando el efectivo en el cajón supera este monto, el POS le sugiere al cajero hacer una sangría (retiro a la caja fuerte). Dejalo en 0 para no controlar el límite.</p>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Fidelización (puntos)</h2></div>
        <label className="field field--check">
          <input type="checkbox" checked={f.loyaltyActivo} onChange={(e) => setF({ ...f, loyaltyActivo: e.target.checked })} />
          Activar programa de puntos
        </label>
        {f.loyaltyActivo && (
          <div className="form-grid">
            <label className="field">Acumula 1 punto cada ($)
              <input type="number" min={0} step="1" value={f.loyaltyAcumulaCada} onChange={(e) => setF({ ...f, loyaltyAcumulaCada: e.target.value })} placeholder="ej. 100" />
            </label>
            <label className="field">Valor de 1 punto al canjear ($)
              <input type="number" min={0} step="0.01" value={f.loyaltyValorPunto} onChange={(e) => setF({ ...f, loyaltyValorPunto: e.target.value })} placeholder="ej. 1" />
            </label>
          </div>
        )}
        <p className="hint">Ej.: acumula cada $100 y punto = $1 → una compra de $500 da 5 puntos, y 100 puntos valen $100 al canjear en la caja. El cliente debe estar identificado.</p>
      </section>

      <section className="panel">
        <div className="panel__head"><h2>Facturación electrónica (CFE)</h2></div>
        {exento ? (
          <p className="muted">
            Con este régimen la verdulería está <strong>exenta de CFE</strong>: el POS emite ticket
            interno (no fiscal). No hace falta configurar facturación.
          </p>
        ) : (
          <div className="form-grid">
            <label className="field">RUT emisor (X-Emisor)
              <input value={f.emisorRut} onChange={(e) => setF({ ...f, emisorRut: e.target.value })} placeholder="usa el RUT del negocio" />
            </label>
            <label className="field">Ambiente
              <select value={f.cfeAmbiente} onChange={(e) => setF({ ...f, cfeAmbiente: e.target.value as 'test' | 'produccion' })}>
                <option value="test">Prueba (test)</option>
                <option value="produccion">Producción</option>
              </select>
            </label>
            <label className="field">Sucursal por defecto
              <input type="number" min={1} value={f.sucursalDefault} onChange={(e) => setF({ ...f, sucursalDefault: Number(e.target.value) })} />
            </label>
          </div>
        )}
        {s?.cfe && !exento && (
          <p className="hint">Proveedor: {s.cfe.provider} · Certificado: {s.cfe.certificadoEstado}</p>
        )}
      </section>

      <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
