import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StatusBar } from './components/StatusBar';
import { Login } from './components/Login';
import { ProductGrid } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { WeighModal } from './components/WeighModal';
import { PaymentModal } from './components/PaymentModal';
import { OpenCashModal } from './components/OpenCashModal';
import { CloseCashModal } from './components/CloseCashModal';
import { TicketModal } from './components/TicketModal';
import { useCatalog } from './hooks/useCatalog';
import { useOnline } from './hooks/useOnline';
import { useScanner } from './hooks/useScanner';
import { useCash } from './hooks/useCash';
import { cartItemFromProduct, useCart } from './state/cart';
import { parseScan } from './lib/barcode';
import { supabase } from './lib/supabase';
import { countPending, enqueueSale, getSale } from './lib/db';
import { flushOutbox, onSyncChange, startAutoSync } from './lib/sync';
import type { CartItem, CatalogProduct, OutboxSale, SalePayment } from './lib/types';

export default function App() {
  // undefined = cargando; null = sin sesión; Session = logueado.
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null | undefined>(
    undefined,
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="login"><p style={{ color: '#fff' }}>Cargando…</p></div>;
  }
  if (session === null) {
    return <Login onLogged={() => { /* onAuthStateChange actualiza la sesión */ }} />;
  }

  return <Pos userEmail={session.user.email ?? ''} onLogout={() => void supabase.auth.signOut()} />;
}

function Pos({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const online = useOnline();
  const { products, listaPrecio, loading, fromCache } = useCatalog();
  const cash = useCash();
  const cart = useCart();
  const [pendientes, setPendientes] = useState(0);
  const [weighing, setWeighing] = useState<CatalogProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [openingCash, setOpeningCash] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [ticket, setTicket] = useState<OutboxSale | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

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
    (p: CatalogProduct, cantidad: number) => cart.add(cartItemFromProduct(p, cantidad)),
    [cart],
  );

  const onPick = useCallback(
    (p: CatalogProduct) => {
      if (p.esPesable) setWeighing(p);
      else addProduct(p, 1);
    },
    [addProduct],
  );

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
      const total = cart.total;
      const id = uuidv4(); // idempotencyKey = id_externo del CFE
      await enqueueSale({
        id,
        fecha: new Date().toISOString(),
        cashSessionId: cash.session?.id,
        items,
        payments,
        total,
        status: 'pending',
        intentos: 0,
        createdAt: Date.now(),
      });
      cart.clear();
      setPaying(false);
      // Intentar subir + emitir el e-Ticket ahora; luego mostrar el comprobante.
      await flushOutbox();
      const registro = (await getSale(id)) ?? {
        id,
        fecha: new Date().toISOString(),
        items,
        payments,
        total,
        status: 'pending' as const,
        intentos: 0,
        createdAt: Date.now(),
      };
      setTicket(registro);
      void countPending().then(setPendientes);
    },
    [cart, cash.session],
  );

  const cobrarDisabled = cart.items.length === 0;

  return (
    <div className="app">
      <StatusBar
        online={online}
        fromCache={fromCache}
        pendientes={pendientes}
        listaPrecio={listaPrecio}
        total={cart.total}
        cash={cash.session}
        userEmail={userEmail}
        onOpenCash={() => setOpeningCash(true)}
        onCloseCash={() => setClosingCash(true)}
        onLogout={onLogout}
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

      {paying && !cobrarDisabled && (
        <PaymentModal total={cart.total} onConfirm={onConfirmPayment} onCancel={() => setPaying(false)} />
      )}

      {openingCash && (
        <OpenCashModal
          loading={cash.loading}
          onConfirm={async (monto) => {
            await cash.open(monto);
            setOpeningCash(false);
            showToast('Caja abierta');
          }}
          onCancel={() => setOpeningCash(false)}
        />
      )}

      {closingCash && cash.session && (
        <CloseCashModal
          sessionId={cash.session.id}
          onClosed={() => {
            cash.clear();
            setClosingCash(false);
            showToast('Caja cerrada');
          }}
          onCancel={() => setClosingCash(false)}
        />
      )}

      {ticket && <TicketModal sale={ticket} onClose={() => setTicket(null)} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
