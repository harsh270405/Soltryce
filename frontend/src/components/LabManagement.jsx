import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Edit3, Trash2, Power, PowerOff,
  Beaker, MapPin, Clock, Shield, AlertCircle,
} from 'lucide-react'
import API, { errorMessage } from '../api'

export default function LabManagement({ reload }) {
  const [labs, setLabs] = useState([])
  const [clearanceLevels, setClearanceLevels] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '', location: '', capacity: 1, equipment: '',
    required_clearance: 0, open_time: '09:00', close_time: '17:00',
  })
  const [message, setMessage] = useState({ text: '', type: '' })

  const loadLabs = async () => {
    try {
      const { data } = await API.get('/services/laboratories/')
      setLabs(data)
    } catch (error) { console.error(error) }
  }

  const loadLevels = async () => {
    try {
      const { data } = await API.get('/services/clearance-levels/')
      setClearanceLevels(data)
    } catch (error) { console.error(error) }
  }

  useEffect(() => { loadLabs(); loadLevels() }, [])

  const resetForm = () => {
    setForm({ name: '', location: '', capacity: 1, equipment: '', required_clearance: 0, open_time: '09:00', close_time: '17:00' })
    setEditing(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await API.patch(`/services/laboratories/${editing.id}/`, form)
        setMessage({ text: 'Lab updated.', type: 'success' })
      } else {
        await API.post('/services/laboratories/', form)
        setMessage({ text: 'Lab created.', type: 'success' })
      }
      resetForm()
      loadLabs()
      reload?.()
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const handleEdit = (lab) => {
    setForm({
      name: lab.name, location: lab.location, capacity: lab.capacity,
      equipment: lab.equipment || '', required_clearance: lab.required_clearance,
      open_time: lab.open_time?.slice(0, 5) || '09:00',
      close_time: lab.close_time?.slice(0, 5) || '17:00',
    })
    setEditing(lab)
    setShowForm(true)
  }

  const handleToggle = async (lab) => {
    try {
      await API.post(`/services/laboratories/${lab.id}/toggle-active/`)
      loadLabs()
      reload?.()
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const handleDelete = async (lab) => {
    if (!confirm(`Permanently delete "${lab.name}"? This will reject pending bookings and cancel approved future bookings.`)) return
    try {
      await API.delete(`/services/laboratories/${lab.id}/`)
      loadLabs()
      reload?.()
      setMessage({ text: 'Lab deleted.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const getClearanceLabel = (level) => {
    const found = clearanceLevels.find(c => c.level === level)
    return found ? found.label : `Level ${level}`
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.82rem', color: 'var(--text-muted)', flex: 1 }}>
          {labs.length} lab{labs.length !== 1 ? 's' : ''} total
        </span>
        <motion.button
          className="primary"
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} /> {showForm ? 'Close' : 'Add lab'}
        </motion.button>
      </div>

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
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            className="panel form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden', marginBottom: '1rem' }}
          >
            <h2 style={{ fontSize: '1rem' }}>{editing ? 'Edit Lab' : 'Add New Lab'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
              <label>Lab name
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. CS Lab 3" />
              </label>
              <label>Location
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required placeholder="e.g. Building A, Room 101" />
              </label>
              <label>Capacity
                <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} required />
              </label>
              <label>Required clearance
                <select value={form.required_clearance} onChange={e => setForm({ ...form, required_clearance: parseInt(e.target.value) })}>
                  {clearanceLevels.map(cl => (
                    <option key={cl.level} value={cl.level}>Level {cl.level}: {cl.label}</option>
                  ))}
                </select>
              </label>
              <label>Opens at
                <input type="time" value={form.open_time} onChange={e => setForm({ ...form, open_time: e.target.value })} required />
              </label>
              <label>Closes at
                <input type="time" value={form.close_time} onChange={e => setForm({ ...form, close_time: e.target.value })} required />
              </label>
            </div>
            <label>Equipment / notes
              <textarea value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })} placeholder="Describe available equipment" rows={2} />
            </label>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <motion.button className="primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {editing ? 'Save changes' : 'Create lab'}
              </motion.button>
              <motion.button type="button" className="secondary" onClick={resetForm} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                Cancel
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Lab list */}
      <motion.section className="panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <AnimatePresence mode="popLayout">
          {labs.length ? labs.map((lab, i) => (
            <motion.article
              key={lab.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 0.5rem',
                borderBottom: i < labs.length - 1 ? '1px solid var(--border-soft)' : 'none',
                opacity: lab.is_active ? 1 : 0.55,
              }}
              whileHover={{ backgroundColor: 'var(--hover-bg-row)', x: 2 }}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: '12px',
                background: lab.is_active ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)' : 'rgba(100,116,139,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: `1.5px solid ${lab.is_active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100,116,139,0.2)'}`,
              }}>
                <Beaker size={20} style={{ color: lab.is_active ? '#22c55e' : '#94a3b8' }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: '0.92rem' }}>{lab.name}</b>
                  {!lab.is_active && (
                    <span style={{
                      fontSize: '.65rem', fontWeight: 800, padding: '0.12rem 0.45rem',
                      borderRadius: 'var(--radius-full)', background: 'rgba(100,116,139,0.12)',
                      color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)', lineHeight: 1.6,
                    }}>
                      INACTIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={12} /> {lab.location}
                  </span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {lab.open_time?.slice(0, 5)}–{lab.close_time?.slice(0, 5)}
                  </span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Shield size={12} /> {getClearanceLabel(lab.required_clearance)}
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                <motion.button
                  className="secondary"
                  onClick={() => handleEdit(lab)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  title="Edit"
                  style={{ padding: '0.45rem 0.6rem' }}
                >
                  <Edit3 size={15} />
                </motion.button>
                <motion.button
                  className={lab.is_active ? 'danger' : 'secondary'}
                  onClick={() => handleToggle(lab)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  title={lab.is_active ? 'Deactivate' : 'Reactivate'}
                  style={{ padding: '0.45rem 0.6rem' }}
                >
                  {lab.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                </motion.button>
                <motion.button
                  className="icon-danger"
                  onClick={() => handleDelete(lab)}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  title="Delete permanently"
                  style={{ padding: '0.45rem' }}
                >
                  <Trash2 size={15} />
                </motion.button>
              </div>
            </motion.article>
          )) : (
            <div className="empty">
              <Beaker size={32} style={{ marginBottom: '.5rem', opacity: 0.3 }} />
              <p>No labs configured yet. Add your first lab to get started.</p>
            </div>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  )
}
