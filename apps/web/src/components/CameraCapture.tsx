import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImageUp, RefreshCw } from 'lucide-react'
import type { PhotoSource } from '../lib/api'

interface Props {
  // Called with the photo and how it was taken, or null when it is removed
  onChange: (photo: Blob | null, source: PhotoSource) => void
  disabled?: boolean
}

// Same limits as the API
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

// Takes a photo directly from the device camera.
// Only when the camera cannot be used (no camera, permission denied,
// old browser) the employee may upload a photo file instead.
// HRD can see which way was used.
export default function CameraCapture({ onChange, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [source, setSource] = useState<PhotoSource>('CAMERA')
  // true after the camera failed, this shows the upload option
  const [cameraUnavailable, setCameraUnavailable] = useState(false)

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  async function startCamera() {
    setError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera.')
      setCameraUnavailable(true)
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

      setCameraUnavailable(true)
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
        setSource('CAMERA')
        onChange(blob, 'CAMERA')
        stopCamera()
      },
      'image/jpeg',
      0.85
    )
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null, source)

    // Camera photo: open the camera again. Uploaded file: pick another file.
    if (source === 'CAMERA') {
      void startCamera()
    } else {
      fileInputRef.current?.click()
    }
  }

  // Fallback: the employee picked a photo file
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so the same file can be chosen again later
    event.target.value = ''

    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG or PNG photo.')
      return
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setError('The photo is too large (max 5 MB).')
      return
    }

    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setSource('UPLOAD')
    onChange(file, 'UPLOAD')
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
          <>
            <img src={previewUrl} alt="Your check-in photo" />
            {source === 'UPLOAD' && <span className="photo-source-tag">Uploaded file</span>}
          </>
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

      {cameraUnavailable && !previewUrl && (
        <p className="muted upload-hint">
          No camera? You can upload a photo instead. HRD will see that it was uploaded.
        </p>
      )}

      {/* Hidden file input, opened by the "Upload photo" button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFile}
        hidden
      />

      <div className="step-actions">
        {previewUrl ? (
          <button type="button" className="btn btn-secondary" onClick={retake} disabled={disabled}>
            <RefreshCw size={16} />
            {source === 'CAMERA' ? 'Retake photo' : 'Choose another photo'}
          </button>
        ) : cameraOn ? (
          <button type="button" className="btn btn-primary" onClick={takePhoto} disabled={disabled}>
            <Camera size={16} />
            Take photo
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={startCamera}
              disabled={disabled || starting}
            >
              <Camera size={16} />
              {starting ? 'Starting camera...' : cameraUnavailable ? 'Try camera again' : 'Open camera'}
            </button>
            {cameraUnavailable && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <ImageUp size={16} />
                Upload photo
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
