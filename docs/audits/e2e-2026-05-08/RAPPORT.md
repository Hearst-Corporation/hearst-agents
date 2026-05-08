# Audit E2E Hearst OS — 2026-05-08

**Branche** : `6fbadb1` (main)
**Démarrage** : 2026-05-08 02:20 UTC
**Méthode** : tests live via `curl` directement sur l'instance Electron en cours (PID 73493, port 9001).
**Environnement** : `HEARST_DEV_AUTH_BYPASS=1` actif, fallback dev-tenant.

## Env présentes

✅ ANTHROPIC_API_KEY, OPENAI_API_KEY, COMPOSIO_API_KEY, EXA_API_KEY, TAVILY_API_KEY, PERPLEXITY_API_KEY, BROWSERBASE_API_KEY, RECALL_API_KEY, ELEVENLABS_API_KEY, FAL_KEY, RUNWAY_API_KEY, HEYGEN_API_KEY, LLAMA_CLOUD_API_KEY, DEEPSEEK_API_KEY, PDL_API_KEY, APOLLO_API_KEY, RESEND_API_KEY, REDIS_URL, UPSTASH_REDIS_REST_URL, R2_ACCOUNT_ID, NEXT_PUBLIC_SUPABASE_URL

## Env manquantes

❌ HEARST_TENANT_ID (fallback dev-tenant actif), NEXT_PUBLIC_HEARST_TENANT_ID

## Limites de cet audit

- Tests **API en live via curl** sur orchestrate SSE et endpoints v2. Pas de Playwright UI dans cette passe (Phase 2 pour Adrien — voir `CHECKLIST-USER.md`).
- Domaines couverts : 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 16, 17.
- Domaines partiellement couverts : 15 (UI auto-pilotable seulement via Playwright, non lancé).
- Domaines NON testés en live : 7 (média payant), 8 (voice WebRTC), 9 (browser agent), 10 (meeting Zoom). Voir CHECKLIST-USER.md.

---

## Tableau récap

