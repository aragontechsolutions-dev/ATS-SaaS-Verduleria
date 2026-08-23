// Estructura del contenido de la landing de un tenant. Se guarda como Json en
// la base (draft / publicado). El backend SIEMPRE normaliza la entrada del
// admin a esta forma (whitelist) antes de guardar, así no se persiste JSON
// arbitrario. La función `normalizeLanding` es pura y está cubierta por tests.

export interface LandingProducto {
  nombre: string;
  precio: string;
  imagenUrl: string;
}

export interface LandingConfig {
  tema: { color: string };
  hero: { mostrar: boolean; titulo: string; lema: string; imagenUrl: string };
  productos: { mostrar: boolean; titulo: string; items: LandingProducto[] };
  horarios: { mostrar: boolean; texto: string; direccion: string; mapaUrl: string };
  contacto: { mostrar: boolean; whatsapp: string; telefono: string; instagram: string; facebook: string };
}

const MAX_ITEMS = 24;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const str = (v: unknown, max = 300): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def);

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Config por defecto para una verdulería recién creada. */
export function defaultLanding(nombre: string, direccion?: string | null): LandingConfig {
  return {
    tema: { color: '#0F8A7C' },
    hero: { mostrar: true, titulo: nombre, lema: 'Fruta y verdura fresca todos los días.', imagenUrl: '' },
    productos: { mostrar: true, titulo: 'Ofertas de la semana', items: [] },
    horarios: { mostrar: true, texto: 'Lun a Sáb 8:00–20:00', direccion: direccion ?? '', mapaUrl: '' },
    contacto: { mostrar: true, whatsapp: '', telefono: '', instagram: '', facebook: '' },
  };
}

/** Normaliza cualquier entrada a un LandingConfig limpio (whitelist + límites). */
export function normalizeLanding(raw: unknown, fallbackNombre = 'Mi verdulería'): LandingConfig {
  const r = obj(raw);
  const hero = obj(r.hero);
  const productos = obj(r.productos);
  const horarios = obj(r.horarios);
  const contacto = obj(r.contacto);
  const tema = obj(r.tema);

  const color = str(tema.color, 7);
  const items = Array.isArray(productos.items) ? productos.items : [];

  return {
    tema: { color: COLOR_RE.test(color) ? color : '#0F8A7C' },
    hero: {
      mostrar: bool(hero.mostrar, true),
      titulo: str(hero.titulo, 120) || fallbackNombre,
      lema: str(hero.lema, 200),
      imagenUrl: str(hero.imagenUrl, 500),
    },
    productos: {
      mostrar: bool(productos.mostrar, true),
      titulo: str(productos.titulo, 120) || 'Ofertas de la semana',
      items: items.slice(0, MAX_ITEMS).map((it) => {
        const p = obj(it);
        return { nombre: str(p.nombre, 80), precio: str(p.precio, 40), imagenUrl: str(p.imagenUrl, 500) };
      }),
    },
    horarios: {
      mostrar: bool(horarios.mostrar, true),
      texto: str(horarios.texto, 300),
      direccion: str(horarios.direccion, 200),
      mapaUrl: str(horarios.mapaUrl, 500),
    },
    contacto: {
      mostrar: bool(contacto.mostrar, true),
      whatsapp: str(contacto.whatsapp, 40),
      telefono: str(contacto.telefono, 40),
      instagram: str(contacto.instagram, 120),
      facebook: str(contacto.facebook, 120),
    },
  };
}
