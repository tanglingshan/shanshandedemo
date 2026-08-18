import { mockHotItems, mockOverview, mockSources } from '../data/mockData'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
// Mock data is opt-in; real API is the default for development and production.
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || '').toLowerCase() === 'true'
const ACCESS_TOKEN_STORAGE_KEY = 'hot-monitor-access-token'
let accessToken = null

function readAccessToken() {
  if (accessToken) return accessToken
  try {
    accessToken = globalThis.sessionStorage?.getItem(ACCESS_TOKEN_STORAGE_KEY) || null
  } catch {
    accessToken = null
  }
  return accessToken
}

export function setAccessToken(token) {
  const normalized = typeof token === 'string' ? token.trim() : ''
  accessToken = normalized || null
  try {
    if (accessToken) globalThis.sessionStorage?.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
    else globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy mode; memory still protects the session.
  }
  return accessToken
}

export function getAccessToken() {
  return readAccessToken()
}

export function clearAccessToken() {
  accessToken = null
  try { globalThis.sessionStorage?.removeItem(ACCESS_TOKEN_STORAGE_KEY) } catch { /* noop */ }
}

function notifyAuthExpired() {
  if (typeof globalThis.window === 'undefined') return
  try { globalThis.window.dispatchEvent(new globalThis.Event('auth:expired')) } catch { /* noop */ }
}
const INVALID_RESPONSE_MESSAGE = '服务器返回了无效数据，请稍后重试'
const mockUsers = [{ id: 'user-demo', email: 'demo@hotmonitor.dev' }]
let mockHotItemAIEnabled = false
const sourceNames = {
  hackernews: 'HackerNews',
  bing: 'Bing',
  bilibili: 'B站',
}

const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms))
const response = (data, message = '') => ({ success: true, data, message, errorCode: null })

// History image endpoints are returned as relative, authenticated URLs. When
// the API is served from a separate origin, resolve those URLs against that
// origin while keeping data URLs and already-absolute URLs untouched.
function resolveAssetUrl(value) {
  const source = String(value || '')
  if (!source || /^(?:data:|https?:|blob:)/i.test(source)) return source
  try {
    const configured = new URL(API_BASE_URL, globalThis.location?.origin || 'http://localhost')
    if (/^https?:$/i.test(configured.protocol) && /^https?:\/\//i.test(API_BASE_URL)) {
      return new URL(source, configured.origin).toString()
    }
  } catch {
    // Keep the original URL if the deployment supplied an invalid base URL.
  }
  return source
}

function parseBody(body) {
  if (!body) return {}
  if (typeof body === 'string') return JSON.parse(body)
  return body
}

/** Hash credentials before serialization so plaintext passwords never reach the API. */
export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function normalizeAuthBody(body = {}, register = false) {
  const source = { ...body }
  const suppliedDigest = source.passwordDigest || source.credential
  const passwordDigest = suppliedDigest || (source.password !== undefined ? await sha256Hex(source.password) : '')
  const account = String(source.account ?? source.email ?? source.username ?? '').trim()
  const payload = {
    account,
    // Keep email during the transition so older API deployments continue to work.
    email: source.email || account,
    passwordDigest,
    credential: passwordDigest,
  }
  if (register) {
    payload.confirmPasswordDigest = source.confirmPasswordDigest
      || (source.confirmPassword !== undefined ? await sha256Hex(source.confirmPassword) : '')
  }
  return payload
}

function normalizeHotItem(item) {
  if (!item) return item
  const source = item.source || item.sourceCode || 'unknown'
  const analysis = item.aiAnalysis || {}
  const rawAiScore = item.aiScore ?? item.relevanceScore ?? analysis.relevanceScore
  const analysisStatus = item.analysisStatus || analysis.analysisStatus || analysis.status
    || (rawAiScore !== undefined && rawAiScore !== null ? 'completed' : 'pending')
  const isAnalyzed = analysisStatus === 'completed' || analysisStatus === 'succeeded' || analysisStatus === 'analyzed'
  return {
    ...item,
    source,
    sourceName: item.sourceName || sourceNames[source] || source,
    rawScore: item.rawScore ?? item.hotScore ?? 0,
    // Pending/disabled items must not look like an analyzed score of zero.
    aiScore: isAnalyzed && rawAiScore !== undefined && rawAiScore !== null ? rawAiScore : null,
    analysisStatus,
    summary: item.summary || analysis.summary || '',
    url: item.url || item.canonicalUrl || '#',
    tags: Array.isArray(item.tags) ? item.tags : (Array.isArray(analysis.tags) ? analysis.tags : []),
    collectedAt: formatCollectedAt(item.collectedAt),
  }
}

