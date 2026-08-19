-- =============================================================
-- EPHEMERA — REAL-TIME PARA GRUPOS (contadores de no leídos)
-- Ejecuta este archivo en el SQL Editor (idempotente).
--
-- Los contadores de la barra lateral se refrescan en vivo cuando
-- llegue un mensaje nuevo o cuando ya viste los existentes.
-- =============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['groups', 'group_members', 'messages', 'message_views']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    END IF;
  END LOOP;
END $$;