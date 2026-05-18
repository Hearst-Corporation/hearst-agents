/**
 * types.ts — Types publics du shell Cockpit.
 *
 * Le shell est *agnostique* du catalogue produit du hub : chaque app passe
 * sa propre liste via la prop `products`. Le shell n'impose qu'une forme
 * minimale (id + name + color + short) — tout le reste reste interne à l'app.
 */

import type { ReactNode } from "react";
import type { ChatConfig } from "../chat/types";

/** Props du CenterPanel — render-prop pour embed produit (hub uniquement). */
export interface CenterPanelProps {
  children: ReactNode;
  renderProduct?: (activeId: string) => ReactNode;
}

/**
 * Forme minimale d'un produit attendue par le shell.
 * Les apps peuvent étendre ce type pour leurs besoins internes : on ne
 * lit que ces champs ici.
 */
export interface CockpitProduct {
  /** Identifiant stable ; "hub" est conventionnellement le produit hôte. */
  id: string;
  /** Nom commercial complet (tooltip rail, bottom bar). */
  name: string;
  /** Sigle 2 lettres (pastille du rail). */
  short: string;
  /** Accent d'identité (hex). */
  color: string;
}

/**
 * Props du `<CockpitShell>` — point d'entrée unique de tous les apps Hearst.
 */
export interface CockpitShellProps {
  children: ReactNode;
  /**
   * Liste des produits affichés dans le lanceur du rail gauche.
   * L'élément avec `id === appId` est traité comme produit hôte : son
   * entrée n'apparaît pas dans le lanceur du rail gauche.
   */
  products: CockpitProduct[];
  /** Id de l'app courante (= produit hôte). */
  appId: string;
  /** Config du chat — endpoint, persistance, contexte produit. */
  chatConfig?: ChatConfig;
  /**
   * Render-prop optionnel : invoqué dans le CenterPanel quand un autre produit
   * que l'app hôte est actif. Utilisé exclusivement par le hub pour embedder
   * les 12 produits en `<webview>` Electron. Les apps produit standalone
   * laissent cette prop vide.
   */
  renderActiveProduct?: (activeId: string) => ReactNode;
  /**
   * Contenu contextuel injecté dans la bottom bar, à côté du label produit.
   * Permet à chaque app de passer sa propre navigation par page (ex. CanvasBottomBar).
   */
  bottomBar?: ReactNode;
}
