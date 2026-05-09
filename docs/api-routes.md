# API Routes — Hearst OS

Auto-généré par `npm run routes:list`. Ne pas éditer à la main.

## Index (153 routes)

| Route | Méthodes | Fichier |
|-------|----------|---------|
| `/api/admin/agent-lock` | GET, POST | [app/api/admin/agent-lock/route.ts](app/api/admin/agent-lock/route.ts) |
| `/api/admin/analytics/tenants` | GET | [app/api/admin/analytics/tenants/route.ts](app/api/admin/analytics/tenants/route.ts) |
| `/api/admin/analytics/usage` | GET | [app/api/admin/analytics/usage/route.ts](app/api/admin/analytics/usage/route.ts) |
| `/api/admin/audit` | GET | [app/api/admin/audit/route.ts](app/api/admin/audit/route.ts) |
| `/api/admin/events-stream` | GET | [app/api/admin/events-stream/route.ts](app/api/admin/events-stream/route.ts) |
| `/api/admin/features-manifest` | POST | [app/api/admin/features-manifest/route.ts](app/api/admin/features-manifest/route.ts) |
| `/api/admin/health` | GET | [app/api/admin/health/route.ts](app/api/admin/health/route.ts) |
| `/api/admin/llm-metrics` | GET | [app/api/admin/llm-metrics/route.ts](app/api/admin/llm-metrics/route.ts) |
| `/api/admin/metrics/live` | GET | [app/api/admin/metrics/live/route.ts](app/api/admin/metrics/live/route.ts) |
| `/api/admin/runs/:runId/events` | GET | [app/api/admin/runs/[runId]/events/route.ts](app/api/admin/runs/[runId]/events/route.ts) |
| `/api/admin/runs/recent` | GET | [app/api/admin/runs/recent/route.ts](app/api/admin/runs/recent/route.ts) |
| `/api/admin/seed/:resource` | POST | [app/api/admin/seed/[resource]/route.ts](app/api/admin/seed/[resource]/route.ts) |
| `/api/admin/settings` | GET, POST | [app/api/admin/settings/route.ts](app/api/admin/settings/route.ts) |
| `/api/admin/webhooks-status` | GET | [app/api/admin/webhooks-status/route.ts](app/api/admin/webhooks-status/route.ts) |
| `/api/agents` | GET, POST | [app/api/agents/route.ts](app/api/agents/route.ts) |
| `/api/agents/:id` | GET, PUT, DELETE | [app/api/agents/[id]/route.ts](app/api/agents/[id]/route.ts) |
| `/api/agents/:id/chat` | POST | [app/api/agents/[id]/chat/route.ts](app/api/agents/[id]/chat/route.ts) |
| `/api/agents/:id/memory` | GET, POST | [app/api/agents/[id]/memory/route.ts](app/api/agents/[id]/memory/route.ts) |
| `/api/agents/:id/memory/govern` | POST | [app/api/agents/[id]/memory/govern/route.ts](app/api/agents/[id]/memory/govern/route.ts) |
| `/api/analytics` | POST | [app/api/analytics/route.ts](app/api/analytics/route.ts) |
| `/api/auth/:nextauth*` | — | [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts) |
| `/api/auth/callback/slack` | GET | [app/api/auth/callback/slack/route.ts](app/api/auth/callback/slack/route.ts) |
| `/api/auth/dev-login` | GET | [app/api/auth/dev-login/route.ts](app/api/auth/dev-login/route.ts) |
| `/api/auth/slack` | GET | [app/api/auth/slack/route.ts](app/api/auth/slack/route.ts) |
| `/api/briefing` | GET, POST | [app/api/briefing/route.ts](app/api/briefing/route.ts) |
| `/api/composio/app-actions` | GET | [app/api/composio/app-actions/route.ts](app/api/composio/app-actions/route.ts) |
| `/api/composio/apps` | GET | [app/api/composio/apps/route.ts](app/api/composio/apps/route.ts) |
| `/api/composio/connect` | POST | [app/api/composio/connect/route.ts](app/api/composio/connect/route.ts) |
| `/api/composio/connections` | GET | [app/api/composio/connections/route.ts](app/api/composio/connections/route.ts) |
| `/api/composio/connections/:id` | DELETE | [app/api/composio/connections/[id]/route.ts](app/api/composio/connections/[id]/route.ts) |
| `/api/composio/diagnose` | GET | [app/api/composio/diagnose/route.ts](app/api/composio/diagnose/route.ts) |
| `/api/composio/invalidate-cache` | POST | [app/api/composio/invalidate-cache/route.ts](app/api/composio/invalidate-cache/route.ts) |
| `/api/connections/expiring` | GET | [app/api/connections/expiring/route.ts](app/api/connections/expiring/route.ts) |
| `/api/connections/native` | GET | [app/api/connections/native/route.ts](app/api/connections/native/route.ts) |
| `/api/datasets` | GET, POST | [app/api/datasets/route.ts](app/api/datasets/route.ts) |
| `/api/datasets/:id/entries` | GET, POST | [app/api/datasets/[id]/entries/route.ts](app/api/datasets/[id]/entries/route.ts) |
| `/api/datasets/:id/evaluate` | POST | [app/api/datasets/[id]/evaluate/route.ts](app/api/datasets/[id]/evaluate/route.ts) |
| `/api/health` | GET | [app/api/health/route.ts](app/api/health/route.ts) |
| `/api/inngest` | — | [app/api/inngest/route.ts](app/api/inngest/route.ts) |
| `/api/integrations` | GET, POST | [app/api/integrations/route.ts](app/api/integrations/route.ts) |
| `/api/integrations/:id/execute` | POST | [app/api/integrations/[id]/execute/route.ts](app/api/integrations/[id]/execute/route.ts) |
| `/api/integrations/:id/health` | POST | [app/api/integrations/[id]/health/route.ts](app/api/integrations/[id]/health/route.ts) |
| `/api/memory-policies` | GET, POST | [app/api/memory-policies/route.ts](app/api/memory-policies/route.ts) |
| `/api/model-profiles` | GET, POST | [app/api/model-profiles/route.ts](app/api/model-profiles/route.ts) |
| `/api/notifications` | GET | [app/api/notifications/route.ts](app/api/notifications/route.ts) |
| `/api/notifications/read` | POST | [app/api/notifications/read/route.ts](app/api/notifications/read/route.ts) |
| `/api/notifications/read-all` | POST | [app/api/notifications/read-all/route.ts](app/api/notifications/read-all/route.ts) |
| `/api/onboarding/set-industry` | POST | [app/api/onboarding/set-industry/route.ts](app/api/onboarding/set-industry/route.ts) |
| `/api/orchestrate` | POST | [app/api/orchestrate/route.ts](app/api/orchestrate/route.ts) |
| `/api/orchestrate/abort/:runId` | POST | [app/api/orchestrate/abort/[runId]/route.ts](app/api/orchestrate/abort/[runId]/route.ts) |
| `/api/prompts` | GET, POST | [app/api/prompts/route.ts](app/api/prompts/route.ts) |
| `/api/prompts/:slug` | GET | [app/api/prompts/[slug]/route.ts](app/api/prompts/[slug]/route.ts) |
| `/api/public/reports/:token` | GET | [app/api/public/reports/[token]/route.ts](app/api/public/reports/[token]/route.ts) |
| `/api/realtime/session` | POST | [app/api/realtime/session/route.ts](app/api/realtime/session/route.ts) |
| `/api/reports` | GET | [app/api/reports/route.ts](app/api/reports/route.ts) |
| `/api/reports/:reportId/comments` | GET, POST | [app/api/reports/[reportId]/comments/route.ts](app/api/reports/[reportId]/comments/route.ts) |
| `/api/reports/:reportId/comments/:commentId` | DELETE | [app/api/reports/[reportId]/comments/[commentId]/route.ts](app/api/reports/[reportId]/comments/[commentId]/route.ts) |
| `/api/reports/:reportId/export` | GET | [app/api/reports/[reportId]/export/route.ts](app/api/reports/[reportId]/export/route.ts) |
| `/api/reports/:reportId/rerun` | POST | [app/api/reports/[reportId]/rerun/route.ts](app/api/reports/[reportId]/rerun/route.ts) |
| `/api/reports/:reportId/versions` | GET | [app/api/reports/[reportId]/versions/route.ts](app/api/reports/[reportId]/versions/route.ts) |
| `/api/reports/:reportId/versions/:versionNumber` | GET, POST | [app/api/reports/[reportId]/versions/[versionNumber]/route.ts](app/api/reports/[reportId]/versions/[versionNumber]/route.ts) |
| `/api/reports/:reportId/versions/diff` | GET | [app/api/reports/[reportId]/versions/diff/route.ts](app/api/reports/[reportId]/versions/diff/route.ts) |
| `/api/reports/share` | POST | [app/api/reports/share/route.ts](app/api/reports/share/route.ts) |
| `/api/reports/templates` | GET, POST | [app/api/reports/templates/route.ts](app/api/reports/templates/route.ts) |
| `/api/reports/templates/:templateId` | GET, PUT, DELETE | [app/api/reports/templates/[templateId]/route.ts](app/api/reports/templates/[templateId]/route.ts) |
| `/api/settings/alerting` | GET, PUT | [app/api/settings/alerting/route.ts](app/api/settings/alerting/route.ts) |
| `/api/settings/alerting/test` | POST | [app/api/settings/alerting/test/route.ts](app/api/settings/alerting/test/route.ts) |
| `/api/signals` | GET | [app/api/signals/route.ts](app/api/signals/route.ts) |
| `/api/signals/:id/resolve` | POST | [app/api/signals/[id]/resolve/route.ts](app/api/signals/[id]/resolve/route.ts) |
| `/api/skills` | GET, POST | [app/api/skills/route.ts](app/api/skills/route.ts) |
| `/api/tools` | GET, POST | [app/api/tools/route.ts](app/api/tools/route.ts) |
| `/api/v2/agents/capabilities` | GET | [app/api/v2/agents/capabilities/route.ts](app/api/v2/agents/capabilities/route.ts) |
| `/api/v2/architecture` | GET | [app/api/v2/architecture/route.ts](app/api/v2/architecture/route.ts) |
| `/api/v2/assets` | GET, POST | [app/api/v2/assets/route.ts](app/api/v2/assets/route.ts) |
| `/api/v2/assets/:id` | GET, DELETE | [app/api/v2/assets/[id]/route.ts](app/api/v2/assets/[id]/route.ts) |
| `/api/v2/assets/:id/download` | GET | [app/api/v2/assets/[id]/download/route.ts](app/api/v2/assets/[id]/download/route.ts) |
| `/api/v2/assets/:id/variants` | GET, POST | [app/api/v2/assets/[id]/variants/route.ts](app/api/v2/assets/[id]/variants/route.ts) |
| `/api/v2/assets/diff` | POST | [app/api/v2/assets/diff/route.ts](app/api/v2/assets/diff/route.ts) |
| `/api/v2/browser/:id` | GET, DELETE | [app/api/v2/browser/[id]/route.ts](app/api/v2/browser/[id]/route.ts) |
| `/api/v2/browser/:id/capture` | POST | [app/api/v2/browser/[id]/capture/route.ts](app/api/v2/browser/[id]/capture/route.ts) |
| `/api/v2/browser/:id/extract` | POST | [app/api/v2/browser/[id]/extract/route.ts](app/api/v2/browser/[id]/extract/route.ts) |
| `/api/v2/browser/:id/take-over` | POST | [app/api/v2/browser/[id]/take-over/route.ts](app/api/v2/browser/[id]/take-over/route.ts) |
| `/api/v2/browser/start` | POST | [app/api/v2/browser/start/route.ts](app/api/v2/browser/start/route.ts) |
| `/api/v2/catalog` | GET | [app/api/v2/catalog/route.ts](app/api/v2/catalog/route.ts) |
| `/api/v2/cockpit/today` | GET | [app/api/v2/cockpit/today/route.ts](app/api/v2/cockpit/today/route.ts) |
| `/api/v2/daily-brief/generate` | POST | [app/api/v2/daily-brief/generate/route.ts](app/api/v2/daily-brief/generate/route.ts) |
| `/api/v2/daily-brief/history` | GET | [app/api/v2/daily-brief/history/route.ts](app/api/v2/daily-brief/history/route.ts) |
| `/api/v2/daily-brief/today` | GET | [app/api/v2/daily-brief/today/route.ts](app/api/v2/daily-brief/today/route.ts) |
| `/api/v2/documents/upload` | POST | [app/api/v2/documents/upload/route.ts](app/api/v2/documents/upload/route.ts) |
| `/api/v2/jobs/:jobId/status` | GET | [app/api/v2/jobs/[jobId]/status/route.ts](app/api/v2/jobs/[jobId]/status/route.ts) |
| `/api/v2/jobs/audio-gen` | POST | [app/api/v2/jobs/audio-gen/route.ts](app/api/v2/jobs/audio-gen/route.ts) |
| `/api/v2/jobs/code-exec` | POST | [app/api/v2/jobs/code-exec/route.ts](app/api/v2/jobs/code-exec/route.ts) |
| `/api/v2/jobs/document-parse` | POST | [app/api/v2/jobs/document-parse/route.ts](app/api/v2/jobs/document-parse/route.ts) |
| `/api/v2/jobs/image-gen` | POST | [app/api/v2/jobs/image-gen/route.ts](app/api/v2/jobs/image-gen/route.ts) |
| `/api/v2/kg/graph` | GET | [app/api/v2/kg/graph/route.ts](app/api/v2/kg/graph/route.ts) |
| `/api/v2/kg/ingest` | POST | [app/api/v2/kg/ingest/route.ts](app/api/v2/kg/ingest/route.ts) |
| `/api/v2/kg/path` | GET | [app/api/v2/kg/path/route.ts](app/api/v2/kg/path/route.ts) |
| `/api/v2/kg/query` | POST | [app/api/v2/kg/query/route.ts](app/api/v2/kg/query/route.ts) |
| `/api/v2/kg/search` | GET | [app/api/v2/kg/search/route.ts](app/api/v2/kg/search/route.ts) |
| `/api/v2/kg/timeline` | GET | [app/api/v2/kg/timeline/route.ts](app/api/v2/kg/timeline/route.ts) |
| `/api/v2/marketplace/templates` | GET, POST | [app/api/v2/marketplace/templates/route.ts](app/api/v2/marketplace/templates/route.ts) |
| `/api/v2/marketplace/templates/:id` | GET, DELETE | [app/api/v2/marketplace/templates/[id]/route.ts](app/api/v2/marketplace/templates/[id]/route.ts) |
| `/api/v2/marketplace/templates/:id/clone` | POST | [app/api/v2/marketplace/templates/[id]/clone/route.ts](app/api/v2/marketplace/templates/[id]/clone/route.ts) |
| `/api/v2/marketplace/templates/:id/rate` | POST | [app/api/v2/marketplace/templates/[id]/rate/route.ts](app/api/v2/marketplace/templates/[id]/rate/route.ts) |
| `/api/v2/marketplace/templates/:id/report` | POST | [app/api/v2/marketplace/templates/[id]/report/route.ts](app/api/v2/marketplace/templates/[id]/report/route.ts) |
| `/api/v2/meetings/:id` | GET, DELETE | [app/api/v2/meetings/[id]/route.ts](app/api/v2/meetings/[id]/route.ts) |
| `/api/v2/meetings/start` | POST | [app/api/v2/meetings/start/route.ts](app/api/v2/meetings/start/route.ts) |
| `/api/v2/meetings/webhook` | POST | [app/api/v2/meetings/webhook/route.ts](app/api/v2/meetings/webhook/route.ts) |
| `/api/v2/missions` | GET, POST, PATCH | [app/api/v2/missions/route.ts](app/api/v2/missions/route.ts) |
| `/api/v2/missions/:id` | DELETE, PATCH | [app/api/v2/missions/[id]/route.ts](app/api/v2/missions/[id]/route.ts) |
| `/api/v2/missions/:id/approve-step` | POST | [app/api/v2/missions/[id]/approve-step/route.ts](app/api/v2/missions/[id]/approve-step/route.ts) |
| `/api/v2/missions/:id/context` | GET | [app/api/v2/missions/[id]/context/route.ts](app/api/v2/missions/[id]/context/route.ts) |
| `/api/v2/missions/:id/messages` | GET, POST | [app/api/v2/missions/[id]/messages/route.ts](app/api/v2/missions/[id]/messages/route.ts) |
| `/api/v2/missions/:id/pause` | POST | [app/api/v2/missions/[id]/pause/route.ts](app/api/v2/missions/[id]/pause/route.ts) |
| `/api/v2/missions/:id/resume` | POST | [app/api/v2/missions/[id]/resume/route.ts](app/api/v2/missions/[id]/resume/route.ts) |
| `/api/v2/missions/:id/run` | POST | [app/api/v2/missions/[id]/run/route.ts](app/api/v2/missions/[id]/run/route.ts) |
| `/api/v2/missions/ops` | GET | [app/api/v2/missions/ops/route.ts](app/api/v2/missions/ops/route.ts) |
| `/api/v2/personas` | GET, POST | [app/api/v2/personas/route.ts](app/api/v2/personas/route.ts) |
| `/api/v2/personas/:id` | GET, DELETE, PATCH | [app/api/v2/personas/[id]/route.ts](app/api/v2/personas/[id]/route.ts) |
| `/api/v2/personas/ab-test` | POST | [app/api/v2/personas/ab-test/route.ts](app/api/v2/personas/ab-test/route.ts) |
| `/api/v2/plans` | GET | [app/api/v2/plans/route.ts](app/api/v2/plans/route.ts) |
| `/api/v2/plans/:id/approve` | POST | [app/api/v2/plans/[id]/approve/route.ts](app/api/v2/plans/[id]/approve/route.ts) |
| `/api/v2/reports` | GET | [app/api/v2/reports/route.ts](app/api/v2/reports/route.ts) |
| `/api/v2/reports/:specId/run` | POST | [app/api/v2/reports/[specId]/run/route.ts](app/api/v2/reports/[specId]/run/route.ts) |
| `/api/v2/reports/specs` | GET, POST | [app/api/v2/reports/specs/route.ts](app/api/v2/reports/specs/route.ts) |
| `/api/v2/reports/specs/:specId` | GET, DELETE, PATCH | [app/api/v2/reports/specs/[specId]/route.ts](app/api/v2/reports/specs/[specId]/route.ts) |
| `/api/v2/reports/specs/sample` | POST | [app/api/v2/reports/specs/sample/route.ts](app/api/v2/reports/specs/sample/route.ts) |
| `/api/v2/right-panel` | GET | [app/api/v2/right-panel/route.ts](app/api/v2/right-panel/route.ts) |
| `/api/v2/right-panel/stream` | GET | [app/api/v2/right-panel/stream/route.ts](app/api/v2/right-panel/stream/route.ts) |
| `/api/v2/runs` | GET | [app/api/v2/runs/route.ts](app/api/v2/runs/route.ts) |
| `/api/v2/runs/:id` | GET, DELETE | [app/api/v2/runs/[id]/route.ts](app/api/v2/runs/[id]/route.ts) |
| `/api/v2/runs/:id/export` | GET | [app/api/v2/runs/[id]/export/route.ts](app/api/v2/runs/[id]/export/route.ts) |
| `/api/v2/runs/:id/rerun` | POST | [app/api/v2/runs/[id]/rerun/route.ts](app/api/v2/runs/[id]/rerun/route.ts) |
| `/api/v2/scheduler/status` | GET | [app/api/v2/scheduler/status/route.ts](app/api/v2/scheduler/status/route.ts) |
| `/api/v2/search` | GET | [app/api/v2/search/route.ts](app/api/v2/search/route.ts) |
| `/api/v2/settings/flags` | GET, POST | [app/api/v2/settings/flags/route.ts](app/api/v2/settings/flags/route.ts) |
| `/api/v2/settings/preferences` | GET, POST | [app/api/v2/settings/preferences/route.ts](app/api/v2/settings/preferences/route.ts) |
| `/api/v2/simulations/:id` | GET | [app/api/v2/simulations/[id]/route.ts](app/api/v2/simulations/[id]/route.ts) |
| `/api/v2/simulations/history` | GET | [app/api/v2/simulations/history/route.ts](app/api/v2/simulations/history/route.ts) |
| `/api/v2/simulations/start` | POST | [app/api/v2/simulations/start/route.ts](app/api/v2/simulations/start/route.ts) |
| `/api/v2/usage/today` | GET | [app/api/v2/usage/today/route.ts](app/api/v2/usage/today/route.ts) |
| `/api/v2/user/connections` | GET | [app/api/v2/user/connections/route.ts](app/api/v2/user/connections/route.ts) |
| `/api/v2/user/me/vertical` | GET | [app/api/v2/user/me/vertical/route.ts](app/api/v2/user/me/vertical/route.ts) |
| `/api/v2/voice/tool-call` | POST | [app/api/v2/voice/tool-call/route.ts](app/api/v2/voice/tool-call/route.ts) |
| `/api/v2/voice/transcripts/:sessionId` | GET, PATCH | [app/api/v2/voice/transcripts/[sessionId]/route.ts](app/api/v2/voice/transcripts/[sessionId]/route.ts) |
| `/api/v2/voice/transcripts/append` | POST | [app/api/v2/voice/transcripts/append/route.ts](app/api/v2/voice/transcripts/append/route.ts) |
| `/api/v2/workflows/:runId/approve-node` | POST | [app/api/v2/workflows/[runId]/approve-node/route.ts](app/api/v2/workflows/[runId]/approve-node/route.ts) |
| `/api/v2/workflows/preview` | POST | [app/api/v2/workflows/preview/route.ts](app/api/v2/workflows/preview/route.ts) |
| `/api/webhooks` | GET, POST | [app/api/webhooks/route.ts](app/api/webhooks/route.ts) |
| `/api/webhooks/:webhookId` | GET, PUT, DELETE | [app/api/webhooks/[webhookId]/route.ts](app/api/webhooks/[webhookId]/route.ts) |
| `/api/webhooks/:webhookId/test` | POST | [app/api/webhooks/[webhookId]/test/route.ts](app/api/webhooks/[webhookId]/test/route.ts) |
| `/api/workflows` | GET, POST | [app/api/workflows/route.ts](app/api/workflows/route.ts) |
| `/api/workflows/templates` | GET | [app/api/workflows/templates/route.ts](app/api/workflows/templates/route.ts) |

