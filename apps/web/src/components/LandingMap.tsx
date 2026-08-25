import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  nombre?: string;
}

// Pin propio (divIcon) para no depender de las imágenes de Leaflet, que en el
// build de Vite quedan con rutas rotas. Usa el color de acento del landing.
const pinIcon = L.divIcon({
  className: 'lp-pin',
  html: '<span class="lp-pin__dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/**
 * Mapa de solo lectura con la ubicación del local. Leaflet + tiles de OSM
 * (sin API key). Reemplaza al iframe embebido, que a veces no cargaba.
 */
export function LandingMap({ lat, lng, nombre }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    const m = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    if (nombre) m.bindPopup(nombre);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reposiciona si cambian las coordenadas (no debería, pero por las dudas).
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setView([lat, lng], 16);
  }, [lat, lng]);

  return <div ref={elRef} className="lp-map" />;
}
