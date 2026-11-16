import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImageUp, RefreshCw, ScanFace, ShieldCheck } from 'lucide-react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { startFaceCheck, type PhotoSource } from '../lib/api'
import { useSession } from '../lib/auth-context'
import {
  captureFrame,
  getHeadDirection,
  loadFaceLandmarker,
  type FaceCheckResult,
  type FaceStep,
  type HeadDirection
} from '../lib/face-check'

interface Props {
  // Called with the photo, how it was taken and the face check photos
  // (camera only), or with null when the photo is removed
  onChange: (photo: Blob | null, source: PhotoSource, faceCheck: FaceCheckResult | null) => void
  disabled?: boolean
}

// Same limits as the API
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

// The head must stay in the asked direction for a few video frames
const FRAMES_TO_HOLD = 4
// Time for one head turn before the face check stops
const STEP_TIMEOUT_MS = 30 * 1000
// The face check photos are only proof, so they are kept small
const FACE_CHECK_WIDTH = 640

const INSTRUCTIONS: Record<HeadDirection, string> = {
  LEFT: 'Slowly turn your head to your left',
  RIGHT: 'Slowly turn your head to your right',
  FRONT: 'Now look straight at the camera'
}

// Thrown to stop the face check when the camera is closed
class FaceCheckCancelled extends Error {}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

// Takes a photo directly from the device camera, after a short face check:
// the employee turns the head left and right in an order picked by the
// server. This makes it hard to check in by holding up a printed photo.
// Only when the camera cannot be used (no camera, permission denied,
// old browser, face check cannot load) the employee may upload a photo
// file instead. HRD can see which way was used.
export default function CameraCapture({ onChange, disabled }: Props) {
  const { token } = useSession()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  const [cameraOn, setCameraOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [source, setSource] = useState<PhotoSource>('CAMERA')
  // true after the camera or the face check failed, this shows the upload option
  const [cameraUnavailable, setCameraUnavailable] = useState(false)

  // Face check progress
  const [checking, setChecking] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [hint, setHint] = useState('')
  const [stepsDone, setStepsDone] = useState(0)

  function stopCamera() {
    cancelledRef.current = true
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
    setChecking(false)
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

  // Watches the video until the head is turned to `target`
  // for a few frames in a row.
  async function waitForDirection(landmarker: FaceLandmarker, target: HeadDirection) {
    const deadline = Date.now() + STEP_TIMEOUT_MS
    let framesHeld = 0

    setInstruction(INSTRUCTIONS[target])
    setHint('')

    while (framesHeld < FRAMES_TO_HOLD) {
      await nextFrame()

      if (cancelledRef.current) throw new FaceCheckCancelled()

      if (Date.now() > deadline) {
        throw new Error('The face check took too long. Make sure your face is well lit, then try again.')
      }

      const video = videoRef.current
      // Wait until the video shows a picture
      if (!video || video.readyState < 2) continue

      const faces = landmarker.detectForVideo(video, performance.now()).faceLandmarks

      if (faces.length === 0) {
        setHint('No face found. Keep your face inside the frame.')
        framesHeld = 0
        continue
      }

      if (faces.length > 1) {
        setHint('Only your face should be in the frame.')
        framesHeld = 0
        continue
      }

      setHint('')
      framesHeld = getHeadDirection(faces[0]) === target ? framesHeld + 1 : 0
    }
  }

  async function runFaceCheck() {
    cancelledRef.current = false
    setChecking(true)
    setError('')
    setStepsDone(0)
    setInstruction('Preparing the face check...')
    setHint('')

    try {
      // Load the detector and ask the server for the head turn order
      let landmarker: FaceLandmarker
      try {
        landmarker = await loadFaceLandmarker()
      } catch {
        setCameraUnavailable(true)
        throw new Error('The face check could not be loaded. Check your internet connection and try again.')
      }
      const challenge = await startFaceCheck(token)

      const turns: Partial<Record<FaceStep, Blob>> = {}

      for (const step of challenge.steps) {
        await waitForDirection(landmarker, step)
        turns[step] = await captureFrame(videoRef.current!, FACE_CHECK_WIDTH)
        setStepsDone(done => done + 1)
      }

      // Main photo: the employee looks at the camera again
      await waitForDirection(landmarker, 'FRONT')
      const photo = await captureFrame(videoRef.current!)

      if (!turns.LEFT || !turns.RIGHT) {
        throw new Error('The face check did not finish. Please try again.')
      }

      setPreviewUrl(URL.createObjectURL(photo))
      setSource('CAMERA')
      onChange(photo, 'CAMERA', {
        challengeId: challenge.challengeId,
        left: turns.LEFT,
        right: turns.RIGHT
      })
      stopCamera()
    } catch (err) {
      if (err instanceof FaceCheckCancelled) return
      setError(err instanceof Error ? err.message : 'The face check failed. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null, source, null)

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
    stopCamera()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setSource('UPLOAD')
    onChange(file, 'UPLOAD', null)
  }

  // The <video> element is only rendered after cameraOn is true,
  // so connect the stream again once it exists.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  // Turn the camera off and stop the face check when the user leaves the page
  useEffect(() => {
    return () => {
      cancelledRef.current = true
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
            {source === 'UPLOAD' ? (
              <span className="photo-source-tag">Uploaded file</span>
            ) : (
              <span className="photo-source-tag photo-source-tag-ok">
                <ShieldCheck size={14} />
                Face check passed
              </span>
            )}
          </>
        ) : cameraOn ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="mirror" />
            {checking && (
              <div className="face-check-overlay" aria-live="polite">
                <strong>{instruction}</strong>
                {hint && <span>{hint}</span>}
                <span className="face-check-dots">
                  <span className={stepsDone > 0 ? 'done' : ''} />
                  <span className={stepsDone > 1 ? 'done' : ''} />
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="frame-placeholder">
            <Camera size={36} />
            <span>Camera is off</span>
          </div>
        )}
      </div>

      {error && <p className="field-error">{error}</p>}

      {cameraOn && !checking && !previewUrl && (
        <p className="muted upload-hint">
          You will turn your head left and right, then look at the camera. The photo is taken
          automatically.
        </p>
      )}

      {cameraUnavailable && !previewUrl && (
        <p className="muted upload-hint">
          Camera not working? You can upload a photo instead. HRD will see that it was uploaded
          without a face check.
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
          checking ? (
            <button type="button" className="btn btn-secondary" onClick={stopCamera}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={runFaceCheck} disabled={disabled}>
              <ScanFace size={16} />
              {error ? 'Try the face check again' : 'Start face check'}
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={startCamera}
            disabled={disabled || starting}
          >
            <Camera size={16} />
            {starting ? 'Starting camera...' : cameraUnavailable ? 'Try camera again' : 'Open camera'}
          </button>
        )}
        {cameraUnavailable && !previewUrl && !checking && (
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
      </div>
    </div>
  )
}