function normalizeHotItemAISettings(data) {
  const source = data?.settings || data || {}
  const status = String(source.status || '').toLowerCase()
  const requestedEnabled = Boolean(source.requestedEnabled ?? source.aiEnabled ?? source.enabled ?? false)
  const deploymentAllowed = source.allowedByEnvironment ?? source.deploymentAllowed ?? source.allowed
    ?? !['not_allowed', 'deployment_not_allowed', 'disabled_by_deployment'].includes(status)
  const configured = source.providerConfigured ?? source.configured ?? source.aiConfigured
    ?? !['config_missing', 'not_configured', 'provider_not_configured'].includes(status)
  const effectiveEnabled = source.effectiveEnabled ?? (requestedEnabled && deploymentAllowed && configured)
  return {
    ...source,
    requestedEnabled,
    aiEnabled: requestedEnabled,
    enabled: requestedEnabled,
    deploymentAllowed: Boolean(deploymentAllowed),
    configured: Boolean(configured),
    effectiveEnabled: Boolean(effectiveEnabled),
    status,
  }
}

function normalizeOverview(overview) {
  if (!overview) return overview
  return {
    ...overview,
    latestCollectTime: formatCollectedAt(overview.latestCollectTime),
  }
}

function formatCollectedAt(value) {
  if (!value) return ''
  if (typeof value === 'string' && !value.includes('T')) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function cleanQuery(query = {}) {
  const nextQuery = { ...query }
  if (nextQuery.source === 'all') delete nextQuery.source
  if (nextQuery.sort === 'score') nextQuery.sort = 'hot'
  return nextQuery
}

function createMockImage(prompt, index, size) {
  const [width, height] = String(size || '1024x1024').split('x').map(Number)
  const safeWidth = Number.isFinite(width) ? width : 1024
  const safeHeight = Number.isFinite(height) ? height : 1024
  const text = String(prompt || 'AI generated image').slice(0, 80).replace(/[<&>]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><defs><linearGradient id="g${index}" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#2563eb"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g${index})"/><text x="50%" y="48%" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${Math.max(20, Math.round(safeWidth / 24))}">AI IMAGE ${index + 1}</text><text x="50%" y="54%" text-anchor="middle" fill="#dbeafe" font-family="Arial,sans-serif" font-size="${Math.max(12, Math.round(safeWidth / 58))}">${text}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function normalizeImageGeneration(data) {
  if (!data) return data
  const images = Array.isArray(data.images) ? data.images : []
  return {
    ...data,
    images: images.map((image) => {
      if (typeof image === 'string') return { url: image, b64Json: null, revisedPrompt: '' }
      const b64Json = image?.b64Json || image?.b64_json || null
      return {
        ...image,
        url: image?.url || (b64Json ? `data:image/png;base64,${b64Json}` : ''),
        b64Json,
        revisedPrompt: image?.revisedPrompt || image?.revised_prompt || '',
      }
    }).filter((image) => image.url),
  }
}

function normalizeImageHistory(data) {
  if (!data) return data
  const payload = data.items ? data : (data.data?.items ? data.data : data)
  const items = Array.isArray(payload.items) ? payload.items : []
  return {
    ...payload,
    items: items.map((item) => ({
      ...item,
      images: (Array.isArray(item.images) ? item.images : []).map((image) => {
        const b64Json = image?.b64Json || image?.b64_json || null
        return {
          ...image,
          url: resolveAssetUrl(image?.url || (b64Json ? `data:image/png;base64,${b64Json}` : '')),
          b64Json,
          revisedPrompt: image?.revisedPrompt || image?.revised_prompt || '',
        }
      }).filter((image) => image.url),
    })),
    page: Number(payload.page) || 1,
    pageSize: Number(payload.pageSize) || 20,
    total: Number(payload.total) || 0,
    totalPages: Number(payload.totalPages) || 0,
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('hot-monitor-user'))
  } catch {
    return null
  }
}

async function mockRequest(path, options = {}) {
  await wait()
  const body = parseBody(options.body)
  if (path === '/auth/me') return response(getStoredUser())
  if (path === '/auth/login') {
    const user = mockUsers.find((item) => item.email === body.email) || { id: 'user-demo', email: body.email }
    localStorage.setItem('hot-monitor-user', JSON.stringify(user))
    return response({ ...user, accessToken: `mock-token-${Date.now()}` })
  }
  if (path === '/auth/register') {
    const user = { id: `user-${Date.now()}`, email: body.email }
    mockUsers.push(user)
    localStorage.setItem('hot-monitor-user', JSON.stringify(user))
    return response(user, '注册成功')
  }
  if (path === '/auth/logout') {
    localStorage.removeItem('hot-monitor-user')
    return response(null, '已退出登录')
  }
  if (path === '/stats/overview') return response(mockOverview)
  if (path === '/settings/hot-item-ai') {
    if (options.method === 'PATCH') {
      const enabled = Boolean(body.enabled ?? body.aiEnabled)
      mockHotItemAIEnabled = enabled
      globalThis.localStorage?.setItem('mock-hot-item-ai-enabled', String(enabled))
    }
    const stored = globalThis.localStorage?.getItem('mock-hot-item-ai-enabled')
    const enabled = stored === null || stored === undefined ? mockHotItemAIEnabled : stored === 'true'
    return response({ requestedEnabled: enabled, allowedByEnvironment: true, providerConfigured: true, effectiveEnabled: enabled, analysisMode: 'future_only', status: enabled ? 'enabled' : 'disabled' })
  }
  if (path === '/sources') return response(mockSources.slice(1))
  if (path.startsWith('/hot-items/')) {
    const item = mockHotItems.find((entry) => entry.id === path.split('/').pop()) || mockHotItems[0]
    return response({ ...item, aiAnalysis: { summary: item.summary, tags: item.tags } })
  }
  if (path === '/hot-items') {
    const params = new URLSearchParams(options.query)
    const source = params.get('source')
    const keyword = params.get('keyword')?.toLowerCase()
    let items = [...mockHotItems]
    if (source && source !== 'all') items = items.filter((item) => item.source === source)
    if (keyword) items = items.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(keyword))
    return response({ items, page: 1, pageSize: items.length, total: items.length })
  }
  if (path === '/image-generations') {
    // The image provider contract calls this field `count`; retain support for
    // the previous `n` payload so local mocks mirror either request shape.
    const count = Math.min(4, Math.max(1, Number(body.count ?? body.n) || 1))
    const images = Array.from({ length: count }, (_, index) => ({
      url: createMockImage(body.prompt, index, body.size),
      b64Json: null,
      revisedPrompt: body.prompt,
    }))
    const history = {
      id: `mock-history-${Date.now()}`,
      requestId: `mock-image-${Date.now()}`,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt || null,
      model: body.model || 'mock-image-model',
      size: body.size || '1024x1024',
      count,
      status: 'succeeded',
      images,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errorCode: null,
    }
    const storedHistory = JSON.parse(localStorage.getItem('mock-image-history') || '[]')
    localStorage.setItem('mock-image-history', JSON.stringify([history, ...storedHistory].slice(0, 50)))
    return response({
      requestId: `mock-image-${Date.now()}`,
      provider: 'mock',
      model: body.model || 'mock-image-model',
      images,
      createdAt: new Date().toISOString(),
    })
  }
  if (path === '/image-generations/polish') {
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return response(null, '请输入提示词')
    const polished = `${prompt}${body.style ? `，${body.style}风格` : ''}，画面主体清晰，构图平衡，光影自然，细节丰富`
    return response({ prompt: polished.slice(0, 1000), negativePrompt: body.negativePrompt || '', model: 'mock-text-model', requestId: `mock-polish-${Date.now()}`, createdAt: new Date().toISOString() })
  }
  if (path === '/image-generations/history') {
    const params = new URLSearchParams(options.query)
    const page = Math.max(1, Number(params.get('page')) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 20))
    const status = params.get('status')
    const all = JSON.parse(localStorage.getItem('mock-image-history') || '[]')
    const filtered = status ? all.filter((item) => item.status === status) : all
    const start = (page - 1) * pageSize
    return response({ items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) })
  }
  return response(null)
}

