/**
 * Contract test — `requireScope()` et `resolveScope()` surface publique.
 *
 * `requireScope` est le god node #1 du repo (229 edges, ~quasi toutes les
 * routes API sensibles passent par lui). Ce fichier PIN sa surface publique
 * et ses invariants comportementaux pour détecter toute mutation involontaire
 * de signature ou sémantique.
 *
 * Ce n'est PAS un test fonctionnel exhaustif — pour ça, voir
 * `scope.test.ts` et `scope-multi-tenant.test.ts`. Ce fichier-ci se limite
 * à pin :
 *   - la signature TypeScript (compile-time)
 *   - le shape exact de `CanonicalScope`
 *   - les branches de retour (succès / erreur)
 *   - les codes/messages d'erreur (status 401, "not_authenticated")
 *   - les options reconnues (`requireTenant`, `requireWorkspace`, `context`)
 *   - le flag `isDevFallback` (vrai en dev sans session.tenantId)
 *
 * Si un de ces tests casse, c'est qu'on a touché la surface publique de
 * `requireScope` — décision consciente requise (avec mise à jour des
 * ~90+ call sites côté routes API).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserId = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/auth/get-user-id", () => ({
  getUserId: mockGetUserId,
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/platform/auth/options", () => ({
  authOptions: {},
}));

const VALID_UUID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WORKSPACE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ENV_BACKUP_TENANT = process.env.HEARST_TENANT_ID;
const ENV_BACKUP_WORKSPACE = process.env.HEARST_WORKSPACE_ID;

function makeSession(tenantId?: string, workspaceId?: string) {
  return {
    user: {
      id: VALID_UUID,
      // Email synthétique — pas de PII réelle dans les fixtures de test.
      email: "test-user@example.test",
      tenantId,
      workspaceId,
    },
    tenantId,
    workspaceId,
    expires: "2099-01-01",
  };
}

describe("requireScope — contract (surface publique pinned)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetUserId.mockReset();
    mockGetServerSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ENV_BACKUP_TENANT === undefined) delete process.env.HEARST_TENANT_ID;
    else process.env.HEARST_TENANT_ID = ENV_BACKUP_TENANT;
    if (ENV_BACKUP_WORKSPACE === undefined) delete process.env.HEARST_WORKSPACE_ID;
    else process.env.HEARST_WORKSPACE_ID = ENV_BACKUP_WORKSPACE;
  });

  // -------------------------------------------------------------------------
  // 1) Exports pinned — si un de ces noms disparaît ou change, on s'en aperçoit.
  // -------------------------------------------------------------------------
  describe("exports publics", () => {
    it("exporte `requireScope` comme fonction async", async () => {
      const mod = await import("@/lib/platform/auth/scope");
      expect(typeof mod.requireScope).toBe("function");
      // Une fonction async retourne une Promise quand appelée. On le vérifie
      // sans avoir besoin de mocker le succès (mockGetUserId non set → null).
      mockGetUserId.mockResolvedValueOnce(null);
      mockGetServerSession.mockResolvedValueOnce(null);
      const result = mod.requireScope();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it("exporte `resolveScope` comme fonction async", async () => {
      const mod = await import("@/lib/platform/auth/scope");
      expect(typeof mod.resolveScope).toBe("function");
      mockGetUserId.mockResolvedValueOnce(null);
      mockGetServerSession.mockResolvedValueOnce(null);
      const result = mod.resolveScope();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it("`requireScope` accepte zéro argument (options optionnelles)", async () => {
      mockGetUserId.mockResolvedValueOnce(null);
      mockGetServerSession.mockResolvedValueOnce(null);
      const { requireScope } = await import("@/lib/platform/auth/scope");
      // Si la signature change pour rendre options obligatoire, ce code ne
      // compilerait plus (TypeScript) et casserait les 90+ call sites.
      await expect(requireScope()).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 2) Shape du retour succès — `{ scope: CanonicalScope, error: null }`
  //    avec userId/tenantId/workspaceId/isDevFallback.
  // -------------------------------------------------------------------------
  describe("shape du retour succès (CanonicalScope)", () => {
    it("retourne { scope, error: null } avec les 4 clés canoniques + provenance littérale", async () => {
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      // Forme du wrapper
      expect(result).toHaveProperty("scope");
      expect(result).toHaveProperty("error");
      expect(result.error).toBeNull();
      expect(result.scope).not.toBeNull();

      // Forme du payload — PIN les 4 clés EXACTES de `CanonicalScope`.
      // Si quelqu'un ajoute / retire / renomme une clé, ce test pète.
      expect(Object.keys(result.scope ?? {}).sort()).toEqual(
        ["isDevFallback", "tenantId", "userId", "workspaceId"].sort(),
      );

      // PIN : provenance LITTÉRALE — les valeurs renvoyées viennent bien des
      // sources mockées (getUserId pour userId, session pour tenant/workspace).
      // Sans ces asserts, un swap de clés ou un hardcode dans `resolveScope`
      // passerait sous le radar du contract test (faux pass identifié au review).
      expect(result.scope?.userId).toBe(VALID_UUID);
      expect(result.scope?.tenantId).toBe(TENANT_ID);
      expect(result.scope?.workspaceId).toBe(WORKSPACE_ID);
      expect(result.scope?.isDevFallback).toBe(false);
    });

    it("types primitifs : userId/tenantId/workspaceId sont strings, isDevFallback est boolean", async () => {
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      expect(typeof result.scope?.userId).toBe("string");
      expect(typeof result.scope?.tenantId).toBe("string");
      expect(typeof result.scope?.workspaceId).toBe("string");
      expect(typeof result.scope?.isDevFallback).toBe("boolean");
    });

    it("`resolveScope` retourne directement `CanonicalScope | null` (pas de wrapper error)", async () => {
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      expect(scope).not.toBeNull();
      // PIN : pas de propriété `error` côté `resolveScope` — c'est
      // exclusivement le rôle de `requireScope` d'ajouter ce wrapper.
      expect(scope).not.toHaveProperty("error");
      expect(scope).toHaveProperty("userId");
      expect(scope).toHaveProperty("tenantId");
      expect(scope).toHaveProperty("workspaceId");
      expect(scope).toHaveProperty("isDevFallback");
    });

    it("valeurs scope viennent de la session, pas hardcodées (anti-faux-pass)", async () => {
      // PIN explicite : si quelqu'un hardcode `userId: "deadbeef"` ou swap
      // les clés tenantId/workspaceId dans `resolveScope`, ce test pète.
      // On utilise des UUIDs uniques DIFFÉRENTS des constantes par défaut
      // pour éliminer toute coïncidence — la seule façon d'avoir ces valeurs
      // dans le scope retourné est que `resolveScope` les a effectivement
      // lues depuis `getUserId()` et `getServerSession()`.
      const UNIQUE_USER = "11111111-2222-3333-4444-555555555555";
      const UNIQUE_TENANT = "99999999-8888-7777-6666-555555555555";
      const UNIQUE_WORKSPACE = "abababab-cdcd-efef-1010-202020202020";

      mockGetUserId.mockResolvedValue(UNIQUE_USER);
      mockGetServerSession.mockResolvedValue({
        user: {
          id: UNIQUE_USER,
          email: "test-user@example.test",
          tenantId: UNIQUE_TENANT,
          workspaceId: UNIQUE_WORKSPACE,
        },
        tenantId: UNIQUE_TENANT,
        workspaceId: UNIQUE_WORKSPACE,
        expires: "2099-01-01",
      });

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      // Provenance : chaque champ vient bien de sa source mockée.
      expect(scope?.userId).toBe(UNIQUE_USER);
      expect(scope?.tenantId).toBe(UNIQUE_TENANT);
      expect(scope?.workspaceId).toBe(UNIQUE_WORKSPACE);
      // Et surtout : les champs ne sont PAS croisés (anti-swap-de-clé).
      expect(scope?.userId).not.toBe(UNIQUE_TENANT);
      expect(scope?.userId).not.toBe(UNIQUE_WORKSPACE);
      expect(scope?.tenantId).not.toBe(UNIQUE_USER);
      expect(scope?.tenantId).not.toBe(UNIQUE_WORKSPACE);
      expect(scope?.workspaceId).not.toBe(UNIQUE_USER);
      expect(scope?.workspaceId).not.toBe(UNIQUE_TENANT);
    });
  });

  // -------------------------------------------------------------------------
  // 3) Branche d'erreur auth — 401 "not_authenticated".
  //    Si on change le status code ou le message, des dizaines de tests API
  //    en aval cassent. On PIN explicitement les deux valeurs.
  // -------------------------------------------------------------------------
  describe("auth fail — contract error 401 / not_authenticated", () => {
    it("retourne `{ scope: null, error: { status, message } }` si getUserId() null", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      expect(result.scope).toBeNull();
      expect(result.error).not.toBeNull();
    });

    it("PIN : error.status === 401 (changement = breaking pour toutes les routes API)", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      expect(result.error?.status).toBe(401);
    });

    it('PIN : error.message === "not_authenticated" (string littéral)', async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      expect(result.error?.message).toBe("not_authenticated");
    });

    it("PIN : shape de l'erreur — exactement { message, status }, rien de plus", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ context: "contract-test" });

      expect(result.error).not.toBeNull();
      expect(Object.keys(result.error ?? {}).sort()).toEqual(["message", "status"].sort());
    });

    it("`resolveScope` retourne null (pas d'objet erreur) si auth fail", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      // PIN : `resolveScope` retourne null en cas d'échec, pas une exception.
      // Les routes qui appellent `resolveScope` directement comptent là-dessus.
      expect(scope).toBeNull();
    });

    it("ne throw JAMAIS sur auth fail — toujours un retour structuré", async () => {
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope, resolveScope } = await import("@/lib/platform/auth/scope");

      // PIN : pas de throw — les routes API ne wrappent PAS d'appel dans
      // try/catch. Si on change ça, le comportement runtime se dégrade
      // silencieusement (500 au lieu de 401).
      //
      // ATTENTION : `resolves.toBeDefined()` n'est PAS suffisant pour prouver
      // "ne throw pas". Une fonction qui throw fait rejeter la Promise (ce qui
      // fait casser l'assertion), mais si elle retourne `null` ou `undefined`
      // de manière silencieuse, on ne distingue pas non plus le throw.
      // On utilise donc un try/catch explicite avec un boolean `didThrow`
      // pour assertir LITTÉRALEMENT que la fonction n'a pas levé d'exception,
      // indépendamment de la valeur retournée (null OU scope OK).
      let requireDidThrow = false;
      let requireResult: unknown = "<unset>";
      try {
        requireResult = await requireScope({ context: "contract-test" });
      } catch (_err) {
        requireDidThrow = true;
      }
      expect(requireDidThrow).toBe(false);
      // Le retour de requireScope est TOUJOURS un objet wrapper (jamais null)
      // mais on n'asserte pas le shape ici — c'est le job des autres tests.
      // Ce qu'on prouve ici : pas de throw + valeur définie.
      expect(requireResult).not.toBe("<unset>");

      let resolveDidThrow = false;
      let resolveResult: unknown = "<unset>";
      try {
        resolveResult = await resolveScope({ context: "contract-test" });
      } catch (_err) {
        resolveDidThrow = true;
      }
      expect(resolveDidThrow).toBe(false);
      // resolveScope peut retourner null OU un scope — les deux sont OK ici.
      // Ce qui compte : pas de throw, ET pas de retour `<unset>` (preuve que
      // l'`await` a bien complété sans rejection).
      expect(resolveResult).not.toBe("<unset>");
    });
  });

  // -------------------------------------------------------------------------
  // 4) Option `requireTenant` — si manquant ET requireTenant=true → null.
  //    PIN les noms exacts des options et leur sémantique.
  // -------------------------------------------------------------------------
  describe("options.requireTenant / options.requireWorkspace", () => {
    it("`requireTenant: true` + session sans tenantId en dev → resolveScope null", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ requireTenant: true, context: "contract-test" });

      // PIN : avec `requireTenant: true`, le dev fallback (DEV_TENANT_ID
      // constant) est désactivé — la fonction refuse de servir un scope
      // synthétique. C'est utilisé par les routes qui MANIPULENT des données
      // tenant-scoped (jamais de fallback).
      expect(scope).toBeNull();
    });

    it("`requireTenant: true` + session sans tenantId via requireScope → error 401", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { requireScope } = await import("@/lib/platform/auth/scope");
      const result = await requireScope({ requireTenant: true, context: "contract-test" });

      expect(result.scope).toBeNull();
      expect(result.error?.status).toBe(401);
      expect(result.error?.message).toBe("not_authenticated");
    });

    it("`requireWorkspace: true` + session sans workspaceId en dev → null", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      // tenantId présent, workspaceId absent
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ requireWorkspace: true, context: "contract-test" });

      expect(scope).toBeNull();
    });

    it("sans `requireTenant` (défaut) : dev fallback actif, scope retourné avec isDevFallback=true", async () => {
      vi.stubEnv("NODE_ENV", "development");
      // S'assurer qu'aucune env legacy ne pollue : on veut tester que les
      // constantes DEV_TENANT_ID / DEV_WORKSPACE_ID prennent la main.
      delete process.env.HEARST_TENANT_ID;
      delete process.env.HEARST_WORKSPACE_ID;
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      expect(scope).not.toBeNull();
      // PIN : sans options, on tombe sur les constantes DEV_TENANT_ID /
      // DEV_WORKSPACE_ID. Si ces valeurs littérales changent, les tests
      // d'intégration qui filtrent sur "dev-tenant" cassent.
      expect(scope?.tenantId).toBe("dev-tenant");
      expect(scope?.workspaceId).toBe("dev-workspace");
      expect(scope?.isDevFallback).toBe(true);
    });

    it("prod + `requireTenant: true` + tenantId présent → succès (cas nominal)", async () => {
      // PIN la branche prod nominale (pas le fail-closed). Avant ce test,
      // seul "prod + session sans tenantId" était couvert — la branche prod
      // happy path n'était pas pinned, donc une régression silencieuse
      // (ex : prod retournant null malgré tenantId présent) passait inaperçue.
      vi.stubEnv("NODE_ENV", "production");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ requireTenant: true, context: "contract-test" });

      expect(scope).not.toBeNull();
      expect(scope?.userId).toBe(VALID_UUID);
      expect(scope?.tenantId).toBe(TENANT_ID);
      expect(scope?.workspaceId).toBe(WORKSPACE_ID);
      // En prod avec session complète : pas de fallback dev.
      expect(scope?.isDevFallback).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4bis) Combo `requireTenant + requireWorkspace = true` simultanés.
  //       Cas utilisé par les routes API qui ont besoin des deux scopes
  //       (cf. `lib/integrations/catalog.ts`). Pas couvert avant.
  // -------------------------------------------------------------------------
  describe("options combo — requireTenant + requireWorkspace simultanés", () => {
    it("les deux à true + tenant + workspace présents → scope OK", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({
        requireTenant: true,
        requireWorkspace: true,
        context: "contract-test",
      });

      expect(scope).not.toBeNull();
      expect(scope?.userId).toBe(VALID_UUID);
      expect(scope?.tenantId).toBe(TENANT_ID);
      expect(scope?.workspaceId).toBe(WORKSPACE_ID);
      expect(scope?.isDevFallback).toBe(false);
    });

    it("les deux à true + tenant manquant (workspace présent) → null", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, WORKSPACE_ID));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({
        requireTenant: true,
        requireWorkspace: true,
        context: "contract-test",
      });

      // PIN : un seul des deux requires échoue → toute la résolution échoue.
      // Pas de scope partiel retourné.
      expect(scope).toBeNull();
    });

    it("les deux à true + workspace manquant (tenant présent) → null", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({
        requireTenant: true,
        requireWorkspace: true,
        context: "contract-test",
      });

      expect(scope).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5) Dev fallback bruyant — invariant explicite du fichier source
  //    ("Dev fallback explicite et bruyant — jamais silencieux").
  //    On PIN qu'un console.warn est émis ET que isDevFallback === true.
  // -------------------------------------------------------------------------
  describe("dev fallback — bruyant + flag explicite", () => {
    it("`isDevFallback === true` quand session.tenantId absent et NODE_ENV !== production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      expect(scope?.isDevFallback).toBe(true);
    });

    it("`isDevFallback === false` quand session.tenantId présent (cas nominal)", async () => {
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      // PIN : pas de fallback quand la session a tout ce qu'il faut.
      expect(scope?.isDevFallback).toBe(false);
    });

    it("dev fallback émet un console.warn (bruyant, pas silencieux)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      await resolveScope({ context: "contract-test" });

      // PIN : au moins un warn doit être émis quand on tombe en fallback.
      // C'est l'invariant "jamais silencieux" du JSDoc en tête de fichier.
      expect(warnSpy).toHaveBeenCalled();
      const warnCall = warnSpy.mock.calls.find((call) =>
        String(call[0] ?? "").includes("DEV fallback"),
      );
      expect(warnCall).toBeDefined();

      warnSpy.mockRestore();
    });

    it("en production, session sans tenantId → fail-closed (pas de fallback bruyant, null)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(undefined, undefined));

      const { resolveScope } = await import("@/lib/platform/auth/scope");
      const scope = await resolveScope({ context: "contract-test" });

      // PIN : prod = fail-closed strict, jamais de fallback dev.
      expect(scope).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6) Wrapper — `requireScope` délègue à `resolveScope`.
  //    Si quelqu'un déconnecte le wrapper (ex : réimplémente requireScope
  //    sans appeler resolveScope), les tests indépendants des deux fonctions
  //    ne le détectent pas. On PIN ici l'invariant de délégation via
  //    l'observation des side-effects (appels aux dépendances communes) et
  //    de la valeur retournée.
  // -------------------------------------------------------------------------
  describe("wrapper — requireScope délègue à resolveScope", () => {
    it("requireScope renvoie exactement la valeur que resolveScope produirait (success path)", async () => {
      // Valeurs uniques pour pin la délégation (pas de coïncidence possible
      // avec les constantes par défaut).
      const WRAPPER_USER = "cccccccc-1111-2222-3333-444444444444";
      const WRAPPER_TENANT = "dddddddd-5555-6666-7777-888888888888";
      const WRAPPER_WORKSPACE = "eeeeeeee-9999-aaaa-bbbb-cccccccccccc";

      mockGetUserId.mockResolvedValue(WRAPPER_USER);
      mockGetServerSession.mockResolvedValue({
        user: {
          id: WRAPPER_USER,
          email: "test-user@example.test",
          tenantId: WRAPPER_TENANT,
          workspaceId: WRAPPER_WORKSPACE,
        },
        tenantId: WRAPPER_TENANT,
        workspaceId: WRAPPER_WORKSPACE,
        expires: "2099-01-01",
      });

      const { requireScope, resolveScope } = await import("@/lib/platform/auth/scope");

      // 1) Snapshot de ce que resolveScope produit pour ces mocks.
      const directScope = await resolveScope({ context: "contract-wrapper" });

      // 2) Appel wrapper avec les MÊMES mocks. Il doit produire le même payload.
      const wrapped = await requireScope({ context: "contract-wrapper" });

      // PIN : requireScope renvoie bien `{ scope, error: null }` avec un scope
      // équivalent (mêmes valeurs) à celui retourné par resolveScope.
      // Si quelqu'un déconnecte le wrapper (retourne un scope hardcodé,
      // saute le dev fallback, etc.), cet égalité-valeur saute.
      expect(wrapped.error).toBeNull();
      expect(wrapped.scope).toEqual(directScope);

      // PIN — invariant de non-mémoïsation des dépendances :
      // chaque appel (resolveScope direct + requireScope) doit re-invoquer
      // les dépendances getUserId et getServerSession. Si quelqu'un
      // mémoïsait l'une de ces fonctions (cache d'execution dans scope.ts,
      // singleton sneaky, etc.), le 2e appel ne re-toucherait pas les mocks
      // et `wrapped.scope` divergerait subtilement de `directScope` au
      // moindre changement de mock résolu (par ex. mockResolvedValueOnce).
      // En asserrant `toHaveBeenCalledTimes(2)` (1× resolveScope + 1× requireScope),
      // on garantit que chaque appel touche LE chemin live des dépendances.
      expect(mockGetUserId).toHaveBeenCalledTimes(2);
      expect(mockGetServerSession).toHaveBeenCalledTimes(2);
    });

    it("requireScope renvoie l'erreur 401 quand resolveScope aurait retourné null (delegation fail path)", async () => {
      // Auth fail → resolveScope renvoie null → requireScope DOIT mapper
      // ce null vers l'erreur 401 structurée. Vérifie que le wrapper
      // observe bien le retour null de resolveScope (sinon il renverrait
      // un scope hardcodé).
      mockGetUserId.mockResolvedValue(null);
      mockGetServerSession.mockResolvedValue(null);

      const { requireScope, resolveScope } = await import("@/lib/platform/auth/scope");

      const directScope = await resolveScope({ context: "contract-wrapper" });
      expect(directScope).toBeNull();

      const wrapped = await requireScope({ context: "contract-wrapper" });

      // PIN : null de resolveScope → 401 not_authenticated côté wrapper.
      expect(wrapped.scope).toBeNull();
      expect(wrapped.error).toEqual({ message: "not_authenticated", status: 401 });
    });

    it("requireScope consomme les mêmes dépendances que resolveScope (mocks getUserId / getServerSession)", async () => {
      // Le wrapper ne doit pas court-circuiter les dépendances. S'il appelle
      // une autre source (ex : lit process.env directement), getUserId
      // ne serait pas invoqué. On vérifie ici que requireScope déclenche
      // bien les appels mockés — preuve qu'il passe par resolveScope.
      mockGetUserId.mockResolvedValue(VALID_UUID);
      mockGetServerSession.mockResolvedValue(makeSession(TENANT_ID, WORKSPACE_ID));

      const { requireScope } = await import("@/lib/platform/auth/scope");
      await requireScope({ context: "contract-wrapper" });

      // PIN : getUserId et getServerSession ont bien été appelés par
      // requireScope (via resolveScope). Si le wrapper est déconnecté,
      // ces compteurs restent à 0.
      expect(mockGetUserId).toHaveBeenCalledTimes(1);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });
  });
});
