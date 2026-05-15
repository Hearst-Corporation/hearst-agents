# QA — VoiceStage : retirer le placeholder "coming soon" — `qa-voice-stage-placeholder`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-voice-stage-placeholder`                                                                 |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — VoiceStage affiche un texte "coming soon" en prod, casse le pattern shell visionOS data-bound |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`                                                               |

## Description

Le pattern de référence du shell visionOS (cf [project_shell_visionos_12stages_databound.md](../../../.claude/memory/project_shell_visionos_12stages_databound.md)) impose que les 12 stages soient **data-bound**. Le VoiceStage est l'exception : il affiche `"Voice · Mode conversationnel — La conversation vocale en temps réel avec l'agent arrive prochainement. En attendant, utilise le chat texte (⌘2). INACTIF"`.

Conséquence :
- Score data-bound est 11/12 au lieu de 12/12.
- Texte "INACTIF" en mono caps viole la voix éditoriale (CLAUDE.md → "Statuts en voix régulière FR").
- L'utilisateur clic Cmd+7 et tombe sur un "coming soon" → friction.

Deux options :
1. **Implémenter** VoiceStage data-bound (WebRTC session, transcript live, vad / pipeline voice).
2. **Retirer** le stage du registry tant que pas livrable (et libérer Cmd+7 ou le remapper).

## Findings source

- **F-110** (Zone 2) — VoiceStage placeholder
- **S-07** (Zone 2) — matrice stages : Voice = `P1` (data-bound KO)

## Surface concernée

- [app/(user)/_stages/VoiceStage.tsx](<../../app/(user)/_stages/VoiceStage.tsx>) — composant placeholder
- [app/(user)/_stages/registry.ts](<../../app/(user)/_stages/registry.ts>) — entry `voice`
- [stores/stage.ts](../../stores/stage.ts) — `STAGE_HOTKEYS` mapping ⌘7
- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>) — bouton "Voice (⌘7)"
- Spec feature locked : [docs/features/voice.md](voice.md) v1.0 — vérifier alignement

## Invariants verrouillés

### I-1. Pas de placeholder "coming soon" en prod

VoiceStage **ne doit pas** afficher `"INACTIF"` ni `"arrive prochainement"` en production. Soit le stage est data-bound, soit il est retiré.

### I-2. Voix éditoriale FR régulière

Si VoiceStage rend un état (idle, listening, transcribing, error), les labels doivent être en français voix régulière :
- "Inactif" (pas "INACTIF")
- "En écoute…" (pas "LISTENING")
- "Connexion en cours…" (pas "CONNECTING")

### I-3. Si retiré, hotkey libérée ou remappée

Si VoiceStage est retiré, Cmd+7 doit :
- soit être désactivé (presser ⌘7 = no-op silencieux)
- soit remapper vers un autre stage utile (ex: Stage Compare, ou rien)

Le bouton LeftRail "Voice (⌘7)" doit être retiré ou désactivé visuellement.

### I-4. Cohérence avec spec `voice.md`

La spec [voice.md](voice.md) est verrouillée v1.0 et liste des invariants sur la feature voice. Toute évolution du VoiceStage doit respecter cette spec (sauf update validé par Adrien).

### I-5. Empty state explicite si data-bound mais sans session

Si VoiceStage data-bound mais qu'aucune session voice n'est active, l'empty state doit être :
- Titre : "Aucune conversation vocale active"
- CTA : "Démarrer une conversation" (qui lance la session WebRTC)
- Pas de mono caps, pas de "INACTIF"

## Critères d'acceptation testables

1. **Pas de "INACTIF"** : Cmd+7 → assert `not(textContent.includes('INACTIF'))` ni `'coming soon'` ni `'arrive prochainement'`.
2. **Voix régulière** : aucun mono caps tracking dans le DOM du stage (matche regex `[A-Z]{4,}` → 0).
3. **Si retiré** : bouton "Voice (⌘7)" absent du LeftRail OU `disabled={true}` + tooltip explicatif.
4. **Si data-bound** : Stage Voice → bouton "Démarrer" présent + click → état "Connexion en cours…" puis "En écoute…".

## Évolutions autorisées

- Implémentation incrémentale (PoC → MVP → prod) tant que I-1 et I-2 tiennent à chaque étape.
- Choix du provider voice (OpenAI Realtime, ElevenLabs Conversational, Whisper, etc.).
- Customisation du transcript live et des actions post-conversation.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Implémentation longue              | Stage reste placeholder                 | Retirer temporairement |
| WebRTC fragile sur certains navigateurs | Conversation impossible                | Fallback texte chat ⌘2 |
| Coût provider voice élevé          | Budget surprise                         | Gate feature derrière flag |

## Tests à écrire

- E2E : `tests/e2e/voice-stage-no-placeholder.spec.ts` — assert pas de texte placeholder
- E2E (si data-bound) : `tests/e2e/voice-stage-session.spec.ts` — démarrer + transcrire
- Unit : `__tests__/voice/voice-stage.test.tsx`

## Notes & historique

- 2026-05-15 — Bug identifié Zone 2. 11/12 stages data-bound, VoiceStage est l'exception.
- Décision pratique recommandée : **retirer temporairement** le stage du registry tant que pas data-bound. Cmd+7 désactivé. Bouton LeftRail caché. Réintroduire quand provider voice choisi et intégré.
