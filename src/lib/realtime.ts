import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const chatChangeListeners = new Set<() => void>()

export function onChatChanged(cb: () => void): () => void {
  chatChangeListeners.add(cb)
  return () => { chatChangeListeners.delete(cb) }
}

export function notifyChatChanged(): void {
  chatChangeListeners.forEach((cb) => cb())
}

const presenceListeners = new Set<(users: Set<string>) => void>()
let presenceChannel: ReturnType<typeof supabase.channel> | null = null
let presenceTrackedKey: string | null = null

function broadcastPresence() {
  if (!presenceChannel) return
  const state = presenceChannel.presenceState()
  const users = new Set<string>(Object.keys(state))
  presenceListeners.forEach((cb) => cb(users))
}

export function useOnlineUsers(userId: string | null): Set<string> {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return

    const listener = (users: Set<string>) => setOnlineUsers(new Set(users))
    presenceListeners.add(listener)

    if (!presenceChannel) {
      const channel = supabase.channel('app-presence', {
        config: { presence: { key: userId } },
      })
      channel.on('presence', { event: 'sync' }, broadcastPresence)
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
          presenceTrackedKey = userId
        }
      })
      presenceChannel = channel
    } else if (presenceTrackedKey !== userId) {
      presenceChannel
        .untrack()
        .then(() => presenceChannel?.track({ online_at: new Date().toISOString() }))
        .then(() => { presenceTrackedKey = userId })
    } else {
      presenceChannel.track({ online_at: new Date().toISOString() })
    }

    broadcastPresence()

    return () => {
      presenceListeners.delete(listener)
    }
  }, [userId])

  return onlineUsers
}

type TypingEntry = {
  ch: ReturnType<typeof supabase.channel>
  listeners: Set<(alias: string) => void>
}

const typingChannels = new Map<string, TypingEntry>()

function getTypingChannel(scope: string): TypingEntry {
  let entry = typingChannels.get(scope)
  if (entry) return entry

  const ch = supabase.channel(`typing-${scope}`)
  entry = { ch, listeners: new Set() }
  typingChannels.set(scope, entry)

  ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
    const alias: string | undefined = payload?.alias
    if (!alias) return
    entry!.listeners.forEach((cb) => cb(alias))
  })
  ch.subscribe(() => {})

  return entry
}

export function subscribeTyping(scope: string, onType: (alias: string) => void): () => void {
  const entry = getTypingChannel(scope)
  entry.listeners.add(onType)
  return () => {
    entry.listeners.delete(onType)
  }
}

export function notifyTyping(scope: string, userId: string, alias: string): void {
  const entry = getTypingChannel(scope)
  entry.ch.send({ type: 'broadcast', event: 'typing', payload: { userId, alias, at: Date.now() } })
}

export function useActivityHeartbeat(userId: string | null): void {
  useEffect(() => {
    if (!userId) return

    const ping = () => {
      supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {}, () => {})
    }

    ping()
    const id = setInterval(ping, 60000)
    window.addEventListener('pagehide', ping)

    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', ping)
      ping()
    }
  }, [userId])
}

// --------------------------------------------------------------
// Mensajes "enviando" (pending): se muestran en el historial mientras
// se sube el archivo y hasta que el insert confirma el mensaje real.
// --------------------------------------------------------------

export type PendingMessage = {
  tempId: string
  type: string
  content: string | null
  mediaUrl: string | null
  createdAt: string
}

const pendingByScope = new Map<string, Map<string, PendingMessage>>()
const pendingListeners = new Set<() => void>()

function emitPending() {
  pendingListeners.forEach((cb) => cb())
}

export function addPendingMessage(scope: string, msg: PendingMessage): void {
  let m = pendingByScope.get(scope)
  if (!m) {
    m = new Map()
    pendingByScope.set(scope, m)
  }
  m.set(msg.tempId, msg)
  emitPending()
}

export function removePendingMessage(scope: string, tempId: string): void {
  const m = pendingByScope.get(scope)
  if (m?.delete(tempId)) emitPending()
}

export function usePendingMessages(scope: string): PendingMessage[] {
  const [pending, setPending] = useState<PendingMessage[]>(() => [...(pendingByScope.get(scope)?.values() ?? [])])

  useEffect(() => {
    const cb = () => setPending([...(pendingByScope.get(scope)?.values() ?? [])])
    pendingListeners.add(cb)
    cb()
    return () => { pendingListeners.delete(cb) }
  }, [scope])

  return pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}