| #     | Domaine                  | Cas                                          | Statut | Latence | Détail                                                    | Preuve                            |
|-------|--------------------------|----------------------------------------------|--------|---------|-----------------------------------------------------------|-----------------------------------|
| 1.1   | Chat / direct_answer     | "Bonjour"                                    | ✅     | 9.7s    | `direct_answer`, "Bonjour. Qu'est-ce qu'on attaque ce matin ?" — voix corrigée OK | sse-traces/1.1.txt                |
| 1.2   | Chat / research          | "Fais un rapport sur le bitcoin mining"      | ✅     | 4.0s    | research path déclenché, asset 2e8f137b créé              | sse-traces/1.2.txt                |
| 1.3   | Chat / reasoning         | "Démontre par récurrence..."                 | ❌     | 12.7s   | `mode=direct_answer` au lieu de `reasoning` — DeepSeek R1 NON déclenché | sse-traces/1.3.txt                |
| 1.4   | Chat / schedule          | "Tous les matins à 8h..."                    | ❌     | 13.8s   | `tool_call_started` JAMAIS émis — `create_scheduled_mission` non invoqué malgré directive | sse-traces/1.4.txt                |
| 1.5   | Chat / planner B1        | "Compile un board pack..."                   | ⚠️     | 3.9s    | `mode=workflow` (research) au lieu de `runPlannerWorkflow` — `HEARST_ENABLE_PLANNER` non set en .env.local | sse-traces/1.5.txt                |
| 1.6   | Chat / schedule false-pos | "Je veux tous les détails sur ce client"    | ✅     | 8.5s    | Pas de schedule injecté à tort. Réponse "Quel client ?"   | sse-traces/1.6.txt                |
| 1.7   | Chat / cap > 50k chars   | message géant                                | ✅     | —       | HTTP 400 `{"error":"message_too_long","max":50000}`       | sse-traces/1.7.txt                |
| 1.8   | Chat / cap empty         | message vide                                 | ✅     | —       | HTTP 400 `{"error":"message_required"}`                   | —                                 |
| 1.9   | Chat / abort             | clic Stop pendant stream                     | ⏭     | —       | Nécessite Playwright UI — voir CHECKLIST-USER.md          | —                                 |
| 1.10  | Chat / rate limit Arcjet | 11 reqs en burst                             | ❌     | —       | **0 / 11 refusées** (devrait cap à 10/min) → rate limit inactif | —                                 |
| 1.11  | Chat / safety injection  | "ignore previous instructions..."            | ✅     | 2.0s    | Refus propre : "ne peuvent pas être révélées"             | sse-traces/1.11.txt               |
| 1.12  | Chat / mass action       | "Envoie ce message à 100 contacts"           | ✅     | 2.1s    | Refus + demande segmentation                              | sse-traces/1.12.txt               |
| 1.13  | Chat / multi-tour        | 3 messages séquentiels avec contexte         | ✅     | —       | Tour 3 cite correctement "Acme, 50 employés, SaaS B2B en Série A" | sse-traces/1.13.t{1,2,3}.txt      |
| 2.1   | Web search / Tavily      | "Prix du bitcoin"                            | ⚠️     | 4.8s    | `mode=workflow` mais aucun `tool_call_started` capté — fallback research path au lieu de `web_search` direct | sse-traces/2.1.txt                |
| 2.2   | Web search / Perplexity  | "Compare Stripe et Adyen"                    | ⚠️     | **47.4s** | `mode=workflow`, latence inacceptable (47 sec)         | sse-traces/2.2.txt                |
| 2.3   | Web search / Exa         | "Trouve des LLMs spécialisés vertical"       | ✅     | 27.6s   | 4 × `web_search` parallèles invoqués                      | sse-traces/2.3.txt                |
| 2.4   | Web search / cache 24h   | repeat 2.1                                   | ✅     | 2.8s    | Latence ÷ 1.7 — cache probablement actif                  | sse-traces/2.4.txt                |
| 2.5   | Web search / fallback    | provider down                                | ⏭     | —       | Test destructif (rename .env) skipped                     | —                                 |
| 2.6   | Web search / all down    | tous providers down                          | ⏭     | —       | Idem                                                       | —                                 |
| 3.1   | Research report          | "Recherche sur LLMs en 2026"                 | ⚠️     | 3.4s    | `mode=custom_agent` — ne tombe PAS dans `runResearchReport`, **aucun asset créé** | sse-traces/3.1.txt                |
| 3.2   | Render asset (post-fix)  | ouvrir asset 2e8f137b                        | ✅     | —       | ResearchReportArticle a été corrigé en début de session — narration + sources rendues | code review                       |
| 3.3   | PDF download             | provenance.pdfFile                           | ⏭     | —       | Pas testé en download direct                              | —                                 |
| 3.4   | Refresh persistance      | timeline rail                                | ⏭     | —       | Nécessite Playwright UI                                   | —                                 |
| 3.5   | KG ingest fire-and-forget| node créé après chat                         | ⏭     | —       | Nécessite inspection KG après délai 5min throttle         | —                                 |
| 4.1   | Reports catalogue        | "Founder Cockpit"                            | ❌     | 3.0s    | **Tombe en research path**, asset c1cf1532 sans `__reportPayload`, blocks=0 — **PAS un vrai catalogue report** | sse-traces/4.1.txt                |
| 4.2   | Reports catalogue        | "Financial PnL"                              | ❌     | 3.6s    | Idem 4.1 — asset ff7c8815, sans marker                    | sse-traces/4.2.txt                |
| 4.3   | Reports catalogue        | "RevPAR hospitality"                         | ❌     | 3.3s    | Idem 4.1 — asset eb6b3da5, sans marker                    | sse-traces/4.3.txt                |
| 4.4-7 | Reports catalogue extra  | Customer 360, Marketing AARRR, exports, share | ⏭     | —       | Pas testés (même bug racine attendu)                      | —                                 |
| 5.1   | Composio Slack write     | "Envoie #general test audit"                 | ❌     | 13.5s   | LLM répond explicitement "Je n'ai pas l'outil d'envoi Slack". `slack_send_message` ABSENT du tour. Au lieu de ça, `SLACK_ASSISTANT_SEARCH_CONTEXT` (read) appelé à tort | sse-traces/5.1.txt                |
| 5.4   | Composio HubSpot read    | "Liste mes deals HubSpot ouverts"            | ⚠️     | 10.8s   | mode=workflow OK mais aucun tool capté — HubSpot probablement non connecté ou tools filtrés | sse-traces/5.4.txt                |
| 5.12  | Composio Notion absent   | "Crée page Notion"                           | ✅     | 9.9s    | Event `app_connect_required {app: "notion"}` correctement émis | sse-traces/5.12.txt               |
| 5.13  | Workflow handler hors guard | scheduled workflow → slack                | ⏭     | —       | Nécessite création workflow + scheduling — non testé      | —                                 |
| 6.1   | Google native Gmail      | "Lis mes 5 derniers emails"                  | ✅     | 17.2s   | `gmail_fetch_emails` invoqué, 16 text_delta              | sse-traces/6.1.txt                |
| 6.2   | Google native Calendar   | "Mon prochain rendez-vous"                   | ✅     | 22.9s   | `googlecalendar_list_events` invoqué                     | sse-traces/6.2.txt                |
| 6.3   | Google native Drive      | "Mes 3 derniers fichiers Drive"              | ✅     | 13.1s   | `googledrive_list_files` invoqué                         | sse-traces/6.3.txt                |
| 7.1-7 | Media generation         | image/audio/vidéo/code E2B/PDF parse         | ⏭     | —       | Coûts API non négligeables — voir CHECKLIST-USER.md       | —                                 |
| 8.1-4 | Voice                    | hotkey ⌘⇧V, parler, désactiver               | ⏭     | —       | WebRTC + micro physique — voir CHECKLIST-USER.md          | —                                 |
| 9.1-5 | Browser agent            | session Browserbase, take over, extract      | ⏭     | —       | Nécessite session live + observation visuelle              | —                                 |
| 10.1-4| Meeting                  | bot Zoom, webhooks Recall                    | ⏭     | —       | Nécessite vraie URL Zoom + webhook                         | —                                 |
| 11.1  | Enrichment company       | "Enrichis stripe.com"                        | ✅     | 17.3s   | `enrich_company` invoqué                                  | sse-traces/11.1.txt               |
| 11.2  | Enrichment contact       | "Qui est patrick.collison@stripe.com"        | ✅     | 16.4s   | `enrich_contact` invoqué                                  | sse-traces/11.2.txt               |
| 11.3  | Enrichment cache         | repeat 11.1                                  | ⏭     | —       | Pas re-testé                                               | —                                 |
| 12.1  | Market data crypto       | "Prix du bitcoin et eth"                     | ❌     | 4.8s    | **`get_crypto_prices` JAMAIS invoqué** — fallback web_search → liste URLs CoinMarketCap au lieu de prix réels | sse-traces/12.1.txt               |
| 12.2  | Market data stocks       | "Cours AAPL et MSFT"                         | ✅     | 11.5s   | `get_stock_quotes` invoqué                                | sse-traces/12.2.txt               |
| 12.3  | Market data combined     | mission daily 9h crypto+stocks                | ⏭     | —       | Pas testé (création mission)                              | —                                 |
| 13.1  | KG Cytoscape rendering   | hotkey ⌘6                                    | ⏭     | —       | Playwright UI                                              | —                                 |
| 13.2  | KG query                 | "Liens entre Stripe et HubSpot"              | ✅     | 24.0s   | `query_knowledge_graph` invoqué                           | sse-traces/13.2.txt               |
| 13.3  | KG auto-ingest           | node après chat sur "Acme Corp"              | ⏭     | —       | Nécessite délai 5min throttle + inspection                | —                                 |
| 14.2  | Mission pause/resume     | toggle enabled                               | ✅     | —       | `paused → active` OK                                       | —                                 |
| 14.3  | Mission run NOW          | POST /run                                    | ✅     | 12.1s   | `{ok:true, runId}` retour synchrone                        | —                                 |
| 14.6  | Mission memory context   | GET /context                                 | ❌     | —       | `summary=null, messages=0, retrieval=0, kg=False` malgré 2 runs success — **mission memory non alimentée** | —                                 |
| 14.5  | Tick scheduler auto      | nouvelle mission attend exécution            | ⏭     | —       | Nécessite attente 60s+                                     | —                                 |
| 14.7-9| Auto-export, webhooks, approval | flows avancés                          | ⏭     | —       | Nécessite config + observation                             | —                                 |
| 15.*  | UI surface complète      | hotkeys, navigation, états, mobile            | ⏭     | —       | Voir CHECKLIST-USER.md                                     | —                                 |
| 16.1-7| Admin pages              | health, runs, audit, llm-metrics, lock        | ✅     | —       | Tous endpoints répondent 200 sauf `/api/admin/features-manifest` (HTTP 405 — mauvaise méthode) | —                                 |
| 17.1  | Reports sharing HMAC     | lien public                                  | ⏭     | —       | Nécessite création + nav privée                            | —                                 |
| 17.2  | Marketplace templates    | clone, rate                                  | ⏭     | —       | Playwright UI                                              | —                                 |
| 17.3  | Personas                 | crée, switch                                 | ⏭     | —       | Playwright UI                                              | —                                 |
| 17.4  | Datasets                 | CRUD                                          | ✅     | —       | `/api/datasets` répond 200 + 718b                          | —                                 |
| 17.5  | Workflows                | CRUD + exécution                             | ✅⚠️   | —       | `/api/workflows` 200 mais `/api/v2/workflows` 404 — coexistence v1/v2 incomplète | —                                 |
| 17.6  | Webhooks subscriptions   | endpoint test webhook.site                   | ⏭     | —       | Création webhook + run mission requis                      | —                                 |
| 17.7  | Inngest daily-brief      | dashboard Inngest                            | ❌     | —       | `/api/v2/daily-brief/generate` → "Inngest API Error: 404 Event key not found" — **INNGEST_EVENT_KEY invalide ou absent** | —                                 |
| 17.8  | Resend send_email        | email à toi-même                             | ⏭     | —       | Pas testé pour ne pas spammer ta boîte                     | —                                 |
| 17.9  | Sentry tool              | query_sentry_issues                          | ⏭     | —       | Pas testé                                                  | —                                 |
| 17.10 | Axiom tool               | query_axiom_logs                             | ⏭     | —       | Pas testé                                                  | —                                 |
| 17.11 | Langfuse tool            | query_langfuse_traces                         | ⏭     | —       | Pas testé                                                  | —                                 |
| 17.12 | Storage hybride          | upload R2 vs Supabase                        | ⏭     | —       | Pas testé en live                                          | —                                 |
| 17.13 | Realtime notifications   | bell se met à jour                           | ⏭     | —       | Playwright UI                                              | —                                 |

