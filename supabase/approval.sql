-- =============================================================
-- EPHEMERA — APROBACIÓN DE NUEVOS USUARIOS POR EL ADMIN
-- Ejecuta este archivo en el SQL Editor (idempotente).
--
-- 1) Agrega la columna is_approved a users (default false para
--    nuevos registros).
-- 2) Aprueba a los usuarios que ya existían antes de este cambio
--    (el admin y quienes ya estaban registrados).
-- 3) Publica la tabla users en el realtime para que el admin
--    reciba el aviso en vivo cuando alguien se registre.
-- =============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Los registros existentes se aprueban de una vez (existían antes del flujo)
UPDATE users SET is_approved = true;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    END IF;
  END LOOP;
END $$;