-- =============================================================
-- EPHEMERA — Estado de configuración por usuario
-- Guarda, por cada usuario, qué permisos ya concedió (notificaciones,
-- push, ubicación, micrófono, cámara, pantalla) para no volver a
-- pedirlos en cada recarga de la página.
-- =============================================================

CREATE TABLE IF NOT EXISTS user_setup (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_granted boolean DEFAULT false,
  push_ok             boolean DEFAULT false,
  location_ok         boolean DEFAULT false,
  mic_ok              boolean DEFAULT false,
  camera_ok           boolean DEFAULT false,
  screen_ok           boolean DEFAULT false,
  screen_unsupported  boolean DEFAULT false,
  lat                 double precision,
  lng                 double precision,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_setup_user ON user_setup (user_id);

ALTER TABLE user_setup ENABLE ROW LEVEL SECURITY;

-- La app usa la anon key; se requieren políticas permisivas como en el resto.
DROP POLICY IF EXISTS "anon_all_user_setup" ON user_setup;
CREATE POLICY "anon_all_user_setup" ON user_setup
  FOR ALL USING (true) WITH CHECK (true);
