import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  /** Centro inicial (ubicación del local o de la zona). */
  center: { lat: number; lng: number } | null;
  /** Punto marcado por el cliente. */
  value: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}

// Maldonado (plaza San Fernando) como centro por defecto.
const DEFAULT_CENTER: [number, number] = [-34.9087, -54.9506];

const pinIcon = L.divIcon({
  className: 'ck-pin',
  html: '<span class="ck-pin__dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/**
 * Mapa para que el cliente marque el punto exacto de entrega. Toca el mapa
 * (o arrastra el pin) y se guarda lat/lng. Sin API key (tiles de OSM).
 */
export function CheckoutMap({ center, value, onPick }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const start: [number, number] = value
      ? [value.lat, value.lng]
      : center
        ? [center.lat, center.lng]
        : DEFAULT_CENTER;
    const map = L.map(elRef.current, { center: start, zoom: value || center ? 16 : 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const poner = (la: number, ln: number) => {
      const lat = Number(la.toFixed(6));
      const lng = Number(ln.toFixed(6));
      onPickRef.current(lat, lng);
    };
    map.on('click', (e: L.LeafletMouseEvent) => poner(e.latlng.lat, e.latlng.lng));

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [center, value]);

  // Sincroniza el marcador con el valor.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value) {
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLatLng();
          onPickRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
        });
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  function usarMiUbicacion() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 17);
        onPickRef.current(Number(latitude.toFixed(6)), Number(longitude.toFixed(6)));
      },
      () => { /* permiso denegado: el cliente marca a mano */ },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="ck-map">
      <div className="ck-map__canvas" ref={elRef} />
      <div className="ck-map__bar">
        <span>{value ? '📍 Punto marcado' : 'Tocá el mapa para marcar dónde entregar'}</span>
        <button type="button" className="ck-map__gps" onClick={usarMiUbicacion}>📍 Mi ubicación</button>
      </div>
    </div>
  );
}
