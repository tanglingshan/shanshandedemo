import { io } from 'socket.io-client'
import { createMockHotItem } from '../data/mockData'
import { normalizeHotItem, normalizeOverview } from './api'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
const DEFAULT_ERROR_MESSAGE = '热点采集或分析失败，请稍后重试'

function getUserFacingErrorMessage(message) {
  return typeof message === 'string' && /[\u3400-\u9fff]/.test(message)
    ? message
    : DEFAULT_ERROR_MESSAGE
}

export function createDashboardSocket({ userId, filters, onStatus, onNewItem, onUpdate, onStats, onError }) {
  if (USE_MOCKS) {
    onStatus?.('connected')
    const timer = window.setInterval(() => onNewItem?.(createMockHotItem()), 42000)
    return {
      disconnect() {
        window.clearInterval(timer)
        onStatus?.('disconnected')
      },
      subscribe() {},
    }
  }

  const socket = io(SOCKET_URL, { withCredentials: true })
  socket.on('connect', () => {
    onStatus?.('connected')
    socket.emit('dashboard:join', { userId, filters })
  })
  socket.on('disconnect', () => onStatus?.('disconnected'))
  socket.on('connect_error', () => onStatus?.('error'))
  socket.on('hot-item:new', (payload) => onNewItem?.(normalizeHotItem(payload?.hotItem || payload)))
  socket.on('hot-item:update', (payload) => onUpdate?.(normalizeHotItem(payload?.hotItem || payload)))
  socket.on('stats:update', (payload) => onStats?.(normalizeOverview(payload?.overview || payload)))
  socket.on('server:error', (payload) => onError?.(getUserFacingErrorMessage(payload?.message)))
  return {
    disconnect() {
      socket.emit('dashboard:leave', { userId })
      socket.disconnect()
    },
    subscribe(keywords, sources) {
      socket.emit('hot-items:subscribe', { keywords, sources })
    },
  }
}
