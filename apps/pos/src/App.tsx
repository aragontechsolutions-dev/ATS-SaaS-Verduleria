import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { StatusBar } from './components/StatusBar';
import { Login } from './components/Login';
import { ProductGrid, hayStock } from './components/ProductGrid';
import { Cart } from './components/Cart';
import { WeighModal } from './components/WeighModal';
import { PaymentModal } from './components/PaymentModal';
import { OpenCashModal } from './components/OpenCashModal';
import { CloseCashModal } from './components/CloseCashModal';
import { CorteModal } from './components/CorteModal';
import { TicketModal } from './components/TicketModal';
import { ScaleSettingsModal } from './components/ScaleSettingsModal';
import { OperationsModal } from './components/OperationsModal';
import { CashMovementModal } from './components/CashMovementModal';
import { RelevoModal } from './components/RelevoModal';
import { CustomerPickerModal } from './components/CustomerPickerModal';
import { DiscountModal } from './components/DiscountModal';
import { PriceOverrideModal } from './components/PriceOverrideModal';
import { ParkedModal } from './components/ParkedModal';
import { PriceCheckModal } from './components/PriceCheckModal';
import { CobranzaModal } from './components/CobranzaModal';
import { PrinterSettingsModal } from './components/PrinterSettingsModal';
import { loadPrinterConfig, maybeOpenDrawer, openDrawer, tryReconnect } from './lib/printer';
import { requiereIdentificacion } from './lib/fiscal';
import { discountMoney, type DiscountSpec } from './lib/discount';
import { useToast } from './lib/toast';
import { useSecurity } from './lib/security';
import { formatMoney } from './lib/format';
import { useCatalog } from './hooks/useCatalog';
import { useOnline } from './hooks/useOnline';
import { useScanner } from './hooks/useScanner';
import { useCash } from './hooks/useCash';
import { useScale } from './hooks/useScale';
import { cartItemFromProduct, lineBruto, useCart, type ParkedTicket } from './state/cart';
import { promosByProduct } from './lib/promo';
import { parseScan } from './lib/barcode';
import { cashSummary, getCorte, getMe, getMyTerminals, getSucursales, postAuditEvent } from './lib/api';
import type { Corte, Sucursal } from './lib/api';
import { ChangePassword } from './components/ChangePassword';
import { supabase } from './lib/supabase';
import { countParked, countPending, deleteParked, enqueueSale, getSale, parkTicket } from './lib/db';
import { flushOutbox, onSyncChange, startAutoSync } from './lib/sync';
import type { CartItem, CatalogProduct, OutboxSale, PosCustomer, SalePayment } from './lib/types';

