import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StatusBar } from './components/StatusBar';
import { ProductGrid } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { WeighModal } from './components/WeighModal';
import { PaymentModal } from './components/PaymentModal';
import { useCatalog } from './hooks/useCatalog';
import { useOnline } from './hooks/useOnline';
import { useScanner } from './hooks/useScanner';
import { cartItemFromProduct, useCart } from './state/cart';
import { parseScan } from './lib/barcode';
import { countPending, enqueueSale } from './lib/db';
import { flushOutbox, onSyncChange, startAutoSync } from './lib/sync';
import type { CartItem, CatalogProduct, SalePayment } from './lib/types';

export default function App() {
  const online = useOnline();
  const { products, listaPrecio, loading, fromCache } = useCatalog();
  const cart = useCart();
  const [pendientes, setPendientes] = useState(0);
  const [weighing, setWeighing] = useState<CatalogProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Auto-sync + contador de pendientes.
  useEffect(() => {
    const stop = startAutoSync();
    const refreshCount = () => void countPending().then(setPendientes);
    const off = onSyncChange(refreshCount);
    refreshCount();
    return () => {
      stop();
      off();
    };
  }, []);

  const addProduct = useCallback(
    (p: CatalogProduct, cantidad: number) => {
      cart.add(cartItemFromProduct(p, cantidad));
    },
    [cart],
  );

  const onPick = useCallback(
    (p: CatalogProduct) => {
      if (p.esPesable) setWeighing(p);
      else addProduct(p, 1);
    },
    [addProduct],
  );

  // Escaneo: peso variable (PLU), EAN normal (código de barras) o no encontrado.
  const onScan = useCallback(
    (code: string) => {
      const r = parseScan(code);
      if (r.type === 'weight') {
        const prod = products.find((p) => p.plu === r.plu);
        if (!prod) return showToast(`PLU ${r.plu} no encontrado`);
        if (r.kind === 'weight' && r.weightKg != null) {
          addProduct(prod, r.weightKg);
          showToast(`${prod.nombre} · ${r.weightKg.toFixed(3)} kg`);
        } else if (r.kind === 'price' && r.price != null && prod.precio > 0) {
          addProduct(prod, r.price / prod.precio);
          showToast(`${prod.nombre} · importe`);
        }
        return;
      }
      if (r.type === 'ean') {
        const prod = products.find((p) => p.codigoBarras === r.code);
        if (!prod) return showToast(`Código ${r.code} no encontrado`);
        onPick(prod);
        return;
      }
      showToast('Código no reconocido');
    },
    [products, addProduct, onPick, showToast],
  );

  useScanner(onScan);

  const onConfirmPayment = useCallback(
    async (payments: SalePayment[]) => {
      const items: CartItem[] = cart.items;
      const id = uuidv4(); // idempotencyKey = id_externo del CFE
      await enqueueSale({
        id,
        fecha: new Date().toISOString(),
        items,
        payments,
        total: cart.total,
        status: 'pending',
        intentos: 0,
        createdAt: Date.now(),
      });
      cart.clear();
      setPaying(false);
      void countPending().then(setPendientes);
      showToast('Venta registrada' + (online ? '' : ' (offline, se sincroniza luego)'));
      void flushOutbox();
    },
    [cart, online, showToast],
  );

  return (
    <div className="app">
      <StatusBar
        online={online}
        fromCache={fromCache}
        pendientes={pendientes}
        listaPrecio={listaPrecio}
        total={cart.total}
      />
      <main className="main">
        {loading ? (
          <p className="empty">Cargando catálogo…</p>
        ) : (
          <ProductGrid products={products} onPick={onPick} />
        )}
        <Cart
          items={cart.items}
          total={cart.total}
          onSetQty={cart.setQty}
          onRemove={cart.remove}
          onClear={cart.clear}
          onCheckout={() => setPaying(true)}
        />
      </main>

      {weighing && (
        <WeighModal
          product={weighing}
          onConfirm={(cantidad) => {
            addProduct(weighing, cantidad);
            setWeighing(null);
          }}
          onCancel={() => setWeighing(null)}
        />
      )}

      {paying && (
        <PaymentModal total={cart.total} onConfirm={onConfirmPayment} onCancel={() => setPaying(false)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