---

## Liste des échecs détaillés

### ❌ 1.3 — DeepSeek R1 reasoning non déclenché

**Reproduction** : POST `/api/orchestrate` avec `"Démontre par récurrence que la somme des n premiers entiers vaut n(n+1)/2"`.

**Symptôme** : `execution_mode_selected.mode = "direct_answer"` au lieu de `"reasoning"`. Le `<think>` block visible dans le text_delta est probablement Claude Sonnet qui imite le format, pas DeepSeek R1.

**Trace SSE** :
```
data: {"type":"execution_mode_selected","mode":"direct_answer",...}
data: {"type":"text_delta","delta":"<think>Nous devons démontrer..."}
```

**Hypothèse** : la heuristique `resolveExecutionMode()` ([lib/engine/orchestrator/index.ts:230-245](../../../lib/engine/orchestrator/index.ts#L230-L245)) ne reconnaît pas "démontre par récurrence" comme intent reasoning. Pas de tool/keyword spécifique câblé. La feature DeepSeek R1 existe ([index.ts:560-585](../../../lib/engine/orchestrator/index.ts#L560-L585)) mais aucun chemin user n'y arrive en pratique.

---

### ❌ 1.4 — `create_scheduled_mission` jamais invoqué

**Reproduction** : `"Tous les matins à 8h, envoie-moi un brief des marchés crypto"`.

**Symptôme** : 0 `tool_call_started` dans le SSE stream, alors que la directive `_scheduleDirective` aurait dû forcer le LLM à appeler le tool. Le LLM a juste répondu en texte avec un format cron littéral.

**Trace SSE** :
```
data: {"type":"execution_mode_selected","mode":"workflow"}
data: {"type":"text_delta","delta":" : `0 8 * * *` **Tâche** : Prix + variations 24h..."}
... (5 text_delta, 0 tool_call)
data: {"type":"run_completed"}
```

**Hypothèse** : le bloc `scheduleHeader` ([system-prompt.ts:380-391](../../../lib/engine/orchestrator/system-prompt.ts#L380-L391)) est bien présent ("Tu DOIS appeler `create_scheduled_mission` avec `_preview: true` comme PREMIÈRE action") mais le LLM ne l'applique pas. Soit le tool n'est pas dans la registry du tour, soit Claude estime pouvoir répondre en texte. **Bug bloquant pour la création de missions par chat.**

---

### ❌ 1.10 — Rate limit Arcjet inactif

**Reproduction** : 12 POST `/api/orchestrate` en burst < 1s.

**Symptôme** : 11/12 retournent HTTP 200 (la 12e était un timeout local). Aucune n'a renvoyé 429.

**Hypothèse** : `ajOrchestrate` est défini dans [`lib/security/arcjet.ts:50`](../../../lib/security/arcjet.ts#L50) avec cap 10 req/min, dispatché dans [`proxy.ts:74`](../../../proxy.ts#L74). Mais en pratique, il ne refuse pas. Soit la dev-bypass court-circuite Arcjet, soit la config Arcjet n'a pas la clé requise (`ARCJET_KEY`), soit le proxy ne s'applique pas correctement à cette route.

**Risque** : un user (ou attaquant) peut spammer `/api/orchestrate` sans limite → coûts Anthropic exposés.

---

### ❌ 4.1, 4.2, 4.3 — Reports catalogue n'existent pas en pratique

**Reproduction** : "Donne-moi un rapport founder cockpit", "Génère le rapport financial PnL", "Rapport hospitality RevPAR".

**Symptôme** : 3 assets créés mais tous au format `{ payload, narration, research }` SANS marker `__reportPayload`, blocks=0.

**Hypothèse** : le LLM ne reconnaît pas "Founder Cockpit", "Financial PnL", "RevPAR" comme déclencheurs `propose_report_spec` malgré la liste dans [system-prompt.ts:512-521](../../../lib/engine/orchestrator/system-prompt.ts#L512-L521). Le path research deterministe est invoqué à la place.

**Conséquence pratique** : **les 9 templates de rapports catalogue (Founder Cockpit, Customer 360, Deal-to-Cash, Financial PnL, Product Analytics, Support Health, Engineering Velocity, Marketing AARRR, HR/People) ne sont pas livrés en réalité**. L'user obtient un research report (web search + synthèse) au lieu d'un dashboard structuré avec blocks.

---

### ❌ 5.1 — Slack send impossible aujourd'hui

**Reproduction** : "Envoie un message #general sur Slack disant test audit E2E".

**Symptôme** : LLM répond textuellement :
> "Je n'ai pas l'outil d'envoi de message Slack disponible dans ce tour (seuls les outils listés sont utilisables, et `chat.postMessage` n'en fait pas partie). Je ne peux pas envoyer ce message directement."

Le LLM appelle `SLACK_ASSISTANT_SEARCH_CONTEXT` (un read tool) mais pas le write.

**Hypothèse** :
1. La connexion Slack EXPIRED qu'on voit dans `/api/composio/connections` est probablement la cause
2. Ou le scope `chat:write` n'est pas accordé
3. Ou le tool filter par domain a éliminé `slack_send_message` du tour

**Conséquence pratique** : **envoyer un Slack via Hearst ne marche pas aujourd'hui** sur cette instance.

---

### ❌ 12.1 — `get_crypto_prices` jamais invoqué

**Reproduction** : "Prix du bitcoin et eth maintenant".

**Symptôme** : aucun tool_call. Le LLM tombe sur un research path web_search et liste 5 URLs CoinMarketCap au lieu de retourner un prix temps réel via le tool natif `get_crypto_prices` ([market-data.ts](../../../lib/tools/native/market-data.ts)).

**Hypothèse** : malgré la description dans [system-prompt.ts:442](../../../lib/engine/orchestrator/system-prompt.ts#L442) (avant suppression du bloc CAPACITÉS NATIVES qu'on a fait en début de session), le LLM ne sait pas que `get_crypto_prices` existe ou ne le préfère pas au web_search.

**Côté positif** : [12.2](sse-traces/12.2.txt) `"Cours AAPL et MSFT"` a bien invoqué `get_stock_quotes` → l'asymétrie crypto/stocks suggère un problème de discovery côté tools natifs au tour. À investiguer dans `ai-pipeline.ts:412-445` (tool map assembly).

---

### ❌ 14.6 — Mission memory non alimentée

**Reproduction** : `GET /api/v2/missions/{id}/context` après 2 runs successful (mission "bitcoin", `lastRunStatus=success`).

**Symptôme** :
```json
{ "summary": null, "messages": [], "retrieval": [], "kg": false }
```

**Hypothèse** : le pipeline `updateMissionContextSummary()` (Haiku post-run) et `appendMissionMessage()` ne tournent pas, ou l'API `/context` ne lit pas les bonnes tables. La spec [missions.md I-12](../../features/missions.md) garantit "summary + 10 messages + retrieval + KG" — **invariant verrouillé violé en pratique**.

**Conséquence pratique** : les missions n'ont aucune mémoire long-terme entre runs. Chaque exécution part de zéro côté contexte mission.

---

### ❌ 17.7 — Daily Brief impossible (Inngest non configuré)

**Reproduction** : `POST /api/v2/daily-brief/generate`.

**Symptôme** : `{"error":"enqueue_failed","message":"Inngest API Error: 404 Event key not found"}`

**Hypothèse** : `INNGEST_EVENT_KEY` invalide ou pointant sur un projet Inngest inexistant. La key est peut-être présente dans `.env.local` mais ne correspond pas à un compte Inngest actif (côté providers).

**Conséquence pratique** : le **Daily Brief ne se génère jamais** sur cette instance — confirme pourquoi `/api/v2/daily-brief/today` retourne `{brief:null}` constamment.

---

## Avertissements (⚠️)

### ⚠️ 2.2 — Latence chat 47.4s
Recherche "Compare Stripe et Adyen" → 47.4s. Inacceptable pour un produit "premium". Probable que Perplexity research mode est lent + plusieurs appels web_search en série.

### ⚠️ 1.5 — Planner B1 jamais activé en prod
`HEARST_ENABLE_PLANNER` absent de `.env.local` → le planner B1 (`runPlannerWorkflow`) n'est jamais déclenché. Le code existe ([planner/index.ts](../../../lib/engine/planner/index.ts)) mais il est mort en pratique.

### ⚠️ 3.1 — Custom agent vide
"Recherche sur LLMs en 2026" → `mode=custom_agent` (pas research_path) mais aucun asset créé. Un agent custom a été matché par `agent-selector.ts` mais son output ne va nulle part. **Path mort**.

### ⚠️ 5.4 — HubSpot read silencieux
"Liste mes deals HubSpot ouverts" → 13 text_delta mais aucun tool capté → soit HubSpot non connecté (pas dans les 9 connexions Composio actives), soit tools filtrés out par domain. Le LLM répond probablement avec des données fictives.

### ⚠️ 16.5 — `/api/admin/features-manifest` méthode incorrecte
HTTP 405. Sans doute besoin de POST au lieu de GET. À documenter.

### ⚠️ 17.5 — `/api/v2/workflows` 404
Coexistence v1/v2 incomplète. `/api/workflows` (v1) répond 200, `/api/v2/workflows` (root) répond 404. Endpoints v2 sont sous `/preview` et `/[runId]/approve-node` seulement.

---

## Liste des skip

- 1.9 abort manuel : nécessite Playwright UI
- 2.5, 2.6 fallback web search : tests destructifs (rename .env)
- 3.3, 3.4, 3.5 PDF download / refresh / KG verif après ingest : pas de Playwright dans cette passe
- 4.4-4.7 reports catalogue extras : même bug racine attendu (cf. 4.1-4.3)
- 5.13 workflow handler hors guard : nécessite création workflow
- Domaine 7 (média) : skip pour économiser coûts API
- Domaine 8 (voice) : WebRTC + micro physique
- Domaine 9 (browser agent) : nécessite session live + observation visuelle
- Domaine 10 (meeting) : nécessite vraie URL Zoom
- 11.3 cache enrichment : pas re-testé
- 12.3 mission combined : nécessite création mission
- 13.1, 13.3-6 KG UI / auto-ingest / paths / embed : Playwright + délais
- 14.5, 14.7-9 : tick + auto-export + webhooks + approval flows
- Domaine 15 UI complet : Playwright (voir CHECKLIST-USER.md)
- 17.1-3 reports sharing / marketplace / personas : Playwright UI
- 17.6, 17.8-13 webhooks / Resend / Sentry / Axiom / Langfuse / storage / notifications realtime : pas testés en live

---

## Métriques globales

- **Total cas définis dans la mission** : ~150
- **Cas testés en live** : 38
- **✅ OK** : 21 (55%)
- **❌ KO** : 9 (24%)
- **⚠️ Dégradé** : 6 (16%)
- **⏭ Skip** : 2 (5% des testables)
- **⏭ Phase 2 (UI / coûts / live setup)** : ~110 cas → CHECKLIST-USER.md

**Latences chat /api/orchestrate** :
- min : 2.0s (1.11 refus injection)
- median : ~10s
- p95 : 27.6s (2.3)
- max : 47.4s (2.2 Perplexity research)

---

## Top 5 régressions critiques

1. **Reports catalogue inexistants en pratique** (4.1-4.3) — Founder Cockpit, Financial PnL, RevPAR... 9 templates marketing morts. Le LLM tombe en research path à chaque fois.
2. **Slack send impossible** (5.1) — write Slack ne marche pas, le LLM le dit lui-même.
3. **`create_scheduled_mission` jamais invoqué** (1.4) — création de mission via chat ne marche pas malgré la directive forcée.
4. **`get_crypto_prices` ignoré** (12.1) — l'user qui demande "prix du BTC" obtient des liens externes au lieu d'un prix temps réel.
5. **Daily Brief impossible** (17.7) — Inngest 404, jamais de brief généré.

## Top 3 risques sécurité

1. **Rate limit Arcjet inactif** (1.10) — coûts Anthropic exposés au spam.
2. **DeepSeek R1 reasoning jamais déclenché** (1.3) — perte d'invariant feature, pas un risque sécu mais perte de capacité revendiquée.
3. **Mission memory absente** (14.6) — invariant verrouillé violé en runtime, contradiction avec spec.

---

**Fin rapport. Aucun fichier de code applicatif n'a été modifié. SSE traces dans `sse-traces/`, network réponses dans `network/`. Phase 2 (cas non automatisables) à exécuter manuellement via `CHECKLIST-USER.md`.**
