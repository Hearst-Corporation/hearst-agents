/**
 * /runs — alias historique de /run (Stage Mission).
 *
 * Anciennement une copie du cockpit ; désormais une simple redirection
 * permanente vers /run pour garantir une source de vérité unique (pas de
 * divergence de comportement entre les deux routes). Les liens/habitudes
 * pointant vers le pluriel restent fonctionnels.
 */

import { redirect } from "next/navigation";

export default function RunsPage() {
  redirect("/run");
}
