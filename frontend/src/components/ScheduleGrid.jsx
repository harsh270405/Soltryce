import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar } from 'lucide-react'

export default function ScheduleGrid({ labs, bookings, onSlotClick, readOnly = false, selectedDate }) {
  const [hoveredSlot, setHoveredSlot] = useState(null)

  // Build time slots from labs data
  const allSlots = []
  if (labs && Object.keys(labs).length > 0) {
    const firstLab = Object.values(labs)[0]
    if (firstLab?.slots) {
      firstLab.slots.forEach(s => allSlots.push(s.time))
    }
  }

  // Determine slot status
  const getSlotStatus = (labId, time) => {
    if (!labs?.[labId]?.slots) return 'available'
    const lab = labs[labId]
    const slot = lab.slots.find(s => s.time === time)
    if (!slot || !slot.bookings || slot.bookings.length === 0) return 'available'
    const booking = slot.bookings[0]
    return booking.status.toLowerCase()
  }

  const getSlotBooking = (labId, time) => {
    if (!labs?.[labId]?.slots) return null
    const slot = labs[labId].slots.find(s => s.time === time)
    return slot?.bookings?.[0] || null
  }

  const statusClass = (status) => {
    const map = { approved: 'slot-approved', pending: 'slot-pending', cancelled: 'slot-cancelled' }
    return map[status] || 'slot-available'
  }

  const statusLabel = (status) => {
    const map = { approved: 'Booked', pending: 'Pending', cancelled: 'Cancelled' }
    return map[status] || 'Available'
  }

  if (!labs || Object.keys(labs).length === 0) {
    return (
      <div className="empty" style={{ margin: '2rem 0' }}>
        <Calendar size={36} style={{ marginBottom: '.75rem', opacity: 0.3 }} />
        <p>No labs available for this date.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Grid */}
      <div className="schedule-grid-wrapper">
        <div
          className="schedule-grid"
          style={{
            gridTemplateColumns: `180px repeat(${allSlots.length}, minmax(80px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div className="schedule-grid-header" style={{ display: 'contents' }}>
            <div style={{
              padding: '0.6rem 1rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              borderBottom: '2px solid var(--border)',
              background: 'var(--surface)',
              position: 'sticky',
              top: 0,
              zIndex: 5,
            }}>
              Laboratory
            </div>
            {allSlots.map(time => (
              <div
                key={time}
                className="schedule-time-label"
                style={{
                  borderBottom: '2px solid var(--border)',
                  background: 'var(--surface)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                }}
              >
                {time}
              </div>
            ))}
          </div>

          {/* Lab rows */}
          {Object.values(labs).map((lab, rowIdx) => (
            <div key={lab.lab_id} style={{ display: 'contents' }}>
              {/* Lab name + qualification badge */}
              <div className="schedule-lab-label" style={{
                background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--border-soft)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lab.lab_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {lab.lab_location}
                  </div>
                </div>
                <span className={`qualification-badge ${lab.qualifies ? 'qualifies' : 'requires-approval'}`}>
                  {lab.qualifies ? '✓' : '🔒'} {lab.qualification_label}
                </span>
              </div>

              {/* Time slot cells */}
              {allSlots.map(time => {
                const status = getSlotStatus(lab.lab_id, time)
                const booking = getSlotBooking(lab.lab_id, time)
                const slotKey = `${lab.lab_id}-${time}`

                return (
                  <motion.div
                    key={slotKey}
                    className={`schedule-grid-cell ${statusClass(status)}`}
                    style={{
                      background: rowIdx % 2 === 0 ? undefined : 'rgba(0,0,0,0.01)',
                      cursor: readOnly ? 'default' : 'pointer',
                    }}
                    onClick={() => !readOnly && onSlotClick?.(lab, time, status, booking)}
                    onMouseEnter={() => setHoveredSlot(slotKey)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    whileHover={!readOnly ? { scale: 1.06, zIndex: 10 } : {}}
                    whileTap={!readOnly ? { scale: 0.97 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {statusLabel(status)}
                    </span>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {hoveredSlot === slotKey && booking && (
                        <motion.div
                          className="slot-tooltip"
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                          <div className="tooltip-name">{booking.user_name}</div>
                          <div className="tooltip-detail">{booking.user_email}</div>
                          {booking.purpose && (
                            <div className="tooltip-detail" style={{ fontStyle: 'italic' }}>
                              "{booking.purpose}"
                            </div>
                          )}
                          <div className="tooltip-detail">
                            Status: <span style={{ fontWeight: 700 }}>{booking.status}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
