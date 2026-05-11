-- Migration 0074 — Ownership columns sur public.agents
-- Ajoute tenant_id + owner_user_id pour l'isolation multi-tenant (F-002, F-094).
-- À appliquer AVANT 0072 (qui référence agents.owner_user_id dans son backfill).

BEGIN;

-- 1. Ajouter les colonnes (nullable d'abord pour le backfill)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.users(id)   ON DELETE CASCADE;

-- 2. Index pour les lookups par tenant
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON public.agents(tenant_id);

COMMIT;
