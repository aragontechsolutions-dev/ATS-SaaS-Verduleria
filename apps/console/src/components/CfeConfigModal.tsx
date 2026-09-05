import { useEffect, useState } from 'react';
import { getTenantCfe, updateTenantCfe } from '../lib/api';
import type { CertificadoEstado, CfeConfig, RegimenFiscal, TenantRow } from '../lib/api';

interface Props {
  tenant: TenantRow;
  onClose: () => void;
  onSaved?: () => void;
}

const REGIMENES: Array<{ v: RegimenFiscal; label: string }> = [
  { v: 'LITERAL_E', label: 'Literal E (IVA mínimo) — emite CFE' },
  { v: 'IVA_MINIMO', label: 'IVA Mínimo — emite CFE' },
  { v: 'REGIMEN_GENERAL', label: 'Régimen General (IRAE) — emite CFE' },
  { v: 'MONOTRIBUTO', label: 'Monotributo — exento de CFE' },
  { v: 'MONOTRIBUTO_MIDES', label: 'Monotributo MIDES — exento de CFE' },
];

const CERTIFICADOS: CertificadoEstado[] = ['SIN_CARGAR', 'VIGENTE', 'POR_VENCER', 'VENCIDO'];

export function CfeConfigModal({ tenant, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regimenFiscal, setRegimen] = useState<RegimenFiscal>('LITERAL_E');
  const [rut, setRut] = useState('');
  const [emisorRut, setEmisorRut] = useState('');
  const [ambiente, setAmbiente] = useState<'test' | 'produccion'>('test');
  const [sucursalDefault, setSucursal] = useState(1);
  const [certificadoEstado, setCertificado] = useState<CertificadoEstado>('SIN_CARGAR');
  const [emisionActiva, setEmision] = useState(false);
  const [confirmarProduccion, setConfirmar] = useState(false);

  // Estado tal como está persistido (para saber si "prende" prod ahora).
  const [inicial, setInicial] = useState<CfeConfig['cfe'] | null>(null);

  useEffect(() => {
    getTenantCfe(tenant.id)
      .then((c) => {
        setRegimen(c.regimenFiscal);
        setRut(c.rut ?? '');
        setEmisorRut(c.cfe.emisorRut);
        setAmbiente(c.cfe.ambiente);
        setSucursal(c.cfe.sucursalDefault);
        setCertificado(c.cfe.certificadoEstado);
        setEmision(c.cfe.emisionActiva);
        setInicial(c.cfe);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [tenant.id]);

  const exento = regimenFiscal === 'MONOTRIBUTO' || regimenFiscal === 'MONOTRIBUTO_MIDES';
  const yaEnProd = !!inicial && inicial.ambiente === 'produccion' && inicial.emisionActiva;
  // ¿Se está PRENDIENDO la emisión en producción en este guardado?
  const prendiendoProd = !exento && emisionActiva && ambiente === 'produccion' && !yaEnProd;
  const certOk = certificadoEstado === 'VIGENTE';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateTenantCfe(tenant.id, {
        regimenFiscal,
        rut: rut.trim(),
        emisorRut: emisorRut.trim(),
        ambiente,
        sucursalDefault,
        emisionActiva,
        certificadoEstado,
        confirmarProduccion: prendiendoProd ? confirmarProduccion : undefined,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(ev) => ev.stopPropagation()} onSubmit={submit}>
        <h3>Config fiscal · {tenant.nombre}</h3>
        <p className="muted">Configuración de facturación electrónica (CFE). Solo Aragon la edita.</p>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            <label className="field">
              Régimen fiscal
              <select value={regimenFiscal} onChange={(e) => setRegimen(e.target.value as RegimenFiscal)}>
                {REGIMENES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
            </label>

            {exento ? (
              <p className="warn">
                Con este régimen la verdulería está <strong>exenta de CFE</strong>: el POS emite ticket interno
                (no fiscal). No hay emisión electrónica que configurar.
              </p>
            ) : (
              <>
                <div className="row2">
                  <label className="field">
                    RUT
                    <input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12 dígitos" />
                  </label>
                  <label className="field">
                    RUT emisor (X-Emisor)
                    <input value={emisorRut} onChange={(e) => setEmisorRut(e.target.value)} placeholder="por defecto = RUT" />
                  </label>
                </div>
                <div className="row2">
                  <label className="field">
                    Ambiente
                    <select value={ambiente} onChange={(e) => setAmbiente(e.target.value as 'test' | 'produccion')}>
                      <option value="test">Prueba (test)</option>
                      <option value="produccion">Producción</option>
                    </select>
                  </label>
                  <label className="field">
                    Sucursal por defecto
                    <input type="number" min={1} value={sucursalDefault} onChange={(e) => setSucursal(Number(e.target.value))} />
                  </label>
                </div>
                <label className="field">
                  Estado del certificado
                  <select value={certificadoEstado} onChange={(e) => setCertificado(e.target.value as CertificadoEstado)}>
                    {CERTIFICADOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <label className="field field--check">
                  <input type="checkbox" checked={emisionActiva} onChange={(e) => setEmision(e.target.checked)} />
                  Activar emisión electrónica (FEU)
                </label>

                {prendiendoProd && (
                  <div className="warn" style={{ display: 'grid', gap: 6 }}>
                    <strong>⚠️ Vas a activar la emisión en PRODUCCIÓN.</strong>
                    <span>El POS empezará a emitir CFE reales ante DGI. Verificá:</span>
                    <ul style={{ margin: '2px 0 0 18px' }}>
                      <li>{emisorRut.trim() ? '✅' : '❌'} RUT emisor cargado</li>
                      <li>{certOk ? '✅' : '❌'} Certificado vigente</li>
                      <li>Se hizo al menos una emisión de prueba en test</li>
                    </ul>
                    <label className="field field--check" style={{ marginTop: 4 }}>
                      <input type="checkbox" checked={confirmarProduccion} onChange={(e) => setConfirmar(e.target.checked)} />
                      Confirmo el paso a producción
                    </label>
                  </div>
                )}
              </>
            )}

            {error && <p className="err">{error}</p>}
          </>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || loading || (prendiendoProd && !confirmarProduccion)}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
