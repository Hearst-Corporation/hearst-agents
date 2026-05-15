/**
 * Platform Auth — Dev Bypass Guard
 *
 * `HEARST_DEV_AUTH_BYPASS=1` ouvre `/api/auth/dev-login` et désactive le check
 * de permissions admin. C'est un raccourci dev/Electron — JAMAIS en prod.
 *
 * Hard-fail au boot si la combinaison NODE_ENV=production + bypass=1 est
 * détectée : on préfère un crash explicite à un déploiement silencieusement
 * ouvert. Le throw remonte jusqu'au runtime Next, qui refuse de démarrer.
 */

const BYPASS_FLAG = "1";

function readBypassRaw(): string | undefined {
  return process.env.HEARST_DEV_AUTH_BYPASS;
}

// F-053 : OR logic — si l'un des 3 vecteurs indique prod, c'est prod.
// L'ancienne logique (HEARST_ENV ?? NODE_ENV) permettait à HEARST_ENV=staging
// de masquer NODE_ENV=production et de contourner le guard.
function isProductionEnv(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  const hearstEnv = (process.env.HEARST_ENV ?? "").toLowerCase();
  if (hearstEnv === "production" || hearstEnv === "prod") return true;
  return false;
}

let asserted = false;

/**
 * Throw si HEARST_DEV_AUTH_BYPASS=1 est positionné en prod.
 * Idempotent — peut être appelé plusieurs fois, n'évalue qu'une fois.
 */
export function assertDevBypassNotInProduction(): void {
  if (asserted) return;
  asserted = true;
  if (readBypassRaw() === BYPASS_FLAG && isProductionEnv()) {
    throw new Error(
      "[auth] HEARST_DEV_AUTH_BYPASS=1 detected in a production environment " +
        "(NODE_ENV, VERCEL_ENV, or HEARST_ENV indicates production). " +
        "Refusing to boot — this flag must NEVER ship to production. " +
        "Unset HEARST_DEV_AUTH_BYPASS or fix the environment.",
    );
  }
}

/**
 * `true` si le bypass dev est actif. Toujours `false` en prod (le hard-fail
 * ci-dessus garantit qu'on n'arrive pas ici avec bypass=1 + prod).
 */
export function isDevBypassEnabled(): boolean {
  assertDevBypassNotInProduction();
  return readBypassRaw() === BYPASS_FLAG && !isProductionEnv();
}

// Side-effect : assert dès l'import. Si ce module est chargé en prod avec
// le bypass actif, le runtime explose avant qu'aucune requête ne soit servie.
assertDevBypassNotInProduction();
