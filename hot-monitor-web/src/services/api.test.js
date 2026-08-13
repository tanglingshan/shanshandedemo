import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_USE_MOCKS', 'true')
})

describe('mock API contract', () => {
  it('returns paged hot items and overview data', async () => {
    const { api } = await import('./api')
    const items = await api.hotItems({ source: 'hackernews' })
    const overview = await api.overview()
    expect(items.success).toBe(true)
    expect(items.data.items.every((item) => item.source === 'hackernews')).toBe(true)
    expect(overview.data.sourceCount).toBe(3)
  })
})

describe('server response parsing', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
  })

  it.each([
    ['empty response', ''],
    ['truncated JSON', '{"success":true'],
    ['HTML response', '<html>服务暂时不可用</html>'],
  ])('converts %s into a Chinese error', async (_caseName, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(body),
    }))

    const { api } = await import('./api')
    await expect(api.me()).rejects.toThrow('服务器返回了无效数据，请稍后重试')
  })

  it('preserves valid API payloads', async () => {
    const payload = { success: true, data: { id: 'user-1' }, message: '', errorCode: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
    }))

    const { api } = await import('./api')
    await expect(api.me()).resolves.toEqual(payload)
  })
})
