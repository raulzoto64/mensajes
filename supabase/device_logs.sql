-- =============================================================
-- EPHEMERA — Registro de accesos (diagnóstico de notificaciones)
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase.
-- Guarda, por cada carga de la página de diagnóstico, desde qué
-- dispositivo/navegador entró el usuario y el estado de su push.
-- =============================================================

CREATE TABLE IF NOT EXISTS device_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_type    text,
  browser        text,
  os             text,
  ua             text,
  push_permission text,
  sw_registered  boolean DEFAULT false,
  has_sub_local  boolean DEFAULT false,
  has_sub_db     boolean DEFAULT false,
  mic_permission boolean DEFAULT false,
  cam_permission boolean DEFAULT false,
  screen_permission boolean DEFAULT false,
  online         boolean DEFAULT true,
  lat            double precision,
  lng            double precision,
  ip             text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_logs_user ON device_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_created ON device_logs (created_at DESC);

-- Si la tabla ya existía, añade las columnas nuevas (idempotente).
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS mic_permission boolean DEFAULT false;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS cam_permission boolean DEFAULT false;
ALTER TABLE device_logs ADD COLUMN IF NOT EXISTS screen_permission boolean DEFAULT false;

ALTER TABLE device_logs ENABLE ROW LEVEL SECURITY;

-- La app usa la anon key; se requieren políticas permisivas como en el resto.
DROP POLICY IF EXISTS "anon_all_device_logs" ON device_logs;
CREATE POLICY "anon_all_device_logs" ON device_logs
  FOR ALL USING (true) WITH CHECK (true);
