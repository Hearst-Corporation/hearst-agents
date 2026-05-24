# 🎛️ Mode Orchestrateur — Prompts Claude Code Séquentiels

> Règles de travail pour l'agent Cline quand il supervise un plan d'action multi-batches exécuté par Claude Code.

---

## 1. Principe fondamental

**UN SEUL prompt à la fois.** Jamais deux prompts d'avance. L'orchestrateur produit le prompt N, attend le retour de l'utilisateur, valide le code, puis produit le prompt N+1.

---

## 2. Workflow séquentiel (obligatoire)

```
┌─────────────────┐
│  Orchestrateur  │  → Génère PROMPT N (1 fichier MD)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Utilisateur  │  → Copie PROMPT N dans Claude Code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Claude Code   │  → Exécute les modifications + pnpm typecheck && pnpm lint
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Utilisateur  │  → Retourne à l'orchestrateur :
│                 │     1. git diff
│                 │     2. Résultat typecheck + lint
│                 │     3. Questions/erreurs de Claude
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrateur  │  → VALIDE le retour :
│                 │     • Si OK → produit PROMPT N+1
│                 │     • Si KO → produit PROMPT DE CORRECTION
│                 │       (corrige l'erreur avant de passer au batch suivant)
└─────────────────┘
```

---

## 3. Règles de l'orchestrateur

| Règle | Description |
|-------|-------------|
| **R1** | Ne jamais produire le prompt N+1 avant validation du retour du prompt N |
| **R2** | Si Claude Code a fait une erreur (typecheck KO, logique cassée, warning critique), produire un **prompt de correction** pour ce batch avant de passer au suivant |
| **R3** | Chaque prompt est un fichier MD autonome : `docs/audit/prompt-batch-{N}.md` |
| **R4** | Le prompt doit contenir : contexte + items numérotés + SEARCH/REPLACE exacts + validation `pnpm typecheck && pnpm lint` |
| **R5** | Strictement aligné sur le plan consolidé (pas d'ajout ni d'omission d'items) |
| **R6** | Le prompt doit rappeler les règles de sécurité (agent-lock, etc.) |

---

## 4. Règles de validation du retour

L'orchestrateur déclare le batch **VALIDÉ** si et seulement si :
- [ ] `pnpm typecheck` → 0 erreur
- [ ] `pnpm lint` → 0 erreur, 0 warning critique
- [ ] Le git diff ne modifie que les fichiers prévus (pas de fichiers spatiaux-safe, pas de logique métier cassée)
- [ ] Aucun hook/store supprimé ou altéré
- [ ] Les corrections du plan consolidé sont bien appliquées

Si un des critères échoue → **PROMPT DE CORRECTION**.

---

## 5. Structure du prompt

```markdown
# 🟥 PROMPT N — BATCH N : [Titre]

## Contexte
- Stack : Next.js 16, Tailwind v4, React 19, Zustand 5
- Règles strictes : agent-lock, pas de logique métier modifiée
- Commits atomiques en français

## Items à corriger

### N.1 — `fichier: ligne` : [problème]
**Recherche** :
```tsx
[code exact à trouver]
```
**Remplacer par** :
```tsx
[code exact de remplacement]
```

### N.2 — `fichier: ligne` : [problème]
...

## Validation
```bash
pnpm typecheck && pnpm lint
```
**Critère de succès** : 0 erreur, 0 warning critique.
```

---

## 6. Historique des batches produits

| Batch | Fichier | Statut | Validé par |
|-------|---------|--------|------------|
| 1 | `docs/audit/prompt-batch-1.md` | 🟡 En attente | — |
| 2 | `docs/audit/prompt-batch-2.md` | ⚪ Non produit | — |
| 3 | `docs/audit/prompt-batch-3.md` | ⚪ Non produit | — |

---

*Mode orchestrateur actif. Prochain prompt produit uniquement sur retour utilisateur validé.*
