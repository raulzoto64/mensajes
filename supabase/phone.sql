-- Migraciones: phone, avatar, stories, settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Stories: thumbnail for video stories
ALTER TABLE stories ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Stories RLS: allow delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_stories' AND tablename = 'stories') THEN
    CREATE POLICY "anon_delete_stories" ON stories FOR DELETE USING (true);
  END IF;
END $$;
