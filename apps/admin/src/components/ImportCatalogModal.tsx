import { useMemo, useState } from 'react';
import { importCatalog, type ImportResult, type ImportRow } from '../lib/api';
import { useToast } from '../lib/toast';

/** Parser CSV mínimo: detecta separador (, o ;) y respeta comillas. */
function parseCsv(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t) return [];
  // Separador: el más frecuente entre ; y , en la primera línea.
  const head = t.split('\n')[0];
  const sep = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enComillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo); rows.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  fila.push(campo);
  rows.push(fila);
  return rows;
}

/** Normaliza un encabezado para mapearlo a nuestro campo. */
function normHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_MAP: Record<string, keyof ImportRow> = {
  nombre: 'nombre', producto: 'nombre', descripcion: 'nombre', articulo: 'nombre',
  precio: 'precio', precioventa: 'precio', pvp: 'precio', preciomostrador: 'precio', venta: 'precio',
  categoria: 'categoria', rubro: 'categoria', familia: 'categoria',
  unidad: 'unidad', um: 'unidad', medida: 'unidad', unidadventa: 'unidad',
  pesable: 'pesable', sepesa: 'pesable', pesa: 'pesable', peso: 'pesable',
  plu: 'plu', codigoplu: 'plu',
  codigo: 'codigoBarras', codigobarras: 'codigoBarras', barras: 'codigoBarras', ean: 'codigoBarras', codigodebarras: 'codigoBarras',
  online: 'visibleOnline', visibleonline: 'visibleOnline', tienda: 'visibleOnline', web: 'visibleOnline',
};

const CAMPOS_LABEL: Array<[keyof ImportRow, string]> = [
  ['nombre', 'Nombre'], ['precio', 'Precio'], ['categoria', 'Categoría'], ['unidad', 'Unidad'],
  ['pesable', 'Pesable'], ['plu', 'PLU'], ['codigoBarras', 'Cód. barras'], ['visibleOnline', 'Online'],
];

const EJEMPLO = 'nombre,precio,categoria,unidad,pesable,plu\nTomate perita,89,Verduras,kg,si,1\nLechuga,45,Hoja,unidad,no,4';

export function ImportCatalogModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<ImportResult | null>(null);

  // Parsea el texto → filas mapeadas a nuestros campos.
  const { rows, sinNombre, sinPrecio, headersReconocidos } = useMemo(() => {
    const matrix = parseCsv(texto);
    if (matrix.length < 2) return { rows: [] as ImportRow[], sinNombre: 0, sinPrecio: 0, headersReconocidos: [] as string[] };
    const headers = matrix[0].map(normHeader);
    const campos = headers.map((h) => HEADER_MAP[h]);
    const reconocidos = [...new Set(campos.filter(Boolean))] as string[];
    const out: ImportRow[] = [];
    let sn = 0, sp = 0;
    for (let i = 1; i < matrix.length; i++) {
      const celdas = matrix[i];
      if (celdas.every((c) => c.trim() === '')) continue;
      const row: ImportRow = {};
      campos.forEach((campo, j) => { if (campo) row[campo] = (celdas[j] ?? '').trim(); });
      if (!row.nombre) sn++;
      if (!row.precio) sp++;
      out.push(row);
    }
    return { rows: out, sinNombre: sn, sinPrecio: sp, headersReconocidos: reconocidos };
  }, [texto]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTexto(String(reader.result ?? ''));
    reader.readAsText(file, 'utf-8');
  }

  async function importar() {
    setImporting(true);
    try {
      const res = await importCatalog(rows);
      setResultado(res);
      if (res.creados + res.actualizados > 0) onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setImporting(false);
    }
  }

  // Pantalla de resultado
  if (resultado) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>Importación terminada</h3>
          <div className="import-res">
            <span className="import-res__ok">✓ {resultado.creados} creados</span>
            <span className="import-res__ok">↻ {resultado.actualizados} actualizados</span>
            {resultado.errores.length > 0 && <span className="import-res__err">⚠ {resultado.errores.length} con error</span>}
          </div>
          {resultado.errores.length > 0 && (
            <div className="import-errs">
              {resultado.errores.slice(0, 20).map((e) => (
                <div key={e.fila} className="import-errs__row">Fila {e.fila}: {e.motivo}</div>
              ))}
              {resultado.errores.length > 20 && <div className="muted">…y {resultado.errores.length - 20} más</div>}
            </div>
          )}
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={onClose}>Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3>Importar catálogo</h3>
        <p className="modal__sub">
          Subí un archivo <strong>CSV</strong> (o pegá el contenido) con una fila por producto.
          Columnas reconocidas: <em>nombre, precio, categoria, unidad, pesable, plu, codigo, online</em>.
          El IVA lo asigna solo el motor. Si el producto ya existe (por PLU o nombre), se actualiza.
        </p>

        <div className="import-tools">
          <label className="btn btn--ghost btn--sm">
            📄 Elegir archivo CSV
            <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
          </label>
          <button className="btn btn--ghost btn--sm" onClick={() => setTexto(EJEMPLO)}>Cargar ejemplo</button>
        </div>

        <textarea
          className="import-ta"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          placeholder={'Pegá acá el CSV…\n' + EJEMPLO}
        />

        {rows.length > 0 && (
          <>
            <div className="import-meta">
              <span><strong>{rows.length}</strong> filas</span>
              {headersReconocidos.length > 0 && <span className="muted">Columnas: {headersReconocidos.join(', ')}</span>}
              {sinNombre > 0 && <span className="import-res__err">{sinNombre} sin nombre</span>}
              {sinPrecio > 0 && <span className="import-res__err">{sinPrecio} sin precio</span>}
            </div>
            <div className="table-wrap import-prev">
              <table className="table">
                <thead><tr>{CAMPOS_LABEL.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>{CAMPOS_LABEL.map(([k]) => <td key={k}>{r[k] ?? ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && <p className="muted" style={{ padding: '6px 0' }}>…y {rows.length - 8} filas más</p>}
            </div>
          </>
        )}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={importing}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => void importar()} disabled={importing || rows.length === 0}>
            {importing ? 'Importando…' : `Importar ${rows.length || ''} productos`}
          </button>
        </div>
      </div>
    </div>
  );
}
