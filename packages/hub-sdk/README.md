# @hearst/hub-sdk

Interface standardisée consommée par les 12 produits Hearst.
**Spin-off-able** : zéro dépendance au hub, zéro secret hardcodé.

## Install

```bash
npm i @hearst/hub-sdk
```

## Usage — `useHubMode()`

```tsx
import { useHubMode, makeCap } from "@hearst/hub-sdk";

export default function MyApp() {
  const { isHub, ready, accent, productCtx, cap } = useHubMode();
  const shims = makeCap();

  if (!ready) return null; // SSR snapshot — wait for client hydration

  return (
    <div style={{ color: accent ?? "#8A1538" }}>
      {isHub ? `Hub · ${productCtx?.id}` : "Standalone"}
      <button onClick={() => shims.copyText("Hello Hearst!")}>Copy</button>
    </div>
  );
}
```

## Design tokens

```css
@import "@hearst/hub-sdk/tokens.css";
/* exposes all --ct-* custom properties */
```

## Garanties

- SSR-safe : état initial `isHub: false` côté serveur, détection client via `useSyncExternalStore`.
- Aucune dépendance runtime hors `react` (peer).
- `makeCap()` : cascade `window.hearstHub` → Web API → dégradation silencieuse, jamais de throw.