## Par domaine

### admin/

- `/api/admin/agent-lock` — GET, POST
- `/api/admin/analytics/tenants` — GET
- `/api/admin/analytics/usage` — GET
- `/api/admin/audit` — GET
- `/api/admin/events-stream` — GET
- `/api/admin/features-manifest` — POST
- `/api/admin/health` — GET
- `/api/admin/llm-metrics` — GET
- `/api/admin/metrics/live` — GET
- `/api/admin/runs/:runId/events` — GET
- `/api/admin/runs/recent` — GET
- `/api/admin/seed/:resource` — POST
- `/api/admin/settings` — GET, POST
- `/api/admin/webhooks-status` — GET

### agents/

- `/api/agents` — GET, POST
- `/api/agents/:id` — GET, PUT, DELETE
- `/api/agents/:id/chat` — POST
- `/api/agents/:id/memory` — GET, POST
- `/api/agents/:id/memory/govern` — POST

### analytics/

- `/api/analytics` — POST

### auth/

- `/api/auth/:nextauth*` — —
- `/api/auth/callback/slack` — GET
- `/api/auth/dev-login` — GET
- `/api/auth/slack` — GET

### briefing/

- `/api/briefing` — GET, POST

### composio/

- `/api/composio/app-actions` — GET
- `/api/composio/apps` — GET
- `/api/composio/connect` — POST
- `/api/composio/connections` — GET
- `/api/composio/connections/:id` — DELETE
- `/api/composio/diagnose` — GET
- `/api/composio/invalidate-cache` — POST

