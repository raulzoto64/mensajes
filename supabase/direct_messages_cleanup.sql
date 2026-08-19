-- =============================================================
-- EPHEMERA — LIMPIEZA AUTOMÁTICA DE MENSAJES DIRECTOS (24H)
-- Archivo independiente: pégalo en el SQL Editor de Supabase.
-- SOLO afecta a mensajes directos (DMs). Los grupos NO se tocan.
--
-- Comportamiento:
--   1) Los mensajes directos con más de 24 horas se borran.
--   2) Las conversaciones directas sin actividad (mensajes nuevos)
--      en las últimas 24 horas se borran por completo.
-- =============================================================

-- Habilita pg_cron (scheduler) si aún no está activo
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función de limpieza
CREATE OR REPLACE FUNCTION clean_expired_dms()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Borra mensajes directos con más de 24 horas de antigüedad
  DELETE FROM direct_messages
  WHERE created_at < now() - interval '24 hours';

  -- 2) Borra conversaciones que no tuvieron actividad en las últimas 24h
  --    (sin mensajes recientes y con más de 24h desde su creación o su último mensaje)
  DELETE FROM direct_conversations dc
  WHERE NOT EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.conversation_id = dc.id
      AND dm.created_at >= now() - interval '24 hours'
  )
  AND (
    dc.created_at < now() - interval '24 hours'
    OR EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.conversation_id = dc.id)
  );
END;
$$;

-- Evita duplicar el job si ejecutas el archivo más de una vez
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-direct-messages-hourly';

-- Programa la limpieza cada hora
SELECT cron.schedule('clean-direct-messages-hourly', '0 * * * *', 'SELECT clean_expired_dms()');