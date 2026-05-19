"use client";

import { useSyncExternalStore, useEffect, useRef, useState } from "react";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
  setActive,
} from "../stores/activeProductStore";
import {
  subscribe as subLauncher,
  getSnapshot as getLauncher,
  getServerSnapshot as getLauncherSSR,
  set as setLauncher,
} from "../stores/launcherStore";
import { HearstMark } from "./HearstMark";
import { useCockpit } from "./context";

/**
 * Rail gauche — accordéon lanceur de la suite Hearst.
 *
 * - Lanceur OUVERT : rail élargi, tous les produits (hache + nom). Clic produit
 *   → on entre dans le produit, le lanceur se replie.
 * - Lanceur REPLIÉ : rail 88px, en haut le badge du produit actif (sa couleur,
 *   son nom) qui sert de toggle ; reclic → le lanceur se redéploie.
 */
export function RailLeft() {
  const { products, appId, getProduct } = useCockpit();
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const open = useSyncExternalStore(subLauncher, getLauncher, getLauncherSSR);

  const otherProducts = products.filter((p) => p.id !== appId);
  const current = getProduct(active);
  const inProduct = current.id !== appId;

  const label = (name: string) => name.replace(/^Hearst\s+/, "");
  const top = inProduct && !open ? current : getProduct(appId);

  function pick(id: string) {
    setActive(id);
    setLauncher(false);
  }

  return (
    <aside className={`ct-rail-left${open ? " launcher" : ""}`}>
      <button
        type="button"
        className="ct-rail-top"
        title={open ? "Réduire" : `${top.name} — ouvrir le lanceur`}
        aria-label={open ? "Réduire le lanceur" : "Ouvrir le lanceur"}
        onClick={() => {
          if (inProduct && !open) {
            setActive(appId);
          } else {
            setLauncher(!open);
          }
        }}
        style={{ ["--p-color" as string]: top.color }}
      >
        <span className="ct-rail-top-badge">
          <HearstMark size={26} />
        </span>
        <span className="ct-rail-top-name">{label(top.name)}</span>
      </button>

      {open ? (
        <nav className="ct-rail-list" aria-label="Produits Hearst">
          {otherProducts.map((p) => {
            const on = active === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`ct-rail-row${on ? " active" : ""}`}
                title={p.name}
                aria-pressed={on}
                onClick={() => pick(p.id)}
                style={{ ["--p-color" as string]: p.color }}
              >
                <span className="ct-rail-row-icon">
                  <HearstMark size={24} />
                </span>
                <span className="ct-rail-row-name">{label(p.name)}</span>
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="ct-spacer" />
      )}

      <div className="ct-spacer" />
      <UserBadge appId={appId} />
    </aside>
  );
}

/**
 * Badge utilisateur en bas du rail gauche.
 * - 1er clic : navigue vers /profile + s'arme (rouge + icône logout).
 * - 2e clic sur le badge armé : déconnexion Supabase + redirect /login.
 * - Clic ailleurs OU 5s sans interaction → désarme automatiquement.
 */
function UserBadge({ appId }: { appId: string }) {
  const [initials, setInitials] = useState<string>("");
  const [armed, setArmed] = useState<boolean>(false);
  const armRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Récupère l'email pour les initiales. Import indirect (variable) pour ne
    // PAS forcer @supabase/ssr comme dépendance résolue au typecheck. Les
    // projets qui n'ont pas Supabase (Cortex, Helm, etc.) builderont sans
    // erreur ; ceux qui l'ont auront leurs initiales auto.
    (async () => {
      try {
        const moduleName = "@supabase/ssr";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)(moduleName).catch(() => null);
        if (!mod?.createBrowserClient) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = mod.createBrowserClient(url, key);
        const { data: { user } } = await sb.auth.getUser();
        if (user?.email) setInitials(computeInitials(user.email));
      } catch {
        /* pas de session ou @supabase/ssr absent */
      }
    })();
  }, []);

  // Quand armé : timer 5s + listener click document pour désarmer.
  useEffect(() => {
    if (!armed) return;

    timerRef.current = window.setTimeout(() => setArmed(false), 5000);

    const onDocClick = (e: MouseEvent) => {
      if (armRef.current && !armRef.current.contains(e.target as Node)) {
        setArmed(false);
      }
    };
    document.addEventListener("click", onDocClick);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      document.removeEventListener("click", onDocClick);
    };
  }, [armed]);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();

    if (armed) {
      // 2e clic — déconnexion (import indirect : @supabase/ssr optionnel).
      try {
        const moduleName = "@supabase/ssr";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod: any = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)(moduleName).catch(() => null);
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (mod?.createBrowserClient && url && key) {
          const sb = mod.createBrowserClient(url, key);
          await sb.auth.signOut();
        }
      } catch {
        /* fallback */
      }
      window.location.href = "/login";
      return;
    }

    // 1er clic — armer + naviguer vers le profil si on n'y est pas déjà.
    setArmed(true);
    if (window.location.pathname !== "/profile") {
      window.location.href = "/profile";
    }
  }

  const display = initials || (appId || "HC").slice(0, 2).toUpperCase();

  return (
    <button
      ref={armRef}
      type="button"
      className={`ct-avatar${armed ? " active" : ""}`}
      title={armed ? "Cliquer pour se déconnecter" : "Profil & réglages"}
      onClick={handleClick}
    >
      {armed ? <LogoutIcon /> : display}
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/**
 * Calcule les initiales depuis un email.
 * - "adrien@hearstcorporation.io" → "AH" (1re lettre prénom + 1re lettre domaine)
 * - "john.doe@x.com" → "JD"
 * - fallback : 2 premières lettres du local-part.
 */
function computeInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