### connections/

- `/api/connections/expiring` — GET
- `/api/connections/native` — GET

### datasets/

- `/api/datasets` — GET, POST
- `/api/datasets/:id/entries` — GET, POST
- `/api/datasets/:id/evaluate` — POST

### health/

- `/api/health` — GET

### inngest/

- `/api/inngest` — —

### integrations/

- `/api/integrations` — GET, POST
- `/api/integrations/:id/execute` — POST
- `/api/integrations/:id/health` — POST

### memory-policies/

- `/api/memory-policies` — GET, POST

### model-profiles/

- `/api/model-profiles` — GET, POST

### notifications/

- `/api/notifications` — GET
- `/api/notifications/read` — POST
- `/api/notifications/read-all` — POST

### onboarding/

- `/api/onboarding/set-industry` — POST

### orchestrate/

- `/api/orchestrate` — POST
- `/api/orchestrate/abort/:runId` — POST

### prompts/

- `/api/prompts` — GET, POST
- `/api/prompts/:slug` — GET

### public/

- `/api/public/reports/:token` — GET

### realtime/

- `/api/realtime/session` — POST

### reports/

- `/api/reports` — GET
- `/api/reports/:reportId/comments` — GET, POST
- `/api/reports/:reportId/comments/:commentId` — DELETE
- `/api/reports/:reportId/export` — GET
- `/api/reports/:reportId/rerun` — POST
- `/api/reports/:reportId/versions` — GET
- `/api/reports/:reportId/versions/:versionNumber` — GET, POST
- `/api/reports/:reportId/versions/diff` — GET
- `/api/reports/share` — POST
- `/api/reports/templates` — GET, POST
- `/api/reports/templates/:templateId` — GET, PUT, DELETE

