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
  onOpenPrinter?: () => void;
  onOpenOps: () => void;
  onOpenPrice?: () => void;
  onCobranza?: () => void;
  onOpenSecurity?: () => void;
  onMovimiento?: () => void;
  onSangria?: () => void;
  onCorteX?: () => void;
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
  onOpenPrinter,
  onOpenOps,
  onOpenPrice,
  onCobranza,
  onOpenSecurity,
  onMovimiento,
  onSangria,
  onCorteX,
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
        {cash?.terminal && <span className="pill pill--info">🖥️ {cash.terminal}</span>}
        {fromCache && <span className="pill pill--muted">catálogo local</span>}
        {listaPrecio && <span className="pill pill--muted">{listaPrecio}</span>}
      </div>
      <div className="statusbar__total">Total: {formatMoney(total)}</div>
      <div className="statusbar__actions">
        {cash ? (
          <button className="sbtn sbtn--cash" onClick={onCloseCash}>🔓 Cerrar caja</button>
        ) : (
          <button className="sbtn sbtn--accent" onClick={onOpenCash}>🔒 Abrir caja</button>
        )}
        {cash && onMovimiento && (
          <button className="sbtn" onClick={onMovimiento} title="Ingreso / egreso de efectivo">➕➖ Movimiento</button>
        )}
        {cash && onSangria && (
          <button className="sbtn" onClick={onSangria} title="Sangría: retirar efectivo del cajón a la caja fuerte">🔻 Sangría</button>
        )}
        {cash && onCorteX && (
          <button className="sbtn" onClick={onCorteX} title="Corte X (resumen parcial del turno)">✂️ Corte X</button>
        )}
        {onOpenPrice && (
          <button className="sbtn" onClick={onOpenPrice} title="Consultar precio (F3)">🔎 Precio</button>
        )}
        {onCobranza && (
          <button className="sbtn" onClick={onCobranza} title="Cobrar cuenta corriente">💳 Cta. cte.</button>
        )}
        <button className="sbtn" onClick={onOpenOps} title="Operaciones del turno">🧾 Operaciones</button>
        <button className={`sbtn ${scaleLive ? 'sbtn--on' : ''}`} onClick={onOpenScale} title="Balanza">
          ⚖ Balanza{scaleLive ? ' ●' : ''}
        </button>
        {onOpenPrinter && (
          <button className="sbtn" onClick={onOpenPrinter} title="Impresora / cajón">🖨</button>
        )}
        {onOpenSecurity && (
          <button className="sbtn" onClick={onOpenSecurity} title="Seguridad / PIN de supervisor">🔒</button>
        )}
        {userEmail && <span className="statusbar__tenant" title={userEmail}>{userEmail}</span>}
        <button className="sbtn sbtn--ghost" onClick={onLogout} title="Cerrar sesión">Salir</button>
      </div>
    </header>
  );
}
