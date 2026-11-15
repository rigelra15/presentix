import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw } from 'lucide-react'

interface Props {
  // Called with the JPEG photo, or null when the user retakes
  onChange: (photo: Blob | null) => void
  disabled?: boolean
}

// Takes a photo directly from the device camera.
// There is no file picker, so the employee cannot upload an old photo.
export default function CameraCapture({ onChange, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  async function startCamera() {
    setError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera. Use Chrome, Edge, Firefox or Safari.')
      return
    }

    setStarting(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })

      streamRef.current = stream
      setCameraOn(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''

      if (name === 'NotAllowedError') {
        setError('Camera permission was denied. Allow camera access in your browser settings, then try again.')
      } else if (name === 'NotFoundError') {
        setError('No camera was found on this device.')
      } else {
        setError('Unable to start the camera. Close other apps that use it and try again.')
      }
    } finally {
      setStarting(false)
    }
  }

  function takePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    // Draw the current video frame on a canvas and save it as JPEG
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    canvas.toBlob(
      blob => {
        if (!blob) {
          setError('Failed to take the photo. Please try again.')
          return
        }

        setPreviewUrl(URL.createObjectURL(blob))
        onChange(blob)
        stopCamera()
      },
      'image/jpeg',
      0.85
    )
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null)
    void startCamera()
  }

  // The <video> element is only rendered after cameraOn is true,
  // so connect the stream again once it exists.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  // Turn the camera off when the user leaves the page
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  // Free the preview image memory when it changes or on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div className="camera">
      <div className="camera-frame">
        {previewUrl ? (
          <img src={previewUrl} alt="Your check-in photo" />
        ) : cameraOn ? (
          <video ref={videoRef} autoPlay playsInline muted className="mirror" />
        ) : (
          <div className="frame-placeholder">
            <Camera size={36} />
            <span>Camera is off</span>
          </div>
        )}
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="step-actions">
        {previewUrl ? (
          <button type="button" className="btn btn-secondary" onClick={retake} disabled={disabled}>
            <RefreshCw size={16} />
            Retake photo
          </button>
        ) : cameraOn ? (
          <button type="button" className="btn btn-primary" onClick={takePhoto} disabled={disabled}>
            <Camera size={16} />
            Take photo
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={startCamera}
            disabled={disabled || starting}
          >
            <Camera size={16} />
            {starting ? 'Starting camera...' : 'Open camera'}
          </button>
        )}
      </div>
    </div>
  )
}
