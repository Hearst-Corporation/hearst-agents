/**
 * Constantes de sécurité partagées.
 * Source de vérité unique — évite la duplication entre approvals, signed-url et monthly-card-token.
 */

/** Longueur minimale (en caractères) des secrets HMAC utilisés pour la signature de tokens. */
export const SECRET_MIN_LENGTH = 32;
