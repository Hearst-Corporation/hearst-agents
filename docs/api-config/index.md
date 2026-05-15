# API Config — Hearst OS

Source de vérité pour tous les services, APIs et tokens du projet.

## Fichiers

| Fichier                                                    | Contenu                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| [SERVICES.md](./SERVICES.md)                               | Catalogue complet — clés actives, statuts REQ/OPT, providers |
| [docs/features/connections.md](../features/connections.md) | Spec technique — Composio, write-guard, OAuth, discovery     |

## Services opérationnels (~25)

**LLM** : Anthropic Claude (REQ) · OpenAI embeddings · DeepSeek R1
**Storage** : Supabase (REQ) · Cloudflare R2 (legacy)
**Auth** : NextAuth · Google OAuth
**Tools** : Composio 1500+ actions · Exa · Tavily · Perplexity
**Media** : fal.ai · ElevenLabs · HeyGen · Runway · Meshy (3D)
**Voice/Meetings** : Deepgram STT · Recall.ai · Hume
**Doc/Code** : LlamaParse · E2B · Browserbase
**Enrichment** : Apollo · PDL
**Jobs** : Inngest · Upstash Redis
**Obs** : Sentry · Axiom · Langfuse
**Email/Sec** : Resend · Arcjet

## Services non câblés (référencés, pas implémentés)

Azure AD · Slack OAuth · Temporal · Plaid · Mercury · Xero · QuickBooks · Blockchain providers · Mining pools · Exchanges

## Ajouter un service

1. Créer le provider dans `lib/capabilities/providers/<service>.ts` (pattern : `elevenlabs.ts`)
2. Ajouter la var dans `.env.local` + dans `SERVICES.md`
3. Exposer `isXxxConfigured()` ou `XxxUnavailableError`
4. Référencer dans ce fichier

## Sécurité

`SERVICES.md` et `docs/api-config/SERVICES.md` sont dans `.gitignore` — **ne jamais commit**.
