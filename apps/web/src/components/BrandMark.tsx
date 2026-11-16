import { useId } from 'react'

// Presentix logo: a "P" whose bowl is also a location pin, with an amber
// "presence point" inside (the employee is here and checked in).
export default function BrandMark({ size = 36 }: { size?: number }) {
  // Unique gradient id, in case the logo appears twice on a page
  const gradientId = useId()

  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16a394" />
          <stop offset="0.55" stopColor="#0f766e" />
          <stop offset="1" stopColor="#0b5a54" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradientId})`} />
      <path
        d="M16.5 37V20.5a9.5 9.5 0 1 1 9.5 9.5h-4"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="20.5" r="3.4" fill="#fbbf24" />
    </svg>
  )
}
