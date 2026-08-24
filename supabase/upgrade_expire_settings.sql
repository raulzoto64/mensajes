-- =============================================================
-- EPHEMERA — MEJORA DE BORRADO CONFIGURABLE + VISTA ÚNICA
-- Archivo de migración (idempotente). Pégalo y ejecútalo en el
-- SQL Editor de Supabase UNA SOLA VEZ (y después de schema.sql +
-- direct_messages.sql + ephemeral_auto_delete.sql).
--
-- Qué hace:
--   1) Agrega auto_delete_hours a groups y direct_conversations
--      (duración de borrado automático: 24h / 48h / 1 sem / 15d / 1 mes).
--   2) Agrega one_time_view a messages y direct_messages
--      (multimedia de "vista única": se ve y se borra).
-- =============================================================

-- 1) Columnas nuevas (no rompe instalaciones existentes)
ALTER TABLE groups              ADD COLUMN IF NOT EXISTS auto_delete_hours integer NOT NULL DEFAULT 24;
ALTER TABLE direct_conversations ADD COLUMN IF NOT EXISTS auto_delete_hours integer NOT NULL DEFAULT 24;
ALTER TABLE messages           ADD COLUMN IF NOT EXISTS one_time_view boolean NOT NULL DEFAULT false;
ALTER TABLE direct_messages    ADD COLUMN IF NOT EXISTS one_time_view boolean NOT NULL DEFAULT false;

-- 2) Función de limpieza de grupos: respeta la duración configurada
--    y borra la multimedia de "vista única" cuando todos la vieron.
CREATE OR REPLACE FUNCTION clean_expired_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Grupos: multimedia de vista única ya vista por TODOS los miembros
  UPDATE messages m
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE m.deleted_at IS NULL
    AND m.one_time_view = true
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM message_views mv
         WHERE mv.message_id = m.id)
       >= (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = m.group_id);

  -- Grupos: mensajes más antiguos que la duración configurada del grupo
  UPDATE messages m
  SET is_deleted = true, deleted_at = now(), delete_reason = 'expired'
  WHERE m.is_deleted = false AND m.deleted_at IS NULL
    AND m.created_at < now() - (COALESCE(
        (SELECT g.auto_delete_hours FROM groups g WHERE g.id = m.group_id), 24
      ) || ' hours')::interval;

  -- DMs: multimedia de vista única ya vista por AMBOS participantes
  UPDATE direct_messages dm
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE dm.deleted_at IS NULL
    AND dm.one_time_view = true
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM direct_message_views mv
         WHERE mv.message_id = dm.id) >= 2;

  -- DMs: mensajes más antiguos que la duración configurada de la conversación
  UPDATE direct_messages dm
  SET is_deleted = true, deleted_at = now(), delete_reason = 'expired'
  WHERE dm.is_deleted = false AND dm.deleted_at IS NULL
    AND dm.created_at < now() - (COALESCE(
        (SELECT c.auto_delete_hours FROM direct_conversations c WHERE c.id = dm.conversation_id), 24
      ) || ' hours')::interval;
END;
$$;

-- Reprograma el job cada hora (idempotente)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-ephemeral';
SELECT cron.schedule('clean-ephemeral', '0 * * * *', 'SELECT clean_expired_messages()');
