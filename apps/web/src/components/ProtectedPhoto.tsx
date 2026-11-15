import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fetchPhoto } from '../lib/api'

interface Props {
  token: string
  attendanceId: number
}

// The photo endpoint needs the Authorization header,
// so the image is downloaded with fetch and shown with an object URL.
// Render it with key={attendanceId} so a new id starts fresh.
export default function ProtectedPhoto({ token, attendanceId }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    fetchPhoto(token, attendanceId)
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
  }, [token, attendanceId])

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
      <img src={url} alt="Check-in photo" />
    </div>
  )
}
