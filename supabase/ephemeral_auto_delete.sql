-- =============================================================
-- EPHEMERA — AUTO-BORRADO CON REGISTRO Y MOTIVO
-- Ejecuta este archivo en el SQL Editor (idempotente).
-- Requiere haber ejecutado first deleted_reason.sql (columnas).
--
-- En vez de borrar la fila, marca el mensaje como borrado con el
-- motivo (viewed = visto por todos, 24h = pasó el tiempo).
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION clean_expired_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Grupos: vistos por TODOS los miembros
  UPDATE messages m
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE m.deleted_at IS NULL
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM message_views mv
         WHERE mv.message_id = m.id)
        >= (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = m.group_id);

  -- Grupos: mayores de 24 horas
  UPDATE messages
  SET is_deleted = true, deleted_at = now(), delete_reason = '24h'
  WHERE is_deleted = false AND deleted_at IS NULL
    AND created_at < now() - interval '24 hours';

  -- DMs: vistos por AMBOS participantes
  UPDATE direct_messages dm
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE dm.deleted_at IS NULL
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM direct_message_views mv
         WHERE mv.message_id = dm.id) >= 2;

  -- DMs: mayores de 24 horas
  UPDATE direct_messages
  SET is_deleted = true, deleted_at = now(), delete_reason = '24h'
  WHERE is_deleted = false AND deleted_at IS NULL
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Evita duplicar jobs si ejecutas el archivo más de una vez
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-ephemeral';

-- Programa la limpieza cada hora
SELECT cron.schedule('clean-ephemeral', '0 * * * *', 'SELECT clean_expired_messages()');