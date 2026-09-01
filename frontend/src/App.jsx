import React, { useEffect, useState, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Bot, Calendar, ClipboardList, FileText, LogOut, Menu, Plus, Search, Send,
  Shield, ShieldCheck, UserRound, Users, Wrench, X, Zap, Clock, CheckCircle2,
  AlertCircle, ArrowRight, Sparkles, TrendingUp, Eye, Sun, Moon, Settings,
} from 'lucide-react'
import API, { errorMessage } from './api'
import ScheduleGrid from './components/ScheduleGrid'
import StudentSchedule from './components/StudentSchedule'
import AdminSchedule from './components/AdminSchedule'
import LabManagement from './components/LabManagement'
import ClearanceManager from './components/ClearanceManager'
import BookingSettings from './components/BookingSettings'

/* ══════════════════════════════════════════════
   Animation Variants
   ══════════════════════════════════════════════ */
const pageVariants = {
  initial: { opacity: 0, y: 16, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
}

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
}

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.01, y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  tap: { scale: 0.99 },
}

/* ══════════════════════════════════════════════
   Shared Components
   ══════════════════════════════════════════════ */
const statusColors = {
  completed: { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  failed: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  in_progress: { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  pending_approval: { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  pending: { bg: '#e8edf5', text: '#3b5998', dot: '#4a6fa5' },
  open: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
}

const status = (value) => {
  const colors = statusColors[value] || statusColors.open
  return (
    <motion.span
      className={`badge ${value.toLowerCase()}`}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: colors.dot,
        display: 'inline-block', marginRight: 5, verticalAlign: 'middle',
        boxShadow: `0 0 6px ${colors.dot}40`,
      }} />
      {value.replaceAll('_', ' ')}
    </motion.span>
  )
}

const date = (value) => new Date(value).toLocaleString()

const Empty = ({ children, icon: Icon }) => (
  <motion.div
    className="empty"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
  >
    {Icon && (
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <Icon size={36} style={{ marginBottom: '.75rem', opacity: 0.3 }} />
      </motion.div>
    )}
    {children}
  </motion.div>
)

/* Animated Counter */
function AnimatedCounter({ value, duration = 0.8 }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    if (value == null || isNaN(value)) return
    const start = prev.current
    const end = Number(value)
    const startTime = performance.now()
    const animate = (now) => {
      const elapsed = (now - startTime) / (duration * 1000)
      if (elapsed >= 1) {
        setDisplay(end)
        prev.current = end
        return
      }
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return <b className="counter-animate">{value != null ? display : '—'}</b>
}

/* ══════════════════════════════════════════════
   Auth
   ══════════════════════════════════════════════ */
function Auth({ signedIn }) {
  const [register, setRegister] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', email: '', display_name: '', department: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const change = (event) => {
    setMessage('')
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (register) await API.post('/auth/register/', form)
      const { data } = await API.post('/auth/login/', { username: form.username.trim(), password: form.password })
      sessionStorage.setItem('soltryce_access_token', data.access)
      localStorage.setItem('soltryce_refresh_token', data.refresh)
      signedIn(data.user)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const features = [
    ['Academic answers grounded in official rulebooks', Zap],
    ['Maintenance triage with safety-aware routing', AlertCircle],
    ['Lab bookings reviewed by administrators', Clock],
  ]

  return (
    <main className="auth">
      <motion.section
        className="welcome"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="brand"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          style={{ color: '#fff', marginBottom: '2rem' }}
        >
          <BookOpen size={24} /> soltryce
        </motion.div>

        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ color: '#bcc5d4' }}
        >
          CAMPUS SERVICES
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
        >
          Campus work,<br />made clear.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Get verified academic answers, manage requests, and keep every next step visible.
        </motion.p>

        <motion.div
          style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '.85rem' }}
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {features.map(([text, Icon]) => (
            <motion.div
              key={text}
              variants={staggerItem}
              whileHover={{ x: 4, transition: { type: 'spring', stiffness: 400 } }}
              style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontSize: '.92rem', color: '#c8cff0', cursor: 'default' }}
            >
              <motion.div
                whileHover={{ rotate: 10, scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Icon size={18} style={{ color: '#7a9cc6', flexShrink: 0 }} />
              </motion.div>
              {text}
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      <motion.form
        className="auth-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
      >
        <motion.p
          className="eyebrow"
          key={register ? 'create' : 'welcome'}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {register ? 'CREATE ACCOUNT' : 'WELCOME BACK'}
        </motion.p>

        <motion.h2
          key={register ? 'join' : 'signin'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {register ? 'Join Soltryce' : 'Sign in to Soltryce'}
        </motion.h2>

        <AnimatePresence mode="wait">
          {register && (
            <motion.div
              key="register-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ display: 'grid', gap: '1rem', overflow: 'hidden' }}
            >
              <label>Display name
                <motion.input name="display_name" onChange={change} required
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                />
              </label>
              <label>Department
                <motion.input name="department" onChange={change} placeholder="Optional"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                />
              </label>
              <label>Email
                <motion.input type="email" name="email" onChange={change} required
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        <label>Username
          <input
            name="username"
            value={form.username}
            autoComplete="username"
            onChange={change}
            required
            placeholder="Enter your username"
          />
        </label>

        <label>Password
          <input
            type="password"
            name="password"
            value={form.password}
            minLength={8}
            autoComplete={register ? 'new-password' : 'current-password'}
            onChange={change}
            required
            placeholder="At least 8 characters"
          />
        </label>

        <AnimatePresence>
          {message && (
            <motion.p
              className="form-error"
              role="alert"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          className="primary"
          disabled={busy}
          style={{ marginTop: '.5rem', padding: '.8rem' }}
          whileHover={{ scale: busy ? 1 : 1.02 }}
          whileTap={{ scale: busy ? 1 : 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {busy ? (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              Please wait…
            </motion.span>
          ) : register ? 'Create student account' : 'Sign in'}
        </motion.button>

        <motion.button
          type="button"
          className="link"
          disabled={busy}
          onClick={() => { setRegister(!register); setMessage('') }}
          whileHover={{ x: 2 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          {register ? 'Already have an account? Sign in' : 'New student? Create an account'}
        </motion.button>
      </motion.form>
    </main>
  )
}

/* ══════════════════════════════════════════════
   Student Dashboard
   ══════════════════════════════════════════════ */
function StudentDashboard({ requests, reload, go }) {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const chatContainerRef = useRef(null)
  const wasAtBottomRef = useRef(true)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const academicRequests = [...requests.filter((request) => request.category === 'academic_question')].reverse()

  const isAtBottom = () => {
    const el = chatContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }

  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom()
    }
  }, [academicRequests])

  const handleScroll = () => {
    const atBottom = isAtBottom()
    wasAtBottomRef.current = atBottom
    setShowScrollDown(!atBottom)
  }

  const ask = async (event) => {
    event.preventDefault()
    try {
      await API.post('/requests/request/', { query, category: 'academic_question' })
      setQuery('')
      setMessage('Question sent to the academic assistant.')
      reload()
    } catch (error) { setMessage(errorMessage(error)) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={22} style={{ color: 'var(--brand)' }} />
          <p className="eyebrow">ACADEMIC ASSISTANT</p>
        </div>
      </motion.header>

      <div className="chat-panel">
        <div className="chat-messages" ref={chatContainerRef} onScroll={handleScroll}>
          {!academicRequests.length && (
            <div className="chat-empty">
              <Sparkles size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p>Ask a question about your academic policies and regulations.</p>
            </div>
          )}
          {academicRequests.map((request, i) => (
            <React.Fragment key={request.id}>
              <motion.div
                className="chat-bubble user-bubble"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <p>{request.query}</p>
              </motion.div>

              <motion.div
                className="chat-bubble assistant-bubble"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
              >
                <div className="assistant-avatar">
                  <Bot size={16} />
                </div>
                <div className="assistant-content">
                  {request.status === 'IN_PROGRESS' || request.status === 'PENDING' ? (
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  ) : request.response ? (
                    <div className="markdown-body">
                      <Markdown remarkPlugins={[remarkGfm]}>{request.response}</Markdown>
                    </div>
                  ) : (
                    <p className="muted">Looking through the rulebook…</p>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          ))}
        </div>

        {showScrollDown && (
          <motion.button
            className="scroll-down-btn"
            onClick={scrollToBottom}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-label="Scroll to bottom"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 13l5 5 5-5"/>
              <path d="M7 6l5 5 5-5"/>
            </svg>
          </motion.button>
        )}

        <form onSubmit={ask} className="compose">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask an academic question…"
            required
          />
          <button type="submit" className="primary" aria-label="Send">
            <Send size={18} />
          </button>
        </form>

        <AnimatePresence>
          {message && (
            <motion.p
              className="notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Request History
   ══════════════════════════════════════════════ */
function RequestHistory({ items, title = 'MY REQUESTS', heading = 'Request history' }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">{title}</p>
        <h1>{heading}</h1>
        <p>Questions and service requests in one place.</p>
      </motion.header>

      <motion.section
        className="panel list"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence mode="popLayout">
          {items.length ? items.map((item, i) => (
            <motion.article
              className="request"
              key={item.id}
              layout
              variants={staggerItem}
              whileHover={{ x: 4, backgroundColor: 'var(--hover-bg-row)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <b>{item.query}</b>{status(item.status)}
                </div>
                <p>{item.response || 'Awaiting an update.'}</p>
                <small>{item.category.replace('_', ' ')} · {date(item.created_at)}</small>
              </div>
            </motion.article>
          )) : (
            <Empty icon={ClipboardList}>No requests yet.</Empty>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Service Form
   ══════════════════════════════════════════════ */
function ServiceForm({ category, reload, go }) {
  const lab = category === 'lab_booking'
  const [values, setValues] = useState({ location: '', description: '', lab_name: '', time_slot: '' })
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const metadata = lab
      ? { lab_name: values.lab_name, time_slot: values.time_slot }
      : { location: values.location, issue_description: values.description }
    const query = lab
      ? `Lab booking request for ${values.lab_name} at ${values.time_slot}.`
      : `Maintenance request for ${values.location}: ${values.description}`
    try {
      await API.post('/requests/request/', { query, category, metadata })
      setMessage(lab ? 'Submitted for administrator approval.' : 'Submitted for automated maintenance triage.')
      reload()
    } catch (error) { setMessage(errorMessage(error)) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">SERVICE DESK</p>
        <h1>{lab ? 'Book a laboratory' : 'Report maintenance'}</h1>
        <p>
          {lab
            ? 'Administrators review laboratory bookings.'
            : 'Routine, well-specified requests go straight to staff; safety-sensitive work is reviewed by an administrator.'
          }
        </p>
      </motion.header>

      <motion.form
        className="panel form"
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
      >
        {lab ? (
          <>
            <label>Laboratory
              <input required onChange={(e) => setValues({ ...values, lab_name: e.target.value })} placeholder="e.g. CS Lab 3" />
            </label>
            <label>Preferred time
              <input required onChange={(e) => setValues({ ...values, time_slot: e.target.value })} placeholder="e.g. 12 Sep, 2–4 PM" />
            </label>
          </>
        ) : (
          <>
            <label>Location
              <input required onChange={(e) => setValues({ ...values, location: e.target.value })} placeholder="e.g. Building A, Room 204" />
            </label>
            <label>Describe the issue
              <textarea required onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder="What's wrong and how can we fix it?" />
            </label>
          </>
        )}

        <div style={{ display: 'flex', gap: '.6rem' }}>
          <motion.button
            className="primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            Submit request
          </motion.button>
          <motion.button
            type="button"
            className="secondary"
            onClick={() => go('home')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            Cancel
          </motion.button>
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              className="notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Admin Dashboard
   ══════════════════════════════════════════════ */
function AdminDashboard({ stats, approvals, review }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Campus operations</h1>
        <p>Approve service requests, manage staff, and maintain the knowledge base.</p>
      </motion.header>

      <motion.section
        className="metrics"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {[
          [stats.pending_approvals, 'Awaiting approval', AlertCircle],
          [stats.pending_staff_tickets, 'Staff tickets', Clock],
          [stats.completed_requests, 'Completed', CheckCircle2],
          [stats.total_users, 'Users', Users],
        ].map(([value, label, Icon]) => (
          <motion.div
            className="metric"
            key={label}
            variants={staggerItem}
            whileHover={{ scale: 1.03, y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AnimatedCounter value={value} />
              <motion.div whileHover={{ rotate: 10, scale: 1.2 }}>
                <Icon size={20} style={{ color: 'var(--metric-icon)', opacity: 0.6 }} />
              </motion.div>
            </div>
            <span>{label}</span>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2>Awaiting review</h2>
        <AnimatePresence mode="popLayout">
          {approvals.length ? approvals.map((approval, i) => (
            <motion.article
              className="approval"
              key={approval.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12, transition: { duration: 0.2 } }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
              whileHover={{ backgroundColor: 'var(--hover-bg-row)' }}
            >
              <div>
                <b>{approval.original_query}</b>
                <p>{approval.user} · {approval.category.replace('_', ' ')}</p>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
                <motion.button
                  className="secondary"
                  onClick={() => review(approval.id, 'APPROVE')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Approve
                </motion.button>
                <motion.button
                  className="danger"
                  onClick={() => review(approval.id, 'REJECT')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Reject
                </motion.button>
              </div>
            </motion.article>
          )) : (
            <Empty icon={CheckCircle2}>No requests need review.</Empty>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Staff Dashboard
   ══════════════════════════════════════════════ */
function StaffDashboard({ tickets, updateTicket }) {
  const pending = tickets.filter((t) => t.status === 'PENDING').length

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">SUPPORT STAFF</p>
        <h1>Maintenance tickets</h1>
        <p>Approved maintenance work is ready for your team.</p>
      </motion.header>

      <motion.section
        className="metrics"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div className="metric" variants={staggerItem} whileHover={{ scale: 1.03, y: -3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AnimatedCounter value={pending} />
            <Clock size={20} style={{ color: 'var(--metric-icon)', opacity: 0.6 }} />
          </div>
          <span>Pending work</span>
        </motion.div>
        <motion.div className="metric" variants={staggerItem} whileHover={{ scale: 1.03, y: -3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <AnimatedCounter value={tickets.filter((t) => t.status === 'COMPLETED').length} />
            <CheckCircle2 size={20} style={{ color: '#22c55e', opacity: 0.6 }} />
          </div>
          <span>Completed tickets</span>
        </motion.div>
      </motion.section>

      <motion.section
        className="panel list"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence mode="popLayout">
          {tickets.length ? tickets.map((ticket, i) => (
            <motion.article
              className="approval"
              key={ticket.id}
              layout
              variants={staggerItem}
              whileHover={{ backgroundColor: 'var(--hover-bg-row)' }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <b>{ticket.query}</b>{status(ticket.status)}
                </div>
                <p>{ticket.user.display_name || ticket.user.username} · {ticket.metadata.location || 'Location not specified'}</p>
                <small>{date(ticket.created_at)}</small>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
                <motion.button
                  className="secondary"
                  disabled={ticket.status === 'PENDING'}
                  onClick={() => updateTicket(ticket.id, 'PENDING')}
                  whileHover={{ scale: ticket.status === 'PENDING' ? 1 : 1.05 }}
                  whileTap={{ scale: ticket.status === 'PENDING' ? 1 : 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Mark pending
                </motion.button>
                <motion.button
                  className="primary"
                  disabled={ticket.status === 'COMPLETED'}
                  onClick={() => updateTicket(ticket.id, 'COMPLETED')}
                  whileHover={{ scale: ticket.status === 'COMPLETED' ? 1 : 1.05 }}
                  whileTap={{ scale: ticket.status === 'COMPLETED' ? 1 : 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  Mark complete
                </motion.button>
              </div>
            </motion.article>
          )) : (
            <Empty icon={Wrench}>No approved maintenance tickets.</Empty>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Rulebooks
   ══════════════════════════════════════════════ */
function Rulebooks({ items, reload }) {
  const [message, setMessage] = useState('')

  const upload = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.target)
    ;['student', 'staff', 'admin'].forEach((role) => formData.append('access_levels', role))
    try {
      await API.post('/knowledge/rulebooks/', formData)
      event.target.reset()
      setMessage('Uploaded and queued for indexing.')
      reload()
    } catch (error) { setMessage(errorMessage(error)) }
  }

  const remove = async (id) => {
    if (!confirm('Remove this rulebook?')) return
    try { await API.delete(`/knowledge/rulebooks/${id}/`); reload() } catch (error) { setMessage(errorMessage(error)) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">KNOWLEDGE BASE</p>
        <h1>Rulebook management</h1>
        <p>The assistant uses only these uploaded PDFs.</p>
      </motion.header>

      <div className="two-col">
        <motion.form
          className="panel form"
          onSubmit={upload}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
        >
          <h2>Add rulebook</h2>
          <label>Title
            <input name="title" required placeholder="e.g. Academic Policy 2025" />
          </label>
          <label>Effective date
            <input name="effective_date" type="date" required />
          </label>
          <label>PDF file
            <input name="file" type="file" accept="application/pdf" required />
          </label>
          <motion.button
            className="primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Plus size={16} /> Upload and index
          </motion.button>

          <AnimatePresence>
            {message && (
              <motion.p
                className="notice"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.form>

        <motion.section
          className="panel list"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <h2>Rulebooks</h2>
          <AnimatePresence mode="popLayout">
            {items.length ? items.map((item, i) => (
              <motion.article
                className="document"
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
                whileHover={{ backgroundColor: 'var(--hover-bg-row)' }}
              >
                <motion.div
                  style={{
                    width: 42, height: 42, borderRadius: 12, background: 'var(--doc-icon-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    border: '1px solid var(--doc-icon-border)',
                  }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <FileText size={20} style={{ color: 'var(--doc-icon-color)' }} />
                </motion.div>
                <div>
                  <b>{item.title}</b>
                  <p>
                    <span style={{ color: item.is_ingested ? '#16a34a' : '#a16207' }}>
                      {item.is_ingested ? '✓ Indexed' : '⏳ Queued'}
                    </span> · Effective {item.effective_date}
                  </p>
                </div>
                <motion.button
                  className="icon-danger"
                  onClick={() => remove(item.id)}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <X size={16} />
                </motion.button>
              </motion.article>
            )) : (
              <Empty icon={FileText}>No rulebooks uploaded.</Empty>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Profile
   ══════════════════════════════════════════════ */
function Profile({ user, setUser }) {
  const [form, setForm] = useState(user)
  const [message, setMessage] = useState('')

  const save = async (event) => {
    event.preventDefault()
    try {
      const { data } = await API.patch('/auth/me/', form)
      setUser(data)
      setMessage('Profile saved.')
    } catch (error) { setMessage(errorMessage(error)) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">ACCOUNT</p>
        <h1>Your profile</h1>
      </motion.header>

      <motion.form
        className="panel form profile"
        onSubmit={save}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
      >
        {['display_name', 'first_name', 'last_name', 'department'].map((key, i) => (
          <motion.label
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            {key.replace('_', ' ')}
            <input
              value={form[key] || ''}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              placeholder={key === 'department' ? 'Optional' : ''}
            />
          </motion.label>
        ))}

        <motion.label
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Email
          <input value={user.email} disabled />
        </motion.label>

        <motion.div
          style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '.5rem' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <motion.span
            className={`badge ${user.role}`}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {user.role}
          </motion.span>
          <span className="muted" style={{ fontSize: '.82rem' }}>Your current role</span>
        </motion.div>

        <motion.button
          className="primary"
          style={{ gridColumn: 'span 2', maxWidth: 200 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          Save profile
        </motion.button>

        <AnimatePresence>
          {message && (
            <motion.p
              className="notice"
              style={{ gridColumn: 'span 2' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Users Page
   ══════════════════════════════════════════════ */
function UsersPage({ users, reload }) {
  const [form, setForm] = useState({ username: '', email: '', display_name: '', department: '', password: '' })
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const roleBadgeColors = {
    admin: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)', glow: '0 0 8px rgba(139, 92, 246, 0.15)' },
    staff: { bg: 'rgba(59, 89, 152, 0.12)', text: '#3b5998', border: 'rgba(59, 89, 152, 0.2)', glow: '0 0 8px rgba(59, 89, 152, 0.15)' },
    student: { bg: 'rgba(34, 197, 94, 0.12)', text: '#16a34a', border: 'rgba(34, 197, 94, 0.2)', glow: '0 0 8px rgba(34, 197, 94, 0.15)' },
  }

  const avatarColors = {
    admin: { bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)', border: 'rgba(139, 92, 246, 0.3)', icon: '#8b5cf6' },
    staff: { bg: 'linear-gradient(135deg, rgba(59, 89, 152, 0.15) 0%, rgba(59, 89, 152, 0.05) 100%)', border: 'rgba(59, 89, 152, 0.3)', icon: '#3b5998' },
    student: { bg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)', border: 'rgba(34, 197, 94, 0.3)', icon: '#16a34a' },
  }

  const update = async (user, values) => {
    try { await API.patch(`/auth/users/${user.id}/`, values); reload() } catch (error) { setMessage(errorMessage(error)) }
  }

  const handleRoleChange = (user, newRole) => {
    if (user.role === newRole) return
    setConfirmAction({
      type: 'role',
      user,
      newRole,
      message: `Change ${user.display_name || user.username}'s role from ${user.role} to ${newRole}?`,
    })
  }

  const handleToggleActive = (user) => {
    const action = user.is_active ? 'deactivate' : 'activate'
    setConfirmAction({
      type: 'active',
      user,
      message: `${action === 'deactivate' ? 'Deactivate' : 'Activate'} ${user.display_name || user.username}'s account?`,
    })
  }

  const executeConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'role') {
      update(confirmAction.user, { role: confirmAction.newRole })
    } else if (confirmAction.type === 'active') {
      update(confirmAction.user, { is_active: !confirmAction.user.is_active })
    }
    setConfirmAction(null)
  }

  const createStaff = async (event) => {
    event.preventDefault()
    try {
      await API.post('/auth/users/', { ...form, role: 'staff' })
      setForm({ username: '', email: '', display_name: '', department: '', password: '' })
      setMessage('Support staff account created.')
      setShowCreateForm(false)
      reload()
    } catch (error) { setMessage(errorMessage(error)) }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roleCounts = {
    all: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    staff: users.filter((u) => u.role === 'staff').length,
    student: users.filter((u) => u.role === 'student').length,
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="eyebrow">ACCESS CONTROL</p>
        <h1>Users and support staff</h1>
        <p>Create support staff accounts and manage account access.</p>
      </motion.header>

      {/* ── Confirmation Dialog ──────────────── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              className="panel"
              style={{ width: 'min(420px, 90%)', padding: '2rem', textAlign: 'center' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: confirmAction.type === 'active' && confirmAction.user.is_active
                    ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 89, 152, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              >
                <AlertCircle size={28} style={{
                  color: confirmAction.type === 'active' && confirmAction.user.is_active
                    ? '#ef4444' : 'var(--brand)',
                }} />
              </motion.div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Confirm change</h2>
              <p style={{ marginBottom: '1.5rem' }}>{confirmAction.message}</p>
              <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center' }}>
                <motion.button
                  className="secondary"
                  onClick={() => setConfirmAction(null)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className={confirmAction.type === 'active' && confirmAction.user.is_active ? 'danger' : 'primary'}
                  onClick={executeConfirm}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ flex: 1 }}
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Row ───────────────────────── */}
      <motion.div
        className="metrics"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        style={{ marginBottom: '1.25rem' }}
      >
        {[
          ['all', 'All users', Users],
          ['admin', 'Admins', ShieldCheck],
          ['staff', 'Staff', Wrench],
          ['student', 'Students', UserRound],
        ].map(([key, label, Icon]) => (
          <motion.div
            key={key}
            className="metric"
            variants={staggerItem}
            whileHover={{ scale: 1.03, y: -2 }}
            onClick={() => setRoleFilter(key)}
            style={{
              cursor: 'pointer',
              outline: roleFilter === key ? '2px solid var(--brand)' : 'none',
              outlineOffset: '-2px',
              transition: 'outline var(--transition-fast), transform var(--transition)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <AnimatedCounter value={roleCounts[key]} />
              <Icon size={18} style={{ color: 'var(--metric-icon)', opacity: 0.5 }} />
            </div>
            <span>{label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Toolbar: Search + Create ─────────── */}
      <motion.div
        style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{
            position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or department…"
            style={{
              width: '100%', paddingLeft: '2.5rem',
              borderRadius: 'var(--radius)', padding: '0.7rem 0.9rem 0.7rem 2.5rem',
            }}
          />
        </div>
        <motion.button
          className="primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          style={{ flexShrink: 0 }}
        >
          <Plus size={16} /> {showCreateForm ? 'Close' : 'Add staff'}
        </motion.button>
      </motion.div>

      {/* ── Create Staff Form (collapsible) ──── */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.form
            className="panel form"
            onSubmit={createStaff}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.85rem' }}>
              <label style={{ gridColumn: 'span 2' }}>Display name
                <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required placeholder="e.g. Jane Smith" />
              </label>
              <label>Username
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="e.g. jsmith" />
              </label>
              <label>Email
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="user@campus.edu" />
              </label>
              <label>Department
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Optional" />
              </label>
              <label>Temporary password
                <input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="At least 8 characters" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '.6rem', marginTop: '.25rem' }}>
              <motion.button
                className="primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Plus size={16} /> Create staff account
              </motion.button>
              <motion.button
                type="button"
                className="secondary"
                onClick={() => setShowCreateForm(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
            </div>
            <AnimatePresence>
              {message && (
                <motion.p
                  className="notice"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Accounts List ────────────────────── */}
      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 200 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>All accounts</h2>
          <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
            {filtered.length} of {users.length} users
          </span>
        </div>

        {filtered.length === 0 ? (
          <Empty icon={Users}>
            {search || roleFilter !== 'all'
              ? 'No accounts match your search or filter.'
              : 'No accounts yet. Create a support staff account to get started.'}
          </Empty>
        ) : (
          <div style={{ display: 'grid', gap: '0' }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((u, i) => {
                const colors = avatarColors[u.role] || avatarColors.student
                const badge = roleBadgeColors[u.role] || roleBadgeColors.student
                return (
                  <motion.article
                    key={u.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '1rem 0.5rem',
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-soft)' : 'none',
                      transition: 'background var(--transition-fast)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                    whileHover={{ backgroundColor: 'var(--hover-bg-row)', x: 2 }}
                  >
                    {/* Avatar */}
                    <motion.div
                      style={{
                        width: 48, height: 48, borderRadius: '14px',
                        background: colors.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        border: `1.5px solid ${colors.border}`,
                        transition: 'transform var(--transition)',
                      }}
                      whileHover={{ scale: 1.08, rotate: 3 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <UserRound size={22} style={{ color: colors.icon }} />
                    </motion.div>

                    {/* User Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                        <b style={{ fontSize: '.95rem' }}>{u.display_name || u.username}</b>
                        <span
                          style={{
                            fontSize: '.68rem', fontWeight: 800, letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            boxShadow: badge.glow,
                            lineHeight: 1.6,
                          }}
                        >
                          {u.role}
                        </span>
                        {!u.is_active && (
                          <span
                            style={{
                              fontSize: '.68rem', fontWeight: 800,
                              padding: '0.15rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              lineHeight: 1.6,
                            }}
                          >
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '.82rem' }}>
                        {u.email}
                        {u.department && <>
                          <span style={{ margin: '0 .35rem', opacity: 0.4 }}>·</span>
                          {u.department}
                        </>}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0, alignItems: 'center' }}>
                      <select
                        aria-label={`Role for ${u.username}`}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        style={{ minWidth: '90px' }}
                      >
                        {['student', 'staff', 'admin'].map((role) => <option key={role}>{role}</option>)}
                      </select>
                      <motion.button
                        className={u.is_active ? 'danger' : 'secondary'}
                        onClick={() => handleToggleActive(u)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </motion.button>
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.section>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════
   Loading Screen
   ══════════════════════════════════════════════ */
function LoadingScreen({ message = 'Connecting to server…' }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
      background: 'var(--loading-bg)',
    }}>
      <motion.div
        className="brand"
        style={{ fontSize: '1.6rem' }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BookOpen />
        </motion.div>
        soltryce
      </motion.div>
      <motion.p
        style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {message}
      </motion.p>
      <motion.div
        style={{ width: 56, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, #2a4f7e, #3b5998)', borderRadius: 4 }}
          animate={{ x: ['-100%', '350%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Main App
   ══════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('home')
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState([])
  const [approvals, setApprovals] = useState([])
  const [stats, setStats] = useState({})
  const [docs, setDocs] = useState([])
  const [users, setUsers] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem('soltryce-theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('soltryce-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const admin = user?.is_admin
  const staff = user?.role === 'staff'

  const load = async () => {
    if (!user) return
    try {
      if (admin) {
        const [history, pending, dashboard, rulebooks, accounts] = await Promise.all([
          API.get('/requests/history/'),
          API.get('/requests/pending/'),
          API.get('/requests/dashboard/'),
          API.get('/knowledge/rulebooks/'),
          API.get('/auth/users/'),
        ])
        setRequests(history.data)
        setApprovals(pending.data)
        setStats(dashboard.data)
        setDocs(rulebooks.data)
        setUsers(accounts.data)
      } else if (staff) {
        const { data } = await API.get('/requests/staff/tickets/')
        setRequests(data)
      } else {
        const { data } = await API.get('/requests/mine/')
        setRequests(data)
      }
    } catch (error) { console.error(error) }
  }

  useEffect(() => {
    const expired = () => setUser(null)
    window.addEventListener('soltryce:session-expired', expired)
    const hasToken = sessionStorage.getItem('soltryce_access_token') || localStorage.getItem('soltryce_refresh_token')
    if (!hasToken) { setLoading(false); return }
    let attempts = 0
    const maxAttempts = 5
    const tryAuth = async () => {
      try {
        const { data } = await API.get('/auth/me/')
        setUser(data)
      } catch (error) {
        if (error.isUpstreamDown && attempts < maxAttempts) {
          attempts++
          setTimeout(tryAuth, attempts * 2000)
          return
        }
        sessionStorage.removeItem('soltryce_access_token')
        localStorage.removeItem('soltryce_refresh_token')
      } finally {
        setLoading(false)
      }
    }
    tryAuth()
    return () => window.removeEventListener('soltryce:session-expired', expired)
  }, [])

  useEffect(() => { load() }, [user])

  const review = async (id, action) => {
    const reason = action === 'REJECT' ? prompt('Rejection reason:') : ''
    if (action === 'REJECT' && !reason) return
    try { await API.post(`/requests/${id}/process/`, { action, reason }); load() } catch (error) { alert(errorMessage(error)) }
  }

  const updateTicket = async (id, ticketStatus) => {
    try { await API.post(`/requests/request/${id}/staff-status/`, { status: ticketStatus }); load() } catch (error) { alert(errorMessage(error)) }
  }

  if (loading) return <LoadingScreen />
  if (!user) return <Auth signedIn={setUser} />

  const nav = admin
    ? [['home', 'Overview', ShieldCheck], ['admin-schedule', 'Schedule', Calendar], ['lab-mgmt', 'Labs', BookOpen], ['clearance', 'Clearance', Shield], ['booking-settings', 'Settings', Settings], ['rulebooks', 'Rulebooks', FileText], ['users', 'Users', Users], ['history', 'All history', ClipboardList], ['profile', 'Profile', UserRound]]
    : staff
      ? [['home', 'Tickets', Wrench], ['profile', 'Profile', UserRound]]
      : [['home', 'Dashboard', ShieldCheck], ['student-schedule', 'Book a lab', Calendar], ['requests', 'My requests', ClipboardList], ['maintenance', 'Maintenance', Wrench], ['profile', 'Profile', UserRound]]

  let page
  if (view === 'home') page = admin
    ? <AdminDashboard stats={stats} approvals={approvals} review={review} />
    : staff
      ? <StaffDashboard tickets={requests} updateTicket={updateTicket} />
      : <StudentDashboard requests={requests} reload={load} go={setView} />
  else if (view === 'requests' || view === 'history') page = <RequestHistory items={requests} />
  else if (view === 'maintenance') page = <ServiceForm category='maintenance' reload={load} go={setView} />
  else if (view === 'admin-schedule') page = <AdminSchedule reload={load} />
  else if (view === 'lab-mgmt') page = <LabManagement reload={load} />
  else if (view === 'clearance') page = <ClearanceManager reload={load} />
  else if (view === 'booking-settings') page = <BookingSettings />
  else if (view === 'student-schedule') page = <StudentSchedule user={user} />
  else if (view === 'rulebooks') page = <Rulebooks items={docs} reload={load} />
  else if (view === 'users') page = <UsersPage users={users} reload={load} />
  else page = <Profile user={user} setUser={setUser} />

  return (
    <div className="shell">
      <motion.aside
        className={open ? 'open' : ''}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="brand"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <BookOpen size={22} /> soltryce
        </motion.div>

        <nav>
          {nav.map(([id, label, Icon], i) => (
            <motion.button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => { setView(id); setOpen(false) }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 300 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
            >
              <Icon size={18} />
              {label}
            </motion.button>
          ))}
        </nav>

        <motion.div
          className="account"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <b>{user.display_name || user.username}</b>
          <small>{admin ? 'Administrator' : staff ? 'Support staff' : 'Student'}</small>
          <motion.button
            onClick={toggleTheme}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </motion.button>
          <motion.button
            onClick={() => { sessionStorage.clear(); localStorage.removeItem('soltryce_refresh_token'); setUser(null) }}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <LogOut size={16} /> Sign out
          </motion.button>
        </motion.div>
      </motion.aside>

      <div className="mobile">
        <motion.button
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          whileTap={{ scale: 0.9 }}
        >
          <Menu size={22} />
        </motion.button>
        <b style={{ flex: 1 }}>soltryce</b>
        <motion.button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          whileTap={{ scale: 0.9 }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </motion.button>
      </div>

      <main>
        <AnimatePresence mode="wait">
          <motion.div key={view}>
            {page}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
