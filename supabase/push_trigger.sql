-- =============================================================
-- EPHEMERA — Trigger de Web Push (envía el aviso a la Edge Function)
--
-- Ejecuta este archivo en el SQL Editor DESPUÉS de:
--   1. Crear la Edge Function `send-push` en el dashboard de Supabase
--   2. Agregar los secrets PUSH_SECRET, VAPID_PRIVATE_KEY y VAPID_PUBLIC_KEY
--      en Settings → Edge Functions → Secrets (valores abajo)
--
-- Requiere la extensión pg_net (Database → Extensions → habilitar).
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  url text := 'https://ahzqmapxpuwyyslbcnks.functions.supabase.co/send-push';
  secret text := '5035b8b60e38488e30e635a4754a4eb06c1f6d8a350964723d8432ed4c6e3cd8';
BEGIN
  PERFORM pg_net.http_post(
    url,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'id', NEW.id,
      'sender_id', NEW.sender_id,
      'group_id', COALESCE(NEW.group_id, NULL),
      'conversation_id', COALESCE(NEW.conversation_id, NULL),
      'type', NEW.type,
      'content', NEW.content,
      'media_url', NEW.media_url,
      'delete_after', COALESCE(NEW.delete_after, NULL)
    ),
    jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', secret
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push_group ON messages;
CREATE TRIGGER trg_notify_push_group
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_send_push();

DROP TRIGGER IF EXISTS trg_notify_push_dm ON direct_messages;
CREATE TRIGGER trg_notify_push_dm
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_send_push();