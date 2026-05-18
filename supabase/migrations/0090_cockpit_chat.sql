-- ============================================================
-- Migration 0090 — Persistance conversations ChatKimi (cockpit rail droit)
--
-- Crée cockpit_chats + cockpit_messages avec RLS par user.
-- FK sur public.users(id) (convention projet — cf. 0073, 0087, 0088, etc.).
-- Politiques symétriques select/insert/update/delete (all = 4 policies).
-- Le service_role (lib/platform/db/supabase.ts) contourne le RLS côté API.
--
-- NE PAS appliquer manuellement : lancer `supabase db push` depuis le projet.
-- ============================================================

BEGIN;

-- ── cockpit_chats — une conversation par user ────────────────

CREATE TABLE IF NOT EXISTS public.cockpit_chats (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cockpit_chats_user
  ON public.cockpit_chats(user_id, updated_at DESC);

ALTER TABLE public.cockpit_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cockpit_chats_select_own" ON public.cockpit_chats;
CREATE POLICY "cockpit_chats_select_own"
  ON public.cockpit_chats FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_chats_insert_own" ON public.cockpit_chats;
CREATE POLICY "cockpit_chats_insert_own"
  ON public.cockpit_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_chats_update_own" ON public.cockpit_chats;
CREATE POLICY "cockpit_chats_update_own"
  ON public.cockpit_chats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_chats_delete_own" ON public.cockpit_chats;
CREATE POLICY "cockpit_chats_delete_own"
  ON public.cockpit_chats FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.cockpit_chats IS
  'Conversations ChatKimi (rail droit Cockpit). Une conversation = N messages. RLS : user ne voit que ses propres chats.';

-- ── cockpit_messages — messages d'une conversation ──────────

CREATE TABLE IF NOT EXISTS public.cockpit_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid        NOT NULL REFERENCES public.cockpit_chats(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cockpit_messages_chat
  ON public.cockpit_messages(chat_id, created_at);

ALTER TABLE public.cockpit_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cockpit_messages_select_own" ON public.cockpit_messages;
CREATE POLICY "cockpit_messages_select_own"
  ON public.cockpit_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_messages_insert_own" ON public.cockpit_messages;
CREATE POLICY "cockpit_messages_insert_own"
  ON public.cockpit_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_messages_update_own" ON public.cockpit_messages;
CREATE POLICY "cockpit_messages_update_own"
  ON public.cockpit_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cockpit_messages_delete_own" ON public.cockpit_messages;
CREATE POLICY "cockpit_messages_delete_own"
  ON public.cockpit_messages FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.cockpit_messages IS
  'Messages des conversations ChatKimi. role IN (user, assistant, system). RLS : user ne voit que ses propres messages.';

COMMIT;
