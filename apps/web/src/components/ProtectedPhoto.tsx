import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fetchPhoto } from '../lib/api'

interface Props {
  token: string
  // API path of the photo, e.g. /api/attendance/attendances/5/photo
  path: string
  alt: string
}

// The photo endpoints need the Authorization header,
// so the image is downloaded with fetch and shown with an object URL.
// Render it with key={path} so a new photo starts fresh.
export default function ProtectedPhoto({ token, path, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    fetchPhoto(token, path)
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load photo')
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [token, path])

  if (error) {
    return (
      <div className="photo-box photo-empty">
        <ImageOff size={28} />
        <span>{error}</span>
      </div>
    )
  }

  if (!url) {
    return <div className="photo-box photo-loading">Loading photo...</div>
  }

  return (
    <div className="photo-box">
      <img src={url} alt={alt} />
    </div>
  )
}
