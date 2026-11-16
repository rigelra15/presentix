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
  note: string
): Promise<Attendance> {
  // Text fields first, then the photo
  const formData = new FormData()
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('accuracy', String(Math.round(location.accuracy)))
  formData.append('note', note)
  formData.append('photoSource', photoSource)
  formData.append('photo', photo, photo.type === 'image/png' ? 'checkin.png' : 'checkin.jpg')

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
export async function fetchPhoto(
  token: string,
  attendanceId: number
): Promise<Blob> {
  const response = await fetchWithToken(token, currentToken =>
    fetch(`/api/attendance/attendances/${attendanceId}/photo`, {
      headers: { Authorization: `Bearer ${currentToken}` },
      cache: 'no-store'
    })
  )

  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  if (!response.ok) {
    throw new Error(`Unable to load photo (HTTP ${response.status})`)
  }

  return response.blob()
}
