-- =============================================================
-- EPHEMERA — MENSAJES DIRECTOS (DMs)
-- Archivo independiente: pégalo VACÍO en el SQL Editor de Supabase.
-- Solo contiene lo necesario para habil privados (no repite el schema.sql).
-- =============================================================

-- Constraint + índice para identificación estable de conversaciones
-- (user_a < user_b se garantiza al insertar desde la app).

-- Conversaciones directas (una por par de usuarios)
CREATE TABLE IF NOT EXISTS direct_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  auto_delete_hours integer NOT NULL DEFAULT 24,
  UNIQUE (user_a, user_b),
  CHECK (user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_a ON direct_conversations (user_a);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_user_b ON direct_conversations (user_b);

-- Mensajes directos
CREATE TABLE IF NOT EXISTS direct_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('text', 'audio', 'video', 'gif', 'emoji', 'image')),
  content         text,
  media_url       text,
  is_deleted      boolean NOT NULL DEFAULT false,
  deleted_at      timestamptz,
  delete_reason   text,
  delete_after    timestamptz,
  one_time_view   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_deleted ON direct_messages (is_deleted);

-- Vistas de mensajes directos (sistema efímero)
CREATE TABLE IF NOT EXISTS direct_message_views (
  message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_views_msg ON direct_message_views (message_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_views_user ON direct_message_views (user_id);

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (mismas políticas permisivas con la anon key)
-- ----------------------------------------------------------------
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_direct_conversations" ON direct_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_direct_messages"      ON direct_messages      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_direct_message_views" ON direct_message_views FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- REAL-TIME: agrega las tablas de DMs a la publicación de realtime
-- para que los mensajes lleguen en vivo al otro usuario sin recargar.
-- ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE direct_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_message_views;