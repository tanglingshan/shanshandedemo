import { mockHotItems, mockOverview, mockSources } from '../data/mockData'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
// Mock data is opt-in; real API is the default for development and production.
const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || '').toLowerCase() === 'true'
const INVALID_RESPONSE_MESSAGE = '服务器返回了无效数据，请稍后重试'
const mockUsers = [{ id: 'user-demo', email: 'demo@hotmonitor.dev' }]
const sourceNames = {
  hackernews: 'HackerNews',
  bing: 'Bing',
  bilibili: 'B站',
}

const wait = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms))
const response = (data, message = '') => ({ success: true, data, message, errorCode: null })

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
  const payload = {
    email: source.email,
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
  return {
    ...item,
    source,
    sourceName: item.sourceName || sourceNames[source] || source,
    rawScore: item.rawScore ?? item.hotScore ?? 0,
    aiScore: item.aiScore ?? item.relevanceScore ?? item.aiAnalysis?.relevanceScore ?? 0,
    url: item.url || item.canonicalUrl || '#',
    tags: Array.isArray(item.tags) ? item.tags : [],
    collectedAt: formatCollectedAt(item.collectedAt),
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
    return response(user)
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
    const count = Math.min(4, Math.max(1, Number(body.n) || 1))
    const images = Array.from({ length: count }, (_, index) => ({
      url: createMockImage(body.prompt, index, body.size),
      b64Json: null,
      revisedPrompt: body.prompt,
    }))
    return response({
      requestId: `mock-image-${Date.now()}`,
      provider: 'mock',
      model: body.model || 'mock-image-model',
      images,
      createdAt: new Date().toISOString(),
    })
  }
  return response(null)
}

async function request(path, options = {}) {
  if (USE_MOCKS) return mockRequest(path, options)
  const query = options.query ? `?${new URLSearchParams(options.query)}` : ''
  const responseValue = await fetch(`${API_BASE_URL}${path}${query}`, {
    method: options.method || 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
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

export const api = {
  me: () => request('/auth/me'),
  login: async (body) => request('/auth/login', { method: 'POST', body: await normalizeAuthBody(body) }),
  register: async (body) => request('/auth/register', { method: 'POST', body: await normalizeAuthBody(body, true) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
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
}

export { normalizeHotItem, normalizeOverview, normalizeImageGeneration, normalizeAuthBody }
