import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StatusBar } from './components/StatusBar';
import { Login } from './components/Login';
import { ProductGrid, hayStock } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { WeighModal } from './components/WeighModal';
import { PaymentModal } from './components/PaymentModal';
import { OpenCashModal } from './components/OpenCashModal';
import { CloseCashModal } from './components/CloseCashModal';
import { TicketModal } from './components/TicketModal';
import { ScaleSettingsModal } from './components/ScaleSettingsModal';
import { OperationsModal } from './components/OperationsModal';
import { CashMovementModal } from './components/CashMovementModal';
import { useToast } from './lib/toast';
import { formatMoney } from './lib/format';
import { useCatalog } from './hooks/useCatalog';
import { useOnline } from './hooks/useOnline';
import { useScanner } from './hooks/useScanner';
import { useCash } from './hooks/useCash';
import { useScale } from './hooks/useScale';
import { cartItemFromProduct, useCart } from './state/cart';
import { parseScan } from './lib/barcode';
import { getSucursales } from './lib/api';
import type { Sucursal } from './lib/api';
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
  const toast = useToast();
  const online = useOnline();
  const { products, listaPrecio, loading, fromCache } = useCatalog();
  const cash = useCash();
  const cart = useCart();
  const [pendientes, setPendientes] = useState(0);
  const [weighing, setWeighing] = useState<CatalogProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [openingCash, setOpeningCash] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [movingCash, setMovingCash] = useState(false);
  const scale = useScale();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  useEffect(() => {
    void getSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);
  const [ticket, setTicket] = useState<OutboxSale | null>(null);

  const showToast = useCallback((msg: string) => toast.info(msg), [toast]);

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

  // Agrega respetando el stock: bloquea sin stock y no deja superar lo disponible.
  const addProduct = useCallback(
    (p: CatalogProduct, cantidad: number) => {
      if (!hayStock(p)) {
        showToast(`${p.nombre}: sin stock`);
        return;
      }
      if (p.stock != null) {
        const enCarrito = cart.items
          .filter((it) => it.productId === p.id)
          .reduce((s, it) => s + it.cantidad, 0);
        const disponible = p.stock - enCarrito;
        if (disponible <= 0) {
          showToast(`${p.nombre}: no hay más stock (${p.stock} ${p.unidadVenta.toLowerCase()})`);
          return;
        }
        if (cantidad > disponible) {
          cart.add(cartItemFromProduct(p, disponible));
          showToast(`Ajustado a ${disponible} ${p.unidadVenta.toLowerCase()} (stock disponible)`);
          return;
        }
      }
      cart.add(cartItemFromProduct(p, cantidad));
    },
    [cart, showToast],
  );

  const onPick = useCallback(
    (p: CatalogProduct) => {
      if (!hayStock(p)) return showToast(`${p.nombre}: sin stock`);
      if (p.esPesable) setWeighing(p);
      else addProduct(p, 1);
    },
    [addProduct, showToast],
  );

  const onScan = useCallback(
    (code: string) => {
      // El formato del EAN de peso variable es configurable por balanza (modo etiqueta).
      const r = parseScan(code, scale.config.barcode);
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
    [products, addProduct, onPick, showToast, scale.config.barcode],
  );

  useScanner(onScan);

  const onConfirmPayment = useCallback(
    async (payments: SalePayment[], vuelto: number) => {
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
        vuelto: vuelto > 0 ? vuelto : undefined,
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
        vuelto: vuelto > 0 ? vuelto : undefined,
        status: 'pending' as const,
        intentos: 0,
        createdAt: Date.now(),
      };
      setTicket(registro);
      const medios = [...new Set(payments.map((p) => p.medio.toLowerCase().replace(/_/g, ' ')))].join(', ');
      const comp = registro.cfe?.serie ? `Comprobante ${registro.cfe.serie}-${registro.cfe.numero}` : 'Ticket interno';
      const detalle = vuelto > 0 ? `${medios} · vuelto ${formatMoney(vuelto)} — ${comp}` : `${medios} — ${comp}`;
      toast.success(`Venta cobrada · ${formatMoney(total)}`, detalle);
      void countPending().then(setPendientes);
    },
    [cart, cash.session, toast],
  );

  const sinCaja = !cash.session;
  const cobrarDisabled = cart.items.length === 0 || sinCaja;

  // No se puede cobrar sin caja abierta: si intentan, se abre el modal de apertura.
  const onCheckout = useCallback(() => {
    if (sinCaja) {
      setOpeningCash(true);
      showToast('Primero abrí la caja');
      return;
    }
    setPaying(true);
  }, [sinCaja, showToast]);

  // Nombre de la sucursal del turno (solo si hay más de una, para diferenciar).
  const sucursalNombre =
    sucursales.length > 1 && cash.session?.sucursalId
      ? sucursales.find((s) => s.id === cash.session?.sucursalId)?.nombre ?? null
      : null;

  return (
    <div className="app">
      <StatusBar
        online={online}
        fromCache={fromCache}
        pendientes={pendientes}
        listaPrecio={listaPrecio}
        total={cart.total}
        cash={cash.session}
        sucursalNombre={sucursalNombre}
        scaleLive={scale.live && scale.connected}
        userEmail={userEmail}
        onOpenCash={() => setOpeningCash(true)}
        onCloseCash={() => setClosingCash(true)}
        onOpenScale={() => setScaleOpen(true)}
        onOpenOps={() => setOpsOpen(true)}
        onMovimiento={cash.session ? () => setMovingCash(true) : undefined}
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
          sinCaja={sinCaja}
          onSetQty={cart.setQty}
          onRemove={cart.remove}
          onClear={cart.clear}
          onCheckout={onCheckout}
          onAbrirCaja={() => setOpeningCash(true)}
        />
      </main>

      {weighing && (
        <WeighModal
          product={weighing}
          liveReading={scale.live && scale.connected ? scale.reading : null}
          onConfirm={(cantidad) => {
            addProduct(weighing, cantidad);
            setWeighing(null);
          }}
          onCancel={() => setWeighing(null)}
        />
      )}

      {scaleOpen && <ScaleSettingsModal scale={scale} onClose={() => setScaleOpen(false)} />}

      {paying && !cobrarDisabled && (
        <PaymentModal total={cart.total} onConfirm={onConfirmPayment} onCancel={() => setPaying(false)} />
      )}

      {openingCash && (
        <OpenCashModal
          loading={cash.loading}
          onConfirm={async (monto, sucursalId) => {
            await cash.open(monto, sucursalId);
            setOpeningCash(false);
            toast.success('Caja abierta', `Fondo inicial: ${formatMoney(monto)}`);
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
            toast.success('Caja cerrada', 'Arqueo registrado');
          }}
          onCancel={() => setClosingCash(false)}
        />
      )}

      {ticket && <TicketModal sale={ticket} onClose={() => setTicket(null)} />}

      {opsOpen && <OperationsModal sessionId={cash.session?.id} onClose={() => setOpsOpen(false)} />}

      {movingCash && cash.session && (
        <CashMovementModal
          sessionId={cash.session.id}
          onDone={(tipo, monto, motivo) => {
            setMovingCash(false);
            toast.success(
              `${tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado · ${formatMoney(monto)}`,
              motivo || 'Movimiento de caja',
            );
          }}
          onCancel={() => setMovingCash(false)}
        />
      )}
    </div>
  );
}
