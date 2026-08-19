-- =============================================================
-- EPHEMERA — Supabase Schema
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase
-- =============================================================

-- ----------------------------------------------------------------
-- 1. USUARIOS (autenticación propia, sin Supabase Auth)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         text UNIQUE NOT NULL,
  password_hash text NOT NULL,          -- SHA-256 hash del password + salt
  salt          text NOT NULL,          -- salt aleatorio de 16 bytes hex
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_alias ON users (alias);

-- ----------------------------------------------------------------
-- 2. GRUPOS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups (created_by);

-- ----------------------------------------------------------------
-- 3. MIEMBROS DE GRUPOS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  group_id  uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);

-- ----------------------------------------------------------------
-- 4. MENSAJES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  type       text NOT NULL CHECK (type IN ('text', 'audio', 'video', 'gif', 'emoji', 'image')),
  content    text,          -- para mensajes de texto/emoji
  media_url  text,          -- para audio, video, gif, imagen
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,   -- cuándo se marcó como borrado
  delete_reason text,       -- 'manual' | 'viewed' | '24h'
  delete_after timestamptz, -- gracia de 5 min: borrado programado al verlo todos
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_group    ON messages (group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted  ON messages (is_deleted);

-- ----------------------------------------------------------------
-- 5. VISTAS DE MENSAJES (para el sistema efímero)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_views (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_views_msg  ON message_views (message_id);
CREATE INDEX IF NOT EXISTS idx_message_views_user ON message_views (user_id);

-- ----------------------------------------------------------------
-- 6. GIFs PERSONALIZADOS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_gifs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  url        text NOT NULL,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_gifs_user ON custom_gifs (created_by);

-- ----------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- Nota: Esta app usa autenticación propia (no Supabase Auth).
-- Las políticas siguientes permiten acceso total con la anon key.
-- Para producción, evalúa usar la service_role key solo en backend.
-- ----------------------------------------------------------------

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_gifs   ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (anon key puede leer/escribir todo)
-- Cambia esto si decides implementar JWT propio con Supabase Auth.
CREATE POLICY "anon_all_users"          ON users         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_groups"         ON groups        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_group_members"  ON group_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_messages"       ON messages      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_message_views"  ON message_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_custom_gifs"    ON custom_gifs   FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 8. STORAGE BUCKET PARA MEDIOS
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public media read" ON storage.objects;
CREATE POLICY "public media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "anon media upload" ON storage.objects;
CREATE POLICY "anon media upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "anon media delete" ON storage.objects;
CREATE POLICY "anon media delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media');

-- ----------------------------------------------------------------
-- 9. FUNCIÓN AUXILIAR: Limpiar mensajes efímeros viejos (opcional)
-- Puedes programar esta función con pg_cron o un cron externo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_expired_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Marca como eliminados los mensajes vistos por todos los miembros del grupo
  UPDATE messages m
  SET is_deleted = true
  WHERE m.is_deleted = false
    AND (
      SELECT COUNT(DISTINCT mv.user_id)
      FROM message_views mv
      WHERE mv.message_id = m.id
    ) >= (
      SELECT COUNT(*)
      FROM group_members gm
      WHERE gm.group_id = m.group_id
    );
END;
$$;

-- Para programar la limpieza automática cada hora (requiere pg_cron):
-- SELECT cron.schedule('clean-ephemeral', '0 * * * *', 'SELECT clean_expired_messages()');

-- ----------------------------------------------------------------
-- 10. PRIMER ADMIN (ajusta el alias y hash según tu usuario)
-- Crea el usuario normalmente desde la app y luego promuévelo:
-- ----------------------------------------------------------------
-- UPDATE users SET is_admin = true WHERE alias = 'tu_alias_admin';
