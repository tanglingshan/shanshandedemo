import { mockHotItems, mockOverview, mockSources } from '../data/mockData'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
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
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
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
}

export { normalizeHotItem, normalizeOverview }
