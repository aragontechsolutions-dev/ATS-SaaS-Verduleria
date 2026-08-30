import { useState } from 'react';
import type { Corte } from '../lib/api';
import { formatMoney } from '../lib/format';
import { loadPrinterConfig, printCorte } from '../lib/printer';

const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: '💵 Efectivo', DEBITO: '💳 Débito', CREDITO: '💳 Crédito', MERCADO_PAGO: '📱 QR / MP',
  TRANSFERENCIA: '🏦 Transferencia', DINERO_ELECTRONICO: '💠 Dinero electrónico', CUENTA_CORRIENTE: '📒 Cuenta corriente',
};
const label = (m: string) => MEDIO_LABEL[m] ?? m.toLowerCase().replace(/_/g, ' ');

interface Props {
  corte: Corte;
  onClose: () => void;
}

/** Muestra el corte X (parcial) o Z (cierre) del turno y permite imprimirlo. */
export function CorteModal({ corte, onClose }: Props) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const medios = Object.keys(corte.porMedio);
  const dif = corte.diferencia ?? 0;

  async function imprimir() {
    setImprimiendo(true);
    try { await printCorte(corte, loadPrinterConfig()); } finally { setImprimiendo(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Corte {corte.tipo} · {corte.tipo === 'Z' ? 'cierre' : 'parcial'}</h3>
        <p className="modal__sub">
          {corte.terminal ? `${corte.terminal}` : 'Caja'}{corte.sucursalNombre ? ` · ${corte.sucursalNombre}` : ''}
          {corte.userNombre ? ` · ${corte.userNombre}` : ''}
        </p>

        <div className="corte">
          <div className="corte__row"><span>Apertura</span><span>{new Date(corte.aperturaAt).toLocaleString('es-UY')}</span></div>
          {corte.tipo === 'Z' && corte.cierreAt && (
            <div className="corte__row"><span>Cierre</span><span>{new Date(corte.cierreAt).toLocaleString('es-UY')}</span></div>
          )}
          <div className="corte__sep" />
          <div className="corte__row"><span>Fondo de apertura</span><span>{formatMoney(corte.montoApertura)}</span></div>
          <div className="corte__row"><span>Ventas ({corte.ventas})</span><span>{formatMoney(corte.totalVendido)}</span></div>
          {corte.ingresos > 0 && <div className="corte__row"><span>Ingresos</span><span>+{formatMoney(corte.ingresos)}</span></div>}
          {corte.egresos > 0 && <div className="corte__row"><span>Egresos</span><span>−{formatMoney(corte.egresos)}</span></div>}
          {corte.sangrias > 0 && <div className="corte__row"><span>Sangrías</span><span>−{formatMoney(corte.sangrias)}</span></div>}

          <div className="corte__sep" />
          <div className="corte__tit">Por medio de pago</div>
          {medios.length === 0 && <div className="corte__row corte__row--muted"><span>Sin ventas</span><span></span></div>}
          {medios.map((m) => (
            <div className="corte__row" key={m}><span>{label(m)}</span><span>{formatMoney(corte.porMedio[m])}</span></div>
          ))}

          <div className="corte__sep" />
          <div className="corte__row corte__row--strong"><span>Efectivo esperado</span><span>{formatMoney(corte.efectivoEsperado)}</span></div>
          {corte.tipo === 'Z' && corte.montoCierre != null && (
            <>
              <div className="corte__row"><span>Efectivo contado</span><span>{formatMoney(corte.montoCierre)}</span></div>
              <div className={`corte__row corte__row--strong ${dif < 0 ? 'corte__row--bad' : ''}`}>
                <span>Diferencia</span><span>{dif > 0 ? '+' : ''}{formatMoney(dif)}</span>
              </div>
            </>
          )}
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn--primary" onClick={() => void imprimir()} disabled={imprimiendo}>
            {imprimiendo ? 'Imprimiendo…' : '🖨 Imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
