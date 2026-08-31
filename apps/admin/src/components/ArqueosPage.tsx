import { useCallback, useEffect, useMemo, useState } from 'react';
import { getArqueos, getCorte, getTerminals, getUsers } from '../lib/api';
import type { ArqueoTurno, Corte, TenantUser, Terminal } from '../lib/api';
import { printCorte } from '../lib/corte';
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
  const [corte, setCorte] = useState<Corte | null>(null);

  const verCorte = useCallback(async (sessionId: string) => {
    try {
      setCorte(await getCorte(sessionId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el corte');
    }
  }, [toast]);

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
                  <th className="num">Cierre</th><th className="num">Diferencia</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sessionId}>
                    <td>{fecha(r.fechaApertura)}</td>
                    <td>{r.abierta ? <span className="op op--apertura">Abierta</span> : fecha(r.fechaCierre)}</td>
                    <td>{r.terminal ?? '—'}{r.sucursalNombre ? <span className="muted"> · {r.sucursalNombre}</span> : ''}{r.esRelevo && <span className="op op--apertura" style={{ marginLeft: 6 }}>relevo</span>}</td>
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
                    <td><button className="btn btn--sm btn--ghost" onClick={() => void verCorte(r.sessionId)}>Corte {r.abierta ? 'X' : 'Z'}</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} className="muted">Sin arqueos en el rango.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Un renglón por turno de caja. La diferencia es la del arqueo de efectivo al cierre (contado − esperado).</p>
      </section>

      {corte && <CorteModal corte={corte} onClose={() => setCorte(null)} />}
    </>
  );
}

function CorteModal({ corte, onClose }: { corte: Corte; onClose: () => void }) {
  const medios = Object.keys(corte.porMedio);
  const dif = corte.diferencia ?? 0;
  const row = (l: string, r: string, strong = false) => (
    <div className="row" style={strong ? { fontWeight: 700 } : undefined}><span>{l}</span><span>{r}</span></div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Corte {corte.tipo} · {corte.tipo === 'Z' ? 'cierre' : 'parcial'}</h3>
        <p className="modal__sub">
          {corte.terminal ?? 'Caja'}{corte.sucursalNombre ? ` · ${corte.sucursalNombre}` : ''}{corte.userNombre ? ` · ${corte.userNombre}` : ''}
        </p>

        <div className="corte-detalle">
          {row('Apertura', new Date(corte.aperturaAt).toLocaleString('es-UY'))}
          {corte.tipo === 'Z' && corte.cierreAt && row('Cierre', new Date(corte.cierreAt).toLocaleString('es-UY'))}
          <hr />
          {row('Fondo de apertura', money.format(corte.montoApertura))}
          {row(`Ventas (${corte.ventas})`, money.format(corte.totalVendido))}
          {corte.ingresos > 0 && row('Ingresos', `+${money.format(corte.ingresos)}`)}
          {corte.egresos > 0 && row('Egresos', `−${money.format(corte.egresos)}`)}
          {corte.sangrias > 0 && row('Sangrías', `−${money.format(corte.sangrias)}`)}
          <hr />
          <div className="corte-tit">Por medio de pago</div>
          {medios.length === 0 && <div className="row muted"><span>Sin ventas</span><span /></div>}
          {medios.map((m) => row(m.toLowerCase().replace(/_/g, ' '), money.format(corte.porMedio[m])))}
          <hr />
          {row('Efectivo esperado', money.format(corte.efectivoEsperado), true)}
          {corte.tipo === 'Z' && corte.montoCierre != null && (
            <>
              {row('Efectivo contado', money.format(corte.montoCierre))}
              {row('Diferencia', `${dif > 0 ? '+' : ''}${money.format(dif)}`, true)}
            </>
          )}
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn--primary" onClick={() => printCorte(corte)}>🖨 Imprimir</button>
        </div>
      </div>
    </div>
  );
}
