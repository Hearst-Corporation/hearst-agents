# Prompt Batch B — Stages StageLayout + Polish

Tu es un développeur front-end senior sur Helm (Hearst OS). Next.js 16, Tailwind v4, React 19, Zustand 5. Tokens CSS uniquement, zéro px magique.

RÈGLES STRICTES :
- NE JAMAIS modifier les dossiers *-safe/ ni docs/spatial/_BACKUP_*
- Vérifier docs/AGENT-LOCK.json avant chaque édit (locked doit être false)
- Commits en français : fix(stages): migrer ChatStage vers StageLayout, etc.
- Après chaque étape : pnpm typecheck && pnpm lint

---

## ÉTAPE B1 — ChatStage.tsx : migrer vers StageLayout

Fichier : app/(user)/_stages/ChatStage.tsx

Actuellement : pas de StageLayout, pas d'header standardisé. Contenu démarre directement avec les bulles.

À faire :
- Wrapper le contenu dans `<StageLayout eyebrow="Chat" title="Conversation" subtitle="Parle avec Kimi">`
- OU si le design du chat ne doit pas avoir de header (intention design), documenter avec un commentaire `// lint-visual-disable-file` en haut du fichier
- Vérifier que le contenu du chat (messages, input) s'affiche correctement dans le StageLayout
- Le StageLayout ajoute un header + padding — s'assurer que le chat garde son aspect conversationnel

---

## ÉTAPE B2 — MissionStage.tsx : migrer vers StageLayout

Fichier : app/(user)/_stages/MissionStage.tsx

Actuellement : MissionHeader custom inline (lignes 275-308) avec t-30, t-13, t-14.

À faire :
- Supprimer MissionHeader custom
- Wrapper dans `<StageLayout eyebrow="Demande active" title={missionName} subtitle={statusLabel}>`
- Le badge statut doit être rendu via le composant `Action` (variant secondary, tone brand/neutral/danger selon le statut)
- S'assurer que les actions (Approuver, Relire, Annuler) restent accessibles dans le StageLayout

---

## ÉTAPE B3 — MeetingStage.tsx : migrer vers StageLayout

Fichier : app/(user)/_stages/MeetingStage.tsx

Actuellement : Header inline (lignes 436-471) avec badge live custom.

À faire :
- Supprimer le header custom
- Wrapper dans `<StageLayout eyebrow="Recall.ai · N segments" title={meetingId || "Réunion"} subtitle={status}>`
- Le badge "Live" doit être rendu via `Action` (variant primary, tone danger, size sm)
- S'assurer que le transcript et les action items restent fonctionnels

---

## ÉTAPE B4 — AssetCompareStage.tsx : migrer vers StageLayout

Fichier : app/(user)/_stages/AssetCompareStage.tsx

Actuellement : Header minimaliste inline (lignes 459-467) avec t-20 + t-13.

À faire :
- Supprimer le header custom
- Wrapper dans `<StageLayout eyebrow="Comparaison" title="Comparer" subtitle="Côte à côte">`
- S'assurer que les deux viewers d'assets restent côte à côte dans le StageLayout

---

## ÉTAPE B5 — VoiceStage.tsx : ajouter EmptyState

Fichier : app/(user)/_stages/VoiceStage.tsx

Actuellement : placeholder statique "non disponible". Pas d'EmptyState, pas de StageErrorBanner.

À faire :
- Importer `EmptyState` depuis `app/(user)/components/ui`
- Remplacer le placeholder par `<EmptyState title="Voice bientôt disponible" description="L'interface vocale est en cours de développement." icon={<MicrophoneIcon />} />`
- Créer un MicrophoneIcon inline ou utiliser un emoji/icon existant
- Le stage utilise déjà StageLayout — s'assurer que EmptyState est rendu DANS le StageLayout

---

## ÉTAPE B6 — SimulationStage.tsx : ajouter StageErrorBanner + EmptyState

Fichier : app/(user)/_stages/SimulationStage.tsx

Actuellement : pas de StageErrorBanner, pas d'EmptyState. Erreurs via toast.error() uniquement.

À faire :
- Importer `StageErrorBanner` et `EmptyState`
- En cas d'erreur API : afficher `StageErrorBanner` en haut du contenu
- Quand aucun scénario n'est lancé : afficher `EmptyState` avec CTA "Lancer un scénario"
- Garder le formulaire idle comme fallback

---

## ÉTAPE B7 — AssetCompareStage : ajouter StageErrorBanner

Fichier : app/(user)/_stages/AssetCompareStage.tsx

Actuellement : erreurs affichées en texte brut "Asset introuvable" (ligne 157).

À faire :
- Importer `StageErrorBanner`
- Remplacer le texte brut par `<StageErrorBanner message="Asset introuvable" />`
- S'applique aux erreurs asset A et asset B

---

## RAPPORT À RENDRE

```
## Résumé — Batch B : Stages StageLayout + Polish

### Étape B1 — ChatStage
- [ ] Migré vers StageLayout (ou documenté comme exception)
- [ ] Header cohérent ou commentaire explicatif

### Étape B2 — MissionStage
- [ ] MissionHeader custom supprimé
- [ ] StageLayout avec eyebrow/title/subtitle
- [ ] Badge statut via composant Action

### Étape B3 — MeetingStage
- [ ] Header custom supprimé
- [ ] StageLayout avec eyebrow/title/subtitle
- [ ] Badge Live via Action

### Étape B4 — AssetCompareStage
- [ ] Header custom supprimé
- [ ] StageLayout avec eyebrow/title/subtitle
- [ ] Viewers côte à côte conservés

### Étape B5 — VoiceStage
- [ ] EmptyState ajouté
- [ ] Placeholder statique remplacé

### Étape B6 — SimulationStage
- [ ] StageErrorBanner ajouté
- [ ] EmptyState pour "aucun scénario"

### Étape B7 — AssetCompareStage error
- [ ] StageErrorBanner pour erreurs asset A/B
- [ ] Texte brut remplacé

### Validation
- pnpm typecheck : [✅/❌]
- pnpm lint : [✅/❌]
- Test visuel : tous les stages avec header cohérent
- Test visuel : VoiceStage affiche EmptyState
- Test visuel : SimulationStage affiche error banner si erreur

### Problèmes rencontrés
[Décrire ici]
```

APPLIQUE DANS L'ORDRE B1→B7. NE SAUTE AUCUNE ÉTAPE.
