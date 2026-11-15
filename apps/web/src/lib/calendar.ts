// Date helpers for the attendance calendar.
// Dates are plain "YYYY-MM-DD" strings (WIB), like attendanceDate from the API.
// Date objects are only used in UTC, so the browser timezone does not matter.

// "2026-11-05" -> Date at 00:00 UTC
function toUtcDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// "2026-11" + 1 -> "2026-12"
export function addMonths(month: string, amount: number): string {
  const date = toUtcDate(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return toDateString(date).slice(0, 7)
}

// "2026-11" -> "November 2026"
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(toUtcDate(`${month}-01`))
}

// Saturday or Sunday
export function isWeekend(value: string): boolean {
  const day = toUtcDate(value).getUTCDay()
  return day === 0 || day === 6
}

// All dates of a month for a Monday-first grid.
// Empty slots before the 1st are null.
export function getMonthGrid(month: string): (string | null)[] {
  const first = toUtcDate(`${month}-01`)
  // getUTCDay: Sunday = 0. Convert so Monday = 0 ... Sunday = 6
  const blanks = (first.getUTCDay() + 6) % 7

  const cells: (string | null)[] = Array(blanks).fill(null)
  const date = new Date(first)

  while (toDateString(date).startsWith(month)) {
    cells.push(toDateString(date))
    date.setUTCDate(date.getUTCDate() + 1)
  }

  return cells
}

// Only the real dates of a month (no empty slots)
export function getMonthDates(month: string): string[] {
  return getMonthGrid(month).filter((date): date is string => date !== null)
}

// present = checked in, partial = only some employees checked in,
// absent = no check-in on a work day, off = weekend,
// future = not happened yet, none = nothing to show (e.g. before joining)
export type DayStatus = 'present' | 'partial' | 'absent' | 'off' | 'future' | 'none'

export interface DayInfo {
  status: DayStatus
  // Short text in the cell, e.g. "08:15" or "3/5"
  text?: string
  // Tooltip
  title?: string
}

// Status of one day for one employee.
// checkInTime: e.g. "08:15 WIB" if they checked in that day.
// startDate: the day the account was created (WIB date). Absent is only
// counted AFTER this day, because the account may be created late in the day.
// Note: public holidays are not known, so they count as work days.
export function getEmployeeDay(
  date: string,
  today: string,
  startDate: string | null,
  checkInTime: string | null
): DayInfo {
  if (checkInTime) {
    return { status: 'present', text: checkInTime.replace(' WIB', ''), title: `Checked in at ${checkInTime}` }
  }

  if (date > today) {
    return { status: 'future' }
  }

  // Unknown start date: do not guess, show nothing instead of "absent"
  if (!startDate || date <= startDate) {
    return { status: 'none', title: 'Before the employee started' }
  }

  if (isWeekend(date)) {
    return { status: 'off', title: 'Weekend' }
  }

  if (date === today) {
    return { status: 'future', text: 'Not yet', title: 'Not checked in yet today' }
  }

  return { status: 'absent', text: 'Absent', title: 'No check-in on this work day' }
}
