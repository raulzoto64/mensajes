-- =============================================================
-- EPHEMERA — Última vez conectado
-- Ejecuta este archivo en el SQL Editor (es idempotente)
-- =============================================================

-- Columna que guarda la última actividad del usuario (la app la actualiza
-- con un heartbeat cada ~60s mientras esté abierta y al cerrar sesión).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Índice por si se quiere listar usuarios por último acceso.
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);