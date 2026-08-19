import { supabase } from './supabase'
import { generateSalt, hashPassword, verifyPassword } from './crypto'

export type SessionUser = {
  id: string
  alias: string
  is_admin: boolean
  is_approved: boolean
}

const SESSION_KEY = 'ephemera_session'

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

export function saveSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export async function register(
  alias: string,
  password: string,
): Promise<{ user: SessionUser | null; error: string | null; pending: boolean }> {
  const trimmed = alias.trim().toLowerCase()

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('alias', trimmed)
    .maybeSingle()

  if (existing) return { user: null, error: 'Este alias ya está en uso.', pending: false }

  const salt = generateSalt()
  const password_hash = await hashPassword(password, salt)

  const { error } = await supabase
    .from('users')
    .insert({ alias: trimmed, password_hash, salt, is_admin: false, is_approved: false })

  if (error) return { user: null, error: error.message, pending: false }

  // No se inicia sesión: el admin debe aprobar el ingreso primero
  return { user: null, error: null, pending: true }
}

export async function login(
  alias: string,
  password: string,
): Promise<{ user: SessionUser | null; error: string | null; pending: boolean }> {
  const trimmed = alias.trim().toLowerCase()

  const { data, error } = await supabase
    .from('users')
    .select('id, alias, password_hash, salt, is_admin, is_approved')
    .eq('alias', trimmed)
    .maybeSingle()

  if (error || !data) return { user: null, error: 'Alias o contraseña incorrectos.', pending: false }

  const valid = await verifyPassword(password, data.salt, data.password_hash)
  if (!valid) return { user: null, error: 'Alias o contraseña incorrectos.', pending: false }

  if (!data.is_approved) {
    return { user: null, error: 'Ya estás registrado, pídele al administrador que te apruebe el ingreso.', pending: true }
  }

  const user: SessionUser = { id: data.id, alias: data.alias, is_admin: data.is_admin, is_approved: data.is_approved }
  saveSession(user)
  return { user, error: null, pending: false }
}

export function logout(): void {
  clearSession()
}
