-- =============================================================
-- EPHEMERA — GRACIA DE 5 MINUTOS ANTES DE BORRAR AL VERLO
-- Ejecuta este archivo en el SQL Editor (idempotente).
--
-- Añade delete_after: cuando todos ven un mensaje se programa su
-- borrado 5 minutos después, en lugar de borrarlo al instante.
-- Requiere haber creado deleted_at/delete_reason (deleted_reason.sql).
-- =============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delete_after timestamptz;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS delete_after timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_delete_after ON messages (delete_after);
CREATE INDEX IF NOT EXISTS idx_direct_messages_delete_after ON direct_messages (delete_after);

-- Ajusta la función de limpieza: programa la gracia y solo borra tras vencer
CREATE OR REPLACE FUNCTION clean_expired_messages()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Grupos: vistos por TODOS los miembros → programar borrado en 5 min
  UPDATE messages m
  SET delete_after = now() + interval '5 minutes'
  WHERE m.is_deleted = false AND m.delete_after IS NULL
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM message_views mv
         WHERE mv.message_id = m.id)
        >= (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = m.group_id);

  -- Grupos: gracia vencida → marcar como borrado
  UPDATE messages m
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE m.is_deleted = false AND m.delete_after IS NOT NULL AND m.delete_after <= now();

  -- Grupos: mayores de 24 horas
  UPDATE messages
  SET is_deleted = true, deleted_at = now(), delete_reason = '24h'
  WHERE is_deleted = false AND deleted_at IS NULL
    AND created_at < now() - interval '24 hours';

  -- DMs: vistos por AMBOS participantes → programar borrado en 5 min
  UPDATE direct_messages dm
  SET delete_after = now() + interval '5 minutes'
  WHERE dm.is_deleted = false AND dm.delete_after IS NULL
    AND (SELECT COUNT(DISTINCT mv.user_id)
         FROM direct_message_views mv
         WHERE mv.message_id = dm.id) >= 2;

  -- DMs: gracia vencida → marcar como borrado
  UPDATE direct_messages dm
  SET is_deleted = true, deleted_at = now(), delete_reason = 'viewed'
  WHERE dm.is_deleted = false AND dm.delete_after IS NOT NULL AND dm.delete_after <= now();

  -- DMs: mayores de 24 horas
  UPDATE direct_messages
  SET is_deleted = true, deleted_at = now(), delete_reason = '24h'
  WHERE is_deleted = false AND deleted_at IS NULL
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Re-sincroniza el job (idempotente)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-ephemeral';
SELECT cron.schedule('clean-ephemeral', '0 * * * *', 'SELECT clean_expired_messages()');