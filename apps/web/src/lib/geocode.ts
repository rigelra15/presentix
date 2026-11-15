// Reverse geocoding: turns coordinates into a readable address.
// Uses the free OpenStreetMap Nominatim API (no API key).
// Its usage policy allows about 1 request per second, so results are
// cached and the address is only looked up where a map is shown.
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

// Same coordinates -> same request, even if several components ask for it
const cache = new Map<string, Promise<string | null>>()

// Returns the address, or null if it cannot be found
export function getAddress(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`
  const cached = cache.get(key)

  if (cached) {
    return cached
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    zoom: '18',
    'accept-language': 'id,en'
  })

  const request = fetch(`${NOMINATIM_URL}?${params}`)
    .then(response => (response.ok ? response.json() : null))
    .then((data: { display_name?: string } | null) => data?.display_name ?? null)
    .catch(() => null)

  cache.set(key, request)
  return request
}
