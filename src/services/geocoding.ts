const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  surat: { lat: 21.1702, lng: 72.8311 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  indore: { lat: 22.7196, lng: 75.8577 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  london: { lat: 51.5072, lng: -0.1276 },
  'new york': { lat: 40.7128, lng: -74.006 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  singapore: { lat: 1.3521, lng: 103.8198 },
};

export async function geocodeLocation(
  address: string,
  city: string,
  pinCode: string
): Promise<{ latitude: number; longitude: number }> {
  const cityKey = city.trim().toLowerCase();

  try {
    const query = encodeURIComponent(`${address}, ${city} ${pinCode}`.trim());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`,
      {
        headers: { 'User-Agent': 'FoodShare-Redistribution-Platform/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }
  } catch {
    // Fallback to known city coordinates with deterministic PIN offset
  }

  const base = CITY_COORDS[cityKey] || { lat: 19.076, lng: 72.8777 };
  const pinHash = pinCode
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const offsetLat = ((pinHash % 19) - 9) * 0.004;
  const offsetLng = (((pinHash * 7) % 19) - 9) * 0.004;

  return {
    latitude: Number((base.lat + offsetLat).toFixed(6)),
    longitude: Number((base.lng + offsetLng).toFixed(6)),
  };
}
