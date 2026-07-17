import { formatMoney } from '../lib/format';

interface Props {
  online: boolean;
  fromCache: boolean;
  pendientes: number;
  listaPrecio: string | null;
  total: number;
}

export function StatusBar({ online, fromCache, pendientes, listaPrecio, total }: Props) {
  return (
    <header className="statusbar">
      <div className="statusbar__brand">🥬 ATS POS</div>
      <div className="statusbar__meta">
        <span className={`pill ${online ? 'pill--ok' : 'pill--warn'}`}>
          {online ? '● En línea' : '○ Sin conexión'}
        </span>
        {pendientes > 0 && <span className="pill pill--info">↻ {pendientes} por sincronizar</span>}
        {fromCache && <span className="pill pill--muted">catálogo local</span>}
        {listaPrecio && <span className="pill pill--muted">{listaPrecio}</span>}
      </div>
      <div className="statusbar__total">Total: {formatMoney(total)}</div>
    </header>
  );
}
