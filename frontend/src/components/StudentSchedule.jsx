import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, BookOpen,
  AlertCircle, CheckCircle2, X, Shield,
} from 'lucide-react'
import API, { errorMessage } from '../api'
import ScheduleGrid from './ScheduleGrid'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = { type: 'spring', stiffness: 300, damping: 30 }

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayStr() {
  return formatDateStr(new Date())
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDateStr(d)
}

export default function StudentSchedule({ user }) {
  const [scheduleData, setScheduleData] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr())
  const [loading, setLoading] = useState(true)
  const [bookingModal, setBookingModal] = useState(null)
  const [purpose, setPurpose] = useState('')
  const [duration, setDuration] = useState(1)
  const [booking, setBooking] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [myBookings, setMyBookings] = useState([])
  const [activeTab, setActiveTab] = useState('schedule')
  const [maxDays, setMaxDays] = useState(30)

  const today = getTodayStr()
  const maxDate = addDays(today, maxDays)

  const loadSchedule = async () => {
    setLoading(true)
    try {
      const { data } = await API.get(`/services/schedule/?date=${selectedDate}`)
      setScheduleData(data)
      if (data.max_days_in_advance !== undefined) {
        setMaxDays(data.max_days_in_advance)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyBookings = async () => {
    try {
      const { data } = await API.get('/services/bookings/')
      setMyBookings(data.filter(b => b.user === user.id))
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => { loadSchedule() }, [selectedDate])
  useEffect(() => { loadMyBookings() }, [])

  const handleSlotClick = (lab, time, status, booking) => {
    if (status !== 'available') return
    setBookingModal({ lab, time })
    setPurpose('')
    setDuration(1)
    setMessage({ text: '', type: '' })
  }

  const handleBook = async () => {
    if (!bookingModal || !purpose.trim()) return
    setBooking(true)
    setMessage({ text: '', type: '' })
    try {
      await API.post('/services/bookings/', {
        laboratory: bookingModal.lab.lab_id,
        date: selectedDate,
        start_time: bookingModal.time + ':00',
        duration,
        purpose: purpose.trim(),
      })
      setMessage({ text: 'Booking submitted successfully!', type: 'success' })
      setBookingModal(null)
      loadSchedule()
      loadMyBookings()
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    } finally {
      setBooking(false)
    }
  }

  const handleCancel = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    try {
      await API.post(`/services/bookings/${bookingId}/cancel/`)
      loadSchedule()
      loadMyBookings()
      setMessage({ text: 'Booking cancelled.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const changeDate = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const nextDate = formatDateStr(d)
    // Enforce date boundaries
    if (nextDate < today) return
    if (nextDate > maxDate) return
    setSelectedDate(nextDate)
  }

  const canGoBack = selectedDate > today
  const canGoForward = selectedDate < maxDate
  const isToday = selectedDate === today

  const isBookingFinished = (b) => {
    // A booking is finished if its end time has already passed
    if (b.date < today) return true
    if (b.date > today) return false
    // Same day — check end time
    const now = new Date()
    const [h, m] = (b.start_time || '00:00').split(':').map(Number)
    const endMinutes = h * 60 + m + (b.duration || 1) * 60
    return now.getHours() * 60 + now.getMinutes() >= endMinutes
  }

  const activeBookings = myBookings.filter(b =>
    (b.status === 'APPROVED' || b.status === 'PENDING') &&
    !isBookingFinished(b)
  )
  const pastBookings = myBookings.filter(b =>
    b.status === 'CANCELLED' || b.status === 'REJECTED' ||
    isBookingFinished(b)
  )

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">LAB SCHEDULE</p>
        <h1>Book a laboratory</h1>
        <p>Browse available slots and book labs based on your clearance level.</p>
      </motion.header>

      {/* Clearance info */}
      {user.clearance_level > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1rem', marginBottom: '1rem',
            background: 'var(--brand-light)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: '0.85rem', fontWeight: 600,
          }}
        >
          <Shield size={16} style={{ color: 'var(--brand)' }} />
          Your clearance level: <b style={{ color: 'var(--brand)' }}>Level {user.clearance_level}</b>
        </motion.div>
      )}

      {/* Tab navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} /> Schedule
        </button>
        <button
          className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <Clock size={16} /> My Bookings ({activeBookings.length})
        </button>
      </div>

      {/* Message toast */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '0.7rem 1rem',
              borderRadius: 'var(--radius-xs)',
              marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.88rem', fontWeight: 600,
              background: message.type === 'success' ? 'var(--notice-bg)' : 'var(--form-error-bg)',
              border: `1px solid ${message.type === 'success' ? 'var(--notice-border)' : 'var(--form-error-border)'}`,
              color: message.type === 'success' ? '#22c55e' : '#f87171',
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'schedule' ? (
        <>
          {/* Date navigation */}
          <div className="schedule-nav">
            <motion.button
              className="secondary"
              onClick={() => changeDate(-1)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ padding: '0.5rem 0.7rem', opacity: canGoBack ? 1 : 0.3, pointerEvents: canGoBack ? 'auto' : 'none' }}
            >
              <ChevronLeft size={18} />
            </motion.button>

            <input
              type="date"
              value={selectedDate}
              min={today}
              max={maxDate}
              onChange={(e) => {
                const v = e.target.value
                if (v >= today && v <= maxDate) setSelectedDate(v)
              }}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            />

            <span className="date-display">{formatDate(selectedDate)}</span>

            <motion.button
              className="secondary"
              onClick={() => changeDate(1)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ padding: '0.5rem 0.7rem', opacity: canGoForward ? 1 : 0.3, pointerEvents: canGoForward ? 'auto' : 'none' }}
            >
              <ChevronRight size={18} />
            </motion.button>

            {!isToday && (
              <motion.button
                className="link"
                onClick={() => setSelectedDate(getTodayStr())}
                whileHover={{ x: 2 }}
              >
                Today
              </motion.button>
            )}
          </div>

          {/* Legend */}
          <div className="grid-legend">
            <div className="legend-item"><div className="legend-dot available" /> Available</div>
            <div className="legend-item"><div className="legend-dot pending" /> Your Pending</div>
            <div className="legend-item"><div className="legend-dot booked" /> Booked</div>
            <div className="legend-item"><div className="legend-dot cancelled" /> Cancelled</div>
          </div>

          {/* Schedule grid */}
          {loading ? (
            <div className="empty" style={{ margin: '2rem 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', marginBottom: '0.75rem' }}
              >
                <Clock size={32} style={{ opacity: 0.3 }} />
              </motion.div>
              <p>Loading schedule…</p>
            </div>
          ) : (
            <ScheduleGrid
              labs={scheduleData?.labs}
              bookings={[]}
              onSlotClick={handleSlotClick}
              readOnly={false}
              selectedDate={selectedDate}
            />
          )}
        </>
      ) : (
        /* My Bookings tab */
        <motion.section
          className="panel list"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {activeBookings.length === 0 && pastBookings.length === 0 ? (
            <div className="empty" style={{ border: 'none', padding: '2rem' }}>
              <BookOpen size={32} style={{ marginBottom: '.5rem', opacity: 0.3 }} />
              <p>No bookings yet. Switch to the Schedule tab to book a lab.</p>
            </div>
          ) : (
            <>
              {activeBookings.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Active Bookings
                  </h3>
                  {activeBookings.map((b, i) => (
                    <motion.article
                      key={b.id}
                      className="request"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                          <b>{b.laboratory_name}</b>
                          <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                        </div>
                        <p>
                          {b.date} · {b.start_time?.slice(0, 5)} ({b.duration}h)
                          {b.purpose && <span style={{ fontStyle: 'italic' }}> — {b.purpose}</span>}
                        </p>
                      </div>
                      {b.status === 'APPROVED' && (
                        <motion.button
                          className="danger"
                          onClick={() => handleCancel(b.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{ flexShrink: 0, fontSize: '0.8rem' }}
                        >
                          Cancel
                        </motion.button>
                      )}
                    </motion.article>
                  ))}
                </>
              )}
              {pastBookings.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                    Past / Cancelled
                  </h3>
                  {pastBookings.map((b, i) => (
                    <motion.article
                      key={b.id}
                      className="request"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{ opacity: 0.6 }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                          <b>{b.laboratory_name}</b>
                          <span className={`badge ${b.status.toLowerCase()}`}>{b.status}</span>
                        </div>
                        <p>{b.date} · {b.start_time?.slice(0, 5)} ({b.duration}h)</p>
                      </div>
                    </motion.article>
                  ))}
                </>
              )}
            </>
          )}
        </motion.section>
      )}

      {/* Booking confirmation modal */}
      <AnimatePresence>
        {bookingModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBookingModal(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Confirm Booking</h2>
                <motion.button
                  className="icon-danger"
                  onClick={() => setBookingModal(null)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--brand-light)', borderRadius: 'var(--radius-xs)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Laboratory
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{bookingModal.lab.lab_name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{bookingModal.lab.lab_location}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Date
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedDate}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Start Time
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bookingModal.time}</div>
                  </div>
                </div>

                {/* Qualification status */}
                <div style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.85rem', fontWeight: 600,
                  background: bookingModal.lab.qualifies ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${bookingModal.lab.qualifies ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                  color: bookingModal.lab.qualifies ? '#22c55e' : '#f59e0b',
                }}>
                  {bookingModal.lab.qualifies ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {bookingModal.lab.qualifies
                    ? 'You qualify — booking will be auto-approved'
                    : 'Your request will need admin approval'}
                </div>

                {/* Duration */}
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
                  Duration
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    {[1, 2].map(d => (
                      <motion.button
                        key={d}
                        type="button"
                        className={duration === d ? 'primary' : 'secondary'}
                        onClick={() => setDuration(d)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem' }}
                      >
                        {d} hour{d > 1 ? 's' : ''}
                      </motion.button>
                    ))}
                  </div>
                </label>

                {/* Purpose */}
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
                  Purpose
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="What will you be working on?"
                    rows={3}
                    style={{ marginTop: '0.4rem', resize: 'vertical' }}
                    required
                  />
                </label>
              </div>

              {message.text && (
                <div style={{
                  padding: '0.6rem 0.8rem', marginBottom: '1rem',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.85rem', fontWeight: 600,
                  background: 'var(--form-error-bg)',
                  border: '1px solid var(--form-error-border)',
                  color: '#f87171',
                }}>
                  {message.text}
                </div>
              )}

              <div className="modal-actions">
                <motion.button
                  className="primary"
                  onClick={handleBook}
                  disabled={booking || !purpose.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  {booking ? 'Booking…' : 'Confirm Booking'}
                </motion.button>
                <motion.button
                  className="secondary"
                  onClick={() => setBookingModal(null)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
