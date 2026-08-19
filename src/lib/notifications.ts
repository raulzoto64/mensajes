import { useEffect, useState } from 'react'

export type NotificationItem = {
  id: string
  type: 'dm' | 'group'
  title: string
  body: string
  conversationId?: string
  otherUserId?: string
  otherAlias?: string
  groupId?: string
  groupName?: string
  at: number
  read: boolean
}

const listeners = new Set<() => void>()
let items: NotificationItem[] = []

function emit() {
  listeners.forEach((cb) => cb())
}

export function addNotification(n: Omit<NotificationItem, 'id' | 'at' | 'read'>) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  items = [{ ...n, id, at: Date.now(), read: false }, ...items].slice(0, 30)
  emit()
}

export function markNotificationRead(id: string) {
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n))
  emit()
}

export function markAllNotificationsRead() {
  items = items.map((n) => ({ ...n, read: true }))
  emit()
}

export function useNotifications(): NotificationItem[] {
  const [list, setList] = useState<NotificationItem[]>(() => [...items])
  useEffect(() => {
    const cb = () => setList([...items])
    listeners.add(cb)
    cb()
    return () => { listeners.delete(cb) }
  }, [])
  return list
}