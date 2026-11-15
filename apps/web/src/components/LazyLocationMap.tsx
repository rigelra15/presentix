import { lazy, Suspense, type ComponentProps } from 'react'

// MapLibre is a big library (~1 MB), so it is only downloaded
// when a page actually shows a map.
const LocationMap = lazy(() => import('./LocationMap'))

type Props = ComponentProps<typeof LocationMap>

export default function LazyLocationMap(props: Props) {
  // Empty box with the same size as the map while it loads
  const fallback = (
    <div className={`location-map ${props.fill ? 'location-map-fill' : ''}`}>
      <div className="map-canvas" />
    </div>
  )

  return (
    <Suspense fallback={fallback}>
      <LocationMap {...props} />
    </Suspense>
  )
}
