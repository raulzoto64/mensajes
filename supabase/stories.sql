-- =============================================================
-- EPHEMERA — Stories Tables
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase
-- =============================================================

-- Tabla de historias (stories)
CREATE TABLE IF NOT EXISTS stories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_url  text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  caption    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL  -- 24 horas después de created_at
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories (expires_at);

-- Tabla de vistas de historias
CREATE TABLE IF NOT EXISTS story_views (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views (user_id);

-- Tabla de logs de llamadas
CREATE TABLE IF NOT EXISTS call_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id  uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  group_id   uuid REFERENCES groups(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  duration   integer,  -- segundos
  type       text NOT NULL DEFAULT 'audio' CHECK (type IN ('audio', 'video'))
);

CREATE INDEX IF NOT EXISTS idx_call_logs_group ON call_logs (group_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs (started_at DESC);

-- Habilitar RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para stories (lectura pública, inserción autenticada)
CREATE POLICY "anon_all_stories"       ON stories      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_story_views"   ON story_views   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_call_logs"     ON call_logs     FOR ALL USING (true) WITH CHECK (true);
