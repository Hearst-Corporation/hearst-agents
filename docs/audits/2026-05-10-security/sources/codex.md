# Audit Codex — Hearst OS Security — 2026-05-10

**Source** : audit externe (modèle GPT-Codex)
**Scope** : security, auth, multi-tenant, tool execution
**Statut** : verbatim, archive

---

## Executive Summary

This codebase is not production-safe yet for hostile multi-user traffic. The dominant risk is not TypeScript correctness, it is authorization and tool-execution trust: several authenticated routes use service-role or privileged backends while trusting client-supplied IDs, tool names, OAuth state, or job/session IDs.

**Validation signal**:
- `npm run typecheck`: passed.
- `npm audit --omit=dev --audit-level=high`: no high/critical prod advisories; moderate advisories in @anthropic-ai/sdk and postcss via next.
- `npm run lint`: failed due visual lint.
- `npm run test`: failed `__tests__/ui/design-tokens.test.ts`.
- `npm run build` will currently fail because prebuild runs lint:visual.

---

## Critical Vulnerabilities

### CV-1. Global agent takeover via /api/agents/*

- **Severity**: Critical
- **Attack scenario**: any authenticated user lists, edits, deletes, chats with, or poisons memory for global agents.
- **Root cause**: auth checks only session presence; no tenant/user/admin authorization; service-role style access.
- **Affected files**: `app/api/agents/route.ts:11`, `app/api/agents/[id]/route.ts:15`, `app/api/agents/[id]/chat/route.ts:44`
- **Production impact**: cross-user data leak, global prompt poisoning, deletion/outage.
- **Exploitability/confidence**: High / High
- **Minimal safe fix**: make all legacy agent routes admin-only immediately.
- **Ideal architectural fix**: tenant-scoped agent records with DB RLS and explicit ownership.

### CV-2. Cross-user conversation and memory poisoning

- **Severity**: Critical
- **Attack scenario**: attacker submits a victim `conversation_id` or `thread_id` to `/api/orchestrate`; prior messages/tool results are loaded into the attacker's run.
- **Root cause**: memory lookup filters by conversation ID only.
- **Affected files**: `app/api/orchestrate/route.ts:82`, `lib/engine/orchestrator/index.ts:199`, `lib/memory/store.ts:147`
- **Production impact**: data exfiltration, context poisoning, unsafe tool confirmation history.
- **Exploitability/confidence**: High / High
- **Minimal safe fix**: verify ownership before every conversation read/write; include user/tenant/workspace in memory filters.
- **Ideal architectural fix**: server-minted conversation records with non-null ownership and RLS.

### CV-3. Tool approval is prompt-level, not enforced

- **Severity**: Critical
- **Attack scenario**: prompt injection causes model to call Gmail, Slack, calendar, Notion, or email tools with commit-like arguments.
- **Root cause**: `_preview:false` or direct tool endpoints can execute side effects without a server-side approval token tied to canonical args.
- **Affected files**: `lib/connectors/composio/to-ai-tools.ts:60`, `lib/tools/native/google.ts:153`, `lib/tools/native/extras-services.ts:70`, `app/api/v2/voice/tool-call/route.ts:63`
- **Production impact**: unauthorized external writes under user OAuth tokens.
- **Exploitability/confidence**: High / High
- **Minimal safe fix**: require a pending approval record with user/run/tool/args hash/nonce before execution.
- **Ideal architectural fix**: split LLM tools into proposal-only tools and deterministic server commit APIs.

### CV-4. Slack OAuth state is forgeable

- **Severity**: Critical
- **Attack scenario**: attacker forges OAuth state containing a victim user ID and plants attacker Slack credentials onto victim account.
- **Root cause**: state is base64 JSON, unsigned, and callback trusts embedded user ID.
- **Affected files**: `app/api/auth/slack/route.ts:64`, `app/api/auth/callback/slack/route.ts:16`
- **Production impact**: account confusion, token planting, cross-account Slack actions.
- **Exploitability/confidence**: Medium-High / High
- **Minimal safe fix**: sign/encrypt state or store nonce plus PKCE verifier server-side.
- **Ideal architectural fix**: centralized OAuth transaction table or NextAuth provider integration.

### CV-5. Inngest fails open when signing key is missing

- **Severity**: Critical
- **Attack scenario**: misconfigured production accepts arbitrary `/api/inngest` POSTs and runs jobs for chosen users/tenants.
- **Root cause**: missing INNGEST_SIGNING_KEY only logs a warning.
- **Affected files**: `app/api/inngest/route.ts:14`, `lib/jobs/inngest/check.ts:18`, `lib/jobs/inngest/functions/daily-brief.ts:37`
- **Production impact**: unauthenticated job execution and provider-cost abuse.
- **Exploitability/confidence**: High when misconfigured / High
- **Minimal safe fix**: hard fail in production without signing key.
- **Ideal architectural fix**: private event ingress plus schema and tenant validation.

### CV-6. Document parsing SSRF

- **Severity**: High
- **Attack scenario**: authenticated user submits `fileUrl` pointing to metadata service, localhost, internal hosts, or a huge file.
- **Root cause**: arbitrary URL fetch with no private-IP guard, timeout, or size cap.
- **Affected files**: `app/api/v2/jobs/document-parse/route.ts:77`, `lib/capabilities/providers/llamaparse.ts:17`
- **Production impact**: SSRF, third-party exfiltration, worker memory exhaustion.
- **Exploitability/confidence**: High / High
- **Minimal safe fix**: only allow app-owned signed storage URLs; block private/link-local hosts; enforce timeout and byte caps.
- **Ideal architectural fix**: parse trusted uploaded blobs only.

### CV-7. Job status and progress cross-user leak

