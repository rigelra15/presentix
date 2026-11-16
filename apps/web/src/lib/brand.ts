// App name and company email domain, kept in one place

export const APP_NAME = 'Presentix'

// Employee login emails use the company domain
export const EMAIL_DOMAIN = 'dexagroup.com'

// "Budi Santoso Wijaya" -> "budi.wijaya@<domain>"
// Accents are removed ("José" -> "jose"), other characters are dropped.
export function suggestEmail(fullName: string): string {
  const words = fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return ''
  }

  const name = words.length === 1 ? words[0] : `${words[0]}.${words[words.length - 1]}`
  return `${name}@${EMAIL_DOMAIN}`
}
