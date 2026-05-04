---
description: Briefing protocole Agent Driven Dev avant de bosser sur une feature
argument-hint: [feature-id?]
---

# Protocole Agent Driven Dev — briefing

Tu vas travailler sur une feature de Hearst OS. **Lis ce qui suit AVANT toute autre action.**

## 1. Vérifie le verrou agent (étape 0, obligatoire)

!cat docs/AGENT-LOCK.json

Si `locked: true` ci-dessus :
- **Refuse** toute écriture (Edit, Write, NotebookEdit) et action destructive (`rm`, `git commit`, `git push`, `mv`, drop DB, etc.)
- Informe l'utilisateur, cite la `reason` si présente
- Indique-lui qu'il doit déverrouiller depuis `/admin/agent-driven-dev`
- Lecture (Read, Grep, Glob, Bash en lecture pure) → autorisée

Si `locked: false` → continue.

## 2. Lis le rapport maître

@docs/AGENT-DRIVEN-DEV.md

Identifie :
- Quelles features sont **verrouillées** (statut `verrouillé v<n>`)
- Quel niveau (P0 = critique, P1 = important, P2 = standard)
- Qui possède quels invariants

## 3. Si la feature est verrouillée → lis sa spec

Argument : **$ARGUMENTS**

Si `$ARGUMENTS` est non vide, ouvre `docs/features/$ARGUMENTS.md` :

@docs/features/$ARGUMENTS.md

Concentre-toi sur :
- **Surface publique** (composants, endpoints API, stores) — ce que tu peux toucher
- **Invariants verrouillés** — ce que tu **ne peux pas** modifier sans update spec
- **Évolutions autorisées** — ce que tu peux changer librement
- **Tests existants** — ce qui couvre déjà
- **Code orphelin** — ce qui est code-ready mais non câblé

## 4. Règle absolue

Si ton changement contredit un invariant :
- **STOP**. Ne code pas.
- Propose à Adrien un update de spec (incrémenter `version spec`, mettre à jour `dernière revue`)
- Attends sa validation explicite avant de coder
- Une fois validé : modifie la spec, puis le code, puis ajoute l'entrée dans `docs/rules/locked-zones.md` si nouvelle règle, puis régénère le manifest avec `npm run features:manifest`

## 5. Si la feature n'est pas encore verrouillée

Mode autonomie standard CLAUDE.md. Tu décides, tu codes, tu commits, tu signales.

## 6. Quand tu finis

- Mets à jour `dernière revue` dans `docs/features/<id>.md` si tu as touché à des fichiers de la feature
- Régénère le manifest si tu as modifié une spec : `npm run features:manifest`
- Le tableau de bord `/admin/agent-driven-dev` se met à jour tout seul

---

**Récapitule à Adrien en 3 lignes** :
1. Statut du verrou (libre / verrouillé)
2. Statut de la feature ciblée (verrouillée v<n> ou autonomie)
3. Quels invariants tu vas devoir respecter (si applicable)

Puis attends son OK pour commencer.
