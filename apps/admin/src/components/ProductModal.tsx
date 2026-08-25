import { useState } from 'react';
import { createProduct, updateProduct } from '../lib/api';
import type { Categoria, IvaIndicador, Product } from '../lib/api';
import { ImageUpload } from './ImageUpload';
import { useToast } from '../lib/toast';

interface Props {
  product?: Product;
  categorias: Categoria[];
  onClose: () => void;
  onSaved: () => void;
}

const UNIDADES = ['KG', 'GRAMO', 'UNIDAD', 'ATADO', 'DOCENA', 'BANDEJA'];
const IVAS: IvaIndicador[] = ['MINIMA', 'BASICA', 'EXENTO', 'SUSPENSO'];

export function ProductModal({ product, categorias, onClose, onSaved }: Props) {
  const toast = useToast();
  const editing = !!product;
  const [nombre, setNombre] = useState(product?.nombre ?? '');
  const [unidadVenta, setUnidadVenta] = useState(product?.unidadVenta ?? 'KG');
  const [esPesable, setEsPesable] = useState(product?.esPesable ?? true);
  const [ivaIndicador, setIva] = useState<IvaIndicador>(product?.ivaIndicador ?? 'MINIMA');
  const [precio, setPrecio] = useState(String(product?.precio ?? ''));
  const [categoriaId, setCategoriaId] = useState(product?.categoriaId ?? '');
  const [plu, setPlu] = useState(product?.plu != null ? String(product.plu) : '');
  const [imagenUrl, setImagenUrl] = useState(product?.imagenUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      nombre: nombre.trim(),
      unidadVenta,
      esPesable,
      ivaIndicador,
      precio: parseFloat(precio) || 0,
      categoriaId: categoriaId || undefined,
      plu: plu ? parseInt(plu, 10) : undefined,
      imagenUrl: imagenUrl || undefined,
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
            <small className="field__hint">Es el precio que cobra la caja/balanza y el que se muestra en tu web. El costo de compra se carga en Compras.</small>
          </label>
          <label className="field">
            IVA
            <select value={ivaIndicador} onChange={(e) => setIva(e.target.value as IvaIndicador)}>
              {IVAS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            PLU (opcional)
            <input type="number" value={plu} onChange={(e) => setPlu(e.target.value)} />
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={esPesable} onChange={(e) => setEsPesable(e.target.checked)} />
            Se vende por peso (balanza)
          </label>
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
