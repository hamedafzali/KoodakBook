import { io, type Socket } from 'socket.io-client'
import { getActiveChildId } from './activeChild'
import { getToken } from './auth'
import { API_BASE } from './config'

// Single realtime connection for online play. Authenticates as (parent, child)
// via the JWT + active child in the handshake; the server validates ownership.
let socket: Socket | null = null
// Each call's turn. Two calls overlapping across the await (a screen that
// closes and reopens while the first is still reading its credentials, or
// a dev StrictMode effect replay) used to race: whichever resumed LAST
// disconnected the other's socket, possibly the one a live screen had just
// bound its listeners to. Now only the latest call opens a socket; an
// earlier one gets null (its screen is already gone or retrying).
let generation = 0

export async function connectSocket(childName: string, emoji = '🧒'): Promise<Socket | null> {
  if (socket?.connected) return socket
  const mine = ++generation
  const [token, childId] = await Promise.all([getToken(), getActiveChildId()])
  if (mine !== generation) return null
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
  // Also retires a connect still in flight: it must not open a socket after
  // its screen has closed.
  generation++
  socket?.disconnect()
  socket = null
}
