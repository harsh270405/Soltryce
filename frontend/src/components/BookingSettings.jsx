import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, CheckCircle2, AlertCircle } from 'lucide-react'
import API, { errorMessage } from '../api'

export default function BookingSettings() {
  const [maxDays, setMaxDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await API.get('/services/booking-settings/')
      setMaxDays(data.max_days_in_advance)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ text: '', type: '' })
    try {
      await API.put('/services/booking-settings/', {
        max_days_in_advance: maxDays,
      })
      setMessage({ text: 'Settings saved successfully.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
        <p>Loading settings…</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">BOOKING CONFIGURATION</p>
        <h1>Booking settings</h1>
        <p>Configure how far in advance students can book laboratories.</p>
      </motion.header>

      {/* Message */}
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
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ padding: '1.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <motion.div
            style={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(59, 89, 152, 0.15) 0%, rgba(59, 89, 152, 0.05) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: '1.5px solid rgba(59, 89, 152, 0.3)',
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Settings size={20} style={{ color: '#3b5998' }} />
          </motion.div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Advance Booking Limit</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Controls how far ahead students can schedule lab bookings
            </p>
          </div>
        </div>

        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
          Maximum days in advance
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <input
              type="number"
              min={1}
              max={365}
              value={maxDays}
              onChange={(e) => setMaxDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '120px' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              day{maxDays !== 1 ? 's' : ''}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 400 }}>
            Students will not be able to book labs more than {maxDays} day{maxDays !== 1 ? 's' : ''} from today. They also cannot book past time slots.
          </p>
        </label>

        <motion.button
          className="primary"
          onClick={handleSave}
          disabled={saving}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ marginTop: '1rem', padding: '0.7rem 1.5rem' }}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </motion.button>
      </motion.section>
    </motion.div>
  )
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = { type: 'spring', stiffness: 300, damping: 30 }
