# Soltryce Frontend

React 19 single-page application built with Vite and served via Nginx.

## Stack

- **React 19** with functional components and hooks
- **Vite 8** for dev server and bundling
- **Framer Motion** for page transitions and micro-interactions
- **Lucide React** for icons
- **Axios** with JWT interceptors for API communication
- **react-markdown** for rendering academic assistant responses
- **Tailwind CSS** for utility classes
- **Nginx** for production serving with reverse proxy

## Development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` with hot module replacement.

## Build

```bash
npm run build
```

Output goes to `dist/`. The Dockerfile uses a multi-stage build (Node → Nginx).

## Lint

```bash
npm run lint
```

Uses ESLint with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`.

## Project Structure

```
src/
├── App.jsx                 # All page components (Auth, Dashboards, Users, Rulebooks, Profile)
├── api.js                  # Axios instance with JWT interceptors and token refresh
├── main.jsx                # React root mount
├── index.css               # Soltryce design system (CSS custom properties, light/dark themes)
├── components/
│   ├── Chat.jsx            # Chat interface component (legacy)
│   ├── AdminPanel.jsx      # HITL approval queue
│   ├── AdminSchedule.jsx   # Admin schedule management
│   ├── BookingSettings.jsx # Booking configuration
│   ├── ClearanceManager.jsx# Clearance management
│   ├── LabManagement.jsx   # Lab resource management
│   ├── ScheduleGrid.jsx    # Schedule grid display
│   └── StudentSchedule.jsx # Student schedule view
└── public/
    └── 50x.html            # Nginx error page
```

## Pages (App.jsx)

All page components are defined in `App.jsx` for co-location of related logic:

| Component | Description |
|-----------|-------------|
| `Auth` | Login/register form with animated welcome panel |
| `StudentDashboard` | Academic assistant chat, quick actions, request metrics |
| `StaffDashboard` | Maintenance ticket management with status controls |
| `AdminDashboard` | Approval queue, stats, admin operations |
| `RequestHistory` | Full request list with category filtering |
| `ServiceForm` | Maintenance report or lab booking request form |
| `Rulebooks` | Upload/manage rulebook PDFs with ingestion status |
| `Profile` | User profile editing |
| `UsersPage` | User management with role filtering, search, and bulk actions |

## Design System

The app uses a custom CSS design system defined in `index.css` via CSS custom properties.

### Light Mode Tokens

```css
--brand: #3b5998;
--bg: #f8fafc;
--surface: #ffffff;
--text: #0f172a;
--text-secondary: #64748b;
--border: #e2e8f0;
--radius: 16px;
```

### Dark Mode

Toggle via `data-theme="dark"` on `<html>`, which remaps all tokens:

```css
[data-theme="dark"] {
  --brand: #7a9cc6;
  --bg: #0b0f1a;
  --surface: #111827;
  --text: #f1f5f9;
  /* ... */
}
```

### Animation System

- **Page transitions**: Spring-based with scale + fade
- **Stagger containers**: Children animate sequentially
- **Hover effects**: Scale + translate with spring physics
- **Counter animations**: Eased number counting

## Markdown Rendering

Academic assistant responses are rendered with `react-markdown`. The `.markdown-body` class provides styling for:

- **Headers** (h1–h4) with proper hierarchy
- **Bold** and *italic* text
- **Tables** with styled headers, alternating row colors, and hover states
- **Blockquotes** with brand-colored left border and subtle background
- **Inline code** and code blocks
- **Ordered and unordered lists**
- **Horizontal rules**
- **Links** with brand color hover

```jsx
import Markdown from 'react-markdown'

<div className="markdown-body">
  <Markdown>{response}</Markdown>
</div>
```

## API Integration

The `api.js` module configures Axios with:

- **Base URL**: `/api/v1/`
- **JWT interceptor**: Automatically attaches `Authorization: Bearer <token>` header
- **Token refresh**: On 401, refreshes the access token and retries the request
- **Network error handling**: Detects upstream down states (502/503/504) and retries
- **Error normalization**: Wraps API errors into user-friendly messages via `errorMessage()`

```js
import API, { errorMessage } from './api'

// GET request
const { data } = await API.get('/auth/me/')

// POST request
await API.post('/requests/request/', { query, category })

// Error handling
try {
  await API.post('/auth/login/', credentials)
} catch (error) {
  setMessage(errorMessage(error))
}
```

## Styling Approach

- **Global design system**: CSS custom properties in `index.css`
- **Component styles**: BEM-like class names (`.panel`, `.answers article`, `.compose`)
- **Utility classes**: Tailwind CSS for layout utilities (`flex`, `gap-2`, etc.)
- **Inline styles**: Used sparingly for dynamic values (animation delays, conditional colors)

## Environment

No environment variables are needed for the frontend — all API URLs are proxied through Nginx in production and Vite's dev server in development.
