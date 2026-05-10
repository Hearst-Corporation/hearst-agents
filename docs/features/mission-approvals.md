# Mission Approvals — `mission-approvals`

## Métadonnées

| Champ              | Valeur                                                              |
| ------------------ | ------------------------------------------------------------------- |
| **id**             | `mission-approvals`                                                 |
| **statut**         | `in_progress`                                                       |
| **owner**          | Adrien                                                              |
| **dernière revue** | 2026-05-10                                                          |
| **version spec**   | 1.0                                                                 |
| **niveau**         | P1 — flow d'approbation collaboratif, HMAC critique, scheduler gate |
| **livrée**         | Q3 (Q3-D)                                                           |

## Description

Workflow d'approbation collaborative multi-acteur sur une mission. L'owner configure une liste d'`approvers` (emails) et un mode (`all` / `any` / `majority`). Avant chaque run, le scheduler vérifie le statut d'approbation : si la mission requiert une nouvelle approbation et que le seuil n'est pas atteint, la run est gated. Un email avec lien HMAC est envoyé à chaque approver, qui peut voter via une page publique sans login.

Philosophie : **collaboration externe sans onboarding** — l'approver n'a pas besoin de compte Hearst, juste de cliquer sur le lien dans son email.

## Surface publique

### Pages

- [app/public/approvals/[token]/page.tsx](../../app/public/approvals/[token]/page.tsx) — page publique, vérifie HMAC, rend `approve` / `reject` buttons

### Endpoints API

- `POST /api/v2/approvals/[token]/vote` ([route.ts](../../app/api/v2/approvals/[token]/vote/route.ts))
  - **Auth** : HMAC token (pas de session)
  - **Input** : `{ decision: "approve" | "reject", comment?: string }`
  - **Output** : `{ status: "recorded", missionStatus: "pending|approved|rejected" }`

## Architecture interne

### Table Supabase

```sql
CREATE TABLE mission_approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  approver_email text NOT NULL,
  decision    text CHECK (decision IN ('pending','approve','reject')),
  comment     text,
  voted_at    timestamptz,
  created_at  timestamptz DEFAULT now(),
  metadata    jsonb DEFAULT '{}'
);

CREATE INDEX idx_mission_approvals_mission ON mission_approvals (mission_id);
```

### Librairies

- [lib/missions/approvals.ts](../../lib/missions/approvals.ts) :
  - `requestApproval(missionId, approvers, mode)` — crée rows pending + sign HMAC tokens + envoie emails
  - `recordVote(token, decision, comment)` — verify HMAC, MAJ row, recompute mission status
  - `getApprovalStatus(missionId)` — retourne `pending | approved | rejected` selon mode + votes
  - `signApprovalToken(approvalId, missionId, approverEmail)` — HMAC signed payload

### HMAC tokens

- Payload : `{ approvalId, missionId, approverEmail, exp }` (TTL 7j)
- Signed via `MISSION_APPROVAL_SECRET` (HMAC-SHA256)
- Encoded base64url

### Scheduler gate

- Avant chaque run, scheduler appelle `getApprovalStatus(missionId)` (fail-open)
- Si `pending` → skip ce tick, re-check au prochain
- Si `approved` → continue (consume si `oneShot=true`, persist sinon)
- Si `rejected` → mark mission disabled + notify owner

## Data flow

```
[Owner configure approvers + mode sur mission]
  ↓ requestApproval()
  ↓ pour chaque approver : insert row pending + sign HMAC + send email
[Approver clic lien email]
  ↓ landing /public/approvals/[token]
  ↓ verify HMAC
  ↓ render approve/reject form
[Approver soumet vote]
  ↓ POST /api/v2/approvals/[token]/vote
  ↓ verify HMAC
  ↓ update row + recompute status
[Scheduler tick mission]
  ↓ getApprovalStatus() → pending/approved/rejected
  ↓ fail-open si DB down
[Si approved → run normal flow]
```

## Invariants verrouillés

### I-1. 3 modes : `all` / `any` / `majority`

- `all` : tous les approvers doivent approuver, un seul reject = rejected
- `any` : un seul approve suffit
- `majority` : >50% approvers doivent approuver

Ajouter un mode = update spec.

### I-2. HMAC token TTL 7 jours

`exp` à +7j depuis `requestApproval()`. Au-delà → 410 sur la page publique. Re-générer un token = update DB + re-send email.

### I-3. Pas de session sur la page publique

La page `/public/approvals/[token]` ne consulte ni cookies ni session. Auth 100% via HMAC. Pas de migration vers session-based sans spec (casserait l'usage externe).

### I-4. Fail-soft email

Si Resend (ou autre provider email) down → `requestApproval` log warn, continue. Le row est créé en DB, l'owner peut re-déclencher l'email manuellement. Pas de retry auto.

### I-5. Fail-open scheduler gate

Si `getApprovalStatus()` throw (DB down, etc.) → considère la mission comme `approved` (fail-open). Cohérent avec [missions I-5](missions.md). Mieux sur-exécuter une fois que bloquer indéfiniment.

### I-6. Cascade delete sur mission

`mission_approvals.mission_id REFERENCES missions(id) ON DELETE CASCADE`. Si la mission est supprimée, les approvals partent aussi.

### I-7. Append-only sur les votes (pas de mutation hors `recordVote`)

La row `mission_approvals` ne peut être MAJ que par `recordVote()` (passage `pending → approve|reject`). Pas de re-vote (vote final). Pas de DELETE manuel hors cascade.

## Évolutions autorisées sans spec

- Polish UI page publique (typo, branding, copy)
- Ajout d'un commentaire optionnel par vote
- Email template enrichi (markdown, contexte mission)
- Webhook après vote (intégration Slack/Discord)
- Notification owner quand vote enregistré
- Resend manuel d'un token (depuis admin)
- Stats agrégées par mission

## Risques & modes de défaillance

| Risque                                 | Impact                  | Mitigation actuelle                                     |
| -------------------------------------- | ----------------------- | ------------------------------------------------------- |
| HMAC secret leak                       | Tokens forgables        | Rotation secret + invalidation tokens (manuel)          |
| Email Resend quota dépassé             | Approvers pas notifiés  | Fail-soft warn, owner peut re-trigger                   |
| Token expiré (>7j)                     | Page 410                | Owner re-trigger requestApproval                        |
| Approver clique 2x                     | Double vote ?           | `recordVote` no-op si row already voted                 |
| DB down pendant tick scheduler         | Fail-open → run         | Acceptable cf I-5                                       |
| Mode `majority` égalité parfaite       | Status pending indéfini | Strictement >50%, donc égalité = pending → admin résout |
| Mission supprimée pendant vote pending | Row cascadée            | Acceptable, owner a explicitement supprimé              |

## Tests

### Manquants (gap)

- Test sign/verify HMAC round-trip
- Test 3 modes (all/any/majority) recompute status
- Test fail-soft email
- Test fail-open scheduler gate
- Test TTL token 7j (mock Date)
- Test cascade delete
- Test ownership (approver email match row)
- E2E : create approval → email sent → vote → mission run gated

## Notes & historique

- **Q3 (Q3-D)** — release initiale, multi-acteur + HMAC + page publique
