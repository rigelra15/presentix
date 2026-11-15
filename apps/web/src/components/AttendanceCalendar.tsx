import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, formatMonth, getMonthGrid, type DayInfo, type DayStatus } from '../lib/calendar'
import { getWibToday } from '../lib/format'

interface Props {
  month: string // "YYYY-MM"
  onMonthChange: (month: string) => void
  getDay: (date: string) => DayInfo
  // Optional: open a day that has check-ins
  onDayClick?: (date: string) => void
  legend: { status: DayStatus; label: string }[]
  summary?: ReactNode
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AttendanceCalendar({
  month,
  onMonthChange,
  getDay,
  onDayClick,
  legend,
  summary
}: Props) {
  const today = getWibToday()
  const currentMonth = today.slice(0, 7)
  const cells = getMonthGrid(month)

  return (
    <div className="calendar">
      <div className="calendar-head">
        <div className="calendar-nav">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h3>{formatMonth(month)}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          {month !== currentMonth && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onMonthChange(currentMonth)}>
              This month
            </button>
          )}
        </div>
        {summary && <div className="calendar-summary">{summary}</div>}
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map(name => (
          <div key={name} className="calendar-weekday">
            {name}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) {
            return <div key={`blank-${index}`} className="calendar-blank" />
          }

          const info = getDay(date)
          const className = `calendar-day day-${info.status} ${date === today ? 'is-today' : ''}`
          const content = (
            <>
              <span className="calendar-date">{Number(date.slice(8))}</span>
              {info.text && <span className="calendar-text">{info.text}</span>}
            </>
          )

          // Only days with check-ins have something to open
          const clickable = onDayClick && (info.status === 'present' || info.status === 'partial')

          return clickable ? (
            <button
              key={date}
              type="button"
              className={className}
              title={info.title}
              onClick={() => onDayClick(date)}
            >
              {content}
            </button>
          ) : (
            <div key={date} className={className} title={info.title}>
              {content}
            </div>
          )
        })}
      </div>

      <div className="calendar-legend">
        {legend.map(item => (
          <span key={item.status}>
            <i className={`legend-dot day-${item.status}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
