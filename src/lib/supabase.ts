import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Only create the client when credentials are present — createClient throws on empty strings
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : (null as unknown as ReturnType<typeof createClient>)

export type Database = {
  users: {
    Row: {
      id: string
      alias: string
      password_hash: string
      salt: string
      is_admin: boolean
      created_at: string
      last_seen_at: string | null
    }
  }
  groups: {
    Row: {
      id: string
      name: string
      description: string | null
      created_by: string
      created_at: string
    }
  }
  group_members: {
    Row: {
      group_id: string
      user_id: string
      joined_at: string
    }
  }
  messages: {
    Row: {
      id: string
      group_id: string
      sender_id: string
      type: 'text' | 'audio' | 'video' | 'gif' | 'emoji' | 'image'
      content: string | null
      media_url: string | null
      is_deleted: boolean
      created_at: string
      deleted_at: string | null
      delete_reason: string | null
      sender_alias?: string
    }
  }
  message_views: {
    Row: {
      message_id: string
      user_id: string
      viewed_at: string
    }
  }
  custom_gifs: {
    Row: {
      id: string
      created_by: string
      url: string
      name: string | null
      created_at: string
    }
  }
  direct_conversations: {
    Row: {
      id: string
      user_a: string
      user_b: string
      created_at: string
    }
  }
  direct_messages: {
    Row: {
      id: string
      conversation_id: string
      sender_id: string
      type: 'text' | 'audio' | 'video' | 'gif' | 'emoji' | 'image'
      content: string | null
      media_url: string | null
      is_deleted: boolean
      created_at: string
      deleted_at: string | null
      delete_reason: string | null
    }
  }
  direct_message_views: {
    Row: {
      message_id: string
      user_id: string
      viewed_at: string
    }
  }
}