async function request(path, options = {}) {
  if (USE_MOCKS) return mockRequest(path, options)
  const query = options.query ? `?${new URLSearchParams(options.query)}` : ''
  const token = readAccessToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token && !headers.Authorization && !headers.authorization) headers.Authorization = `Bearer ${token}`
  const responseValue = await fetch(`${API_BASE_URL}${path}${query}`, {
    method: options.method || 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (responseValue.status === 401) {
    clearAccessToken()
    notifyAuthExpired()
  }
  let payload
  try {
    const rawBody = await responseValue.text()
    if (!rawBody.trim()) throw new Error('empty response body')
    payload = JSON.parse(rawBody)
  } catch {
    console.error('服务器响应数据格式无效')
    throw new Error(INVALID_RESPONSE_MESSAGE)
  }
  if (!responseValue.ok || payload.success === false) throw new Error(payload.message || '请求失败')
  return payload
}

function normalizeAuthResult(result) {
  const data = result?.data
  const token = result?.accessToken || result?.access_token || result?.token
    || data?.accessToken || data?.access_token || data?.token
  if (token) setAccessToken(token)
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return token ? { ...result, accessToken: token } : result
  }
  const user = data.user || data.userInfo || data.profile || (token
    ? Object.fromEntries(Object.entries(data).filter(([key]) => !['accessToken', 'access_token', 'token', 'tokenType', 'expiresIn', 'expires_in'].includes(key)))
    : data)
  return { ...result, data: user, ...(token ? { accessToken: token } : {}) }
}

