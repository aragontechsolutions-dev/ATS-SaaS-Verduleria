import { useCallback, useEffect, useRef, useState } from 'react';
import {
  enviarPresencia,
  marcarEnCamino,
  marcarEntregado,
  type Pedido,
  type PresenciaEstado,
} from '../lib/api';

const HEARTBEAT_MS = 20000;
const TRABAJANDO_KEY = 'ats.repartidor.trabajando';
const money = (n: number) => `$${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Repartidor({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [trabajando, setTrabajando] = useState<boolean>(() => {
    try { return localStorage.getItem(TRABAJANDO_KEY) === '1'; } catch { return false; }
  });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estadoServer, setEstadoServer] = useState<'DISPONIBLE' | 'OFFLINE' | 'EN_ENTREGA'>('OFFLINE');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const heartbeat = useCallback(async (estado: PresenciaEstado) => {
    try {
      const res = await enviarPresencia(estado, coordsRef.current ?? undefined);
      setEstadoServer(res.estado);
      setPedidos(res.pedidos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sin conexión');
    }
  }, []);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Este teléfono no comparte ubicación'); return; }
    setGpsError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setGpsError(null); },
      () => setGpsError('No pudimos leer tu ubicación (activá el GPS y dá permiso)'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    coordsRef.current = null;
  }, []);

  // Ciclo de trabajo: al ponerse "disponible", enciende GPS + heartbeat periódico.
  useEffect(() => {
    if (!trabajando) return;
    startGps();
    void heartbeat('DISPONIBLE');
    timerRef.current = window.setInterval(() => void heartbeat('DISPONIBLE'), HEARTBEAT_MS);
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      stopGps();
    };
  }, [trabajando, heartbeat, startGps, stopGps]);

  function toggleTrabajando() {
    const v = !trabajando;
    setTrabajando(v);
    try { localStorage.setItem(TRABAJANDO_KEY, v ? '1' : '0'); } catch { /* noop */ }
    if (!v) void heartbeat('OFFLINE'); // aviso inmediato de que se desconecta
  }

  async function accion(id: string, fn: (id: string) => Promise<Pedido[]>) {
    setBusyId(id);
    try {
      setPedidos(await fn(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusyId(null);
    }
  }

  const enEntrega = estadoServer === 'EN_ENTREGA' || pedidos.some((p) => p.estado === 'EN_CAMINO');

  return (
    <div className="app">
      <header className="topbar">
        <img src="/icon.svg" alt="" className="topbar__logo" />
        <div className="topbar__title">
          <strong>Reparto</strong>
          <small>{email}</small>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Salir</button>
      </header>

      <div className={`estado-bar estado-bar--${trabajando ? (enEntrega ? 'entrega' : 'on') : 'off'}`}>
        <label className="switch">
          <input type="checkbox" checked={trabajando} onChange={toggleTrabajando} />
          <span className="switch__slider" />
        </label>
        <span className="estado-bar__txt">
          {trabajando
            ? enEntrega ? '🛵 En entrega' : '🟢 Disponible — esperando pedidos'
            : '⚪ Desconectado'}
        </span>
      </div>

      {trabajando && gpsError && <div className="aviso aviso--warn">⚠️ {gpsError}. Se asignará por orden de llegada.</div>}
      {error && <div className="aviso aviso--err">{error}</div>}

      <main className="lista">
        {!trabajando && (
          <div className="vacio">
            <p>Estás desconectado.</p>
            <p className="muted">Activá <strong>Disponible</strong> para empezar a recibir entregas.</p>
          </div>
        )}

        {trabajando && pedidos.length === 0 && (
          <div className="vacio">
            <p>No tenés entregas asignadas.</p>
            <p className="muted">Cuando el local despache un pedido cercano, te va a aparecer acá.</p>
          </div>
        )}

        {pedidos.map((p, i) => (
          <PedidoCard
            key={p.id}
            p={p}
            orden={i + 1}
            busy={busyId === p.id}
            onEnCamino={() => accion(p.id, marcarEnCamino)}
            onEntregado={() => accion(p.id, marcarEntregado)}
          />
        ))}
      </main>
    </div>
  );
}

function PedidoCard({ p, orden, busy, onEnCamino, onEntregado }: {
  p: Pedido;
  orden: number;
  busy: boolean;
  onEnCamino: () => void;
  onEntregado: () => void;
}) {
  const mapsUrl = p.direccion
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.direccion)}`
    : null;

  return (
    <div className={`ped ped--${p.estado.toLowerCase()}`}>
      <div className="ped__head">
        <span className="ped__orden">#{orden}</span>
        <div>
          <strong>Pedido #{p.numero}</strong>
          <span className={`ped__badge ped__badge--${p.estado.toLowerCase()}`}>
            {p.estado === 'EN_CAMINO' ? 'En camino' : 'Para salir'}
          </span>
        </div>
      </div>

      <div className="ped__cli">
        <strong>{p.cliente}</strong>
        <a className="ped__tel" href={`tel:${p.telefono}`}>📞 {p.telefono}</a>
      </div>

      {p.direccion && (
        <div className="ped__dir">
          📍 {p.direccion}
          {mapsUrl && <a className="btn btn--map" href={mapsUrl} target="_blank" rel="noreferrer">Ir con Maps</a>}
        </div>
      )}

      <ul className="ped__items">
        {p.items.map((it, idx) => (
          <li key={idx}><span>{it.concepto}</span><em>{it.cantidad} {it.unidad}</em></li>
        ))}
      </ul>

      {p.notas && <p className="ped__notas">📝 {p.notas}</p>}

      <div className="ped__cobro">A cobrar: <strong>{money(p.total)}</strong></div>

      <div className="ped__acciones">
        {p.estado === 'PREPARANDO' ? (
          <button className="btn btn--primary btn--block" onClick={onEnCamino} disabled={busy}>
            {busy ? '…' : '🛵 Salí a entregar'}
          </button>
        ) : (
          <button className="btn btn--ok btn--block" onClick={() => { if (confirm(`¿Confirmás la entrega del pedido #${p.numero} y el cobro de ${money(p.total)}?`)) onEntregado(); }} disabled={busy}>
            {busy ? '…' : '✓ Entregado'}
          </button>
        )}
      </div>
    </div>
  );
}
