"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/app/hooks/use-toast";
import { useOAuthCompletionPoll } from "@/app/hooks/use-oauth-completion-poll";
import { invalidateOAuthExpiryCache } from "@/app/hooks/use-oauth-expiry";
import { openOAuthPopup } from "@/lib/oauth/popup";
import { useOAuthStore } from "@/stores/oauth";
import {
  INTENT_KEYWORDS,
  STATUS_RANK,
  SUGGESTION_PICKS,
  WALLPAPER_PAGE,
  categoryLabel,
  categoryLabelById,
  type ComposioApp,
  type ConnectedAccount,
  type DiscoveredTool,
  type DrawerState,
} from "./types";

// ============================================================================
//  useConnectionsHub — orchestration complète du hub.
//
//  Le hook encapsule TOUT le pilotage métier :
//   - state local (accounts, apps, drawer, search, filters)
//   - fetch initial (`refreshAccounts` + `loadApps`)
//   - dedup Composio/native (I-16 : Composio override le native en UI)
//   - OAuth flow handler avec popup synchrone (I-17 : `window.open()` doit
//     rester dans le handler du click utilisateur, sinon popup-blocker)
//   - postMessage listener + polling popup close + completion poll
//   - dérivés mémoïsés (suggestions, categories, wallpaper, search results)
//
//  Le composant `ConnectionsHub` se contente de consommer la sortie et
//  câbler les sous-composants `Header / Stage / Wallpaper / AppDrawer`.
// ============================================================================
export function useConnectionsHub() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [apps, setApps] = useState<ComposioApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => searchParams.get("category"),
  );
  const [wallpaperLimit, setWallpaperLimit] = useState(WALLPAPER_PAGE);
  // Filtre "attentions" — quand actif, le wallpaper ne montre que les
  // services en pending/error/expired. Activé par click sur le badge ⚠ N
  // du header, désactivable par re-click ou bouton "réinitialiser".
  const [attentionFilter, setAttentionFilter] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerActions, setDrawerActions] = useState<DiscoveredTool[] | null>(null);
  const [drawerLoadingActions, setDrawerLoadingActions] = useState(false);

  const refreshAccounts = useCallback(async () => {
    // Fusion de 2 sources de connexions :
    // 1) Composio (OAuth via popup) — l'historique du composant
    // 2) Native (SSO Google/Microsoft initial) — Gmail/Cal/Drive sont déjà
    //    accessibles à l'agent dès le login, pas besoin de redemander
    //    OAuth Composio (qui se prendrait un access_denied par Google).
    // Si une app apparaît dans les deux, le composio gagne (cas où l'user
    // a explicitement re-OAuth via Composio par-dessus le SSO).
    try {
      const [composioRes, nativeRes] = await Promise.all([
        fetch("/api/composio/connections", { credentials: "include" }),
        fetch("/api/connections/native", { credentials: "include" }).catch(
          () => null,
        ),
      ]);

      if (composioRes.status === 503) {
        const data = (await composioRes.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setEnabled(false);
        setSdkError(data.message ?? "Composio not configured");
        return;
      }
      if (!composioRes.ok) {
        const data = (await composioRes.json().catch(() => ({}))) as { error?: string };
        setSdkError(data.error ?? `HTTP ${composioRes.status}`);
        return;
      }
      setSdkError(null);

      const composioData = (await composioRes.json()) as {
        connections?: ConnectedAccount[];
      };
      const composioConns: ConnectedAccount[] = (composioData.connections ?? []).map(
        (c) => ({ ...c, source: "composio" }),
      );

      let nativeConns: ConnectedAccount[] = [];
      if (nativeRes && nativeRes.ok) {
        const nativeData = (await nativeRes.json()) as {
          connections?: ConnectedAccount[];
        };
        nativeConns = nativeData.connections ?? [];
      }

      // Dédup : si un slug existe en composio ET en native, on garde le
      // composio (qui prouve un OAuth explicite, plus "fort"). Le natif est
      // un fallback automatique du SSO. (cf invariant I-16)
      const composioSlugs = new Set(
        composioConns.map((c) => c.appName.toLowerCase()),
      );
      const filteredNative = nativeConns.filter(
        (n) => !composioSlugs.has(n.appName.toLowerCase()),
      );
      setAccounts([...composioConns, ...filteredNative]);
    } catch (err) {
      console.error("[Composio] failed to load connections", err);
      setSdkError(err instanceof Error ? err.message : "network_error");
    }
  }, []);

  const loadApps = useCallback(async () => {
    try {
      const res = await fetch("/api/composio/apps", { credentials: "include" });
      if (res.status === 503) return;
      if (!res.ok) return;
      const data = (await res.json()) as { apps?: ComposioApp[] };
      // Filtre source : on n'affiche que les toolkits qui ont une auth-config
      // côté Composio (managed ou custom). Les ~910 non-connectables sont
      // masqués pour ne pas frustrer l'utilisateur avec des NO_INTEGRATION.
      // Le code de différenciation visuelle (LockBadge, NotConnectableFooter)
      // reste en place comme safety net si le flag bouge en runtime.
      const all = data.apps ?? [];
      const connectableOnly = all.filter((a) => a.connectable !== false);
      setApps(connectableOnly);
    } catch (err) {
      console.error("[Composio] failed to load apps catalog", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void Promise.all([refreshAccounts(), loadApps()]).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshAccounts, loadApps]);

  const connectedSlugs = useMemo(
    () => new Set(accounts.map((a) => a.appName.toLowerCase())),
    [accounts],
  );

  // slug → meilleur statut parmi toutes les connexions du service.
  // Un service avec 2 ACTIVE + 1 EXPIRED reste "active".
  const statusBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) {
      const slug = acc.appName.toLowerCase();
      const s = acc.status.toLowerCase();
      const existing = map.get(slug);
      const rank = STATUS_RANK[s] ?? 9;
      const existingRank = existing ? (STATUS_RANK[existing] ?? 9) : 9;
      if (rank < existingRank) map.set(slug, s);
    }
    return map;
  }, [accounts]);

  const connectedApps = useMemo(
    () => apps.filter((a) => connectedSlugs.has(a.key)),
    [apps, connectedSlugs],
  );

  // Compté par SERVICE unique (pas par connexion) — un service avec 2 ACTIVE
  // + 1 EXPIRED ne compte pas comme attention puisque le meilleur statut
  // est ACTIVE.
  const stats = useMemo(() => {
    const attentions = Array.from(statusBySlug.values()).filter(
      (s) => s !== "active",
    ).length;
    return {
      connectedCount: connectedApps.length,
      catalogCount: apps.length,
      attentions,
    };
  }, [statusBySlug, apps, connectedApps]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    // Match classique fuzzy nom/key/description.
    const fuzzy = apps.filter(
      (a) =>
        a.key.includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );

    // Match intent : la query contient-elle un mot-clé d'une famille ?
    // Si oui, on remonte les slugs de cette famille EN TÊTE — sauf ceux
    // déjà dans fuzzy (pour éviter les doublons).
    const intentSlugs = new Set<string>();
    for (const intent of INTENT_KEYWORDS) {
      if (intent.keywords.some((kw) => q.includes(kw))) {
        for (const s of intent.slugs) intentSlugs.add(s);
      }
    }
    const fuzzyKeys = new Set(fuzzy.map((a) => a.key));
    const intentMatches = Array.from(intentSlugs)
      .map((slug) => apps.find((a) => a.key === slug))
      .filter((a): a is ComposioApp => {
        if (!a) return false;
        return !fuzzyKeys.has(a.key);
      });

    return [...intentMatches, ...fuzzy];
  }, [apps, searchQuery]);

  // Suggestions = picks par défaut filtrés des déjà-connectés. Toujours 3.
  // Si la liste éditoriale est épuisée (rare — 12 picks + ~5 connectés
  // typiques ⇒ jamais), on complète avec des apps non-connectées du
  // catalogue, hint = leur catégorie en lower-case.
  const suggestions = useMemo(() => {
    type Sugg = { app: ComposioApp; hint: string };
    const fromPicks: Sugg[] = SUGGESTION_PICKS
      .map((p) => {
        const app = apps.find((a) => a.key === p.slug);
        if (!app || connectedSlugs.has(p.slug)) return null;
        return { app, hint: p.hint };
      })
      .filter((s): s is Sugg => s !== null);

    if (fromPicks.length >= 3) return fromPicks.slice(0, 3);

    // Fallback : compléter avec des apps connectables pas encore dans la
    // liste, hint = leur catégorie. Garantit qu'on affiche toujours 3 cards.
    const usedKeys = new Set(fromPicks.map((s) => s.app.key));
    const needed = 3 - fromPicks.length;
    const fallbacks: Sugg[] = apps
      .filter((a) => !connectedSlugs.has(a.key) && !usedKeys.has(a.key))
      .slice(0, needed)
      .map((app) => ({ app, hint: categoryLabel(app).toLowerCase() }));

    return [...fromPicks, ...fallbacks].slice(0, 3);
  }, [apps, connectedSlugs]);

  // Catégories effectivement présentes dans le catalogue. Les apps connectées
  // sont exclues — elles ne figurent plus dans le wallpaper, leur catégorie
  // ne doit pas gonfler les compteurs.
  const categoriesWithCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const app of apps) {
      if (connectedSlugs.has(app.key)) continue;
      for (const cat of app.categories) {
        map.set(cat, (map.get(cat) ?? 0) + 1);
      }
    }
    const entries = Array.from(map.entries())
      .map(([id, count]) => ({ id, label: categoryLabelById(id), count }))
      .sort((a, b) => b.count - a.count);
    return entries;
  }, [apps, connectedSlugs]);

  // Wallpaper = catalogue des apps NON connectées. Les apps déjà branchées
  // sont visibles dans la section "Connectés" en haut, on évite la
  // duplication. Exception : `attentionFilter` cible justement les
  // connexions dégradées (expired/error) — on les laisse passer.
  // Base = wallpaper sans filtre catégorie (utilisé pour le count « Tout »
  // dédupliqué de la CategoriesBar). Sommer `categoriesWithCount[].count`
  // double-compterait les services présents dans plusieurs catégories.
  const wallpaperBase = useMemo(
    () => (attentionFilter ? apps : apps.filter((a) => !connectedSlugs.has(a.key))),
    [apps, attentionFilter, connectedSlugs],
  );

  const wallpaperApps = useMemo(() => {
    let filtered = wallpaperBase;
    if (activeCategory) {
      filtered = filtered.filter((a) => a.categories.includes(activeCategory));
    }
    if (attentionFilter) {
      filtered = filtered.filter((a) => {
        const status = statusBySlug.get(a.key);
        return status && status !== "active";
      });
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [wallpaperBase, activeCategory, attentionFilter, statusBySlug]);

  const wallpaperVisible = useMemo(
    () => wallpaperApps.slice(0, wallpaperLimit),
    [wallpaperApps, wallpaperLimit],
  );

  const openDrawer = useCallback(
    async (app: ComposioApp) => {
      const connected = accounts.find((a) => a.appName.toLowerCase() === app.key);
      setDrawer({ app, connectedAccount: connected });
      setDrawerActions(null);

      // On charge les actions pour TOUTES les apps (connectées ou pas) pour
      // que le drawer puisse décrire "ce que ton agent pourra faire" même
      // en mode discovery.
      setDrawerLoadingActions(true);
      try {
        const res = await fetch(
          `/api/composio/app-actions?app=${encodeURIComponent(app.key)}`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = (await res.json()) as { tools?: DiscoveredTool[] };
          setDrawerActions(data.tools ?? []);
        }
      } finally {
        setDrawerLoadingActions(false);
      }
    },
    [accounts],
  );

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setDrawerActions(null);
  }, []);

  const handleConnect = useCallback(
    async (app: ComposioApp) => {
      setBusy(app.key);

      // I-17 : ouvrir la popup IMMÉDIATEMENT en réponse au click. Si on
      // attend la fin du fetch /api/composio/connect, le browser perd le
      // contexte de geste utilisateur et le popup blocker la rejette.
      // On ouvre vide, on navigue ensuite quand on a la redirectUrl.
      const popup = openOAuthPopup();

      useOAuthStore.getState().start({
        slug: app.key,
        appName: app.name,
        popup,
      });

      try {
        const res = await fetch("/api/composio/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            appName: app.key,
            redirectUri: `${window.location.origin}/apps?connected=${encodeURIComponent(app.key)}`,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          redirectUrl?: string;
          error?: string;
          errorCode?: string;
          details?: unknown;
        };

        if (!res.ok || !data.ok) {
          const message = data.error ?? "Erreur Composio";
          // NO_INTEGRATION / AUTH_CONFIG_REQUIRED = état attendu (le toolkit
          // n'a pas d'auth-config côté dashboard Composio). Pas un bug client,
          // donc pas de console.error qui crie en rouge dans devtools.
          const isMissingIntegration =
            data.errorCode === "NO_INTEGRATION" ||
            data.errorCode === "AUTH_CONFIG_REQUIRED";
          if (!isMissingIntegration) {
            console.warn(
              `[Composio] Connect failed for ${app.key}: code=${data.errorCode} message=${message}`,
              data.details,
            );
          }
          toast.error(`Connexion ${app.name} impossible`, message);

          if (isMissingIntegration) {
            // Réutiliser la popup déjà ouverte pour rediriger vers le dashboard
            // Composio plutôt qu'ouvrir une 2ème window. Le user voit direct
            // la page de configuration du toolkit, sans flash de popup vide.
            const dashboardUrl = `https://app.composio.dev/app/${encodeURIComponent(app.key)}`;
            if (popup && !popup.closed) {
              popup.navigate(dashboardUrl);
            } else {
              window.open(dashboardUrl, "_blank", "noopener,noreferrer");
            }
          } else if (popup && !popup.closed) {
            popup.close();
          }

          useOAuthStore.getState().setStatus("error", message);
          return;
        }
        if (data.redirectUrl) {
          // Naviguer la popup vers l'URL OAuth. Si la popup a été bloquée
          // (popup === null), on retombe sur la nav de la fenêtre principale
          // — comportement de fallback acceptable, l'utilisateur revient via
          // le redirectUri vers /apps?connected=slug.
          if (popup && !popup.closed) {
            popup.navigate(data.redirectUrl);
            useOAuthStore.getState().setStatus("active");
          } else {
            useOAuthStore.getState().clear();
            window.location.href = data.redirectUrl;
          }
          return;
        }
        // Pas de redirect = déjà connecté côté Composio (apps no-auth).
        if (popup && !popup.closed) popup.close();
        useOAuthStore.getState().setStatus("success");
        toast.success(`${app.name} connecté`, "Demande à Hearst d'utiliser ce service");
        await refreshAccounts();
        setTimeout(() => useOAuthStore.getState().clear(), 3000);
      } catch (err) {
        toast.error("Connexion impossible", err instanceof Error ? err.message : "Erreur réseau");
        if (popup && !popup.closed) popup.close();
        useOAuthStore.getState().setStatus(
          "error",
          err instanceof Error ? err.message : "Erreur réseau",
        );
      } finally {
        setBusy(null);
      }
    },
    [refreshAccounts],
  );

  const handleDisconnect = useCallback(
    async (account: ConnectedAccount) => {
      setBusy(account.id);
      try {
        const res = await fetch(`/api/composio/connections/${encodeURIComponent(account.id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error("Déconnexion impossible", data.error ?? "Erreur");
          return;
        }
        toast.success("Service déconnecté", account.appName);
        invalidateOAuthExpiryCache();
        await refreshAccounts();
        closeDrawer();
      } finally {
        setBusy(null);
      }
    },
    [refreshAccounts, closeDrawer],
  );

  // OAuth callback landing — ?connected=<slug> after Composio returns.
  // Deux cas :
  // 1) On est dans la popup OAuth (window.opener pointe vers la fenêtre
  //    principale Hearst) → postMessage au parent puis self.close.
  // 2) Pas de popup (fallback historique : redirect full page) → toast
  //    + refresh comme avant.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (!connected) return;

    const isPopup =
      window.opener &&
      window.opener !== window &&
      !(window.opener as Window).closed;

    if (isPopup) {
      try {
        (window.opener as Window).postMessage(
          { type: "hearst_oauth_complete", status: "success", slug: connected },
          window.location.origin,
        );
      } catch (err) {
        console.error("[Composio] postMessage to opener failed", err);
      }
      // On laisse 50 ms au parent pour traiter le message avant de fermer la
      // popup, sinon Chrome peut perdre le message en transit.
      setTimeout(() => window.close(), 50);
      return;
    }

    // Fallback : nav full-page (popup bloquée par le browser ou flow legacy).
    toast.success(
      `${connected} connecté ✓`,
      `Demande à Hearst d'utiliser ${connected} dans le chat`,
    );
    window.history.replaceState({}, "", window.location.pathname);
    void fetch("/api/composio/invalidate-cache", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    queueMicrotask(() => void refreshAccounts());
  }, [refreshAccounts]);

  // Listener postMessage pour les callbacks venant de la popup OAuth.
  // Filtre par origin pour rejeter les messages externes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; status?: string; slug?: string; error?: string };
      if (data?.type !== "hearst_oauth_complete") return;

      if (data.status === "success" && data.slug) {
        useOAuthStore.getState().setStatus("success");
        toast.success(
          `${data.slug} connecté ✓`,
          `Demande à Hearst d'utiliser ${data.slug} dans le chat`,
        );
        void fetch("/api/composio/invalidate-cache", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        invalidateOAuthExpiryCache();
        void refreshAccounts();
        setTimeout(() => useOAuthStore.getState().clear(), 3000);
      } else if (data.status === "error") {
        useOAuthStore.getState().setStatus("error", data.error ?? "Connexion refusée");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshAccounts]);

  // Détecte la fermeture manuelle de la popup (croix / cmd+W) sans callback.
  // Toutes les ~500ms, on regarde si la popup référencée par le store est
  // close. Si oui, on bascule en "cancelled" pour que la carte du RightPanel
  // sache. Note : le hook useOAuthCompletionPoll plus bas peut détecter une
  // connexion réussie avant cet interval (status passe à "success") — dans
  // ce cas la condition (status === "opening" || "active") devient fausse,
  // donc on ne trigger pas un faux "cancelled".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      const { popup, status } = useOAuthStore.getState();
      if (!popup) return;
      if (popup.closed && (status === "opening" || status === "active")) {
        useOAuthStore.getState().setStatus("cancelled");
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  // Composio termine ses flows OAuth sur leur propre page de confirmation
  // (cross-origin → postMessage bloqué). On poll l'API connections pour
  // détecter le moment où le slug visé devient ACTIVE et déclencher la
  // confirmation côté Hearst sans attendre que l'utilisateur ferme la popup.
  const onOAuthSuccess = useCallback(
    (slug: string) => {
      toast.success(
        `${slug} connecté ✓`,
        `Demande à Hearst d'utiliser ${slug} dans le chat`,
      );
      void fetch("/api/composio/invalidate-cache", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      invalidateOAuthExpiryCache();
      void refreshAccounts();
      // Auto-clear la carte du RightPanel après un délai court — laisse le
      // temps de voir la confirmation, sans encombrer le panel.
      setTimeout(() => useOAuthStore.getState().clear(), 3000);
    },
    [refreshAccounts],
  );
  useOAuthCompletionPoll(onOAuthSuccess);

  // Sync drawer ↔ accounts. Quand un OAuth réussit pendant que le drawer
  // est ouvert, accounts bouge mais drawer.connectedAccount resterait figé
  // à la valeur capturée au clic. On dérive donc `liveDrawer` à chaque
  // render au lieu d'un setState dans useEffect (anti-pattern react-hooks).
  const liveDrawer = useMemo(() => {
    if (!drawer) return null;
    const matched = accounts.find(
      (a) => a.appName.toLowerCase() === drawer.app.key,
    );
    return { ...drawer, connectedAccount: matched };
  }, [accounts, drawer]);

  // Quand on change de catégorie, on remet le wallpaper à zéro pour ne
  // pas garder un offset qui n'a plus de sens dans la nouvelle liste.
  const onCategoryChange = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    setWallpaperLimit(WALLPAPER_PAGE);
  }, []);

  const onToggleAttentionFilter = useCallback(() => {
    setAttentionFilter((s) => !s);
    setActiveCategory(null);
    setWallpaperLimit(WALLPAPER_PAGE);
  }, []);

  const onClearAttentionFilter = useCallback(() => {
    setAttentionFilter(false);
  }, []);

  const onLoadMoreWallpaper = useCallback(() => {
    setWallpaperLimit((n) => n + WALLPAPER_PAGE);
  }, []);

  return {
    // état brut
    apps,
    accounts,
    loading,
    enabled,
    sdkError,
    busy,
    // dérivés
    connectedSlugs,
    statusBySlug,
    connectedApps,
    stats,
    suggestions,
    categoriesWithCount,
    wallpaperBase,
    wallpaperApps,
    wallpaperVisible,
    searchResults,
    liveDrawer,
    drawerActions,
    drawerLoadingActions,
    // search + filtres
    searchQuery,
    setSearchQuery,
    activeCategory,
    onCategoryChange,
    attentionFilter,
    onToggleAttentionFilter,
    onClearAttentionFilter,
    onLoadMoreWallpaper,
    // actions drawer/OAuth
    openDrawer,
    closeDrawer,
    handleConnect,
    handleDisconnect,
  };
}
