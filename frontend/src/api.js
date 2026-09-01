import axios from 'axios'

const API = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1' })
let refreshPromise
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('soltryce_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
API.interceptors.response.use((response) => response, async (error) => {
  const original = error.config
  // Network errors (no response) or 502/503/504 from nginx during startup
  const isNetworkError = !error.response
  const isUpstreamDown = error.response && [502, 503, 504].includes(error.response.status)
  if (isNetworkError || isUpstreamDown) {
    return Promise.reject({ ...error, isUpstreamDown: true })
  }
  if (error.response?.status !== 401 || original?._retried || original?.url?.includes('/auth/refresh/') || original?.url?.includes('/auth/login/')) return Promise.reject(error)
  const refresh = localStorage.getItem('soltryce_refresh_token')
  if (!refresh) return Promise.reject(error)
  original._retried = true
  try {
    refreshPromise ||= axios.post(`${API.defaults.baseURL}/auth/refresh/`, { refresh })
    const { data } = await refreshPromise
    sessionStorage.setItem('soltryce_access_token', data.access)
    if (data.refresh) localStorage.setItem('soltryce_refresh_token', data.refresh)
    original.headers.Authorization = `Bearer ${data.access}`
    return API(original)
  } catch (refreshError) {
    sessionStorage.removeItem('soltryce_access_token'); localStorage.removeItem('soltryce_refresh_token')
    window.dispatchEvent(new Event('soltryce:session-expired'))
    return Promise.reject(refreshError)
  } finally { refreshPromise = null }
})
export const errorMessage = (error) => {
  if (error.isUpstreamDown) return 'The server is starting up. This usually takes less than a minute — please try again shortly.'
  const data = error.response?.data
  if (!data) return 'Unable to reach the service. Please try again.'
  return typeof data.detail === 'string' ? data.detail : Object.values(data).flat().join(' ')
}
export default API
