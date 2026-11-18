import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapDonationMarker {
  id: number;
  foodName: string;
  category: string;
  city: string;
  pinCode: string;
  remainingQuantity: number;
  quantityUnit: string;
  latitude: number;
  longitude: number;
  hasExactAccess?: boolean;
}

interface DonationMapProps {
  donations: MapDonationMarker[];
  onSelectDonation?: (id: number) => void;
  heightClass?: string;
}

export function DonationMap({
  donations,
  onSelectDonation,
  heightClass = 'h-[440px]',
}: DonationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const centerLat = donations[0]?.latitude ?? 19.076;
      const centerLng = donations[0]?.longitude ?? 72.8777;
      mapRef.current = L.map(containerRef.current).setView([centerLat, centerLng], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    // Clear existing circleMarkers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const bounds: [number, number][] = [];
    donations.forEach((d) => {
      if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return;
      bounds.push([d.latitude, d.longitude]);

      const marker = L.circleMarker([d.latitude, d.longitude], {
        radius: 9,
        fillColor: '#15803D',
        color: '#FFFFFF',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 0.92,
      }).addTo(map);

      const safeTitle = d.foodName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeCity = `${d.city} ${d.pinCode}`.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const directionsUrl = `https://www.openstreetmap.org/directions?to=${d.latitude},${d.longitude}`;

      const popupEl = document.createElement('div');
      popupEl.className = 'text-sm space-y-1 min-w-[180px]';
      popupEl.innerHTML = `
        <div class="font-semibold text-gray-900">${safeTitle}</div>
        <div class="text-xs text-gray-600">${d.remainingQuantity} ${d.quantityUnit} · ${d.category}</div>
        <div class="text-xs text-gray-500">${safeCity}</div>
        <div class="pt-1.5 flex items-center gap-3">
          <button type="button" data-donation-id="${d.id}" class="text-xs font-semibold text-green-700 hover:underline">View Details</button>
          ${
            d.hasExactAccess
              ? `<a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-amber-600 hover:underline">Directions</a>`
              : ''
          }
        </div>
      `;

      const btn = popupEl.querySelector('button[data-donation-id]');
      if (btn && onSelectDonation) {
        btn.addEventListener('click', () => onSelectDonation(d.id));
      }

      marker.bindPopup(popupEl);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }

    return () => {};
  }, [donations, onSelectDonation]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
    </div>
  );
}