export default function App() {
  // undefined = cargando; null = sin sesión; Session = logueado.
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null | undefined>(
    undefined,
  );
  // Puerta de acceso una vez logueado: loading → verificando; change → primer
  // acceso (cambiar contraseña); sincaja → sin caja habilitada; ok → habilitado.
  const [gate, setGate] = useState<'loading' | 'change' | 'sincaja' | 'ok'>('loading');
  // Mensaje a mostrar en el login (usuario inactivo, contraseña actualizada…).
  const [loginMsg, setLoginMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Con sesión, validamos el acceso contra el backend: un usuario inactivo (o
  // sin membership) no resuelve contexto → 401 → lo sacamos con un mensaje. Si
  // es primer acceso, forzamos el cambio de contraseña.
  useEffect(() => {
    if (!session) { setGate('loading'); return; }
    let alive = true;
    setGate('loading');
    getMe()
      .then(async (me) => {
        if (!alive) return;
        if (me.mustChangePassword) { setGate('change'); return; }
        // Control de acceso por caja: si el comercio ya definió cajas y este
        // usuario no tiene ninguna habilitada, se le bloquea el ingreso. Offline
        // (o error) no bloquea: la apertura de caja igual lo valida en el backend.
        try {
          const { terminals, hayCajas } = await getMyTerminals();
          if (alive) setGate(hayCajas && terminals.length === 0 ? 'sincaja' : 'ok');
        } catch {
          if (alive) setGate('ok');
        }
      })
      .catch(() => {
        if (!alive) return;
        setLoginMsg('Tu usuario está inactivo o no tiene acceso. Contactá al encargado.');
        void supabase.auth.signOut();
      });
    return () => { alive = false; };
  }, [session]);

  if (session === undefined) {
    return <div className="login"><p style={{ color: '#fff' }}>Cargando…</p></div>;
  }
  if (session === null) {
    return <Login initialMessage={loginMsg} onLogged={() => setLoginMsg(null)} />;
  }
  if (gate === 'loading') {
    return <div className="login"><p style={{ color: '#fff' }}>Verificando acceso…</p></div>;
  }
  if (gate === 'change') {
    return <ChangePassword email={session.user.email ?? ''} onDone={(msg) => setLoginMsg(msg)} />;
  }
  if (gate === 'sincaja') {
    return (
      <div className="login">
        <div className="login__card">
          <img className="login__logo" src="/icon.svg" alt="Aragon Tech Solutions" />
          <h1 className="login__title">Sin caja asignada</h1>
          <p className="login__note">
            {session.user.email} no tiene ninguna caja habilitada para operar.
            Pedile al administrador que te asigne una desde el Panel (Caja → Cajas).
          </p>
          <button className="btn btn--primary login__btn" onClick={() => void supabase.auth.signOut()}>Salir</button>
        </div>
        <p className="login__foot">Aragon Tech Solutions · Technology for smarter fresh produce businesses</p>
      </div>
    );
  }

  return <Pos userEmail={session.user.email ?? ''} onLogout={() => void supabase.auth.signOut()} />;
}

function Pos({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const toast = useToast();
  const security = useSecurity();
  const online = useOnline();
  const { products, promos, listaPrecio, limiteEfectivoCaja, loading, fromCache } = useCatalog();
  const promosMap = useMemo(() => promosByProduct(promos), [promos]);
  const cash = useCash();
  const cart = useCart(promosMap);
  const [pendientes, setPendientes] = useState(0);
  const [weighing, setWeighing] = useState<CatalogProduct | null>(null);
  const [paying, setPaying] = useState(false);
  const [openingCash, setOpeningCash] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [corte, setCorte] = useState<Corte | null>(null);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [movingCash, setMovingCash] = useState(false);
  const [movementInitial, setMovementInitial] = useState<'INGRESO' | 'EGRESO' | 'SANGRIA'>('EGRESO');
  const [relevoOpen, setRelevoOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  // Descuento: null = cerrado; {kind:'line', index} o {kind:'global'}.
  const [discountTarget, setDiscountTarget] = useState<{ kind: 'line'; index: number } | { kind: 'global' } | null>(null);
  // Cambio de precio de una línea (índice) o null si está cerrado.
  const [priceTarget, setPriceTarget] = useState<number | null>(null);
  // Multiplicador de cantidad: teclear «3 *» agrega 3 unidades al próximo producto.
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [parkedCount, setParkedCount] = useState(0);
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  const [checkedProduct, setCheckedProduct] = useState<CatalogProduct | null>(null);
  const [cobranzaOpen, setCobranzaOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const multBufRef = useRef('');
  const multTimeRef = useRef(0);
  const scale = useScale();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  useEffect(() => {
    void getSucursales().then(setSucursales).catch(() => setSucursales([]));
    void getMe().then((m) => setUserId(m.userId)).catch(() => {});
    // Reconecta a una impresora ESC/POS ya autorizada (sin re-pedir permiso).
    void tryReconnect(loadPrinterConfig());
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
      if (p.esPesable) {
        setMultiplier(null); // el multiplicador no aplica a pesables
        setWeighing(p);
      } else {
        const qty = multiplier && multiplier > 0 ? multiplier : 1;
        addProduct(p, qty);
        if (multiplier) setMultiplier(null);
      }
    },
    [addProduct, showToast, multiplier],
  );

  const onScan = useCallback(
    (code: string) => {
      // El formato del EAN de peso variable es configurable por balanza (modo etiqueta).
      const r = parseScan(code, scale.config.barcode);
      // Verificador de precio abierto: el escaneo consulta, no agrega al carrito.
      if (priceCheckOpen) {
        const prod =
          r.type === 'weight'
            ? products.find((p) => p.plu === r.plu)
            : r.type === 'ean'
              ? products.find((p) => p.codigoBarras === r.code)
              : undefined;
        if (prod) setCheckedProduct(prod);
        else showToast('Producto no encontrado');
        return;
      }
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
    [products, addProduct, onPick, showToast, scale.config.barcode, priceCheckOpen],
  );

  useScanner(onScan);

  const onConfirmPayment = useCallback(
    async (payments: SalePayment[], vuelto: number) => {
      // Ítems efectivos: incluyen el descuento por línea + el global prorrateado.
      const items: CartItem[] = cart.displayItems;
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
        customer: customer ?? undefined,
        status: 'pending',
        intentos: 0,
        createdAt: Date.now(),
      });
      cart.clear();
      setCustomer(null);
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
        customer: customer ?? undefined,
        status: 'pending' as const,
        intentos: 0,
        createdAt: Date.now(),
      };
      setTicket(registro);
      // Cajón: se abre una vez al cobrar en efectivo (si está configurado).
      void maybeOpenDrawer(registro, loadPrinterConfig());
      const medios = [...new Set(payments.map((p) => p.medio.toLowerCase().replace(/_/g, ' ')))].join(', ');
      const comp = registro.cfe?.serie ? `Comprobante ${registro.cfe.serie}-${registro.cfe.numero}` : 'Ticket interno';
      const detalle = vuelto > 0 ? `${medios} · vuelto ${formatMoney(vuelto)} — ${comp}` : `${medios} — ${comp}`;
      toast.success(`Venta cobrada · ${formatMoney(total)}`, detalle);
      void countPending().then(setPendientes);
      // Límite de efectivo: si tras cobrar en efectivo el cajón supera el límite,
      // sugerimos una sangría (best-effort, solo si hay límite configurado).
      if (cash.session && limiteEfectivoCaja && payments.some((p) => p.medio === 'EFECTIVO')) {
        void cashSummary(cash.session.id)
          .then((s) => {
            if (s.superaLimite && s.limiteEfectivo != null) {
              toast.info('Conviene hacer una sangría', `Hay ${formatMoney(s.efectivoEsperado)} en el cajón (límite ${formatMoney(s.limiteEfectivo)})`);
            }
          })
          .catch(() => {});
      }
    },
    [cart, cash.session, customer, limiteEfectivoCaja, toast],
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

  const refreshParked = useCallback(() => void countParked().then(setParkedCount), []);
  useEffect(() => { refreshParked(); }, [refreshParked]);

  // Etiqueta automática de un ticket en espera (primer producto + cantidad).
  const parkedLabel = useCallback(
    (items: CartItem[]) =>
      items.length ? `${items[0].concepto}${items.length > 1 ? ` +${items.length - 1}` : ''}` : 'Ticket',
    [],
  );

  // Suspender: guarda el carrito actual como ticket en espera y limpia la caja.
  const onSuspend = useCallback(() => {
    if (cart.items.length === 0) return showToast('El carrito está vacío');
    void parkTicket({
      id: uuidv4(),
      label: parkedLabel(cart.items),
      items: cart.items,
      globalDiscount: cart.globalDiscount,
      customer: customer ?? undefined,
      createdAt: Date.now(),
    }).then(() => {
      cart.clear();
      setCustomer(null);
      setMultiplier(null);
      refreshParked();
      toast.info('Venta puesta en espera');
    });
  }, [cart, customer, parkedLabel, refreshParked, showToast, toast]);

  // Retomar: si hay algo en el carrito, lo suspende antes para no perderlo.
  const onResume = useCallback(
    (t: ParkedTicket) => {
      if (cart.items.length > 0) {
        void parkTicket({
          id: uuidv4(),
          label: parkedLabel(cart.items),
          items: cart.items,
          globalDiscount: cart.globalDiscount,
          customer: customer ?? undefined,
          createdAt: Date.now(),
        });
      }
      cart.load(t.items, t.globalDiscount);
      setCustomer(t.customer ?? null);
      void deleteParked(t.id).then(refreshParked);
      setParkedOpen(false);
      toast.info(`Retomaste: ${t.label}`);
    },
    [cart, customer, parkedLabel, refreshParked, toast],
  );

  // Quitar una línea del carrito. Se registra en la auditoría (anti-fraude):
  // "descuentos" por anulación de líneas ya escaneadas son un patrón clásico.
  const onRemoveLine = useCallback(
    (index: number) => {
      const it = cart.items[index];
      if (it) {
        void postAuditEvent('ANULACION_LINEA', {
          descripcion: `Se quitó ${it.concepto} del ticket`,
          monto: it.cantidad * it.precioUnit,
          cashSessionId: cash.session?.id,
          meta: { concepto: it.concepto, cantidad: it.cantidad, precioUnit: it.precioUnit, unidad: it.unidad },
        });
      }
      cart.remove(index);
    },
    [cart, cash.session?.id],
  );

  // Confirmar el cambio de precio de una línea (ya autorizado por PIN).
  const onConfirmPrice = useCallback(
    (index: number, precioUnit: number) => {
      const it = cart.items[index];
      setPriceTarget(null);
      if (!it) return;
      cart.setPrecio(index, precioUnit);
      void postAuditEvent('PRECIO_MODIFICADO', {
        descripcion: `${it.concepto}: ${formatMoney(it.precioUnit)} → ${formatMoney(precioUnit)}`,
        monto: precioUnit,
        cashSessionId: cash.session?.id,
        meta: { concepto: it.concepto, anterior: it.precioUnit, nuevo: precioUnit, unidad: it.unidad },
      });
    },
    [cart, cash.session?.id],
  );

  // Corte X: resumen parcial del turno sin cerrar la caja.
  const onCorteX = useCallback(() => {
    if (!cash.session) return;
    void getCorte(cash.session.id)
      .then(setCorte)
      .catch((e) => showToast(e instanceof Error ? e.message : 'No se pudo generar el corte'));
  }, [cash.session, showToast]);

  const anyModalOpen =
    paying || openingCash || closingCash || scaleOpen || opsOpen || movingCash || relevoOpen || !!corte ||
    customerOpen || !!discountTarget || priceTarget != null || !!ticket || !!weighing || parkedOpen || priceCheckOpen || cobranzaOpen || printerOpen;

  // Cierra el modal de nivel superior con Escape. Devuelve true si cerró alguno.
  const closeTopModal = useCallback((): boolean => {
    if (corte) return setCorte(null), true;
    if (ticket) return setTicket(null), true;
    if (printerOpen) return setPrinterOpen(false), true;
    if (cobranzaOpen) return setCobranzaOpen(false), true;
    if (priceCheckOpen) return setPriceCheckOpen(false), true;
    if (parkedOpen) return setParkedOpen(false), true;
    if (discountTarget) return setDiscountTarget(null), true;
    if (priceTarget != null) return setPriceTarget(null), true;
    if (customerOpen) return setCustomerOpen(false), true;
    if (paying) return setPaying(false), true;
    if (relevoOpen) return setRelevoOpen(false), true;
    if (movingCash) return setMovingCash(false), true;
    if (closingCash) return setClosingCash(false), true;
    if (openingCash) return setOpeningCash(false), true;
    if (scaleOpen) return setScaleOpen(false), true;
    if (opsOpen) return setOpsOpen(false), true;
    if (weighing) return setWeighing(null), true;
    return false;
  }, [corte, ticket, printerOpen, cobranzaOpen, priceCheckOpen, parkedOpen, discountTarget, priceTarget, customerOpen, paying, movingCash, relevoOpen, closingCash, openingCash, scaleOpen, opsOpen, weighing]);

  const openPriceCheck = useCallback(() => { setCheckedProduct(null); setPriceCheckOpen(true); }, []);

  // Atajos de teclado y multiplicador de cantidad (venta rápida por teclado).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      // Cobrar: F9 o Ctrl/Cmd+Enter (Enter simple lo usa el lector de código).
      if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        if (!anyModalOpen && !cobrarDisabled) onCheckout();
        return;
      }
      // Suspender la venta actual: F7.
      if (e.key === 'F7') {
        e.preventDefault();
        if (!anyModalOpen && cart.items.length > 0) onSuspend();
        return;
      }
      // Consultar precio: F3.
      if (e.key === 'F3') {
        e.preventDefault();
        if (!anyModalOpen) openPriceCheck();
        return;
      }
      // Enfocar el buscador: F2 o «/» (si no se está tipeando).
      if (e.key === 'F2' || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      // Cancelar: cierra el modal abierto o limpia el multiplicador.
      if (e.key === 'Escape') {
        if (closeTopModal()) { e.preventDefault(); return; }
        if (multiplier) { setMultiplier(null); e.preventDefault(); }
        return;
      }

      // El multiplicador solo se arma fuera de inputs y sin modales abiertos.
      if (typing || anyModalOpen) return;
      if (/^[0-9]$/.test(e.key)) {
        const now = Date.now();
        if (now - multTimeRef.current > 1500) multBufRef.current = '';
        multTimeRef.current = now;
        multBufRef.current += e.key;
        return;
      }
      if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        const n = parseInt(multBufRef.current, 10);
        multBufRef.current = '';
        if (n > 0) { setMultiplier(n); e.preventDefault(); }
        return;
      }
      if (e.key === 'Enter') { multBufRef.current = ''; return; } // límite de escaneo
      if (e.key.length === 1) multBufRef.current = ''; // cualquier otra tecla reinicia
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen, cobrarDisabled, onCheckout, closeTopModal, multiplier, cart.items.length, onSuspend, openPriceCheck]);

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
        onOpenPrinter={() => setPrinterOpen(true)}
        onOpenOps={() => setOpsOpen(true)}
        onOpenPrice={openPriceCheck}
        onCobranza={() => setCobranzaOpen(true)}
        onOpenSecurity={security.openSettings}
        onMovimiento={cash.session ? () => { setMovementInitial('EGRESO'); setMovingCash(true); } : undefined}
        onSangria={cash.session ? () => { setMovementInitial('SANGRIA'); setMovingCash(true); } : undefined}
        onRelevo={cash.session?.terminalId ? () => setRelevoOpen(true) : undefined}
        onCorteX={cash.session ? onCorteX : undefined}
        onLogout={onLogout}
      />
      <main className="main">
        {loading ? (
          <p className="empty">Cargando catálogo…</p>
        ) : (
          <ProductGrid products={products} onPick={onPick} searchRef={searchRef} onMultiplier={(n) => setMultiplier(n > 0 ? n : null)} />
        )}
        {multiplier && (
          <div className="mult-badge" role="status">
            × {multiplier}
            <button onClick={() => setMultiplier(null)} aria-label="Quitar multiplicador">✕</button>
          </div>
        )}
        <div className="kbd-hints">
          <span><kbd>F2</kbd> buscar</span>
          <span><kbd>3</kbd><kbd>*</kbd> cantidad</span>
          <span><kbd>F3</kbd> precio</span>
          <span><kbd>F7</kbd> suspender</span>
          <span><kbd>F9</kbd> cobrar</span>
          <span><kbd>Esc</kbd> cancelar</span>
        </div>
        <Cart
          items={cart.displayItems}
          totals={cart.totals}
          promos={promosMap}
          hayGlobalDiscount={!!cart.globalDiscount}
          sinCaja={sinCaja}
          customer={customer}
          requiereIdent={requiereIdentificacion(cart.total)}
          onIdentify={() => setCustomerOpen(true)}
          onClearCustomer={() => setCustomer(null)}
          onSetQty={cart.setQty}
          onEditPrice={(index) => void security.requireAuth('price').then((ok) => ok && setPriceTarget(index))}
          onLineDiscount={(index) => void security.requireAuth('discount').then((ok) => ok && setDiscountTarget({ kind: 'line', index }))}
          onGlobalDiscount={() => void security.requireAuth('discount').then((ok) => ok && setDiscountTarget({ kind: 'global' }))}
          onSuspend={onSuspend}
          onOpenParked={() => setParkedOpen(true)}
          parkedCount={parkedCount}
          onRemove={onRemoveLine}
          onClear={() => void security.requireAuth('void').then((ok) => ok && cart.clear())}
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

      {customerOpen && (
        <CustomerPickerModal
          onPick={(c) => { setCustomer(c); setCustomerOpen(false); }}
          onClose={() => setCustomerOpen(false)}
        />
      )}

      {parkedOpen && (
        <ParkedModal onResume={onResume} onClose={() => setParkedOpen(false)} onChange={refreshParked} />
      )}

      {priceCheckOpen && (
        <PriceCheckModal
          products={products}
          product={checkedProduct}
          onSelect={setCheckedProduct}
          onClose={() => setPriceCheckOpen(false)}
        />
      )}

      {printerOpen && <PrinterSettingsModal onClose={() => setPrinterOpen(false)} />}

      {cobranzaOpen && (
        <CobranzaModal
          cashSessionId={cash.session?.id}
          onClose={() => setCobranzaOpen(false)}
          onDone={(monto, medio, cliente) => {
            setCobranzaOpen(false);
            toast.success(
              `Cobranza · ${formatMoney(monto)}`,
              `${cliente} — ${medio.toLowerCase().replace(/_/g, ' ')}`,
            );
          }}
        />
      )}

      {discountTarget?.kind === 'line' && cart.items[discountTarget.index] && (
        <DiscountModal
          titulo={`Descuento · ${cart.items[discountTarget.index].concepto}`}
          base={lineBruto(cart.items[discountTarget.index])}
          actual={cart.items[discountTarget.index].descuento ? { mode: 'amount', value: cart.items[discountTarget.index].descuento! } : null}
          onConfirm={(spec: DiscountSpec | null) => {
            const base = lineBruto(cart.items[discountTarget.index]);
            cart.setDescuento(discountTarget.index, spec ? discountMoney(base, spec) : 0);
            setDiscountTarget(null);
          }}
          onCancel={() => setDiscountTarget(null)}
        />
      )}

      {priceTarget != null && cart.items[priceTarget] && (
        <PriceOverrideModal
          concepto={cart.items[priceTarget].concepto}
          unidad={cart.items[priceTarget].unidad}
          cantidad={cart.items[priceTarget].cantidad}
          actual={cart.items[priceTarget].precioUnit}
          onConfirm={(precioUnit) => onConfirmPrice(priceTarget, precioUnit)}
          onCancel={() => setPriceTarget(null)}
        />
      )}

      {discountTarget?.kind === 'global' && (
        <DiscountModal
          titulo="Descuento total"
          base={cart.totals.total + cart.totals.globalDescuento}
          actual={cart.globalDiscount}
          onConfirm={(spec: DiscountSpec | null) => { cart.setGlobalDiscount(spec); setDiscountTarget(null); }}
          onCancel={() => setDiscountTarget(null)}
        />
      )}

      {paying && !cobrarDisabled && (
        <PaymentModal
          total={cart.total}
          customer={customer}
          requiereIdent={requiereIdentificacion(cart.total)}
          onConfirm={onConfirmPayment}
          onCancel={() => setPaying(false)}
        />
      )}

      {openingCash && (
        <OpenCashModal
          loading={cash.loading}
          onConfirm={async (monto, sucursalId, terminalId) => {
            await cash.open(monto, sucursalId, terminalId);
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
            const cerradaId = cash.session?.id;
            cash.clear();
            setClosingCash(false);
            toast.success('Caja cerrada', 'Arqueo registrado');
            // Ofrecer el corte Z del turno recién cerrado.
            if (cerradaId) void getCorte(cerradaId).then(setCorte).catch(() => {});
          }}
          onCancel={() => setClosingCash(false)}
        />
      )}

      {corte && <CorteModal corte={corte} onClose={() => setCorte(null)} />}

      {ticket && <TicketModal sale={ticket} onClose={() => setTicket(null)} />}

      {opsOpen && <OperationsModal sessionId={cash.session?.id} onClose={() => setOpsOpen(false)} />}

      {movingCash && cash.session && (
        <CashMovementModal
          sessionId={cash.session.id}
          initialTipo={movementInitial}
          onDone={(tipo, monto, motivo) => {
            setMovingCash(false);
            const label = tipo === 'INGRESO' ? 'Ingreso' : tipo === 'SANGRIA' ? 'Sangría' : 'Egreso';
            toast.success(`${label} · ${formatMoney(monto)}`, motivo || 'Movimiento de caja');
            // La sangría saca efectivo del cajón: abrimos el cajón para retirarlo.
            if (tipo === 'SANGRIA') void openDrawer(loadPrinterConfig()).catch(() => {});
          }}
          onCancel={() => setMovingCash(false)}
        />
      )}

      {relevoOpen && cash.session?.terminalId && (
        <RelevoModal
          terminalId={cash.session.terminalId}
          terminalNombre={cash.session.terminal ?? null}
          salienteUserId={userId}
          onDone={(r) => {
            setRelevoOpen(false);
            cash.clear();
            toast.success(`Caja entregada a ${r.entrante}`, 'Cerrá sesión para que inicie su turno.');
          }}
          onCancel={() => setRelevoOpen(false)}
        />
      )}
    </div>
  );
}
