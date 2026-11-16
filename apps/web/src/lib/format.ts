// All dates and times in the app use Jakarta time (WIB),
// the same timezone the server uses for attendance dates.
const TIME_ZONE = 'Asia/Jakarta'

// Today's date in WIB as YYYY-MM-DD
export function getWibToday(): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
    new Date()
  )
}

// "2026-11-15" -> "Sun, 15 Nov 2026"
export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

// ISO timestamp -> "08:15 WIB"
export function formatTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)

  return `${time} WIB`
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

// ISO timestamp -> WIB date "YYYY-MM-DD"
export function toWibDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(
    new Date(value)
  )
}

// Time between check-in and check-out, e.g. "8h 05m"
export function formatDuration(from: string, to: string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)

  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}

// ISO timestamp -> "16 Nov 2026, 10:42 WIB"
export function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)

  return `${day}, ${formatTime(value)}`
}
