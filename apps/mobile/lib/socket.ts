import { io, type Socket } from 'socket.io-client'
import { getActiveChildId } from './activeChild'
import { getToken } from './auth'
import { API_BASE } from './config'

// Single realtime connection for online play. Authenticates as (parent, child)
// via the JWT + active child in the handshake; the server validates ownership.
let socket: Socket | null = null

export async function connectSocket(childName: string, emoji = '🧒'): Promise<Socket | null> {
  if (socket?.connected) return socket
  const [token, childId] = await Promise.all([getToken(), getActiveChildId()])
  if (!token || !childId) return null
  socket?.disconnect()
  socket = io(API_BASE, {
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