### settings/

- `/api/settings/alerting` — GET, PUT
- `/api/settings/alerting/test` — POST

### signals/

- `/api/signals` — GET
- `/api/signals/:id/resolve` — POST

### skills/

- `/api/skills` — GET, POST

### tools/

- `/api/tools` — GET, POST

### v2/

- `/api/v2/agents/capabilities` — GET
- `/api/v2/architecture` — GET
- `/api/v2/assets` — GET, POST
- `/api/v2/assets/:id` — GET, DELETE
- `/api/v2/assets/:id/download` — GET
- `/api/v2/assets/:id/variants` — GET, POST
- `/api/v2/assets/diff` — POST
- `/api/v2/browser/:id` — GET, DELETE
- `/api/v2/browser/:id/capture` — POST
- `/api/v2/browser/:id/extract` — POST
- `/api/v2/browser/:id/take-over` — POST
- `/api/v2/browser/start` — POST
- `/api/v2/catalog` — GET
- `/api/v2/cockpit/today` — GET
- `/api/v2/daily-brief/generate` — POST
- `/api/v2/daily-brief/history` — GET
- `/api/v2/daily-brief/today` — GET
- `/api/v2/documents/upload` — POST
- `/api/v2/jobs/:jobId/status` — GET
- `/api/v2/jobs/audio-gen` — POST
- `/api/v2/jobs/code-exec` — POST
- `/api/v2/jobs/document-parse` — POST
- `/api/v2/jobs/image-gen` — POST
- `/api/v2/kg/graph` — GET
- `/api/v2/kg/ingest` — POST
- `/api/v2/kg/path` — GET
- `/api/v2/kg/query` — POST
- `/api/v2/kg/search` — GET
- `/api/v2/kg/timeline` — GET
- `/api/v2/marketplace/templates` — GET, POST
- `/api/v2/marketplace/templates/:id` — GET, DELETE
- `/api/v2/marketplace/templates/:id/clone` — POST
- `/api/v2/marketplace/templates/:id/rate` — POST
- `/api/v2/marketplace/templates/:id/report` — POST
- `/api/v2/meetings/:id` — GET, DELETE
- `/api/v2/meetings/start` — POST
- `/api/v2/meetings/webhook` — POST
- `/api/v2/missions` — GET, POST, PATCH
- `/api/v2/missions/:id` — DELETE, PATCH
- `/api/v2/missions/:id/approve-step` — POST
- `/api/v2/missions/:id/context` — GET
- `/api/v2/missions/:id/messages` — GET, POST
- `/api/v2/missions/:id/pause` — POST
- `/api/v2/missions/:id/resume` — POST
- `/api/v2/missions/:id/run` — POST
- `/api/v2/missions/ops` — GET
- `/api/v2/personas` — GET, POST
- `/api/v2/personas/:id` — GET, DELETE, PATCH
- `/api/v2/personas/ab-test` — POST
- `/api/v2/plans` — GET
- `/api/v2/plans/:id/approve` — POST
- `/api/v2/reports` — GET
- `/api/v2/reports/:specId/run` — POST
- `/api/v2/reports/specs` — GET, POST
- `/api/v2/reports/specs/:specId` — GET, DELETE, PATCH
- `/api/v2/reports/specs/sample` — POST
- `/api/v2/right-panel` — GET
- `/api/v2/right-panel/stream` — GET
- `/api/v2/runs` — GET
- `/api/v2/runs/:id` — GET, DELETE
- `/api/v2/runs/:id/export` — GET
- `/api/v2/runs/:id/rerun` — POST
- `/api/v2/scheduler/status` — GET
- `/api/v2/search` — GET
- `/api/v2/settings/flags` — GET, POST
- `/api/v2/settings/preferences` — GET, POST
- `/api/v2/simulations/:id` — GET
- `/api/v2/simulations/history` — GET
- `/api/v2/simulations/start` — POST
- `/api/v2/usage/today` — GET
- `/api/v2/user/connections` — GET
- `/api/v2/user/me/vertical` — GET
- `/api/v2/voice/tool-call` — POST
- `/api/v2/voice/transcripts/:sessionId` — GET, PATCH
- `/api/v2/voice/transcripts/append` — POST
- `/api/v2/workflows/:runId/approve-node` — POST
- `/api/v2/workflows/preview` — POST

### webhooks/

- `/api/webhooks` — GET, POST
- `/api/webhooks/:webhookId` — GET, PUT, DELETE
- `/api/webhooks/:webhookId/test` — POST

### workflows/

- `/api/workflows` — GET, POST
- `/api/workflows/templates` — GET