export const api = {
  me: async () => {
    const result = await request('/auth/me')
    return result?.data?.user ? { ...result, data: result.data.user } : result
  },
  login: async (body) => normalizeAuthResult(await request('/auth/login', { method: 'POST', body: await normalizeAuthBody(body) })),
  register: async (body) => normalizeAuthResult(await request('/auth/register', { method: 'POST', body: await normalizeAuthBody(body, true) })),
  logout: async () => {
    try { return await request('/auth/logout', { method: 'POST' }) } finally { clearAccessToken() }
  },
  hotItems: async (query = {}) => {
    const result = await request('/hot-items', { query: cleanQuery(query) })
    return {
      ...result,
      data: {
        ...result.data,
        items: (result.data?.items || []).map(normalizeHotItem),
      },
    }
  },
  hotItem: async (id) => {
    const result = await request(`/hot-items/${id}`)
    return { ...result, data: normalizeHotItem(result.data) }
  },
  overview: async () => {
    const result = await request('/stats/overview')
    return { ...result, data: normalizeOverview(result.data) }
  },
  sources: () => request('/sources'),
  imageGenerate: async (body) => {
    const result = await request('/image-generations', { method: 'POST', body })
    return { ...result, data: normalizeImageGeneration(result.data) }
  },
  hotItemAISettings: async () => {
    const result = await request('/settings/hot-item-ai')
    return { ...result, data: normalizeHotItemAISettings(result.data) }
  },
  updateHotItemAISettings: async (enabled) => {
    const result = await request('/settings/hot-item-ai', {
      method: 'PATCH',
      body: { enabled: Boolean(enabled) },
    })
    return { ...result, data: normalizeHotItemAISettings(result.data) }
  },
  imagePolish: async (body) => {
    const result = await request('/image-generations/polish', { method: 'POST', body })
    return result
  },
  imageHistory: async (query = {}) => {
    const result = await request('/image-generations/history', { query })
    return { ...result, data: normalizeImageHistory(result.data) }
  },
}

export { normalizeHotItem, normalizeOverview, normalizeHotItemAISettings, normalizeImageGeneration, normalizeImageHistory, normalizeAuthBody, resolveAssetUrl }
