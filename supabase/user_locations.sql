-- =============================================================
-- EPHEMERA — Ubicaciones en tiempo real
-- Guarda los pings de ubicación de cada usuario mientras usa la app.
-- La app solo inserta cuando la posición CAMBIA (ver liveLocation.ts):
-- si el usuario se queda en el mismo sitio, no se vuelve a insertar.
-- =============================================================

CREATE TABLE IF NOT EXISTS user_locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  accuracy   double precision,
  is_initial boolean DEFAULT false,
  place_type text,
  address    text,
  manzana    text,
  lote       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_created ON user_locations (created_at DESC);

-- Si la tabla ya existía, añade las columnas nuevas (idempotente).
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS is_initial boolean DEFAULT false;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS place_type text;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS manzana text;
ALTER TABLE user_locations ADD COLUMN IF NOT EXISTS lote text;

ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- La app usa la anon key; se requieren políticas permisivas como en el resto.
DROP POLICY IF EXISTS "anon_all_user_locations" ON user_locations;
CREATE POLICY "anon_all_user_locations" ON user_locations
  FOR ALL USING (true) WITH CHECK (true);
