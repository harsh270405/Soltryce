import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Search, Users, Plus, X, Edit3, Trash2,
  ChevronDown, CheckCircle2,
} from 'lucide-react'
import API, { errorMessage } from '../api'

export default function ClearanceManager({ reload }) {
  // Clearance level definitions
  const [levels, setLevels] = useState([])
  const [levelForm, setLevelForm] = useState({ level: '', label: '' })
  const [editingLevel, setEditingLevel] = useState(null)
  const [showLevelForm, setShowLevelForm] = useState(false)

  // Student clearance
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [selectedStudents, setSelectedStudents] = useState(new Set())
  const [bulkLevel, setBulkLevel] = useState(0)
  const [showBulkPanel, setShowBulkPanel] = useState(false)

  const [message, setMessage] = useState({ text: '', type: '' })

  const loadLevels = async () => {
    try {
      const { data } = await API.get('/services/clearance-levels/')
      setLevels(data)
    } catch (error) { console.error(error) }
  }

  const loadStudents = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (levelFilter !== '') params.set('clearance_level', levelFilter)
      const { data } = await API.get(`/services/students/clearance/?${params}`)
      setStudents(data)
    } catch (error) { console.error(error) }
  }

  useEffect(() => { loadLevels(); loadStudents() }, [])
  useEffect(() => { loadStudents() }, [search, levelFilter])

  // ── Clearance Level CRUD ──

  const handleLevelSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingLevel) {
        await API.patch(`/services/clearance-levels/${editingLevel.level}/`, { label: levelForm.label })
        setMessage({ text: 'Level updated.', type: 'success' })
      } else {
        await API.post('/services/clearance-levels/', { level: parseInt(levelForm.level), label: levelForm.label })
        setMessage({ text: 'Level created.', type: 'success' })
      }
      setLevelForm({ level: '', label: '' })
      setEditingLevel(null)
      setShowLevelForm(false)
      loadLevels()
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const handleDeleteLevel = async (level) => {
    if (level.level === 0) return alert('Cannot delete level 0.')
    if (!confirm(`Delete clearance level ${level.level}: ${level.label}?`)) return
    try {
      await API.delete(`/services/clearance-levels/${level.level}/`)
      loadLevels()
      setMessage({ text: 'Level deleted.', type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  // ── Student Clearance ──

  const toggleStudent = (id) => {
    const next = new Set(selectedStudents)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedStudents(next)
  }

  const toggleAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)))
    }
  }

  const handleBulkAssign = async () => {
    if (selectedStudents.size === 0 || !bulkLevel && bulkLevel !== 0) return
    try {
      await API.post('/services/bulk-assign-clearance/', {
        student_ids: Array.from(selectedStudents),
        clearance_level: bulkLevel,
      })
      setSelectedStudents(new Set())
      setShowBulkPanel(false)
      loadStudents()
      reload?.()
      setMessage({ text: `Assigned level ${bulkLevel} to ${selectedStudents.size} student(s).`, type: 'success' })
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const handleSingleAssign = async (studentId, level) => {
    try {
      await API.post(`/services/students/${studentId}/clearance/`, { clearance_level: level })
      loadStudents()
      reload?.()
    } catch (error) {
      setMessage({ text: errorMessage(error), type: 'error' })
    }
  }

  const getLevelLabel = (level) => {
    const found = levels.find(l => l.level === level)
    return found ? found.label : `Level ${level}`
  }

  return (
    <div>
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

      {/* Clearance Level Definitions */}
      <motion.section className="panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Clearance Levels</h2>
          <motion.button
            className="primary"
            onClick={() => { setLevelForm({ level: '', label: '' }); setEditingLevel(null); setShowLevelForm(!showLevelForm) }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem' }}
          >
            <Plus size={14} /> {showLevelForm ? 'Close' : 'Add level'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showLevelForm && (
            <motion.form
              onSubmit={handleLevelSubmit}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: '1rem' }}
            >
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'end' }}>
                {!editingLevel && (
                  <label style={{ flex: '0 0 80px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
                    Level
                    <input
                      type="number" min="1" max="99"
                      value={levelForm.level}
                      onChange={e => setLevelForm({ ...levelForm, level: e.target.value })}
                      required placeholder="e.g. 1"
                      style={{ marginTop: '0.3rem' }}
                    />
                  </label>
                )}
                <label style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: 'var(--label-color)' }}>
                  Label
                  <input
                    value={levelForm.label}
                    onChange={e => setLevelForm({ ...levelForm, label: e.target.value })}
                    required placeholder="e.g. Intermediate"
                    style={{ marginTop: '0.3rem' }}
                  />
                </label>
                <motion.button className="primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ flexShrink: 0, padding: '0.55rem 1rem' }}>
                  {editingLevel ? 'Save' : 'Create'}
                </motion.button>
                {editingLevel && (
                  <motion.button type="button" className="secondary" onClick={() => { setEditingLevel(null); setShowLevelForm(false) }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    Cancel
                  </motion.button>
                )}
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
          {levels.map(cl => (
            <motion.div
              key={cl.level}
              style={{
                padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
              }}
              whileHover={{ borderColor: 'var(--brand)', y: -1 }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>Level {cl.level}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{cl.label}</div>
              </div>
              {cl.level !== 0 && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <motion.button
                    className="icon-danger"
                    onClick={() => { setEditingLevel(cl); setLevelForm({ level: String(cl.level), label: cl.label }); setShowLevelForm(true) }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ padding: '0.3rem', background: 'transparent' }}
                  >
                    <Edit3 size={13} />
                  </motion.button>
                  <motion.button
                    className="icon-danger"
                    onClick={() => handleDeleteLevel(cl)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ padding: '0.3rem' }}
                  >
                    <Trash2 size={13} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Student Clearance Management */}
      <motion.section className="panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Student Clearance</h2>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ width: '100%', paddingLeft: '2.2rem', fontSize: '0.85rem' }}
            />
          </div>
          <select
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
          >
            <option value="">All levels</option>
            {levels.map(cl => (
              <option key={cl.level} value={cl.level}>Level {cl.level}: {cl.label}</option>
            ))}
          </select>
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {selectedStudents.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                padding: '0.65rem 0.85rem', marginBottom: '0.75rem',
                background: 'var(--brand-light)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', gap: '0.6rem',
                flexWrap: 'wrap', fontSize: '0.85rem',
              }}
            >
              <b>{selectedStudents.size} selected</b>
              <select value={bulkLevel} onChange={e => setBulkLevel(parseInt(e.target.value))} style={{ fontSize: '0.82rem' }}>
                {levels.map(cl => (
                  <option key={cl.level} value={cl.level}>Level {cl.level}: {cl.label}</option>
                ))}
              </select>
              <motion.button className="primary" onClick={handleBulkAssign} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                <CheckCircle2 size={14} /> Assign
              </motion.button>
              <motion.button className="secondary" onClick={() => setSelectedStudents(new Set())} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}>
                Clear
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Student list */}
        <div style={{ display: 'grid', gap: '0' }}>
          {/* Select all header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 0.25rem', borderBottom: '1px solid var(--border)',
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            onClick={toggleAll}
          >
            <input
              type="checkbox"
              checked={selectedStudents.size === students.length && students.length > 0}
              onChange={toggleAll}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ flex: 1 }}>Select all ({students.length})</span>
          </div>

          {students.map((student, i) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0.25rem',
                borderBottom: i < students.length - 1 ? '1px solid var(--border-soft)' : 'none',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onClick={() => toggleStudent(student.id)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg-row)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <input
                type="checkbox"
                checked={selectedStudents.has(student.id)}
                onChange={() => toggleStudent(student.id)}
                onClick={e => e.stopPropagation()}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{student.display_name || student.username}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{student.email}</div>
              </div>
              <select
                value={student.clearance_level}
                onChange={(e) => { e.stopPropagation(); handleSingleAssign(student.id, parseInt(e.target.value)) }}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem', minWidth: '100px' }}
              >
                {levels.map(cl => (
                  <option key={cl.level} value={cl.level}>Level {cl.level}</option>
                ))}
              </select>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                background: 'var(--brand-subtle)', color: 'var(--brand)',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                {getLevelLabel(student.clearance_level)}
              </span>
            </motion.div>
          ))}
        </div>

        {students.length === 0 && (
          <div className="empty" style={{ border: 'none', marginTop: '1rem' }}>
            <Users size={32} style={{ marginBottom: '.5rem', opacity: 0.3 }} />
            <p>No students found.</p>
          </div>
        )}
      </motion.section>
    </div>
  )
}
