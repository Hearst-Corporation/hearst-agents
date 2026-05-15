# QA — Auth : validation E2E sans dev-bypass — `qa-auth-bypass-validation`

## Métadonnées

| Champ              | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **id**             | `qa-auth-bypass-validation`                                                                  |
| **statut**         | `draft`                                                                                      |
| **owner**          | Adrien                                                                                       |
| **dernière revue** | 2026-05-15                                                                                   |
| **version spec**   | 1.0                                                                                          |
| **niveau**         | **P1** — impossibilité de valider le flow non-loggé + signout en prod tant que dev-bypass actif |
| **priorité**       | `P1`                                                                                         |
| **tag**            | `priorité-P1`, `qa-2026-05-15`, `sécurité`                                                   |

## Description

`HEARST_DEV_AUTH_BYPASS=1` rend impossible la validation E2E des comportements auth en prod :
- GET `/` sans session devrait redirect vers `/login` (testé impossible avec bypass)
- POST `/api/auth/signout` devrait invalider la session et forcer un redirect browser-side
- GET `/api/v2/*` sans session devrait retourner 401

Cette spec ne change pas le flow auth existant (cf [auth.md](auth.md) v1.0 verrouillée — invariants I-1 à I-10), mais ajoute :
1. Un mécanisme de test E2E sans bypass (toggle env var via test setup, ou flag URL).
2. Un guard explicite que signout côté client force un redirect propre.

## Findings source

- **F-001** (Zone 1) — `/login` redirect immédiat dev-bypass, pas testable sans bypass
- **F-005** (Zone 1) — GET `/` sans session retourne home (avec bypass), à valider sans
- **F-044** (Zone 1) — POST signout : session vide mais APIs cockpit/connections/theme retournent 200
- **F-037** (Zone 1) — `/admin` accès sans rôle non testable
- **F-038** (Zone 1) — `/login` reste affiché brièvement même si loggé

## Surface concernée

- [lib/platform/auth/options.ts](../../lib/platform/auth/options.ts) — config NextAuth
- [app/(user)/layout.tsx](<../../app/(user)/layout.tsx>) — guard session côté shell
- [app/api/auth/[...nextauth]/route.ts](../../app/api/auth/[...nextauth]/route.ts) — handler
- [app/login/page.tsx](../../app/login/page.tsx) — page login
- Spec verrouillée : [auth.md](auth.md) v1.0 — respect des invariants

## Invariants verrouillés

### I-1. Test E2E sans bypass possible

Le test suite Playwright **doit** pouvoir simuler un environnement sans dev-bypass :
- soit via override env var pour un sous-test (`process.env.HEARST_DEV_AUTH_BYPASS = "0"` dans `beforeEach`)
- soit via un flag URL (ex: `?nobypass=1`) qui désactive le bypass pour cette session

Le mécanisme choisi ne doit pas affecter la sécurité prod (le flag URL ne doit pas être actif si bypass désactivé dans l'env).

### I-2. Redirect `/` → `/login` quand non-loggé

Sans bypass, GET `/` sans cookie session **doit** retourner :
- HTTP 307 redirect vers `/login`
- OU rendu côté client qui détecte `status === "unauthenticated"` et appelle `router.push('/login')`

L'invariant I-1 de [auth.md](auth.md) (UUID strict) reste respecté.

### I-3. APIs `/api/v2/*` retournent 401 sans session

Sans bypass, toute route `/api/v2/*` sans cookie session **doit** retourner 401.

Cette invariant est déjà couverte par `requireScope()` (I-5 de auth.md). Cette spec QA ne fait que vérifier qu'il n'y a pas de regression.

### I-4. Signout côté client force redirect

POST `/api/auth/signout` côté serveur invalide la session (déjà OK). Le client **doit** ensuite :
- détecter `useSession().status === "unauthenticated"`
- forcer `router.push('/login')` automatiquement (via `useEffect` global dans le layout)

Sinon l'utilisateur reste sur la home avec une session vide et des erreurs 401 silencieuses.

### I-5. Page login : redirect immédiat si loggé

Si `useSession().status === "authenticated"` au mount de `/login`, redirect immédiat vers `/` (sans afficher la page login intermédiaire).

### I-6. Dev-bypass logué en boot

Au boot serveur, si `HEARST_DEV_AUTH_BYPASS=1`, log un warning explicite côté serveur :
> `[auth] DEV BYPASS ACTIVE — toutes les sessions sont fakes. Ne JAMAIS activer en prod.`

Voire un banner UI sur toutes les pages (déjà recommandé par F-001 implicitement).

## Critères d'acceptation testables

1. **Toggle E2E bypass** : `playwright.use({ env: { HEARST_DEV_AUTH_BYPASS: '0' } })` (ou équivalent setup) → re-jouer F-001, F-005, F-037, F-044.
2. **Redirect `/` non-loggé** : sans bypass, navigate `/` → URL devient `/login`.
3. **401 APIs** : sans bypass, `curl /api/v2/cockpit/today` → 401.
4. **Signout redirect** : POST signout + assert browser URL devient `/login` dans les 2s.
5. **Login si loggé redirect** : avec session, navigate `/login` → redirect `/` immédiat.
6. **Banner dev** (optionnel) : avec bypass, un banner DEV visible en haut de toutes les pages.

## Évolutions autorisées

- Choix du mécanisme de test sans bypass.
- Customisation du redirect post-signout (vers `/login`, `/`, ou un page custom).
- Ajout d'un banner UI permanent quand bypass actif.

## Risques & modes de défaillance

| Risque                              | Impact                                  | Mitigation actuelle |
| ----------------------------------- | --------------------------------------- | ------------------- |
| `HEARST_DEV_AUTH_BYPASS=1` fuite en prod | Bypass total auth                  | Guard 403 dans dev-login (auth.md I-2) |
| Signout pas suivi de redirect       | User confus, APIs 401 silencieuses     | I-4 client force redirect |
| Test E2E sans bypass mal isolé      | Pollution autres tests                  | Setup/teardown propre |

## Tests à écrire

- E2E : `tests/e2e/auth-no-bypass.spec.ts` — setup sans bypass + 4 tests F-001/005/037/044
- E2E : `tests/e2e/signout-redirect.spec.ts` — signout → redirect
- Unit : `__tests__/auth/dev-bypass-warning.test.ts` — log warning au boot

## Notes & historique

- 2026-05-15 — Tests F-001, F-005, F-037, F-044 marqués "Tests bloqués" en QA Zone 1 à cause du bypass actif.
- Cette spec ne contredit pas [auth.md](auth.md) v1.0 — elle complète les invariants en couvrant la dimension "validation E2E sans bypass".
- Respect strict des invariants auth.md I-1 à I-10 (UUID strict, dev-bypass guard 403, etc.).
