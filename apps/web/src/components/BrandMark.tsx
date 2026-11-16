// Logo: a house (home = WFH) with a check mark (attendance)
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 11 12 4l8.5 7" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="m8.75 14.5 2.25 2.25 4.25-4.5" />
      </svg>
    </span>
  )
}
