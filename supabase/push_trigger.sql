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
  row_json jsonb := to_jsonb(NEW);
BEGIN
  -- Si pg_net no está habilitado, no hacemos nada (el mensaje se guarda igual)
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM pg_net.http_post(
      'https://ahzqmapxpuwyyslbcnks.functions.supabase.co/send-push',
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'id', NEW.id,
        'sender_id', NEW.sender_id,
        'group_id',   row_json->'group_id',
        'conversation_id', row_json->'conversation_id',
        'type', NEW.type,
        'content', NEW.content,
        'media_url', NEW.media_url,
        'delete_after', row_json->'delete_after'
      ),
      jsonb_build_object(
        'content-type', 'application/json',
        'x-push-secret', '5035b8b60e38488e30e635a4754a4eb06c1f6d8a350964723d8432ed4c6e3cd8'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- NUNCA debe bloquear el envío del mensaje
    NULL;
  END;

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