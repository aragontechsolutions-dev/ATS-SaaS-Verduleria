import { useEffect, useRef, useState } from 'react';
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
  onMovimiento?: () => void;
  onSangria?: () => void;
  onRelevo?: () => void;
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
  onMovimiento,
  onSangria,
  onRelevo,
  onCorteX,
  onLogout,
}: Props) {
  // Acciones secundarias (turno / caja / ajustes) agrupadas en un menú "Más".
  const masItems: Array<{ icon: string; label: string; onClick: () => void }> = [];
  if (cash && onMovimiento) masItems.push({ icon: '➕➖', label: 'Movimiento de efectivo', onClick: onMovimiento });
  if (cash && onSangria) masItems.push({ icon: '🔻', label: 'Sangría (retiro a caja fuerte)', onClick: onSangria });
  if (cash && onRelevo) masItems.push({ icon: '🔄', label: 'Relevo de cajero', onClick: onRelevo });
  if (cash && onCorteX) masItems.push({ icon: '✂️', label: 'Corte X (resumen parcial)', onClick: onCorteX });
  if (onCobranza) masItems.push({ icon: '💳', label: 'Cobrar cuenta corriente', onClick: onCobranza });
  if (onOpenPrinter) masItems.push({ icon: '🖨️', label: 'Impresora / cajón', onClick: onOpenPrinter });

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
        {onOpenPrice && (
          <button className="sbtn" onClick={onOpenPrice} title="Consultar precio (F3)">🔎 Precio</button>
        )}
        <button className="sbtn" onClick={onOpenOps} title="Operaciones del turno">🧾 Operaciones</button>
        <button className={`sbtn ${scaleLive ? 'sbtn--on' : ''}`} onClick={onOpenScale} title="Balanza">
          ⚖ Balanza{scaleLive ? ' ●' : ''}
        </button>
        {masItems.length > 0 && <MoreMenu items={masItems} />}
        {userEmail && <span className="statusbar__tenant" title={userEmail}>{userEmail}</span>}
        <button className="sbtn sbtn--ghost" onClick={onLogout} title="Cerrar sesión">Salir</button>
      </div>
    </header>
  );
}

/** Menú desplegable de acciones secundarias. */
function MoreMenu({ items }: { items: Array<{ icon: string; label: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div className="sbmenu" ref={ref}>
      <button className={`sbtn ${open ? 'sbtn--on' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}>
        ⋯ Más
      </button>
      {open && (
        <div className="sbmenu__pop" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              className="sbmenu__item"
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              <span className="sbmenu__ic" aria-hidden>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
