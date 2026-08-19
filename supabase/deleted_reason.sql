-- =============================================================
-- EPHEMERA — REGISTRO DE BORRADOS CON MOTIVO
-- Ejecuta este archivo en el SQL Editor (es idempotente)
--
-- En lugar de borrar el mensaje, se marca como borrado y se
-- guarda el motivo:
--   delete_reason = 'manual'  → alguien lo eliminó manualmente
--   delete_reason = 'viewed'  → lo vieron todos los participantes
--   delete_reason = '24h'     → pasaron 24 horas
-- =============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delete_reason text;

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages (deleted_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_deleted_at ON direct_messages (deleted_at);