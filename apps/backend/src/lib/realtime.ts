import type { Server, Socket } from 'socket.io'
import { verifyToken } from './jwt'
import { query, queryOne } from './db'

/**
 * Realtime layer for online play (turn-based مارپله). Kept deliberately simple:
 * game state is client-authoritative and relayed between the two players — no
 * competitive stakes, so no server-side simulation. Safety: a socket is
 * authenticated as (parent, child); you can only invite an accepted friend;
 * only canned emoji reactions travel between players (never free text).
 */
interface SData { userId: string; childId: string; name: string; emoji: string }

const online = new Map<string, Set<string>>()          // childId → socketIds
const pending = new Map<string, { fromChildId: string; fromName: string; fromEmoji: string; fromSocketId: string; toChildId: string }>()
const rooms = new Map<string, { players: { childId: string; name: string; emoji: string }[] }>()

const data = (s: Socket) => s.data as SData
const randomId = () => Math.random().toString(36).slice(2, 10)

function addOnline(childId: string, sid: string) {
  if (!online.has(childId)) online.set(childId, new Set())
  online.get(childId)!.add(sid)
}
function removeOnline(childId: string, sid: string) {
  const set = online.get(childId)
  if (!set) return
  set.delete(sid)
  if (set.size === 0) online.delete(childId)
}

async function friendIds(childId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `select c.id from friendships f
       join children c on c.id = case when f.requester_child_id = $1 then f.addressee_child_id else f.requester_child_id end
      where (f.requester_child_id = $1 or f.addressee_child_id = $1) and f.status = 'accepted'`,
    [childId])
  return rows.map((r) => r.id)
}

// Tell this child's online friends to refresh their presence (someone they know
// just came online or went offline).
async function nudgeFriends(io: Server, childId: string) {
  const ids = await friendIds(childId)
  for (const fid of ids) {
    const socks = online.get(fid)
    if (socks) for (const sid of socks) io.to(sid).emit('presence:refresh')
  }
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await queryOne(
    `select 1 from friendships
      where status = 'accepted'
        and ((requester_child_id = $1 and addressee_child_id = $2)
          or (requester_child_id = $2 and addressee_child_id = $1)) limit 1`,
    [a, b])
  return !!row
}

export function setupRealtime(io: Server) {
  io.use(async (socket, next) => {
    try {
      const { token, childId, childName, emoji } = socket.handshake.auth ?? {}
      if (!token || !childId) return next(new Error('unauthorized'))
      const { sub: userId, scope, childId: tokenChildId } = verifyToken(String(token))
      // A kid-login socket is locked to its own child — otherwise one
      // sibling's token could open a realtime session as another.
      if (scope === 'child' && tokenChildId !== String(childId)) return next(new Error('forbidden'))
      const owned = await queryOne<{ name: string }>(
        'select name from children where id = $1 and parent_id = $2', [String(childId), userId])
      if (!owned) return next(new Error('forbidden'))
      socket.data = { userId, childId: String(childId), name: String(childName || owned.name), emoji: String(emoji || '🧒') } as SData
      next()
    } catch { next(new Error('unauthorized')) }
  })

  io.on('connection', (socket) => {
    const d = data(socket)
    addOnline(d.childId, socket.id)
    void nudgeFriends(io, d.childId)

    // Which of my friends are online right now.
    socket.on('presence:friends', async () => {
      const ids = await friendIds(d.childId)
      socket.emit('presence:online', { ids: ids.filter((id) => online.has(id)) })
    })

    // Invite an (accepted) friend to play.
    socket.on('invite', async ({ toChildId }: { toChildId: string }) => {
      if (!toChildId || !(await areFriends(d.childId, toChildId))) return
      const targets = online.get(toChildId)
      if (!targets || targets.size === 0) { socket.emit('invite:offline', { toChildId }); return }
      const roomId = randomId()
      pending.set(roomId, { fromChildId: d.childId, fromName: d.name, fromEmoji: d.emoji, fromSocketId: socket.id, toChildId })
      for (const sid of targets) {
        io.to(sid).emit('invite:incoming', { roomId, fromChildId: d.childId, fromName: d.name, fromEmoji: d.emoji })
      }
    })

    socket.on('invite:accept', ({ roomId }: { roomId: string }) => {
      const inv = pending.get(roomId)
      if (!inv || inv.toChildId !== d.childId) return
      pending.delete(roomId)
      const inviter = io.sockets.sockets.get(inv.fromSocketId)
      if (!inviter) { socket.emit('invite:gone'); return }
      const players = [
        { childId: inv.fromChildId, name: inv.fromName, emoji: inv.fromEmoji },
        { childId: d.childId, name: d.name, emoji: d.emoji },
      ]
      rooms.set(roomId, { players })
      inviter.join(roomId)
      socket.join(roomId)
      io.to(roomId).emit('game:start', { roomId, players, firstTurn: 0 })
    })

    socket.on('invite:decline', ({ roomId }: { roomId: string }) => {
      const inv = pending.get(roomId)
      if (!inv) return
      pending.delete(roomId)
      io.to(inv.fromSocketId).emit('invite:declined', { name: d.name })
    })

    // Turn state relayed to the other player(s).
    socket.on('game:move', ({ roomId, state }: { roomId: string; state: unknown }) => {
      socket.to(roomId).emit('game:state', { state })
    })

    // Canned emoji reaction only — no free text ever.
    socket.on('game:react', ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      socket.to(roomId).emit('game:reaction', { childId: d.childId, emoji: String(emoji).slice(0, 4) })
    })

    socket.on('game:leave', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('game:opponent-left')
      socket.leave(roomId)
      rooms.delete(roomId)
    })

    socket.on('disconnect', () => {
      removeOnline(d.childId, socket.id)
      void nudgeFriends(io, d.childId)
      // Tell any rooms this socket was in that a player dropped.
      for (const roomId of socket.rooms) {
        if (rooms.has(roomId)) socket.to(roomId).emit('game:opponent-left')
      }
    })
  })
}
