# Prompt Batch C — Vérification finale + P0-11 Architecture

Tu es un développeur front-end senior sur Helm (Hearst OS). Next.js 16, Tailwind v4, React 19, Zustand 5.

RÈGLES STRICTES :
- NE JAMAIS modifier les dossiers *-safe/ ni docs/spatial/_BACKUP_*
- Vérifier docs/AGENT-LOCK.json avant chaque édit (locked doit être false)
- Commits en français : test: validation build + e2e, refactor(layout): RSC wrapper client
- Après chaque étape : pnpm typecheck && pnpm lint

---

## ÉTAPE C1 — Build production

Commande : pnpm build

À vérifier :
- Succès sans erreur
- Pas de warning critique (tree-shaking, chunks trop gros)
- Le output .next/ est généré correctement

Si erreur :
- Corriger immédiatement avant de continuer
- Les erreurs les plus probables : import manquant après refactor, type inconnu

---

## ÉTAPE C2 — Tests unitaires

Commande : pnpm test

À vérifier :
- Tous les tests passent
- Si un test échoue à cause du guard anti-double dans stage.ts (batch 1), mettre à jour le test
- Si un test échoue à cause de la prop inDrawer dans RightRailChat, mettre à jour le test

---

## ÉTAPE C3 — Tests E2E

Commande : pnpm test:e2e

À vérifier :
- happy-path.spec.ts passe
- auth/*.spec.ts passent
- Pas de régression sur la navigation rail → stage → page

Si le serveur dev n'est pas démarré :
- pnpm dev & (en background)
- sleep 5
- pnpm test:e2e

---

## ÉTAPE C4 — Tests visuels

Commande : pnpm test:visual

À vérifier :
- 0 diff non attendu sur les screenshots de référence
- Si des diffs sont attendus (nouveau FAB, nouveau drawer, nouveaux headers), les approuver

---

## ÉTAPE C5 — A11Y audit avec axe

Outil : axe DevTools (extension Chrome)

Pages à auditer :
- / (cockpit)
- /reports
- /settings
- / (mobile < 1280px avec drawer chat ouvert)

Critères :
- 0 violation critique
- 0 violation sérieuse
- Score Lighthouse a11y ≥ 90 sur chaque page

---

## ÉTAPE C6 — P0-11 : layout racine RSC + wrapper client

Fichiers concernés : app/(user)/layout.tsx, nouveau fichier à créer

CONTEXTE :
Le layout racine app/(user)/layout.tsx est "use client". Toute la branche user est hydratée côté client. Pas de Server Components possibles.

SOLUTION :
1. Créer `app/(user)/components/ClientProviders.tsx` ("use client")
   - Contient : SessionProvider, CockpitShell, Commandeur, VoiceMount, FocusBadge, MobileBottomNav, FocusModeStyles, useGlobalHotkeys
   - Reçoit children en prop

2. Transformer `app/(user)/layout.tsx` en RSC (supprimer "use client")
   - Importe ClientProviders
   - Rend `<ClientProviders>{children}</ClientProviders>`
   - Le reste du fichier (HELM_PRODUCTS, etc.) reste inchangé

3. Vérifier que tous les imports client-only sont dans ClientProviders
   - next-auth/react → SessionProvider
   - @hearst/cockpit-shell → CockpitShell
   - @/app/hooks/use-global-hotkeys → hook
   - @/stores/* → hooks Zustand

ATTENTION :
- C'est un changement architectural. Tout ce qui était importé dans le layout doit être soit dans ClientProviders, soit déplacé dans un fichier RSC séparé.
- Les pages qui étaient des Server Components (ex: app/(user)/page.tsx avec async function) doivent rester des RSC. Vérifier qu'elles ne sont pas cassées.
- CockpitXClient est "use client" et est importé par page.tsx — ça doit rester inchangé.

---

## RAPPORT À RENDRE

```
## Résumé — Batch C : Vérification finale + Architecture

### Étape C1 — Build
- [ ] pnpm build : [✅/❌]
- [ ] Erreurs : [liste ou "aucune"]
- [ ] Warnings critiques : [liste ou "aucune"]

### Étape C2 — Tests unitaires
- [ ] pnpm test : [✅/❌]
- [ ] Tests failed : [liste ou "aucun"]

### Étape C3 — Tests E2E
- [ ] pnpm test:e2e : [✅/❌]
- [ ] Specs failed : [liste ou "aucun"]

### Étape C4 — Tests visuels
- [ ] pnpm test:visual : [✅/❌]
- [ ] Diffs attendus approuvés : [liste]
- [ ] Diffs inattendus : [liste ou "aucun"]

### Étape C5 — A11Y audit
- [ ] axe DevTools / : [score]/100, [N] violations
- [ ] axe DevTools /reports : [score]/100, [N] violations
- [ ] axe DevTools /settings : [score]/100, [N] violations
- [ ] axe DevTools / (mobile drawer) : [score]/100, [N] violations

### Étape C6 — P0-11 Architecture (optionnel)
- [ ] ClientProviders.tsx créé
- [ ] layout.tsx transformé en RSC
- [ ] Pages RSC intactes (page.tsx, cockpit-x/page.tsx, etc.)
- [ ] pnpm typecheck : [✅/❌]
- [ ] pnpm build : [✅/❌]

### Problèmes rencontrés
[Décrire ici]
```

APPLIQUE DANS L'ORDRE C1→C6. C6 EST OPTIONNELLE — ne la faire que si C1-C5 passent toutes.
