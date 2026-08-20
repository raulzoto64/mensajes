-- =============================================================
-- EPHEMERA — Tabla de suscripciones de Web Push
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase
-- =============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  browser    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- La app usa la anon key; se requieren políticas permisivas
-- como en el resto de las tablas.
CREATE POLICY "anon_all_push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);