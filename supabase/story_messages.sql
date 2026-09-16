CREATE TABLE IF NOT EXISTS story_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text,
  media_url text,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'emoji', 'audio', 'image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_messages_story ON story_messages(story_id);
CREATE INDEX IF NOT EXISTS idx_story_messages_user ON story_messages(user_id);

ALTER TABLE story_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_story_messages" ON story_messages FOR ALL USING (true) WITH CHECK (true);
