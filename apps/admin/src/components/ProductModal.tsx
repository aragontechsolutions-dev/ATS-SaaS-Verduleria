import { useEffect, useState } from 'react';
import { classifyIva, createProduct, getSuppliers, updateProduct } from '../lib/api';
import type { Categoria, Clasificacion, IvaIndicador, Product, Supplier } from '../lib/api';
import { ImageUpload } from './ImageUpload';
import { useToast } from '../lib/toast';

interface Props {
  product?: Product;
  categorias: Categoria[];
  /** Solo ADMIN/CONTADOR pueden fijar el IVA a mano. */
  canOverrideIva?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const UNIDADES = ['KG', 'GRAMO', 'UNIDAD', 'ATADO', 'DOCENA', 'BANDEJA'];
const IVAS: IvaIndicador[] = ['MINIMA', 'BASICA', 'EXENTO', 'SUSPENSO'];
const TASA_LABEL: Record<IvaIndicador, string> = {
  MINIMA: 'Mínima 10%', BASICA: 'Básica 22%', EXENTO: 'Exento', SUSPENSO: 'En suspenso',
};

export function ProductModal({ product, categorias, canOverrideIva = false, onClose, onSaved }: Props) {
  const toast = useToast();
  const editing = !!product;
  const [nombre, setNombre] = useState(product?.nombre ?? '');
  const [unidadVenta, setUnidadVenta] = useState(product?.unidadVenta ?? 'KG');
  const [esPesable, setEsPesable] = useState(product?.esPesable ?? true);
  const [precio, setPrecio] = useState(String(product?.precio ?? ''));
  const [categoriaId, setCategoriaId] = useState(product?.categoriaId ?? '');
  const [plu, setPlu] = useState(product?.plu != null ? String(product.plu) : '');
  const [imagenUrl, setImagenUrl] = useState(product?.imagenUrl ?? '');
  // Reposición (solo edición): proveedor habitual y stock mínimo.
  const [proveedorId, setProveedorId] = useState(product?.proveedorId ?? '');
  const [stockMinimo, setStockMinimo] = useState(product?.stockMinimo != null ? String(product.stockMinimo) : '');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) getSuppliers().then((s) => setSuppliers(s.filter((x) => x.activo))).catch(() => {});
  }, [editing]);

  // Motor de IVA: por defecto lo asigna solo; el contador puede hacer override.
  const [override, setOverride] = useState(product?.ivaOverride ?? false);
  const [ivaIndicador, setIva] = useState<IvaIndicador>(product?.ivaIndicador ?? 'MINIMA');
  const [esEstadoNatural, setEstadoNatural] = useState(product?.esEstadoNatural ?? true);
  const [esImportado, setImportado] = useState(product?.esImportado ?? false);
  const [preview, setPreview] = useState<Clasificacion | null>(null);

  // Vista previa en vivo del IVA que asignaría el motor (debounced), sin override.
  useEffect(() => {
    if (override) return;
    const n = nombre.trim();
    if (n.length < 2) { setPreview(null); return; }
    const t = window.setTimeout(() => {
      classifyIva(n).then(setPreview).catch(() => setPreview(null));
    }, 400);
    return () => window.clearTimeout(t);
  }, [nombre, override]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      nombre: nombre.trim(),
      unidadVenta,
      esPesable,
      precio: parseFloat(precio) || 0,
      categoriaId: categoriaId || undefined,
      plu: plu ? parseInt(plu, 10) : undefined,
      imagenUrl: imagenUrl || undefined,
      // Reposición: solo se envía al editar.
      ...(editing ? { proveedorId: proveedorId || '', stockMinimo: stockMinimo.trim() ? parseFloat(stockMinimo) : 0 } : {}),
      // IVA: solo ADMIN/CONTADOR mandan override; si no, lo asigna el motor.
      ...(canOverrideIva
        ? { ivaOverride: override, ...(override ? { ivaIndicador, esEstadoNatural, esImportado } : {}) }
        : {}),
    };
    try {
      if (editing) await updateProduct(product!.id, payload);
      else await createProduct(payload);
      toast.success(editing ? `Producto “${payload.nombre}” editado correctamente` : `Producto “${payload.nombre}” agregado correctamente`);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <h3>{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
        <label className="field">
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        </label>
        <div className="row2">
          <label className="field">
            Categoría
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">— sin categoría —</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="field">
            Unidad de venta
            <select value={unidadVenta} onChange={(e) => setUnidadVenta(e.target.value)}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u.toLowerCase()}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            Precio de venta (con IVA)
            <input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
            <small className="field__hint">Lo cobra la caja/balanza y se muestra en tu web. El costo de compra se carga en Compras.</small>
          </label>
          <label className="field">
            PLU (opcional)
            <input type="number" value={plu} onChange={(e) => setPlu(e.target.value)} />
          </label>
        </div>

        {editing && (
          <div className="row2">
            <label className="field">
              Proveedor habitual
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="field">
              Stock mínimo ({unidadVenta.toLowerCase()})
              <input type="number" step="0.001" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder="0 = sin mínimo" />
            </label>
          </div>
        )}

        <label className="field field--check">
          <input type="checkbox" checked={esPesable} onChange={(e) => setEsPesable(e.target.checked)} />
          Se vende por peso (balanza)
        </label>

        {/* IVA — lo asigna el motor automáticamente; ADMIN/CONTADOR pueden corregir. */}
        <div className="iva-box">
          <div className="iva-box__head">
            <span>IVA</span>
            {canOverrideIva && (
              <label className="chk">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                Ajustar a mano (contador)
              </label>
            )}
          </div>
          {override && !canOverrideIva ? (
            <p className="iva-box__auto">
              Fijado por el contador: <strong>{TASA_LABEL[product?.ivaIndicador ?? ivaIndicador]}</strong>
            </p>
          ) : !override ? (
            <p className="iva-box__auto">
              {preview ? (
                <>
                  Asignado por el motor: <strong>{TASA_LABEL[preview.ivaIndicador]}</strong>
                  {preview.regla ? <span className="muted"> · regla “{preview.regla}”</span> : <span className="muted"> · sin regla, se usa el default</span>}
                </>
              ) : editing && product ? (
                <>Asignado por el motor: <strong>{TASA_LABEL[product.ivaIndicador]}</strong>{product.ivaRegla ? <span className="muted"> · regla “{product.ivaRegla}”</span> : null}</>
              ) : (
                <span className="muted">Escribí el nombre y el motor asigna el IVA solo.</span>
              )}
            </p>
          ) : (
            <div className="row2">
              <label className="field">
                Tasa
                <select value={ivaIndicador} onChange={(e) => setIva(e.target.value as IvaIndicador)}>
                  {IVAS.map((i) => <option key={i} value={i}>{TASA_LABEL[i]}</option>)}
                </select>
              </label>
              <div className="iva-box__flags">
                <label className="chk"><input type="checkbox" checked={esEstadoNatural} onChange={(e) => setEstadoNatural(e.target.checked)} /> Estado natural</label>
                <label className="chk"><input type="checkbox" checked={esImportado} onChange={(e) => setImportado(e.target.checked)} /> Importado</label>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <span>Foto del producto (se usa en tu web)</span>
          <ImageUpload value={imagenUrl} onChange={setImagenUrl} hint="Cuadrada, se ve mejor." />
        </div>

        {error && <p className="err">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
