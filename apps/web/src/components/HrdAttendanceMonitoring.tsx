
import { useEffect, useMemo, useState } from 'react'
import { api, type Attendance, type Employee } from '../lib/api'
import './HrdAttendanceMonitoring.css'

interface Props {
  token: string
  employees: Employee[]
}

function getWibToday(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function formatTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date) + ' WIB'
}

export default function HrdAttendanceMonitoring({
  token,
  employees
}: Props) {
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Fetch all attendance records using the HRD token.
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const data = await api<Attendance[]>(
          '/api/attendance/attendances',
          { token }
        )

        if (!Array.isArray(data)) {
          throw new Error('Invalid attendance response')
        }

        if (!cancelled) {
          setRecords(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load attendance'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  // Load the protected photo only when HRD opens its preview.
  useEffect(() => {
    if (selectedId === null) {
      return
    }

    let disposed = false
    let objectUrl: string | null = null
    const controller = new AbortController()

    async function loadPhoto() {
      setPhotoUrl(null)
      setPhotoError('')
      setPhotoLoading(true)

      try {
        const response = await fetch(
          `/api/attendance/attendances/${selectedId}/photo`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal,
            cache: 'no-store'
          }
        )

        if (!response.ok) {
          throw new Error(
            `Unable to load photo (HTTP ${response.status})`
          )
        }

        const contentType = (
          response.headers.get('content-type') ?? ''
        )
          .split(';')[0]
          .trim()
          .toLowerCase()

        if (
          contentType !== 'image/png' &&
          contentType !== 'image/jpeg'
        ) {
          throw new Error('Server did not return an image')
        }

        const blob = await response.blob()

        if (blob.size === 0) {
          throw new Error('Photo is empty')
        }

        if (disposed) {
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setPhotoUrl(objectUrl)
      } catch (err) {
        if (!disposed) {
          setPhotoError(
            err instanceof Error
              ? err.message
              : 'Failed to load photo'
          )
        }
      } finally {
        if (!disposed) {
          setPhotoLoading(false)
        }
      }
    }

    void loadPhoto()

    return () => {
      disposed = true
      controller.abort()

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [selectedId, token])

  // Allow closing the preview using the Escape key.
  useEffect(() => {
    if (selectedId === null) {
      return
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('keydown', onEscape)
    }
  }, [selectedId])

  const employeeMap = useMemo(
    () => new Map(
      employees.map(employee => [employee.id, employee])
    ),
    [employees]
  )

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()

    return records.filter(record => {
      const employee = employeeMap.get(record.employeeId)

      const matchesSearch =
        !query ||
        [
          employee?.fullName ?? '',
          employee?.employeeCode ?? '',
          employee?.department ?? '',
          String(record.employeeId)
        ].some(value =>
          value.toLowerCase().includes(query)
        )

      const matchesDate =
        !dateFilter ||
        record.attendanceDate === dateFilter

      return matchesSearch && matchesDate
    })
  }, [records, employeeMap, search, dateFilter])

  const today = getWibToday()

  const todayCount = records.filter(
    record => record.attendanceDate === today
  ).length

  const selectedRecord = records.find(
    record => record.id === selectedId
  )

  function refresh() {
    setRefreshKey(value => value + 1)
  }

  return (
    <section className="attendance-monitoring">
      <div className="attendance-monitor-header">
        <div>
          <h2>Attendance Monitoring</h2>
          <p>
            Review employee WFH attendance and supporting photos.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="attendance-stats">
        <div className="attendance-stat-card">
          <span>Total Check-ins</span>
          <strong>{records.length}</strong>
          <small>All recorded attendance</small>
        </div>

        <div className="attendance-stat-card">
          <span>Today's Check-ins</span>
          <strong>{todayCount}</strong>
          <small>{formatDate(today)} · WIB</small>
        </div>
      </div>

      <div className="attendance-records-card">
        <div className="attendance-records-heading">
          <div>
            <h3>Attendance Records</h3>
            <p>
              {filteredRecords.length} matching records
            </p>
          </div>

          <div className="attendance-filters">
            <input
              type="search"
              placeholder="Search employee..."
              aria-label="Search employee attendance"
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
            />

            <input
              type="date"
              aria-label="Filter attendance by date"
              value={dateFilter}
              onChange={event =>
                setDateFilter(event.target.value)
              }
            />

            {dateFilter && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDateFilter('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="attendance-loading">
            Loading attendance records...
          </p>
        ) : !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check-in Time</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map(record => {
                  const employee = employeeMap.get(
                    record.employeeId
                  )

                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>
                          {employee?.fullName ??
                            `Employee #${record.employeeId}`}
                        </strong>

                        <small>
                          {employee?.employeeCode ??
                            'Employee data unavailable'}
                        </small>
                      </td>

                      <td>
                        {formatDate(record.attendanceDate)}
                      </td>

                      <td>
                        {formatTime(record.checkedInAt)}
                      </td>

                      <td>
                        <span className="status active">
                          Checked in
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="secondary-button attendance-view-button"
                          onClick={() => setSelectedId(record.id)}
                        >
                          View Photo
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="attendance-empty"
                    >
                      No matching attendance records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId !== null && (
        <div
          className="attendance-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setSelectedId(null)
            }
          }}
        >
          <section
            className="attendance-photo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-photo-title"
          >
            <div className="attendance-photo-header">
              <div>
                <h3 id="attendance-photo-title">
                  WFH Photo Evidence
                </h3>

                {selectedRecord && (
                  <p>
                    {employeeMap.get(selectedRecord.employeeId)
                      ?.fullName ??
                      `Employee #${selectedRecord.employeeId}`}
                    {' · '}
                    {formatDate(selectedRecord.attendanceDate)}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>

            <div className="attendance-photo-content">
              {photoLoading && (
                <p role="status">Loading photo...</p>
              )}

              {photoError && (
                <p className="error" role="alert">
                  {photoError}
                </p>
              )}

              {photoUrl && !photoLoading && (
                <img
                  src={photoUrl}
                  alt="WFH attendance evidence"
                />
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
