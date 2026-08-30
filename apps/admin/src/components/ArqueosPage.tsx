import { useCallback, useEffect, useMemo, useState } from 'react';
import { getArqueos, getTerminals, getUsers } from '../lib/api';
import type { ArqueoTurno, TenantUser, Terminal } from '../lib/api';
import { SkeletonRows } from './Skeleton';
import { useToast } from '../lib/toast';

const money = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 });

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fecha(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-UY') : '—';
}

/** Arqueos por turno de caja (reporte por caja): un renglón por sesión de caja. */
export function ArqueosView() {
  const toast = useToast();
  const [rows, setRows] = useState<ArqueoTurno[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState(hoyISO());
  const [to, setTo] = useState(hoyISO());
  const [terminalId, setTerminalId] = useState('');
  const [userId, setUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArqueos({
        from: from ? `${from}T00:00:00` : undefined,
        to: to ? `${to}T23:59:59` : undefined,
        terminalId: terminalId || undefined,
        userId: userId || undefined,
      });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error cargando los arqueos');
    } finally {
      setLoading(false);
    }
  }, [from, to, terminalId, userId, toast]);

  useEffect(() => {
    getTerminals().then(setTerminals).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totales = useMemo(() => {
    let vendido = 0;
    let diferencia = 0;
    for (const r of rows) {
      vendido += r.totalVendido;
      if (r.diferencia != null) diferencia += r.diferencia;
    }
    return { turnos: rows.length, vendido, diferencia };
  }, [rows]);

  return (
    <>
      <section className="tiles">
        <div className="tile"><span className="tile__label">Turnos</span><span className="tile__value">{totales.turnos}</span></div>
        <div className="tile"><span className="tile__label">Total vendido</span><span className="tile__value">{money.format(totales.vendido)}</span></div>
        <div className="tile">
          <span className="tile__label">Diferencia acumulada</span>
          <span className="tile__value">{money.format(totales.diferencia)}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Arqueos por caja</h2>
          <button className="btn btn--ghost btn--sm" onClick={() => void load()}>↻ Actualizar</button>
        </div>

        <div className="cat-new">
          <label className="field">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field">Caja
            <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
              <option value="">Todas</option>
              {terminals.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.sucursalNombre}</option>)}
            </select>
          </label>
          <label className="field">Cajero
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.userId} value={u.userId}>{u.nombre}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <SkeletonRows rows={6} cols={7} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Apertura</th><th>Cierre</th><th>Caja</th><th>Cajero</th>
                  <th className="num">Fondo</th><th className="num">Ventas</th><th className="num">Vendido</th>
                  <th className="num">Cierre</th><th className="num">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sessionId}>
                    <td>{fecha(r.fechaApertura)}</td>
                    <td>{r.abierta ? <span className="op op--apertura">Abierta</span> : fecha(r.fechaCierre)}</td>
                    <td>{r.terminal ?? '—'}{r.sucursalNombre ? <span className="muted"> · {r.sucursalNombre}</span> : ''}</td>
                    <td>{r.userNombre ?? '—'}</td>
                    <td className="num">{money.format(r.montoApertura)}</td>
                    <td className="num">{r.ventas}</td>
                    <td className="num">{money.format(r.totalVendido)}</td>
                    <td className="num">{r.montoCierre != null ? money.format(r.montoCierre) : '—'}</td>
                    <td className="num">
                      {r.diferencia == null ? '—' : r.diferencia === 0 ? (
                        <span className="mrg mrg--ok">OK</span>
                      ) : (
                        <span className={`mrg ${r.diferencia < 0 ? 'mrg--bad' : 'mrg--warn'}`}>
                          {r.diferencia > 0 ? '+' : ''}{money.format(r.diferencia)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="muted">Sin arqueos en el rango.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Un renglón por turno de caja. La diferencia es la del arqueo de efectivo al cierre (contado − esperado).</p>
      </section>
    </>
  );
}
