// Small CSV helpers for the attendance export.

// Excel runs cells that start with these characters as a formula,
// so a note like "=HYPERLINK(...)" could do something harmful.
const FORMULA_START = /^[=+\-@\t\r]/

function toCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value)

  // Numbers stay as they are (latitudes in Indonesia are negative)
  if (typeof value === 'string' && FORMULA_START.test(text)) {
    text = `'${text}`
  }

  // Quote every cell and double the quotes inside it
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map(row => row.map(toCell).join(',')).join('\r\n')
}

// Saves the text as a file in the browser
export function downloadCsv(filename: string, content: string) {
  // The BOM tells Excel the file is UTF-8, so names like "Siti Ayşe" look right
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
