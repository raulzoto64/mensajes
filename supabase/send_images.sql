-- =============================================================
-- EPHEMERA — ENVIAR IMÁGENES Y VIDEOS
-- Ejecuta este archivo en el SQL Editor (es idempotente)
-- Solo agrega el tipo 'image' al CHECK de mensajes; no toca RLS.
-- =============================================================

-- Mensajes de grupo
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'audio', 'video', 'gif', 'emoji', 'image'));

-- Mensajes directos
ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_type_check;
ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_type_check
  CHECK (type IN ('text', 'audio', 'video', 'gif', 'emoji', 'image'));