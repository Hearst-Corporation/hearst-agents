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

function isProductionEnv(): boolean {
  const env = (process.env.HEARST_ENV ?? process.env.NODE_ENV ?? "").toLowerCase();
  return env === "production" || env === "prod";
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
      "[auth] HEARST_DEV_AUTH_BYPASS=1 detected with NODE_ENV/HEARST_ENV=production. " +
        "Refusing to boot — this flag must NEVER ship to production. " +
        "Unset HEARST_DEV_AUTH_BYPASS or fix the environment."
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
