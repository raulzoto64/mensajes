-- =============================================================
-- EPHEMERA — Rol "super admin"
-- El super admin es el ÚNICO que puede ver las ubicaciones de los
-- usuarios (pestaña 📍 Ubicaciones del panel). Los admins normales
-- no la ven.
-- =============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Designa un super admin (cámbialo por tu alias). Ejecuta esto UNA vez.
-- El super admin también es admin normal, así puede abrir el panel.
-- UPDATE users SET is_admin = true, is_super_admin = true WHERE alias = 'TU_ALIAS';
