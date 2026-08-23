import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../lib/api';
import type { RegimenFiscal, Settings } from '../lib/api';

const REGIMENES: Array<{ v: RegimenFiscal; label: string }> = [
  { v: 'LITERAL_E', label: 'Literal E (IVA mínimo) — emite CFE' },
  { v: 'IVA_MINIMO', label: 'IVA Mínimo — emite CFE' },
  { v: 'REGIMEN_GENERAL', label: 'Régimen General (IRAE) — emite CFE' },
  { v: 'MONOTRIBUTO', label: 'Monotributo — exento de CFE' },
  { v: 'MONOTRIBUTO_MIDES', label: 'Monotributo MIDES — exento de CFE' },
];

export function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos del formulario
  const [f, setF] = useState({
    nombre: '', razonSocial: '', rut: '', regimenFiscal: 'LITERAL_E' as RegimenFiscal,
    direccion: '', telefono: '', email: '', cfeAmbiente: 'test' as 'test' | 'produccion',
    emisorRut: '', sucursalDefault: 1,
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
        });
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(false);
    try {
      const data = await updateSettings({ ...f, sucursalDefault: Number(f.sucursalDefault) });
      setS(data);
      setOkMsg(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!s && !error) return <p className="muted">Cargando…</p>;

  const exento = f.regimenFiscal === 'MONOTRIBUTO' || f.regimenFiscal === 'MONOTRIBUTO_MIDES';

  return (
    <form onSubmit={submit}>
      {error && <div className="banner banner--err">{error}</div>}
      {okMsg && <div className="banner banner--ok">Cambios guardados ✓</div>}

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
