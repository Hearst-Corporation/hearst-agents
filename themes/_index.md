# Thèmes capturés

Géré par `/heist` (scrape) + `/skin` (intégration admin).

| Slug | Source | Date | Sandbox |
|------|--------|------|---------|
| default | (Hearst OS canonique — `app/globals.css`) | — | — |
| robotflowtemplate-webflow-io | https://robotflowtemplate.webflow.io/home-pages/home-v1 | 2026-05-15 | [sandbox](./robotflowtemplate-webflow-io/sandbox.html) |

## Activer un thème

- **UI** : `/admin/themes` → clic sur la carte (persiste en DB via `/api/user/theme`)
- **Code** : `<html data-theme="<slug>">` ou `applyTheme("<slug>")` depuis `lib/themes`

## Ajouter un thème

```bash
/skin <url>      # scrape + intégration auto à l'admin
# ou
/heist <url>     # scrape uniquement (pas d'ajout admin)
```
