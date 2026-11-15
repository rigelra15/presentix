import { ExternalLink, MapPin } from 'lucide-react'
import { formatCoordinates } from '../lib/format'

interface Props {
  latitude: number
  longitude: number
  accuracy?: number | null
  height?: number
}

// Small OpenStreetMap preview. Uses the public embed page,
// so no map library or API key is needed.
export default function LocationMap({ latitude, longitude, accuracy, height = 220 }: Props) {
  const delta = 0.004 // about 400 m around the point

  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta
  ].join(',')

  const embedUrl =
    'https://www.openstreetmap.org/export/embed.html' +
    `?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  return (
    <div className="location-map">
      <iframe
        title="Check-in location map"
        src={embedUrl}
        style={{ height }}
        loading="lazy"
      />
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
