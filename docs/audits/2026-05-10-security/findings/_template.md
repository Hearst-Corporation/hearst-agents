# [F-XXX] — Title

> **Source de vérité** : `docs/audits/2026-05-10-security/findings.json` entry `F-XXX`.
> Ce doc trace le **cycle de vie complet** d'un fix : spec → impl → test → re-audit → validation → close.

---

## 1. Spec (immutable)

- **ID** : `F-XXX`
- **Severity** : `P0` / `P1` / `P2`
- **Category** : `auth | rls | idor | ssrf | prompt_injection | tool_execution | code_execution | secrets | reliability | observability | csrf | xss | rate_limit | ci_build | deps | perf`
- **Confidence** : `max | high | medium | low`
- **Convergence** : `convergent | exclusive_claude | exclusive_codex | divergent`
- **Sources** : Claude Opus 4.7, Codex (externe)

### Evidence (file:line)

- `path/to/file.ts:42`
- `path/to/other.ts:100-120`

### Attack scenario

(Verbatim depuis findings.json — quel attaquant, quelles capacités, quel impact concret)

### Production impact

(Conséquence business/technique si exploité ou survient)

### Fix minimal

(1 phrase concise — ce qui doit changer)

### Fix idéal

(Architecture cible long terme)

---

## 2. Plan d'implémentation

**Décidé le** : YYYY-MM-DD
**Implementer** : claude-opus-4.7 (cette session) | autre
**Effort estimé** : X min / X h / X j

### Approche choisie

Décris l'approche : minimal ou idéal ? Pourquoi ?

### Fichiers à toucher

- [ ] `path/to/file1.ts` — quoi changer
- [ ] `path/to/file2.ts` — quoi changer

### Tests à ajouter / modifier

- [ ] `__tests__/...` — quel cas couvrir
- [ ] `e2e/...` — si nécessaire

### Dépendances / ordre

- Bloque ou est bloqué par : F-YYY, F-ZZZ
- À faire avant ou après ?

---

## 3. Implémentation

**Démarré** : YYYY-MM-DD HH:MM
**Terminé** : YYYY-MM-DD HH:MM
**Commit SHA** : `xxxxxxx`

### Diff résumé

```diff
- old code
+ new code
```

### Notes d'implémentation

(Décisions prises pendant l'implémentation, écarts par rapport au plan, surprises rencontrées)

---

## 4. Tests

**Lancé** : YYYY-MM-DD HH:MM

### Tests automatiques

```bash
# Commandes lancées
npm run typecheck
npm run lint
npm run test
```

**Résultat** : ✅ passing / ❌ failing — détails

### Tests manuels (si UI ou flow)

- [ ] Scénario 1 : ...
- [ ] Scénario 2 : ...

### Régression check

- [ ] Aucune feature liée cassée (vérifier `route-mapper` output)

---

## 5. Re-audit (par modèle différent)

> **Règle stricte** : Le modèle qui a implémenté ne re-audite PAS son fix.

**Re-audited by** : codex | claude-fresh-session
**Re-audited on** : YYYY-MM-DD
**Re-audit output** : `reaudits/F-XXX-<model>.md`

### Verdict re-audit

- [ ] ✅ Vulnérabilité neutralisée — passer à validation
- [ ] ⚠ Partiellement fixé — re-open avec sub-finding
- [ ] ❌ Toujours exploitable — re-implementing

### Détails du re-audit

(Synthèse de ce que le re-audit a vérifié et ses conclusions)

---

## 6. Validation finale

**Lancée** : YYYY-MM-DD

### Validation technique

```bash
npm run validate  # typecheck + lint + test
```

- [ ] `validator` agent verdict : ✅ no blockers / ❌ blockers found

### Validation fonctionnelle

- [ ] Screenshot si UI : `validation/F-XXX-screenshot.png`
- [ ] Smoke test manuel : flow OK

### Cleanup

- [ ] `knip` — aucun dead code introduit
- [ ] `madge --circular` — aucune circular dep
- [ ] Aucun TODO/FIXME laissé dans le code touché
- [ ] Pas de console.log oublié

---

## 7. Close

**Closed** : YYYY-MM-DD
**Status final** : `validated` → `closed`
**Closé par** : claude-opus-4.7 orchestrator

### Résumé

(2-3 phrases : ce qui a été fait, l'impact mesuré, ce qui a éventuellement été reporté en follow-up)

### Follow-ups éventuels

- [ ] F-YYY : nouveau finding découvert pendant le fix
- [ ] Refactor architectural reporté (fix idéal pas appliqué — pourquoi)

### Lien commit / PR

- Commit : `xxxxxxx`
- PR (si applicable) : #NNN
