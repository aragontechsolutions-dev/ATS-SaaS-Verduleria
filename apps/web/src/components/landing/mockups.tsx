// Mockups visuales del producto para la landing. Sin imágenes ni librerías:
// puro JSX + CSS + SVG, con datos demo claramente ficticios.

const money = (n: number) => '$' + n.toLocaleString('es-UY');

/** Mini gráfico de barras en SVG (ventas por día). */
function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  const W = 260;
  const H = 96;
  const gap = 10;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg className="mk-chart" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Gráfico de ventas por día">
      {data.map((v, i) => {
        const h = Math.round((v / max) * H);
        const x = i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={bw} height={h} rx="3" className={i === data.length - 1 ? 'mk-bar mk-bar--hot' : 'mk-bar'} />
            <text x={x + bw / 2} y={H + 13} className="mk-chart__lbl" textAnchor="middle">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Panel del negocio (dashboard). Es el visual principal del hero y del showcase. */
export function DashboardMock({ etiquetas = false }: { etiquetas?: boolean }) {
  return (
    <div className="mk mk-dash" role="img" aria-label="Panel del negocio del sistema, con ventas del día, caja y alertas">
      <div className="mk-dash__side">
        <div className="mk-dash__logo"><span className="mk-dash__dot" /> Verdulería Demo</div>
        <nav className="mk-dash__nav">
          <span className="is-active">📊 Panel</span>
          <span>🛒 Ventas</span>
          <span>🥬 Productos</span>
          <span>📦 Stock</span>
          <span>🚚 Compras</span>
          <span>💰 Caja</span>
          <span>📈 Reportes</span>
        </nav>
      </div>
      <div className="mk-dash__main">
        <div className="mk-dash__top">
          <strong>Hola, Dueño 👋</strong>
          <span className="mk-chip mk-chip--ok">Caja abierta</span>
        </div>
        <div className="mk-kpis">
          <div className="mk-kpi">
            <span className="mk-kpi__lbl">Ventas de hoy</span>
            <span className="mk-kpi__val">{money(24680)}</span>
            <span className="mk-kpi__delta mk-up">▲ 12% vs ayer</span>
          </div>
          <div className="mk-kpi">
            <span className="mk-kpi__lbl">Tickets</span>
            <span className="mk-kpi__val">83</span>
            <span className="mk-kpi__delta">Prom. {money(297)}</span>
          </div>
          <div className="mk-kpi">
            <span className="mk-kpi__lbl">Efectivo en caja</span>
            <span className="mk-kpi__val">{money(15340)}</span>
            <span className="mk-kpi__delta">Turno mañana</span>
          </div>
        </div>
        <div className="mk-dash__cols">
          <div className="mk-panel">
            <div className="mk-panel__h">Ventas de la semana {etiquetas && <span className="mk-tag">en vivo</span>}</div>
            <BarChart data={[12, 18, 15, 22, 19, 27, 24]} labels={['L', 'M', 'M', 'J', 'V', 'S', 'D']} />
          </div>
          <div className="mk-panel">
            <div className="mk-panel__h">Lo más vendido</div>
            <ul className="mk-top">
              <li><span>🍌 Banana</span><b>142 kg</b></li>
              <li><span>🍅 Tomate</span><b>96 kg</b></li>
              <li><span>🥔 Papa</span><b>88 kg</b></li>
              <li><span>🥬 Lechuga</span><b>61 un</b></li>
            </ul>
          </div>
        </div>
        <div className="mk-alerts">
          <span className="mk-alert mk-alert--warn">⚠️ 5 productos bajo mínimo</span>
          <span className="mk-alert mk-alert--red">⛔ 2 sin stock</span>
          <span className="mk-alert">🥬 3 por vencer</span>
        </div>
      </div>
      {etiquetas && (
        <>
          <span className="mk-note mk-note--1">Ventas del día en tiempo real</span>
          <span className="mk-note mk-note--2">Alertas de stock y vencimiento</span>
        </>
      )}
    </div>
  );
}

/** Punto de venta (POS). */
export function PosMock() {
  return (
    <div className="mk mk-pos" role="img" aria-label="Pantalla de punto de venta con productos, carrito y medios de pago">
      <div className="mk-pos__grid">
        {['🍌 Banana', '🍅 Tomate', '🥔 Papa', '🥬 Lechuga', '🍎 Manzana', '🧅 Cebolla', '🥕 Zanahoria', '🍊 Naranja', '🫑 Morrón'].map((p) => (
          <span className="mk-pos__prod" key={p}>{p}</span>
        ))}
      </div>
      <div className="mk-pos__cart">
        <div className="mk-pos__h">Ticket #101</div>
        <div className="mk-pos__line"><span>Banana <em>1.240 kg</em></span><b>{money(98)}</b></div>
        <div className="mk-pos__line"><span>Tomate <em>0.850 kg</em></span><b>{money(67)}</b></div>
        <div className="mk-pos__line"><span>Lechuga <em>2 un</em></span><b>{money(70)}</b></div>
        <div className="mk-pos__total"><span>Total</span><b>{money(235)}</b></div>
        <div className="mk-pos__pays">
          <span className="is-on">Efectivo</span>
          <span>Tarjeta</span>
          <span>Mercado Pago</span>
        </div>
        <div className="mk-pos__pay-btn">Cobrar {money(235)}</div>
      </div>
    </div>
  );
}

/** Tabla de gestión de productos. */
export function ProductsMock() {
  const rows = [
    { n: '🍌 Banana', cat: 'Frutas', c: 45, v: 79, s: '128 kg', u: 'kg', iva: 'Mín.', on: true },
    { n: '🍅 Tomate perita', cat: 'Verduras', c: 52, v: 89, s: '64 kg', u: 'kg', iva: 'Mín.', on: true },
    { n: '🥔 Papa', cat: 'Verduras', c: 28, v: 49, s: '210 kg', u: 'kg', iva: 'Mín.', on: true },
    { n: '🥬 Lechuga', cat: 'Verduras', c: 18, v: 35, s: '40 un', u: 'un', iva: 'Mín.', on: true },
    { n: '🍎 Manzana', cat: 'Frutas', c: 60, v: 99, s: '9 kg', u: 'kg', iva: 'Mín.', on: false },
  ];
  return (
    <div className="mk mk-tbl" role="img" aria-label="Tabla de productos con precio de compra, venta, stock, unidad, IVA y estado">
      <div className="mk-tbl__h"><span>🥬 Productos</span><span className="mk-chip">+ Nuevo</span></div>
      <div className="mk-tbl__scroll">
        <table>
          <thead>
            <tr><th>Producto</th><th>Categoría</th><th>Compra</th><th>Venta</th><th>Stock</th><th>Unidad</th><th>IVA</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td className="mk-mut">{r.cat}</td>
                <td>{money(r.c)}</td>
                <td><b>{money(r.v)}</b></td>
                <td>{r.s}</td>
                <td className="mk-mut">{r.u}</td>
                <td className="mk-mut">{r.iva}</td>
                <td><span className={`mk-state ${r.on ? 'is-on' : 'is-off'}`}>{r.on ? 'Activo' : 'Pausado'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Control de stock. */
export function StockMock() {
  const rows = [
    { n: '🍌 Banana', act: 128, min: 40, st: 'ok' },
    { n: '🍅 Tomate', act: 12, min: 30, st: 'low' },
    { n: '🥬 Lechuga', act: 0, min: 15, st: 'out' },
    { n: '🥔 Papa', act: 210, min: 50, st: 'ok' },
  ];
  const pct = (r: { act: number; min: number }) => Math.min(100, Math.round((r.act / (r.min * 3 || 1)) * 100));
  return (
    <div className="mk mk-stock" role="img" aria-label="Control de stock con stock actual, mínimo y alertas">
      <div className="mk-tbl__h"><span>📦 Stock</span><span className="mk-chip mk-chip--warn">3 alertas</span></div>
      <ul className="mk-stock__list">
        {rows.map((r) => (
          <li key={r.n}>
            <span className="mk-stock__name">{r.n}</span>
            <span className="mk-bar-wrap"><span className={`mk-bar-fill mk-bar-fill--${r.st}`} style={{ width: `${pct(r)}%` }} /></span>
            <span className="mk-stock__q">{r.act} <em>/ mín {r.min}</em></span>
            {r.st === 'out' ? <span className="mk-state is-off">Sin stock</span> : r.st === 'low' ? <span className="mk-state is-warn">Reponer</span> : <span className="mk-state is-on">Ok</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reportes / analítica. */
export function AnalyticsMock() {
  return (
    <div className="mk mk-an" role="img" aria-label="Reportes con ventas por período, margen y productos más vendidos">
      <div className="mk-an__row">
        <div className="mk-kpi"><span className="mk-kpi__lbl">Ventas del mes</span><span className="mk-kpi__val">{money(612400)}</span><span className="mk-kpi__delta mk-up">▲ 8%</span></div>
        <div className="mk-kpi"><span className="mk-kpi__lbl">Margen prom.</span><span className="mk-kpi__val">34%</span><span className="mk-kpi__delta">por producto</span></div>
      </div>
      <div className="mk-panel">
        <div className="mk-panel__h">Evolución de ventas</div>
        <BarChart data={[38, 42, 40, 51, 47, 55, 60, 58]} labels={['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']} />
      </div>
    </div>
  );
}
