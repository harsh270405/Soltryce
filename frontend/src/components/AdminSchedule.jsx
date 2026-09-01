import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle2,
  X, Ban,
} from 'lucide-react'
import API, { errorMessage } from '../api'
import ScheduleGrid from './ScheduleGrid'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AdminSchedule({ reload }) {
  const [scheduleData, setScheduleData] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  const loadSchedule = async () => {
    setLoading(true)
    try {
      const { data } = await API.get(`/services/schedule/?date=${selectedDate}`)
      setScheduleData(data)
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadSchedule() }, [selectedDate])

  const handleSlotClick = (lab, time, status, booking) => {
    setActionModal({ lab, time, status, booking })
    setReason('')
    setMessage({ text: '', type: '' })
  }

  const handleApprove = async () => {
    if (!actionModal?.booking) return
    setBusy(true)
    try {
      // Find the approval request for this booking
      const { data: approvals } = await API.get('/requests/pending/')
      const matching = approvals.find(a =>
        a.tool_payload?.booking_id === actionModal.booking.id ||
        (a.tool_payload?.laboratory_name === actionModal.lab.lab_name &&
         a.tool_payload?.date === selectedDate &&
         a.tool_payload?.start_time?.slice(0, 5) === actionModal.time)
      )
      if (matching) {
        await API.post(`/requests/${matching.id}/process/`, { action: 'APPROVE', reason: '' })
      } else {
        // Direct approve via labs API
        await API.patch(`/services/bookings/${actionModal.booking.id}/`, { status: 'APPROVED' })
      }
      loadSchedule()
      reload?.()
      setActionModal(null)
      setMessage({ text: 'Booking approved.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    } finally { setBusy(false) }
  }

  const handleReject = async () => {
    if (!actionModal?.booking) return
    if (!reason.trim()) {
      setMessage({ text: 'Rejection reason is required.', type: 'error' })
      return
    }
    setBusy(true)
    try {
      const { data: approvals } = await API.get('/requests/pending/')
      const matching = approvals.find(a =>
        a.tool_payload?.booking_id === actionModal.booking.id ||
        (a.tool_payload?.laboratory_name === actionModal.lab.lab_name &&
         a.tool_payload?.date === selectedDate &&
         a.tool_payload?.start_time?.slice(0, 5) === actionModal.time)
      )
      if (matching) {
        await API.post(`/requests/${matching.id}/process/`, { action: 'REJECT', reason })
      } else {
        await API.patch(`/services/bookings/${actionModal.booking.id}/`, { status: 'REJECTED', reason })
      }
      loadSchedule()
      reload?.()
      setActionModal(null)
      setMessage({ text: 'Booking rejected.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    } finally { setBusy(false) }
  }

  const handleCancel = async () => {
    if (!actionModal?.booking) return
    setBusy(true)
    try {
      await API.patch(`/services/bookings/${actionModal.booking.id}/`, { status: 'CANCELLED', reason: reason || 'Cancelled by admin' })
      loadSchedule()
      reload?.()
      setActionModal(null)
      setMessage({ text: 'Booking cancelled.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    } finally { setBusy(false) }
  }

  const changeDate = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  const modalTitle = () => {
    if (!actionModal) return ''
    if (actionModal.status === 'available') return 'Block Slot (Admin Override)'
    if (actionModal.status === 'pending') return 'Review Booking Request'
    if (actionModal.status === 'approved') return 'Manage Booking'
    return 'Slot Info'
  }

  return (
    <div>
      {/* Message toast */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '0.65rem 0.85rem', marginBottom: '1rem',
              borderRadius: 'var(--radius-xs)', fontSize: '0.85rem', fontWeight: 600,
              background: message.type === 'success' ? 'var(--notice-bg)' : 'var(--form-error-bg)',
              border: `1px solid ${message.type === 'success' ? 'var(--notice-border)' : 'var(--form-error-border)'}`,
              color: message.type === 'success' ? '#22c55e' : '#f87171',
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date navigation */}
      <div className="schedule-nav">
        <motion.button className="secondary" onClick={() => changeDate(-1)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ padding: '0.5rem 0.7rem' }}>
          <ChevronLeft size={18} />
        </motion.button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
        <span className="date-display">{formatDate(selectedDate)}</span>
        <motion.button className="secondary" onClick={() => changeDate(1)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ padding: '0.5rem 0.7rem' }}>
          <ChevronRight size={18} />
        </motion.button>
        {!isToday && (
          <motion.button className="link" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} whileHover={{ x: 2 }}>
            Today
          </motion.button>
        )}
      </div>

      {/* Legend */}
      <div className="grid-legend">
        <div className="legend-item"><div className="legend-dot available" /> Available</div>
        <div className="legend-item"><div className="legend-dot pending" /> Pending</div>
        <div className="legend-item"><div className="legend-dot booked" /> Booked</div>
        <div className="legend-item"><div className="legend-dot cancelled" /> Cancelled</div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="empty" style={{ margin: '2rem 0' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
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

      {/* Action modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionModal(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{modalTitle()}</h2>
                <motion.button className="icon-danger" onClick={() => setActionModal(null)} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}>
                  <X size={16} />
                </motion.button>
              </div>

              {/* Info */}
              <div style={{ display: 'grid', gap: '0.7rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.65rem', background: 'var(--brand-light)', borderRadius: 'var(--radius-xs)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lab</div>
                  <div style={{ fontWeight: 700 }}>{actionModal.lab.lab_name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{actionModal.lab.lab_location} · {selectedDate} at {actionModal.time}</div>
                </div>

                {actionModal.booking && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{actionModal.booking.user_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{actionModal.booking.user_email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</div>
                        <span className={`badge ${actionModal.booking.status.toLowerCase()}`}>{actionModal.booking.status}</span>
                      </div>
                    </div>
                    {actionModal.booking.purpose && (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Purpose</div>
                        <div style={{ fontSize: '0.88rem', fontStyle: 'italic' }}>"{actionModal.booking.purpose}"</div>
                      </div>
                    )}
                  </>
                )}

                {/* Reason input for reject/cancel */}
                {(actionModal.status === 'pending' || actionModal.status === 'approved') && (
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
                    {actionModal.status === 'pending' ? 'Rejection reason (required if rejecting)' : 'Cancellation reason (optional)'}
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={actionModal.status === 'pending' ? 'Why is this being rejected?' : 'Optional reason for cancellation'}
                      rows={2}
                      style={{ marginTop: '0.35rem', resize: 'vertical' }}
                    />
                  </label>
                )}
              </div>

              {message.text && (
                <div style={{
                  padding: '0.5rem 0.75rem', marginBottom: '1rem',
                  borderRadius: 'var(--radius-xs)', fontSize: '0.82rem', fontWeight: 600,
                  background: 'var(--form-error-bg)', border: '1px solid var(--form-error-border)', color: '#f87171',
                }}>
                  {message.text}
                </div>
              )}

              {/* Actions */}
              <div className="modal-actions">
                {actionModal.status === 'pending' && (
                  <>
                    <motion.button className="primary" onClick={handleApprove} disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ flex: 1, padding: '0.7rem' }}>
                      <CheckCircle2 size={16} /> Approve
                    </motion.button>
                    <motion.button className="danger" onClick={handleReject} disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ flex: 1, padding: '0.7rem' }}>
                      <Ban size={16} /> Reject
                    </motion.button>
                  </>
                )}
                {actionModal.status === 'approved' && (
                  <motion.button className="danger" onClick={handleCancel} disabled={busy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ flex: 1, padding: '0.7rem' }}>
                    <Ban size={16} /> Cancel Booking
                  </motion.button>
                )}
                {actionModal.status === 'available' && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                    This slot is available. Students can book it directly.
                  </div>
                )}
                <motion.button className="secondary" onClick={() => setActionModal(null)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ padding: '0.7rem 1.5rem' }}>
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
