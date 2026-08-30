import { useCallback, useEffect, useState } from 'react';
import { getAuditEvents } from '../lib/api';
import type { AuditEvent } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

const TIPOS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos los eventos' },
  { value: 'LOGIN', label: 'Inicio de sesión' },
  { value: 'LOGIN_FALLIDO', label: 'Login fallido' },
  { value: 'USUARIO_BLOQUEADO', label: 'Usuario bloqueado' },
  { value: 'USUARIO_DESBLOQUEADO', label: 'Usuario desbloqueado' },
  { value: 'PASSWORD_RESET', label: 'Reset de contraseña' },
  { value: 'CAJA_ABIERTA', label: 'Caja abierta' },
  { value: 'CAJA_CERRADA', label: 'Caja cerrada' },
  { value: 'MOV_INGRESO', label: 'Ingreso de efectivo' },
  { value: 'MOV_EGRESO', label: 'Egreso de efectivo' },
  { value: 'VENTA', label: 'Venta' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'COBRANZA', label: 'Cobranza' },
  { value: 'CAJON_ABIERTO', label: 'Apertura de cajón' },
  { value: 'ANULACION_LINEA', label: 'Anulación de línea' },
  { value: 'PRECIO_MODIFICADO', label: 'Cambio de precio' },
];

const LABEL: Record<string, string> = Object.fromEntries(TIPOS.filter((t) => t.value).map((t) => [t.value, t.label]));

// Eventos "sensibles" que conviene resaltar.
const ALERTA = new Set(['LOGIN_FALLIDO', 'USUARIO_BLOQUEADO', 'ANULACION_LINEA', 'PRECIO_MODIFICADO', 'CAJON_ABIERTO']);

export function AuditoriaPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AuditEvent[] | null>(null);
  const [tipo, setTipo] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setRows(null);
    try {
      setRows(await getAuditEvents({ tipo: tipo || undefined, from: from || undefined, to: to || undefined, limit: 300 }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando la auditoría');
      setRows([]);
    }
  }, [tipo, from, to, toast]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Auditoría</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => void load()}>↻ Actualizar</button>
      </div>
      <p className="muted">Bitácora de operaciones sensibles: quién hizo qué, cuándo y en qué caja.</p>

      <div className="cat-new">
        <label className="field">Evento
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="field">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      {rows === null ? (
        <SkeletonRows rows={6} cols={4} />
      ) : rows.length === 0 ? (
        <p className="muted">Sin eventos para los filtros elegidos.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Fecha y hora</th><th>Evento</th><th>Usuario</th><th>Detalle</th><th className="num">Monto</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.fecha).toLocaleString('es-UY')}</td>
                  <td>
                    <span className={`badge ${ALERTA.has(r.tipo) ? 'badge--suspendida' : 'badge--trial'}`}>
                      {LABEL[r.tipo] ?? r.tipo}
                    </span>
                  </td>
                  <td>{r.usuario ?? '—'}</td>
                  <td>{r.descripcion ?? '—'}</td>
                  <td className="num">{r.monto != null ? money.format(r.monto) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
