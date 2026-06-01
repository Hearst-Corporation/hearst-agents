/**
 * Tenant resolution — frontière fédération Hive → Helm.
 *
 * POURQUOI : Hive forwarde `x-hive-tenant-id` qui peut être un SLUG humain
 * ("adrien") pour l'UX. Or les colonnes Helm (settings, permissions, logs) sont
 * typées `uuid` → pousser un slug y déclenche `invalid input syntax for type
 * uuid: "adrien"`. Ce module résout tout identifiant tenant entrant en **UUID
 * canonique** côté Helm, de façon déterministe et stable.
 *
 * ⚠️ Ne concerne QUE le tenant DB (`scope.tenantId`). L'entity Composio reste
 * `hive:<valeur brute forwardée>` (slug) — c'est l'identifiant externe sous
 * lequel les connexions OAuth de l'utilisateur ont été créées dans Composio ;
 * il ne doit JAMAIS être remplacé par cet UUID. Distinction stricte :
 *   - tenant DB UUID  → DB / settings / permissions / logs Helm
 *   - entity Composio → `hive:<slug>` (connexions tierces)
 *   - tenant Cortex   → l'UUID canonique est aliasé côté Cortex
 *     (CORTEX_TENANT_ALIASES: d10c9c22 → "adrien"), donc envoyer l'UUID marche.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/**
 * Map slug → UUID lue depuis `HIVE_TENANT_UUID_ALIASES` (JSON env), ex :
 *   {"adrien":"d10c9c22-2432-4daa-b4f2-ab849a87dfae"}
 * Permet d'onboarder de nouveaux tenants Hive sans code (config only).
 * Absente / invalide → {} (on retombe sur le fallback service-token).
 */
function envAliasMap(): Record<string, string> {
  const raw = process.env.HIVE_TENANT_UUID_ALIASES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* JSON invalide → map vide, fallback */
  }
  return {};
}

export type TenantSource = "header-uuid" | "alias-map" | "service-token-fallback";

export interface ResolvedImpersonationTenant {
  /** UUID canonique pour DB / settings / permissions / logs Helm. */
  tenantUuid: string;
  /** D'où vient l'UUID (audit / debug). */
  source: TenantSource;
}

/**
 * Résout le tenant forwardé par Hive en UUID canonique Helm.
 *
 * Ordre de résolution :
 *   1. `forwarded` est déjà un UUID  → passthrough (lowercased).
 *   2. `forwarded` est un slug présent dans la map d'alias env → UUID mappé.
 *   3. sinon → `serviceTokenTenant` (tenant `api_keys.tenant_id` du service
 *      token, déjà un UUID Helm valide + canonique pour le tenant courant).
 *
 * @param forwarded valeur brute de `x-hive-tenant-id` (slug ou UUID)
 * @param serviceTokenTenant tenant UUID du service token (fallback canonique)
 * @param map override de la map d'alias (tests) — défaut : env
 */
export function resolveImpersonationTenant(
  forwarded: string,
  serviceTokenTenant: string,
  map: Record<string, string> = envAliasMap(),
): ResolvedImpersonationTenant {
  const raw = forwarded.trim();

  if (isUuid(raw)) {
    return { tenantUuid: raw.toLowerCase(), source: "header-uuid" };
  }

  const mapped = map[raw];
  if (typeof mapped === "string" && isUuid(mapped)) {
    return { tenantUuid: mapped.toLowerCase(), source: "alias-map" };
  }

  return { tenantUuid: serviceTokenTenant, source: "service-token-fallback" };
}
