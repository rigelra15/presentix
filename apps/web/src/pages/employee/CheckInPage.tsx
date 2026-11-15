import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CheckCircle2, LocateFixed, Send } from 'lucide-react'
import {
  api,
  submitCheckIn,
  type Attendance,
  type CheckInLocation
} from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime, getWibToday } from '../../lib/format'
import { Alert, Loading, PageHeader } from '../../components/ui'
import CameraCapture from '../../components/CameraCapture'
import LocationMap from '../../components/LocationMap'

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location permission was denied. Allow location access in your browser settings, then try again.'
  }

  if (error.code === error.TIMEOUT) {
    return 'Getting your location took too long. Move closer to a window or turn on GPS, then try again.'
  }

  return 'Your location is not available right now. Please try again.'
}

export default function CheckInPage() {
  const { token } = useSession()
  const today = getWibToday()

  // Today's attendance, if the employee already checked in
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [location, setLocation] = useState<CheckInLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  const [photo, setPhoto] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    api<Attendance[]>('/api/attendance/attendances/me', { token })
      .then(records => {
        setTodayRecord(records.find(r => r.attendanceDate === today) ?? null)
      })
      .catch(err => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load attendance')
      })
      .finally(() => setLoading(false))
  }, [token, today])

  function getLocation() {
    if (!navigator.geolocation) {
      setLocationError('This browser does not support GPS location.')
      return
    }

    setLocating(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLocating(false)
      },
      error => {
        setLocationError(locationErrorMessage(error))
        setLocating(false)
      },
      // Always ask for a fresh, accurate position
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function handleSubmit() {
    if (!photo || !location || submitting) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const record = await submitCheckIn(token, photo, location)
      setTodayRecord(record)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Check-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Loading text="Checking today's attendance..." />
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="WFH Check-in" />
        <Alert type="error">{loadError}</Alert>
      </>
    )
  }

  // Already checked in today -> show a summary instead of the form
  if (todayRecord) {
    return (
      <>
        <PageHeader title="WFH Check-in" description={formatDate(today)} />

        <div className="card success-card">
          <CheckCircle2 size={40} />
          <div>
            <h2>You're checked in for today</h2>
            <p>
              Recorded at <strong>{formatTime(todayRecord.checkedInAt)}</strong>.
              You can check in again tomorrow.
            </p>
          </div>
        </div>

        {todayRecord.latitude !== null && todayRecord.longitude !== null && (
          <div className="card">
            <h3 className="card-title">Check-in location</h3>
            <LocationMap
              latitude={todayRecord.latitude}
              longitude={todayRecord.longitude}
              accuracy={todayRecord.locationAccuracy}
            />
          </div>
        )}

        <Link to="/history" className="btn btn-secondary">
          View my attendance history
        </Link>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="WFH Check-in"
        description="Share your location and take a live photo to record today's attendance."
      />

      <div className="checkin-date card">
        <CalendarCheck size={20} />
        <div>
          <small>Attendance date</small>
          <strong>{formatDate(today)}</strong>
        </div>
      </div>

      <div className="checkin-grid">
        <section className="card step-card">
          <div className="step-head">
            <span className={`step-number ${location ? 'done' : ''}`}>1</span>
            <div>
              <h3>Your location</h3>
              <p>GPS location is required for check-in.</p>
            </div>
          </div>

          {location && (
            <LocationMap
              latitude={location.latitude}
              longitude={location.longitude}
              accuracy={Math.round(location.accuracy)}
            />
          )}

          {locationError && <p className="field-error">{locationError}</p>}

          <button
            type="button"
            className={`btn ${location ? 'btn-secondary' : 'btn-primary'}`}
            onClick={getLocation}
            disabled={locating || submitting}
          >
            <LocateFixed size={16} />
            {locating ? 'Getting location...' : location ? 'Refresh location' : 'Get my location'}
          </button>
        </section>

        <section className="card step-card">
          <div className="step-head">
            <span className={`step-number ${photo ? 'done' : ''}`}>2</span>
            <div>
              <h3>Live photo</h3>
              <p>Take a photo of yourself at your workplace.</p>
            </div>
          </div>

          <CameraCapture onChange={setPhoto} disabled={submitting} />
        </section>
      </div>

      {submitError && <Alert type="error">{submitError}</Alert>}

      <div className="submit-bar">
        <span className="muted">
          {!location
            ? 'Step 1: get your location.'
            : !photo
              ? 'Step 2: take your photo.'
              : 'Ready to submit.'}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={!location || !photo || submitting}
        >
          <Send size={18} />
          {submitting ? 'Submitting...' : 'Submit check-in'}
        </button>
      </div>
    </>
  )
}
