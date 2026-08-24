/** URL de mapa embebido de OpenStreetMap (sin API key) con un marcador. */
export function osmEmbedUrl(lat: number, lng: number): string {
  const d = 0.004; // ~calle
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

/** ¿Hay una ubicación marcada? (0,0 = sin marcar). */
export function tieneUbicacion(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

/** Formatea un teléfono uruguayo: 099123456 → +598 99 123 456 (espejo del backend). */
export function formatUyPhone(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('598')) d = d.slice(3);
  d = d.replace(/^0+/, '').slice(0, 11);
  if (!d) return '';
  const grupos = d.length >= 8 ? [d.slice(0, 2), d.slice(2, 5), d.slice(5)] : [d];
  return '+598 ' + grupos.filter(Boolean).join(' ');
}
