import { io, type Socket } from 'socket.io-client'
import { getActiveChildId } from './activeChild'
import { getToken } from './auth'

/* Realtime connection for online مارپله. Same handshake shape as mobile's
 * lib/socket.ts (JWT + active child, server validates ownership) — but
 * connects same-origin with no explicit URL, instead of mobile's API_BASE.
 * There's no public route straight to the backend on web (only this app's
 * own container is tunneled), so the connection lands on this origin's
 * `/socket.io` path and a small proxy in front of Next (proxy-server.js)
 * forwards it to the backend internally, WS upgrade included. */
let socket: Socket | null = null

export function connectSocket(childName: string, emoji = '🧒'): Socket | null {
  if (socket?.connected) return socket
  const token = getToken()
  const childId = getActiveChildId()
  if (!token || !childId) return null
  socket?.disconnect()
  socket = io({
    transports: ['websocket'],
    auth: { token, childId, childName, emoji },
    forceNew: true,
    reconnection: true,
  })
  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
