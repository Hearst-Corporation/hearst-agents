-- Migration 0073 — F-005 : browser_sessions ownership table
-- Crée la table de tracking des sessions Browserbase pour isoler par user.

BEGIN;

CREATE TABLE IF NOT EXISTS public.browser_sessions (
  session_id   text        PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_user   ON public.browser_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_tenant ON public.browser_sessions(tenant_id);

ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

-- service_role : accès complet
CREATE POLICY "browser_sessions_service_role_all" ON public.browser_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated : accès uniquement à ses propres sessions
CREATE POLICY "browser_sessions_self_all" ON public.browser_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
