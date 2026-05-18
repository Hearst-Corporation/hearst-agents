---
description: Corrige la conformité Cockpit — dynamic + kimiCockpit + tokens.css
---
# /fix-cockpit — helm
Sans demander confirmation :
1. `app/api/cockpit-chat/route.ts` — ajoute `export const dynamic = "force-dynamic";` après runtime
2. `lib/llm/kimiCockpit.ts` — remplace `process.env.KIMI_API_KEY!` par `process.env.HYPERCLI_API_KEY || process.env.KIMI_API_KEY || "build-placeholder"`
3. `app/layout.tsx` — ajoute `import "@hearst/cockpit-shell/tokens.css";`
Puis `pnpm build`.
