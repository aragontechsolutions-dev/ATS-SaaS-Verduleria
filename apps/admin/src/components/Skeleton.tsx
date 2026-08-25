/** Bloque de carga (shimmer). `w`/`h` aceptan cualquier medida CSS. */
export function Skeleton({ w = '100%', h = 16, radius = 8, className = '' }: {
  w?: string | number;
  h?: string | number;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width: w, height: h, borderRadius: radius }}
      aria-hidden
    />
  );
}

/** Spinner circular. `size` en px. */
export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Cargando" />;
}

/** Filas de tabla en carga (skeleton). */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skel-table" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skel-table__row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} h={14} w={c === 0 ? '40%' : '70%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Tarjetas en carga (para grillas tipo productos/stock). */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="skel-cards" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div className="skel-cards__card" key={i}>
          <Skeleton h={90} radius={10} />
          <Skeleton h={13} w="80%" />
          <Skeleton h={13} w="50%" />
        </div>
      ))}
    </div>
  );
}
