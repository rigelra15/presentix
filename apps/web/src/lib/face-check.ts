import type { FaceLandmarker } from '@mediapipe/tasks-vision'

// Head directions the face check asks for.
// LEFT/RIGHT are the employee's own left and right.
export type FaceStep = 'LEFT' | 'RIGHT'
export type HeadDirection = FaceStep | 'FRONT'

export interface FaceCheckChallenge {
  challengeId: string
  steps: FaceStep[]
  expiresAt: string
}

// What the camera sends together with the main photo
export interface FaceCheckResult {
  challengeId: string
  left: Blob
  right: Blob
}

// Keep this version the same as @mediapipe/tasks-vision in package.json
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// Landmark numbers of the MediaPipe face mesh
const NOSE_TIP = 1
const FACE_EDGE_A = 234
const FACE_EDGE_B = 454

// How far the nose must move from the middle of the face.
// 0.5 = looking straight, 0 or 1 = nose on the edge of the face.
const TURN_LIMIT = 0.18
const FRONT_LIMIT = 0.08

let landmarkerPromise: Promise<FaceLandmarker> | null = null

// Loads the face detector once. The library (~10 MB with its model)
// is only downloaded when the employee starts the face check.
export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)

      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'VIDEO',
        // 2 so we can tell the employee when more than one face is visible
        numFaces: 2
      })
    })()

    // Allow a new try after a failed download
    landmarkerPromise.catch(() => {
      landmarkerPromise = null
    })
  }

  return landmarkerPromise
}

interface Point {
  x: number
  y: number
}

// Works out where the head is turned from 3 face points of the
// camera image (not the mirrored preview).
// The camera sees the employee from the front, so when they turn to
// their own left, the nose moves to the right side of the image.
export function getHeadDirection(landmarks: Point[]): HeadDirection | null {
  const nose = landmarks[NOSE_TIP]
  const edgeA = landmarks[FACE_EDGE_A]
  const edgeB = landmarks[FACE_EDGE_B]
  if (!nose || !edgeA || !edgeB) return null

  const minX = Math.min(edgeA.x, edgeB.x)
  const maxX = Math.max(edgeA.x, edgeB.x)
  if (maxX - minX < 0.01) return null

  // 0 = nose at the left edge of the image, 1 = at the right edge
  const position = (nose.x - minX) / (maxX - minX)

  if (position > 0.5 + TURN_LIMIT) return 'LEFT'
  if (position < 0.5 - TURN_LIMIT) return 'RIGHT'
  if (Math.abs(position - 0.5) < FRONT_LIMIT) return 'FRONT'

  // Between straight and turned: keep waiting
  return null
}

// Saves the current video frame as a JPEG.
// maxWidth makes the face check photos small (they are only proof).
export function captureFrame(video: HTMLVideoElement, maxWidth?: number): Promise<Blob> {
  const scale = maxWidth && video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Failed to take the photo. Please try again.'))),
      'image/jpeg',
      0.85
    )
  })
}
