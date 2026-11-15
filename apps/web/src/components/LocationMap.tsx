import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { ExternalLink, MapPin } from 'lucide-react'
import { formatCoordinates } from '../lib/format'

// MapLibre runs map work in a web worker. With Vite we have to
// tell MapLibre where the bundled worker file is.
maplibregl.setWorkerUrl(workerUrl)

// Free vector map style from OpenFreeMap (no API key needed)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  latitude: number
  longitude: number
  accuracy?: number | null
  // fill = same size as the camera frame on the check-in page
  fill?: boolean
}

export default function LocationMap({ latitude, longitude, accuracy, fill }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude], // MapLibre uses [lng, lat]
      zoom: 15,
      attributionControl: { compact: true },
      // Needs two fingers / Ctrl+scroll to move the map,
      // so scrolling the page does not get stuck on the map.
      cooperativeGestures: true
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    new maplibregl.Marker({ color: '#0f766e' })
      .setLngLat([longitude, latitude])
      .addTo(map)

    // Clean up the map when the component is removed or the location changes
    return () => map.remove()
  }, [latitude, longitude])

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  return (
    <div className={`location-map ${fill ? 'location-map-fill' : ''}`}>
      <div ref={containerRef} className="map-canvas" />
      <div className="location-meta">
        <span>
          <MapPin size={14} />
          {formatCoordinates(latitude, longitude)}
          {accuracy != null && <small> · ±{accuracy} m</small>}
        </span>
        <a href={googleMapsUrl} target="_blank" rel="noreferrer">
          Open in Google Maps
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
