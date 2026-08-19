-- =============================================================
-- EPHEMERA — CREAR BUCKET DE STORAGE 'media'
-- Ejecuta este archivo en el SQL Editor (es idempotente)
-- Necesario para audio, video, imágenes y GIFs personalizados.
-- =============================================================

-- Crea el bucket público si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (ver los medios)
DROP POLICY IF EXISTS "public media read" ON storage.objects;
CREATE POLICY "public media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Subida con la anon key (la app sube los archivos)
DROP POLICY IF EXISTS "anon media upload" ON storage.objects;
CREATE POLICY "anon media upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media');

-- Borrado con la anon key (limpieza efímera)
DROP POLICY IF EXISTS "anon media delete" ON storage.objects;
CREATE POLICY "anon media delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media');