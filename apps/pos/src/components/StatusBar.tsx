import { formatMoney } from '../lib/format';
import type { CashSession } from '../lib/types';

interface Props {
  online: boolean;
  fromCache: boolean;
  pendientes: number;
  listaPrecio: string | null;
  total: number;
  cash: CashSession | null;
  sucursalNombre?: string | null;
  scaleLive?: boolean;
  userEmail?: string;
  onOpenCash: () => void;
  onCloseCash: () => void;
  onOpenScale: () => void;
  onLogout: () => void;
}

export function StatusBar({
  online,
  fromCache,
  pendientes,
  listaPrecio,
  total,
  cash,
  sucursalNombre,
  scaleLive,
  userEmail,
  onOpenCash,
  onCloseCash,
  onOpenScale,
  onLogout,
}: Props) {
  return (
    <header className="statusbar">
      <div className="statusbar__brand">
        <img src="/icon.svg" alt="Aragon" />
        ARAGON POS
      </div>
      <div className="statusbar__meta">
        <span className={`pill ${online ? 'pill--ok' : 'pill--warn'}`}>
          {online ? '● En línea' : '○ Sin conexión'}
        </span>
        {pendientes > 0 && <span className="pill pill--info">↻ {pendientes} por sincronizar</span>}
        {sucursalNombre && <span className="pill pill--info">🏪 {sucursalNombre}</span>}
        {fromCache && <span className="pill pill--muted">catálogo local</span>}
        {listaPrecio && <span className="pill pill--muted">{listaPrecio}</span>}
        {cash ? (
          <button className="pill pill--cash" onClick={onCloseCash}>
            🔓 Caja abierta · Cerrar
          </button>
        ) : (
          <button className="pill pill--cash" onClick={onOpenCash}>
            🔒 Abrir caja
          </button>
        )}
        <button className={`pill ${scaleLive ? 'pill--ok' : 'pill--muted'}`} onClick={onOpenScale} title="Balanza">
          ⚖ Balanza{scaleLive ? ' ●' : ''}
        </button>
      </div>
      <div className="statusbar__total">Total: {formatMoney(total)}</div>
      {userEmail && <span className="statusbar__tenant">{userEmail}</span>}
      <button className="pill pill--cash" onClick={onLogout} title="Cerrar sesión">
        Salir
      </button>
    </header>
  );
}
