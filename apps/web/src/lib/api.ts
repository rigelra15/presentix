export type Role = 'EMPLOYEE' | 'HRD'

export interface SessionUser {
  id: number
  email: string
  role: Role
  employeeId?: number
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
}

export interface Attendance {
  id: number
  employeeId: number
  attendanceDate: string
  checkedInAt: string
  photoUrl: string
  latitude: number | null
  longitude: number | null
  locationAccuracy: number | null
}

export interface CheckInLocation {
  latitude: number
  longitude: number
  accuracy: number
}

// Fired when the server says the token is no longer valid.
// AuthProvider listens to this event and logs the user out.
export const SESSION_EXPIRED_EVENT = 'session-expired'

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
  const headers: Record<string, string> = {}

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  return handleResponse<T>(response, options.token)
}

export async function submitCheckIn(
  token: string,
  photo: Blob,
  location: CheckInLocation
): Promise<Attendance> {
  // Text fields first, then the photo
  const formData = new FormData()
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('accuracy', String(Math.round(location.accuracy)))
  formData.append('photo', photo, 'checkin.jpg')

  const response = await fetch('/api/attendance/attendances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })

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
  const response = await fetch(
    `/api/attendance/attendances/${attendanceId}/photo`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    }
  )

  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  if (!response.ok) {
    throw new Error(`Unable to load photo (HTTP ${response.status})`)
  }

  return response.blob()
}
