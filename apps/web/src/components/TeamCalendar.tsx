import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attendance, Employee } from '../lib/api'
import { getEmployeeDay, getMonthDates, isWeekend, type DayInfo } from '../lib/calendar'
import { formatTime, getWibToday, toWibDate } from '../lib/format'
import AttendanceCalendar from './AttendanceCalendar'

interface Props {
  records: Attendance[]
  employees: Employee[]
  // Open the list filtered to one day
  onOpenDay: (date: string) => void
}

// HRD calendar.
// "All employees": each day shows how many expected employees checked in.
// One employee: each day shows checked in / absent for that person.
export default function TeamCalendar({ records, employees, onOpenDay }: Props) {
  const navigate = useNavigate()
  const today = getWibToday()

  const [month, setMonth] = useState(today.slice(0, 7))
  const [department, setDepartment] = useState('')
  const [employeeId, setEmployeeId] = useState('')

  const departments = [...new Set(employees.map(e => e.department))].sort()
  const inDepartment = employees.filter(e => !department || e.department === department)
  const selected = employees.find(e => String(e.id) === employeeId) ?? null

  // Check-ins grouped by date
  const recordsByDate = new Map<string, Attendance[]>()
  for (const record of records) {
    const list = recordsByDate.get(record.attendanceDate) ?? []
    list.push(record)
    recordsByDate.set(record.attendanceDate, list)
  }

  function getEmployeeRecord(date: string, id: number) {
    return recordsByDate.get(date)?.find(record => record.employeeId === id)
  }

  function getTeamDay(date: string): DayInfo {
    // Expected = active employees created before that day, plus anyone who
    // checked in that day. (Status changes are not kept as history,
    // so this uses today's status.)
    const expected = inDepartment.filter(
      e => e.isActive && (toWibDate(e.createdAt) < date || getEmployeeRecord(date, e.id))
    )
    const checkedIn = expected.filter(e => getEmployeeRecord(date, e.id)).length
    const text = `${checkedIn}/${expected.length}`
    const title = `${checkedIn} of ${expected.length} employees checked in`

    if (date > today) return { status: 'future' }
    if (expected.length === 0) return { status: 'none' }
    if (isWeekend(date)) return { status: 'off', text: checkedIn ? text : undefined, title: 'Weekend' }
    if (checkedIn === expected.length) return { status: 'present', text, title }
    if (checkedIn > 0) return { status: 'partial', text, title }
    // Today is not over yet, so nobody is "absent" yet
    if (date === today) return { status: 'future', text, title }
    return { status: 'absent', text, title }
  }

  function getDay(date: string): DayInfo {
    if (!selected) return getTeamDay(date)

    const record = getEmployeeRecord(date, selected.id)
    return getEmployeeDay(
      date,
      today,
      toWibDate(selected.createdAt),
      record ? formatTime(record.checkedInAt) : null
    )
  }

  function handleDayClick(date: string) {
    if (selected) {
      // One employee: open that check-in
      const record = getEmployeeRecord(date, selected.id)
      if (record) navigate(`/hrd/attendance/${record.id}`)
    } else {
      onOpenDay(date)
    }
  }

  // Count the days of the shown month per status
  const statuses = getMonthDates(month).map(date => getDay(date).status)
  const countOf = (status: string) => statuses.filter(s => s === status).length

  return (
    <>
      <div className="toolbar">
        <select
          value={department}
          onChange={event => {
            setDepartment(event.target.value)
            setEmployeeId('')
          }}
          aria-label="Department"
        >
          <option value="">All departments</option>
          {departments.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select value={employeeId} onChange={event => setEmployeeId(event.target.value)} aria-label="Employee">
          <option value="">All employees</option>
          {inDepartment.map(employee => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} ({employee.employeeCode})
            </option>
          ))}
        </select>
      </div>

      <div className="calendar-body">
        <AttendanceCalendar
          month={month}
          onMonthChange={setMonth}
          getDay={getDay}
          onDayClick={handleDayClick}
          summary={
            selected ? (
              <>
                <span className="badge badge-success">{countOf('present')} checked in</span>
                <span className="badge badge-danger">{countOf('absent')} absent</span>
              </>
            ) : (
              <>
                <span className="badge badge-success">{countOf('present')} full days</span>
                <span className="badge badge-warning">{countOf('partial')} partial</span>
                <span className="badge badge-danger">{countOf('absent')} nobody</span>
              </>
            )
          }
          legend={
            selected
              ? [
                  { status: 'present', label: 'Checked in' },
                  { status: 'absent', label: 'Absent (work day)' },
                  { status: 'off', label: 'Weekend' }
                ]
              : [
                  { status: 'present', label: 'Everyone checked in' },
                  { status: 'partial', label: 'Some checked in' },
                  { status: 'absent', label: 'Nobody checked in' },
                  { status: 'off', label: 'Weekend' }
                ]
          }
        />
      </div>
    </>
  )
}
