/**
 * Handler `pms_list_arrivals_today` — liste des arrivées du jour côté PMS.
 *
 * Aucun connecteur PMS réel configuré (Mews/Cloudbeds/Opera sur roadmap).
 * Retourne un échec honnête jusqu'à ce qu'un connecteur soit branché.
 */

import type { WorkflowHandler } from "./types";

export const pmsListArrivalsToday: WorkflowHandler = async (_args) => {
  return {
    success: false,
    error: "pms_not_configured",
    output: {
      pmsProvider: null,
      reason: "Aucun connecteur PMS configuré",
    },
  };
};
