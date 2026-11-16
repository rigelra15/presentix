import type { FaceCheckChallenge, FaceCheckResult } from './face-check'

export type Role = 'EMPLOYEE' | 'HRD'

export interface SessionUser {
  id: number
  email: string
  role: Role
  employeeId?: number
  // Missing in sessions saved before this field was added
  createdAt?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: SessionUser
}

export interface Employee {
  id: number
  employeeCode: string
  fullName: string
  department: string
  email: string
  isActive: boolean
  // true when the employee has an approved profile photo
  hasPhoto: boolean
  // When the employee sent a new photo that waits for HRD, null = none
  photoRequestAt: string | null
  // When HRD rejected the last new photo, null = never or approved since
  photoRejectedAt: string | null
  createdAt: string
}

// CAMERA = live camera photo, UPLOAD = file chosen because no camera was available
export type PhotoSource = 'CAMERA' | 'UPLOAD'

export interface Attendance {
  id: number
  employeeId: number
  attendanceDate: string
  checkedInAt: string
  // Empty until the employee checks out
  checkedOutAt: string | null
  photoUrl: string
  latitude: number | null
  longitude: number | null
  locationAccuracy: number | null
  // Today's agenda. Empty for check-ins made before notes were added.
  note: string | null
  // Empty for check-ins made before this was recorded
  photoSource: PhotoSource | null
  // true when the employee passed the head-turn face check
  livenessChecked: boolean
}

// Starts a face check. The server picks the order of the head turns.
export function startFaceCheck(token: string): Promise<FaceCheckChallenge> {
  return api<FaceCheckChallenge>('/api/attendance/attendances/liveness-challenge', {
    token,
    method: 'POST'
  })
}

export interface CheckInLocation {
  latitude: number
  longitude: number
  accuracy: number
}

// Fired when the session cannot be renewed any more.
// AuthProvider listens to this event and logs the user out.
export const SESSION_EXPIRED_EVENT = 'session-expired'

// Fired with the new access token after a refresh, so AuthProvider
// can keep it (event.detail is the token).
export const TOKEN_REFRESHED_EVENT = 'token-refreshed'

let refreshing: Promise<string | null> | null = null

// Gets a new access token using the httpOnly refresh cookie.
// Returns null when the user is not logged in (any more).
//
// Several requests can fail with 401 at the same time. They all wait
// for the same refresh instead of each starting one. The Web Lock also
// makes other tabs wait, because every refresh replaces the cookie and
// using an old cookie again ends the session.
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    const doRefresh = async () => {
      const response = await fetch('/api/employee/auth/refresh', { method: 'POST' })

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as LoginResponse
      window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: data.access_token }))
      return data.access_token
    }

    const run = navigator.locks
      ? navigator.locks.request('auth-refresh', doRefresh)
      : doRefresh()

    refreshing = run
      .catch(() => null)
      .finally(() => {
        refreshing = null
      })
  }

  return refreshing
}

// Sends a request with the access token. If the token has expired (401),
// gets a new one and tries once more.
async function fetchWithToken(
  token: string | undefined,
  send: (token: string | undefined) => Promise<Response>
): Promise<Response> {
  const response = await send(token)

  if (response.status !== 401 || !token) {
    return response
  }

  const newToken = await refreshAccessToken()
  return newToken ? send(newToken) : response
}

// NestJS returns `message` as a string, or as an array for validation errors.
function getErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = data.message

    if (typeof message === 'string') {
      return message
    }

    if (Array.isArray(message)) {
      return message.join(', ')
    }
  }

  return `Request failed (HTTP ${status})`
}

async function handleResponse<T>(
  response: Response,
  token?: string
): Promise<T> {
  const raw = await response.text()
  let data: unknown = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('Server returned an invalid response')
    }
  }

  if (response.status === 401 && token) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    throw new Error('Your session has expired. Please log in again.')
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status))
  }

  return data as T
}

export async function api<T>(
  path: string,
  options: {
    token?: string
    method?: string
    body?: unknown
  } = {}
): Promise<T> {
  const response = await fetchWithToken(options.token, token => {
    const headers: Record<string, string> = {}

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    return fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    })
  })

  return handleResponse<T>(response, options.token)
}

export async function submitCheckIn(
  token: string,
  photo: Blob,
  photoSource: PhotoSource,
  location: CheckInLocation,
  note: string,
  // Required for camera photos, empty for uploaded photos
  faceCheck: FaceCheckResult | null
): Promise<Attendance> {
  // Text fields first, then the photo
  const formData = new FormData()
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('accuracy', String(Math.round(location.accuracy)))
  formData.append('note', note)
  formData.append('photoSource', photoSource)
  if (faceCheck) {
    formData.append('challengeId', faceCheck.challengeId)
  }
  formData.append('photo', photo, photo.type === 'image/png' ? 'checkin.png' : 'checkin.jpg')
  if (faceCheck) {
    formData.append('livenessLeft', faceCheck.left, 'left.jpg')
    formData.append('livenessRight', faceCheck.right, 'right.jpg')
  }

  const response = await fetchWithToken(token, currentToken =>
    fetch('/api/attendance/attendances', {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentToken}` },
      body: formData
    })
  )

  if (response.status === 409) {
    throw new Error('You have already checked in today.')
  }

  if (response.status === 413) {
    throw new Error('The photo is too large (max 5 MB).')
  }

  return handleResponse<Attendance>(response, token)
}

// Photos are protected, so they are loaded with the token
// and shown with an object URL instead of a normal <img src>.
// path: e.g. /api/attendance/attendances/5/photo
export async function fetchPhoto(token: string, path: string): Promise<Blob> {
  const response = await fetchWithToken(token, currentToken =>
    fetch(path, {
      headers: { Authorization: `Bearer ${currentToken}` },
      cache: 'no-store'
    })
  )

  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  if (response.status === 404) {
    throw new Error('No photo')
  }

  if (!response.ok) {
    throw new Error(`Unable to load photo (HTTP ${response.status})`)
  }

  return response.blob()
}

// Same limits as the API
const PHOTO_MAX_SIZE = 5 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png']

// Returns an error message, or '' when the file can be uploaded
export function checkPhotoFile(file: File): string {
  if (!PHOTO_TYPES.includes(file.type)) return 'Please choose a JPEG or PNG photo.'
  if (file.size > PHOTO_MAX_SIZE) return 'The photo is too large (max 5 MB).'
  return ''
}

// Uploads a profile photo:
// - HRD: /api/employee/employees/:id/photo (replaces it right away)
// - employee: /api/employee/me/photo-request (waits for HRD approval)
export async function uploadPhoto(token: string, path: string, photo: File): Promise<Employee> {
  const formData = new FormData()
  formData.append('photo', photo, photo.name)

  const response = await fetchWithToken(token, currentToken =>
    fetch(path, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${currentToken}` },
      body: formData
    })
  )

  if (response.status === 413) {
    throw new Error('The photo is too large (max 5 MB).')
  }

  return handleResponse<Employee>(response, token)
}
