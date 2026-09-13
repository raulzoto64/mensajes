-- Agregar columna phone a la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
