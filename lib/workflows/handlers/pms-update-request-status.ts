/**
 * Handler `pms_update_request_status` — update du statut d'une service request.
 *
 * Aucun connecteur PMS réel configuré (Mews/Cloudbeds/Opera sur roadmap).
 * Valide le requestId, puis retourne un échec honnête jusqu'à ce qu'un
 * connecteur soit branché.
 */

import type { WorkflowHandler } from "./types";

export const pmsUpdateRequestStatus: WorkflowHandler = async (args) => {
  const requestId = typeof args.requestId === "string" ? args.requestId : "";

  if (!requestId) {
    return {
      success: false,
      error: "pms_update_request_status: requestId manquant",
    };
  }

  return {
    success: false,
    error: "pms_not_configured",
    output: {
      pmsProvider: null,
      requestId,
      reason: "Aucun connecteur PMS configuré",
    },
  };
};
