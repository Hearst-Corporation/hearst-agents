# QA — Shell : logo + avatar interactifs — `qa-shell-interactive-elements`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-shell-interactive-elements`                                                              |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — logo "H" + avatar "A" paraissent cliquables mais ne le sont pas, affordance trompeuse |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`, `a11y`                                                       |

## Description

Le rail gauche `aside[aria-label="Navigation principale"]` expose :
- en haut : logo `H` (image `/hearst-h.svg`)
- en bas : avatar `A` (initiale utilisateur)

Tous les deux **paraissent cliquables** (taille bouton, position dans la nav) mais ne le sont pas :
- Logo : wrapper `aria-hidden="true"`, `alt=""`, non cliquable
- Avatar : `<div>` non-interactif

Affordance trompeuse + a11y cassée (pas de retour Accueil, pas de menu profil/signout accessible).

Cette spec couvre aussi le rail droit (state actif aria-current OK pour Zone 2 F-118, donc non régression).

## Findings source

- **F-012** (Zone 1) — avatar "A" non cliquable
- **F-013** (Zone 1) — logo "H" non cliquable
- **F-048** (Zone 1) — logo `aria-hidden=true alt=''`
- **F-049** (Zone 1) — avatar `<div>` non-interactif

## Surface concernée

- [app/(user)/_shell/LeftRail.tsx](<../../app/(user)/_shell/LeftRail.tsx>) — logo + avatar
- [app/(user)/components/UserMenu.tsx](<../../app/(user)/components/UserMenu.tsx>) — menu profil/signout (à créer si absent)
- [app/api/auth/signout](../../app/api/auth/signout) — endpoint signout

## Invariants verrouillés

### I-1. Logo = lien retour Accueil

Le logo `H` **doit** être un `<Link href="/">` ou `<a href="/">` :
- `aria-label="Hearst — Retour à l'accueil"`
- Visible aux lecteurs d'écran (`aria-hidden="false"` ou absent)
- Cliquable (curseur pointer au hover)
- Focus ring visible au keyboard
- Click → navigate `/` (cockpit home)

### I-2. Avatar = bouton menu utilisateur

L'avatar `A` (ou photo profil si disponible) **doit** être un `<button>` qui ouvre un menu :
- `aria-label="Menu utilisateur"`
- `aria-haspopup="menu"`
- `aria-expanded={open}`
- Menu contient : "Profil", "Paramètres", "Déconnexion"

### I-3. Menu signout fonctionnel

Click sur "Déconnexion" :
- POST `/api/auth/signout` (NextAuth)
- Redirect vers `/login` (ou `/` si dev-bypass actif)
- Vide `useSession()` côté client

### I-4. Menu profil

Click sur "Profil" → navigate vers `/settings/profile` ou équivalent (à créer si absent — voir spec settings.md verrouillée).

### I-5. A11y menu

Le menu utilisateur respecte les invariants menu :
- `role="menu"` sur le conteneur
- `role="menuitem"` sur chaque item
- Focus trap pendant l'ouverture
- Escape ferme le menu
- Click outside ferme

### I-6. Pas de wrapper aria-hidden sur des éléments interactifs

Aucun élément interactif (`<button>`, `<a>`, `<input>`) ne doit être enfant d'un wrapper `aria-hidden="true"`. Si le logo doit être visuellement décoratif mais cliquable, il doit être un `<a aria-label="...">` avec l'image en background ou enfant `aria-hidden`.

## Critères d'acceptation testables

1. **Logo cliquable** : `expect(aside > a[aria-label*="Accueil"]).toBeVisible()`.
2. **Logo lien `/`** : `expect(logoLink.href).toBe('http://localhost:4102/')`.
3. **Avatar bouton** : `expect(aside > button[aria-label*="Menu utilisateur"]).toBeVisible()`.
4. **Menu ouvre** : click avatar → `[role="menu"]` visible.
5. **Signout** : click "Déconnexion" → POST signout → redirect.
6. **A11y** : `axe-core` scan → 0 violation sur logo + avatar.

## Évolutions autorisées

- Customisation du menu (ajout d'items : changelog, support, etc.).
- Remplacer initiale par photo profil.
- Animation d'ouverture / fermeture du menu.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| Click avatar = signout direct (sans menu) | UX brutale                        | Confirmation modale via menu |
| Menu sans focus trap                | A11y cassée                             | I-5 trap             |
| Logo cliquable mais pointe vers route morte | 404                            | I-1 + test E2E       |

## Tests à écrire

- E2E : `tests/e2e/shell-logo-link.spec.ts` — click logo → home
- E2E : `tests/e2e/shell-user-menu.spec.ts` — open + items + close
- E2E : `tests/e2e/shell-signout.spec.ts` — click déconnexion → redirect

## Notes & historique

- 2026-05-15 — Bug identifié Zone 1.
- L'avatar est probablement déjà un placeholder en attendant le menu — fix = créer le composant `<UserMenu>` et le câbler.
