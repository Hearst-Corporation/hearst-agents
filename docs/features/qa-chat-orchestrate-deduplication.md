# QA — ChatDock : déduplication POST `/api/orchestrate` — `qa-chat-orchestrate-deduplication`

## Métadonnées

| Champ              | Valeur                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| **id**             | `qa-chat-orchestrate-deduplication`                                                 |
| **statut**         | `draft`                                                                             |
| **owner**          | Adrien                                                                              |
| **dernière revue** | 2026-05-15                                                                          |
| **version spec**   | 1.0                                                                                 |
| **niveau**         | **P0** — double facturation Anthropic + UX cassée (réponse Agent dédoublée visible) |
| **priorité**       | `P0`                                                                                |
| **tag**            | `priorité-P0`, `qa-2026-05-15`                                                      |

## Description

Un seul click sur le bouton "Envoyer" du ChatDock déclenche **2 requêtes POST `/api/orchestrate` consécutives** (~3s d'intervalle). Conséquence visible : la réponse Agent rendue dans l'UI contient deux phrasings concaténés (ex: *"Bonjour. Tout fonctionne de mon côté — tu veux attaquer quoi ce matin ? Tout fonctionne de ce côté — tu veux attaquer quoi ?"*).

Risques :
- **Double facturation Anthropic** (chaque POST = 1 cycle modèle complet).
- **Double persistance run** (2 entrées dans la table runs).
- **UX cassée** : l'utilisateur voit une réponse incohérente avec doublon textuel.

## Findings source

- **F-102** (Zone 2) — doublon POST `/api/orchestrate`, requests #66 et #68 dans le network log
- **C-004** (Zone 2) — Chat matrix : observed = 2 POST + réponse dédoublée

## Surface concernée

- [app/(user)/components/ChatDock.tsx](<../../app/(user)/components/ChatDock.tsx>) — bouton "Envoyer", handler submit
- [app/api/orchestrate/route.ts](../../app/api/orchestrate/route.ts) — endpoint POST
- Store chat (`useChatStore` ou équivalent) — gestion du flux d'envoi
- Hooks : `useChatSend`, `useOrchestrate` — possible double déclenchement

## Hypothèses de cause

1. **Double submit handler** : `<form onSubmit>` + `<button onClick>` qui appellent tous les deux la même fonction.
2. **React 19 StrictMode** en dev qui invoque deux fois un effect (mais `StrictMode` ne double pas les event handlers — peu probable).
3. **Race condition** : optimistic UI qui dispatch + serveur qui re-dispatch après ACK.
4. **Réessai automatique** sur 200 silencieux mal interprété.
5. **Submit via `form.requestSubmit()` + bouton click** simultanés.

À investiguer avec breakpoint sur `fetch('/api/orchestrate')` en dev.

## Invariants verrouillés

### I-1. 1 click "Envoyer" = exactement 1 POST `/api/orchestrate`

Pour un même payload utilisateur, exactement une requête POST doit partir. Aucun retry, aucun double dispatch.

### I-2. Bouton "Envoyer" disabled pendant le request en cours

Pendant que la requête est en vol (`status === "sending"` ou équivalent), le bouton **doit** être `disabled={true}` pour empêcher tout re-clic.

### I-3. Form submit + button click dédupliqués

Si le form a `onSubmit` ET le bouton a `onClick`, ils ne doivent **pas** tous les deux appeler la fonction d'envoi. Soit `<button type="submit">` + `<form onSubmit>` uniquement, soit `<button type="button" onClick>` sans `onSubmit` sur le form.

### I-4. Idempotence côté serveur (défense en profondeur)

L'endpoint `/api/orchestrate` **devrait** accepter un header `Idempotency-Key` (UUID généré côté client par envoi) qui permet de dédupliquer côté serveur si le client renvoie par erreur. Optionnel mais recommandé.

### I-5. Réponse rendue = 1 string sans concaténation

L'UI **doit** afficher une seule réponse Agent par envoi utilisateur. Si deux réponses arrivent pour le même message (cas bug), seule la première est conservée et la seconde est ignorée (idempotence côté store).

## Critères d'acceptation testables

1. **Network 1×** : Stage Chat → textarea → input "Bonjour test" → click "Envoyer" → `mcp__playwright__browser_network_requests filter:orchestrate` doit retourner exactement 1 entry.
2. **Bouton disabled pendant envoi** : observer le bouton entre click et réponse → `disabled` attribute présent.
3. **Réponse unique** : assert que `[role="article"][data-role="agent"]` ne contient qu'une seule phrase (pas de doublon textuel).
4. **Stress test** : 10 envois consécutifs → exactement 10 POST, pas 20.
5. **Idempotency-Key (si implémenté)** : header présent dans la requête + serveur retourne `409 Conflict` si même key réenvoyée dans une fenêtre de 30s.

## Évolutions autorisées

- Choix entre submit form ou click bouton, tant qu'un seul des deux trigger l'envoi.
- Ajout d'un toast d'erreur si POST échoue.
- Retry automatique sur erreur réseau (avec back-off et `Idempotency-Key`).
- Streaming SSE ou ReadableStream pour la réponse (orthogonal à la déduplication du POST).

## Risques & modes de défaillance

| Risque                              | Impact                          | Mitigation actuelle |
| ----------------------------------- | ------------------------------- | ------------------- |
| Race condition réessai client       | Double facturation              | `Idempotency-Key` recommandé |
| Bouton non disabled sur stage chat lent | Double clic utilisateur     | I-2 disabled state  |
| Persistance run dédoublée           | Run history pollué              | Dedup côté serveur via key |

## Tests à écrire

- E2E : `tests/e2e/chat-send-single-post.spec.ts` — assert 1 network request par envoi
- Unit : `__tests__/components/ChatDock.test.tsx` — bouton disabled pendant `status === "sending"`
- API : `__tests__/api/orchestrate.test.ts` — idempotency-key dedup

## Notes & historique

- 2026-05-15 — Bug identifié par Zone 2. Reproductible 100% — chaque envoi déclenche 2 POST.
- Symptôme UI immédiatement visible (texte dédoublé) → priorité P0.
