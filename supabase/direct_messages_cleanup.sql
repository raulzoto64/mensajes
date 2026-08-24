-- =============================================================
-- EPHEMERA — LIMPIEZA AUTOMÁTICA DE MENSAJES DIRECTOS
-- Archivo independiente: pégalo en el SQL Editor de Supabase.
-- SOLO afecta a mensajes directos (DMs). Los grupos NO se tocan.
--
-- Comportamiento (versión con duración configurable):
--   1) Los mensajes directos más antiguos que la duración configurada
--      de su conversación (auto_delete_hours) se borran.
--   2) NO se borran las conversaciones: permanecen en la barra lateral
--      aunque no tengan mensajes (las vacía el cliente).
-- =============================================================

-- Habilita pg_cron (scheduler) si aún no está activo
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función de limpieza
CREATE OR REPLACE FUNCTION clean_expired_dms()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Borra mensajes directos más antiguos que la duración configurada
  DELETE FROM direct_messages dm
  WHERE dm.created_at < now() - (COALESCE(
          (SELECT c.auto_delete_hours FROM direct_conversations c WHERE c.id = dm.conversation_id), 24
        ) || ' hours')::interval;
END;
$$;

-- Evita duplicar el job si ejecutas el archivo más de una vez
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-direct-messages-hourly';

-- Programa la limpieza cada hora
SELECT cron.schedule('clean-direct-messages-hourly', '0 * * * *', 'SELECT clean_expired_dms()');
