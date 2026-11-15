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
}

export async function api<T>(
  path: string,
  options: {
    token?: string
    method?: string
    body?: unknown
  } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {})
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {})
  })

  const raw = await response.text()

  let data: unknown = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('Server returned an invalid response')
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : `Request failed (HTTP ${response.status})`

    throw new Error(message)
  }

  return data as T
}

export async function uploadAttendance(
  token: string,
  photo: File
): Promise<Attendance> {
  const formData = new FormData()
  formData.append('photo', photo)

  const response = await fetch(
    '/api/attendance/attendances',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }
  )

  const raw = await response.text()
  let data: unknown = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(
        'Respons server tidak valid. Periksa riwayat sebelum mencoba lagi.'
      )
    }
  }

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        'Kamu sudah melakukan check-in hari ini.'
      )
    }

    if (response.status === 413) {
      throw new Error(
        'Ukuran foto melebihi batas 5 MB.'
      )
    }

    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : `Check-in gagal (HTTP ${response.status})`

    throw new Error(message)
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'number'
  ) {
    throw new Error(
      'Check-in mungkin sudah tersimpan, tetapi respons server tidak lengkap. Periksa riwayat.'
    )
  }

  return data as Attendance
}
