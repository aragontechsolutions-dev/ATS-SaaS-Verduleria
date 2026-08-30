import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCashOperations, getTerminals, getUsers } from '../lib/api';
import type { CashOperation, TenantUser, Terminal } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { CajasManager } from './CajasPage';
import { ArqueosView } from './ArqueosPage';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

const TIPO_META: Record<string, { label: string; cls: string; signo: number }> = {
  VENTA: { label: 'Venta', cls: 'op--venta', signo: 1 },
  INGRESO: { label: 'Ingreso', cls: 'op--ingreso', signo: 1 },
  EGRESO: { label: 'Egreso', cls: 'op--egreso', signo: -1 },
  SANGRIA: { label: 'Sangría', cls: 'op--egreso', signo: -1 },
  APERTURA: { label: 'Apertura', cls: 'op--apertura', signo: 0 },
  CIERRE: { label: 'Cierre', cls: 'op--cierre', signo: 0 },
};

const TIPOS = ['', 'VENTA', 'INGRESO', 'EGRESO', 'SANGRIA', 'APERTURA', 'CIERRE'];
const REFRESH_MS = 12_000;

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CajaPage() {
  const toast = useToast();
  const [ops, setOps] = useState<CashOperation[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(hoyISO());
  const [to, setTo] = useState(hoyISO());
  const [userId, setUserId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [tipo, setTipo] = useState('');
  const [live, setLive] = useState(true);
  const [ultima, setUltima] = useState<Date | null>(null);
  // Sub-vista del módulo: histórico, arqueos por caja o gestión de cajas.
  const [vista, setVista] = useState<'operaciones' | 'arqueos' | 'cajas'>('operaciones');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getCashOperations({
          from: from ? `${from}T00:00:00` : undefined,
          to: to ? `${to}T23:59:59` : undefined,
          userId: userId || undefined,
          terminalId: terminalId || undefined,
        });
        setOps(data);
        setUltima(new Date());
      } catch (e) {
        if (!silent) toast.error(e instanceof Error ? e.message : 'Error cargando operaciones');
      } finally {
        setLoading(false);
      }
    },
    [from, to, userId, terminalId, toast],
  );

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    getTerminals().then(setTerminals).catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Tiempo real: refresca en segundo plano cada pocos segundos (solo en el histórico).
  useEffect(() => {
    if (!live || vista !== 'operaciones') return;
    const t = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [live, vista, load]);

  const filtradas = useMemo(() => (tipo ? ops.filter((o) => o.tipo === tipo) : ops), [ops, tipo]);

  const totales = useMemo(() => {
    let ventas = 0;
    let ingresos = 0;
    let egresos = 0;
    for (const o of ops) {
      if (o.tipo === 'VENTA') ventas += o.monto;
      else if (o.tipo === 'INGRESO') ingresos += o.monto;
      else if (o.tipo === 'EGRESO') egresos += o.monto;
    }
    return { ventas, ingresos, egresos };
  }, [ops]);

  return (
    <>
      <div className="segmented">
        <button className={`seg ${vista === 'operaciones' ? 'seg--on' : ''}`} onClick={() => setVista('operaciones')}>Operaciones</button>
        <button className={`seg ${vista === 'arqueos' ? 'seg--on' : ''}`} onClick={() => setVista('arqueos')}>Arqueos</button>
        <button className={`seg ${vista === 'cajas' ? 'seg--on' : ''}`} onClick={() => setVista('cajas')}>Cajas</button>
      </div>

      {vista === 'cajas' ? (
        <CajasManager />
      ) : vista === 'arqueos' ? (
        <ArqueosView />
      ) : (
        <>
      <section className="tiles">
        <div className="tile"><span className="tile__label">Ventas</span><span className="tile__value">{money.format(totales.ventas)}</span></div>
        <div className="tile"><span className="tile__label">Ingresos de caja</span><span className="tile__value">{money.format(totales.ingresos)}</span></div>
        <div className="tile"><span className="tile__label">Egresos de caja</span><span className="tile__value">{money.format(totales.egresos)}</span></div>
        <div className="tile"><span className="tile__label">Operaciones</span><span className="tile__value">{ops.length}</span></div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Operaciones de caja</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {ultima && <span className="muted" style={{ fontSize: 12 }}>Actualizado {ultima.toLocaleTimeString('es-UY')}</span>}
            <label className="chk"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> En vivo</label>
            <button className="btn btn--ghost btn--sm" onClick={() => void load()}>↻ Actualizar</button>
          </div>
        </div>

        <div className="cat-new">
          <label className="field">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field">Usuario
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.userId} value={u.userId}>{u.nombre}</option>)}
            </select>
          </label>
          {terminals.length > 0 && (
            <label className="field">Caja
              <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
                <option value="">Todas</option>
                {terminals.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.sucursalNombre}</option>)}
              </select>
            </label>
          )}
          <label className="field">Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t} value={t}>{t ? TIPO_META[t].label : 'Todos'}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <SkeletonRows rows={8} cols={5} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Fecha y hora</th><th>Tipo</th><th>Detalle</th><th>Caja</th><th>Usuario</th><th>Medio</th><th className="num">Monto</th></tr>
              </thead>
              <tbody>
                {filtradas.map((o) => {
                  const meta = TIPO_META[o.tipo];
                  return (
                    <tr key={o.id}>
                      <td>{new Date(o.fecha).toLocaleString('es-UY')}</td>
                      <td><span className={`op ${meta.cls}`}>{meta.label}</span></td>
                      <td>{o.descripcion}</td>
                      <td>{o.terminal ?? '—'}</td>
                      <td>{o.userNombre ?? '—'}</td>
                      <td>{o.medio ? o.medio.toLowerCase().replace(/_/g, ' ') : '—'}</td>
                      <td className="num">
                        <span className={meta.signo < 0 ? 'mrg mrg--bad' : ''}>
                          {meta.signo < 0 ? '−' : ''}{money.format(o.monto)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtradas.length === 0 && <tr><td colSpan={7} className="muted">Sin operaciones en el rango.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Incluye ventas, aperturas/cierres de caja e ingresos/egresos de efectivo. Se actualiza en vivo mientras el turno opera.</p>
      </section>
        </>
      )}
    </>
  );
}
