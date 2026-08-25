import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}

// Uruguay (Montevideo) como centro por defecto cuando no hay ubicación marcada.
const DEFAULT_CENTER: [number, number] = [-34.9011, -56.1645];

// Marcador propio (divIcon) para no depender de las imágenes de Leaflet, que
// en Vite quedan con rutas rotas. Es un pin simple con el color de la marca.
const pinIcon = L.divIcon({
  className: 'map-pin',
  html: '<span class="map-pin__dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/**
 * Mapa interactivo para marcar la ubicación del local: se hace clic (o se
 * arrastra el marcador) y se devuelve lat/lng. Sin API key (tiles de OSM).
 */
export function MapPicker({ lat, lng, onPick }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const marcada = lat !== 0 || lng !== 0;

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const center: [number, number] = marcada ? [lat, lng] : DEFAULT_CENTER;
    const map = L.map(elRef.current, { center, zoom: marcada ? 16 : 13, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const la = Number(e.latlng.lat.toFixed(6));
      const ln = Number(e.latlng.lng.toFixed(6));
      onPickRef.current(la, ln);
    });

    mapRef.current = map;
    // Corrige el tamaño si el contenedor se montó oculto (tab/preview).
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el marcador y el centro cuando cambian las coordenadas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!marcada) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const pos: [number, number] = [lat, lng];
    if (!markerRef.current) {
      const m = L.marker(pos, { icon: pinIcon, draggable: true }).addTo(map);
      m.on('dragend', () => {
        const p = m.getLatLng();
        onPickRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng(pos);
    }
    map.setView(pos, Math.max(map.getZoom(), 16));
  }, [lat, lng, marcada]);

  return (
    <div className="map-picker">
      <div ref={elRef} className="map-picker__canvas" />
      <p className="hint">Tocá el mapa para marcar el local. Podés arrastrar el pin para ajustarlo.</p>
    </div>
  );
}
