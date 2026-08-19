-- =============================================================
-- EPHEMERA — REAL-TIME COMPLETO (grupos + DMs + users)
-- Ejecuta este archivo en el SQL Editor (idempotente).
--
-- Sin esto, los mensajes, contadores de no leídos y notificaciones
-- NO llegan en vivo: solo aparecen al recargar o abrir el chat.
-- Publia TODAS las tablas necesarias en supabase_realtime.
-- =============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users',
    'groups',
    'group_members',
    'messages',
    'message_views',
    'custom_gifs',
    'direct_conversations',
    'direct_messages',
    'direct_message_views'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    END IF;
  END LOOP;
END $$;