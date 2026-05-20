/**
 * /catalog — placeholder route.
 *
 * Le segment "Catalog" du <HubBottomBar /> du package @hearst/cockpit-shell
 * navigue vers `/catalog` via `window.location.href` hardcodé. Helm n'a pas
 * de concept Catalog propre (héritage de la nav du Hub agrégateur). On
 * redirige vers la home Cockpit Helm pour éviter le 404.
 *
 * À retirer si une vraie page Catalog Helm est créée plus tard, ou si le
 * package upstream rend les segments du HubBottomBar configurables (cf.
 * piste PR upstream : prop `segments` ou variant `hideCatalog`).
 */

import { redirect } from "next/navigation";

export default function CatalogPage(): never {
  redirect("/");
}
