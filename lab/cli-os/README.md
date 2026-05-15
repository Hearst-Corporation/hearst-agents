# CLI OS Lab

Sandbox visuelle pour prototyper la navigation Hearst OS façon « AI Command Line to Dashboard »
(réf Dribbble George Railean, shot 26648227).

**Aucun héritage** de tokens, polices, styles ou primitives de l'app principale.
Stack 100 % isolée : Vite + React 19 + Tailwind v4 + Framer Motion + TypeScript.

## Lancer

```bash
cd lab/cli-os
pnpm install
pnpm dev
```

URL : <http://localhost:5173>

## Convention

- `src/lib/navigation-truth.ts` — source unique de vérité, alimentée par l'agent Explore.
  Décrit la navigation cœur de Hearst (Stages, sessions, missions, hotkeys, verbes Commandeur)
  sans jamais importer de code de l'app principale.
- `src/styles.css` — tokens FROM SCRATCH, vide au départ. Tu remplis quand tu valides une
  couleur, un radius, une typographie.
- `src/App.tsx` — point d'entrée. Démarre avec un input centré sur fond noir, c'est tout.
- Les composants finalisés se portent ensuite vers `app/(user)/components/cli-os/` côté
  Hearst lors de l'intégration.

## Règles

- Pas de DS Hearst. Pas de lint visuel. Pas d'AGENT-LOCK. Zone libre.
- Si la nav réelle évolue côté Hearst, relancer un agent Explore pour régénérer
  `navigation-truth.ts`.