- **Severity**: High
- **Attack scenario**: user guesses or obtains a BullMQ job ID and reads another user's result, storage URL, error, or progress stream.
- **Root cause**: job lookup verifies auth but not job ownership.
- **Affected files**: `app/api/v2/jobs/[jobId]/status/route.ts:46`, `app/api/v2/jobs/[jobId]/progress/route.ts:69`, `lib/jobs/queue.ts:86`
- **Production impact**: data leakage and operational metadata exposure.
- **Exploitability/confidence**: Medium-High / High
- **Minimal safe fix**: verify `job.data.userId/tenantId/workspaceId` before returning state.
- **Ideal architectural fix**: persistent scoped job table with opaque public IDs.

### CV-8. Browserbase session takeover

- **Severity**: High
- **Attack scenario**: any authenticated user with a session ID can inspect, stop, extract from, or take over another browser session.
- **Root cause**: session IDs are not mapped to owners.
- **Affected files**: `app/api/v2/browser/start/route.ts:51`, `app/api/v2/browser/[id]/route.ts:20`, `app/api/v2/browser/[id]/take-over/route.ts:39`
- **Production impact**: live session leakage, credential exposure, task disruption.
- **Exploitability/confidence**: Medium / High
- **Minimal safe fix**: persist `browser_session_id -> user/tenant/workspace` and enforce on every route.
- **Ideal architectural fix**: capability-token broker for browser sessions.

---

## Architectural Weaknesses

- Privileged service paths often rely on route-local checks instead of a central scoped data-access layer.
- IDs from clients are treated as authority: conversation IDs, plan IDs, mission IDs, job IDs, browser session IDs.
- Asset/report scoping is fail-open when provenance is missing. Evidence: `lib/assets/types.ts:195`, `app/api/reports/share/route.ts:75`
- Admin routes are inconsistent: some use `requireScope` instead of `requireAdmin`. Evidence: `app/api/admin/events-stream/route.ts:9`, `app/api/admin/agent-lock/route.ts:15`
- Tool execution lacks a unified policy engine for side effects, approvals, budgets, and egress.

---

## Scalability Bottlenecks

- Asset lookup and search filter scope in application code after global queries; this will both leak edge cases and miss valid rows at scale.
- Embedding fallback can pull thousands of rows and compute cosine similarity in JS.
- SSE streams and in-memory event buses are per-instance and expensive under many clients.
- BullMQ workers are disabled on Vercel paths; image/audio/video/code/document jobs can enqueue without reliable workers.
- LlamaParse polling duration can exceed worker/job lock assumptions, creating duplicate retries and provider cost.

---

## Reliability Risks

- Structured model/tool history persistence is fire-and-forget in memory storage, so serverless teardown can lose confirmation context.
- Plan approval appears to approve before ownership checks in one path and double-approve in the resume path.
- Visual lint and design-token tests currently block production build confidence.
- In-memory rate limiting will not hold across serverless instances.
- Webhook and background job retries need stronger idempotency keys and dead-letter visibility.

---

## Security Risks

- Unsafe raw HTML is rendered in KPI captions. Evidence: `lib/reports/blocks/KpiTile.tsx:99`
- Search leaks unscoped run metadata. Evidence: `app/api/v2/search/route.ts:248`
- Webhook delivery validates HTTPS but not private IPs/DNS rebinding.
- Proxy auth checks cookie presence; most routes do deeper auth, but any route relying only on proxy would be bypassable.
- Direct code execution route bypasses the stronger native tool safety checks and needs quotas/egress policy.

---

## AI-Agent-Specific Risks

- Browser agent treats page HTML as model context without a strong untrusted-content boundary, while also allowing navigation/click/fill actions. Evidence: `lib/browser/agent-loop.ts:224`
- Tool outputs and page contents can poison future turns because conversation memory is loaded by ID alone.
- Write tools are callable by the model unless server approval is cryptographically tied to exact arguments.
- Token explosion risk exists in browser/page extraction, memory replay, and search aggregation paths without hard per-source budgets.
- Compromised agents can abuse external connectors because side-effect authorization is distributed and inconsistent.

---

## Quick Wins

- Make `/api/agents/*`, `/api/admin/*`, and legacy mutation routes admin-only unless explicitly user-scoped.
- Add ownership checks to conversation, job, browser session, asset, mission, plan, and run search access.
- Fail production boot or route handling when INNGEST_SIGNING_KEY is missing.
- Replace Slack OAuth state with signed/server-stored state.
- Block arbitrary document parse URLs; require app-owned uploads.
- Remove or sanitize captionHtml.
- Fix visual lint and the failing design-token test so builds reflect deployability.

---

## Long-Term Refactors

- Introduce a single scoped repository layer: every query takes `{ userId, tenantId, workspaceId }` and fails closed.
- Move all private resource ownership into first-class non-null DB columns with indexes and RLS.
- Build a central tool execution broker with approval records, budgets, egress policy, audit logs, and idempotency.
- Replace client-supplied resource IDs with server-minted opaque capability IDs where possible.
- Split browser/code/document execution into isolated brokers with allowlisted egress and per-tenant quotas.

---

## Priority Roadmap

- **P0**: lock down `/api/agents/*`, conversation memory ownership, write-tool approval, Slack OAuth state, Inngest signing, document SSRF.
- **P1**: fix job/browser session ownership, admin route authorization, asset/report fail-open scoping, search run leakage, mission/plan approval scoping.
- **P2**: sanitize report HTML, harden webhook egress, centralize code-exec safety, add durable distributed rate limits.
- **P3**: redesign scoped data access, tool broker, background job ownership table, and agent/browser policy engine.
- **P4**: clean CI/build blockers, dependency moderates, and performance hot paths once the security boundary is closed.
