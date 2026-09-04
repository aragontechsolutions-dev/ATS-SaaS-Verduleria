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
    tiendaOnlineActiva: false, cfeEmisionActiva: false,
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
          tiendaOnlineActiva: data.tiendaOnlineActiva,
          cfeEmisionActiva: data.cfe?.emisionActiva ?? false,
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

      {s && <CajaSecurityPanel settings={s} onSaved={setS} />}

      <section className="panel">
        <div className="panel__head"><h2>Tienda online</h2></div>
        <label className="field field--check">
          <input type="checkbox" checked={f.tiendaOnlineActiva} onChange={(e) => setF({ ...f, tiendaOnlineActiva: e.target.checked })} />
          Activar tienda online (e-commerce público)
        </label>
        <p className="hint">
          Publica tu catálogo online para que tus clientes vean los productos marcados como
          <strong> visibles online</strong> (en la ficha de cada producto). Los pedidos y el envío a domicilio
          se habilitan en los próximos módulos.
        </p>
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
        {!exento && (
          <>
            <label className="field field--check" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={f.cfeEmisionActiva} onChange={(e) => setF({ ...f, cfeEmisionActiva: e.target.checked })} />
              Activar emisión electrónica (FEU)
            </label>
            <p className="hint">
              Mientras esté <strong>desactivada</strong>, cada venta genera un <strong>ticket interno</strong> (no fiscal). Al activarla,
              el POS emite <strong>CFE reales</strong> vía FEU con el RUT emisor. Ambiente actual:
              <strong> {f.cfeAmbiente === 'produccion' ? 'Producción' : 'Prueba (test)'}</strong>
              {s?.cfe ? <> · Proveedor: {s.cfe.provider} · Certificado: {s.cfe.certificadoEstado}</> : null}
            </p>
          </>
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

const GATE_LABELS: Array<[string, string]> = [
  ['discount', 'Aplicar descuento'],
  ['price', 'Cambiar el precio de una línea'],
  ['void', 'Vaciar el carrito'],
  ['return', 'Registrar devolución'],
];

/** Configuración centralizada del PIN de supervisor de las cajas. */
function CajaSecurityPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const toast = useToast();
  const seg = settings.cajaSeguridad;
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [gates, setGates] = useState<Record<string, boolean>>({ ...seg.gates });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const algunGate = Object.values(gates).some(Boolean);

  async function guardar() {
    setErr(null);
    const cambiaPin = !!(pin || pin2);
    if (cambiaPin) {
      if (!/^\d{4,12}$/.test(pin)) return setErr('El PIN debe tener entre 4 y 12 dígitos.');
      if (pin !== pin2) return setErr('Los PIN no coinciden.');
    }
    if (algunGate && !seg.tienePin && !cambiaPin) return setErr('Configurá un PIN para poder exigir autorización.');
    setSaving(true);
    try {
      const data = await updateSettings({ ...(cambiaPin ? { cajaPin: pin } : {}), cajaGates: gates });
      onSaved(data);
      setPin(''); setPin2('');
      toast.success('Seguridad de caja actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function quitar() {
    if (!confirm('¿Quitar el PIN? Las cajas dejarán de pedir autorización.')) return;
    try {
      const data = await updateSettings({ cajaPinClear: true });
      onSaved(data);
      setGates({ ...data.cajaSeguridad.gates });
      toast.success('PIN quitado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo quitar el PIN');
    }
  }

  return (
    <section className="panel">
      <div className="panel__head"><h2>Seguridad de caja</h2></div>
      <p className="hint">
        Definí un <strong>PIN de supervisor</strong> y qué acciones sensibles del POS lo exigen. Se aplica a
        <strong> todas las cajas</strong> del negocio y funciona sin conexión. El cajero ya no lo configura en la caja.
      </p>
      <div className="form-grid">
        <label className="field">{seg.tienePin ? 'Nuevo PIN' : 'PIN'}
          <input type="password" inputMode="numeric" autoComplete="new-password" value={pin}
            onChange={(e) => { setPin(e.target.value); setErr(null); }}
            placeholder={seg.tienePin ? 'Dejar vacío = sin cambios' : '4 a 12 dígitos'} />
        </label>
        <label className="field">Repetir PIN
          <input type="password" inputMode="numeric" autoComplete="new-password" value={pin2}
            onChange={(e) => { setPin2(e.target.value); setErr(null); }} />
        </label>
      </div>
      {seg.tienePin && <p className="hint">✅ Hay un PIN configurado. Dejá los campos vacíos para conservarlo.</p>}

      <p className="hint" style={{ margin: '10px 0 4px' }}>Acciones que exigen PIN:</p>
      {GATE_LABELS.map(([k, label]) => (
        <label key={k} className="field field--check">
          <input type="checkbox" checked={!!gates[k]} onChange={(e) => setGates((g) => ({ ...g, [k]: e.target.checked }))} />
          {label}
        </label>
      ))}

      {err && <div className="banner banner--err">{err}</div>}
      <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn--primary" onClick={() => void guardar()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar seguridad'}
        </button>
        {seg.tienePin && <button type="button" className="btn btn--ghost" onClick={() => void quitar()}>Quitar PIN</button>}
      </div>
    </section>
  );
}
