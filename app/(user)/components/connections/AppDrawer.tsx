"use client";

import { useState } from "react";
import { Action } from "../ui";
import { AppLogo } from "./AppLogo";
import {
  ACTIONS_PREVIEW,
  actionLabel,
  type ComposioApp,
  categoryLabel,
  type DiscoveredTool,
  type DrawerState,
  truncateDescription,
} from "./types";

// ─── Drawer (logique inchangée) ───────────────────────────────

interface AppDrawerProps {
  state: DrawerState;
  actions: DiscoveredTool[] | null;
  loadingActions: boolean;
  busy: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect?: () => void;
}

export function AppDrawer({
  state,
  actions,
  loadingActions,
  busy,
  onClose,
  onConnect,
  onDisconnect,
}: AppDrawerProps) {
  const { app, connectedAccount } = state;
  const isConnected = !!connectedAccount;
  const [showAll, setShowAll] = useState(false);

  const totalActions = actions?.length ?? 0;
  const visibleActions = showAll ? (actions ?? []) : (actions ?? []).slice(0, ACTIONS_PREVIEW);
  const overflow = totalActions - visibleActions.length;

  return (
    <>
      <div
        className="fixed inset-0 z-backdrop"
        style={{ background: "var(--overlay-scrim)" }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={app.name}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md z-modal flex flex-col border-l panel-enter"
        style={{ background: "var(--bg-elev)", borderColor: "var(--border-shell)" }}
      >
        {/* Header — close + status badge, fixe en haut */}
        <div
          className="shrink-0 px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-shell)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="t-11 font-medium text-text-faint hover:text-text transition-colors"
          >
            ← Fermer
          </button>
          {isConnected && <span className="t-11 font-medium text-(--accent-teal)">● Connecté</span>}
        </div>

        {/* Body scrollable — titre, description, liste d'actions */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <AppLogo app={app} size={48} />
            <div className="min-w-0">
              <h2
                className="t-18 m-0"
                style={{ fontWeight: "var(--weight-semibold)", color: "var(--text)" }}
              >
                {app.name}
              </h2>
              <p className="t-11 font-light text-text-faint m-0 mt-1">{categoryLabel(app)}</p>
            </div>
          </div>

          {app.description && (
            <p
              className="t-13 mb-6"
              style={{ color: "var(--text-soft)", lineHeight: "var(--leading-relaxed)" }}
            >
              {app.description}
            </p>
          )}

          <ActionsSection
            isConnected={isConnected}
            loading={loadingActions}
            actions={visibleActions}
            totalActions={totalActions}
            overflow={overflow}
            showAll={showAll}
            onToggleShowAll={() => setShowAll((s) => !s)}
          />
        </div>

        {/* Footer sticky — bouton connect/disconnect en bas */}
        <div
          className="shrink-0 px-6 py-4 border-t"
          style={{ background: "var(--bg-elev)", borderColor: "var(--border-shell)" }}
        >
          {isConnected && connectedAccount?.source === "native" ? (
            <NativeFooter />
          ) : isConnected ? (
            <Action
              variant="secondary"
              tone="danger"
              onClick={onDisconnect}
              loading={busy}
              className="w-full"
            >
              {`Déconnecter ${app.name}`}
            </Action>
          ) : app.connectable === false ? (
            <NotConnectableFooter app={app} />
          ) : (
            <Action
              variant="primary"
              tone="brand"
              onClick={onConnect}
              loading={busy}
              className="w-full"
            >
              {`Connecter ${app.name}`}
            </Action>
          )}
        </div>
      </aside>
    </>
  );
}

// Footer pour les services connectés via le SSO initial (Google/Microsoft).
// Pas de bouton "Déconnecter" parce que ces tokens viennent du login —
// pour révoquer, l'utilisateur doit logout / changer de compte SSO.
function NativeFooter() {
  return (
    <div className="flex flex-col gap-2">
      <p className="t-11 font-medium" style={{ color: "var(--accent-teal-deep)" }}>
        Géré via le SSO
      </p>
      <p className="t-11" style={{ color: "var(--text-soft)", lineHeight: "var(--leading-snug)" }}>
        L&apos;accès à ce service vient de ton login Google/Microsoft initial — Hearst
        l&apos;utilise nativement, sans OAuth additionnel. Pour révoquer, change de session ou
        retire les permissions côté provider.
      </p>
    </div>
  );
}

// Footer alternatif quand le toolkit n'a pas d'auth-config Composio →
// le flow OAuth standard donnerait NO_INTEGRATION. On bascule sur un
// lien direct vers le dashboard Composio pour configurer l'intégration.
function NotConnectableFooter({ app }: { app: ComposioApp }) {
  const dashboardUrl = `https://app.composio.dev/app/${encodeURIComponent(app.key)}`;
  return (
    <div className="flex flex-col gap-2">
      <p className="t-11" style={{ color: "var(--text-soft)", lineHeight: "var(--leading-snug)" }}>
        Ce service demande une auth-config personnalisée côté Composio avant d&apos;être connectable
        depuis Hearst.
      </p>
      <a
        href={dashboardUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="ghost-btn-solid ghost-btn-ghost w-full text-center"
        style={{
          color: "var(--text)",
          borderColor: "var(--border-default)",
          textDecoration: "none",
        }}
      >
        Configurer sur Composio →
      </a>
    </div>
  );
}

function ActionsSection({
  isConnected,
  loading,
  actions,
  totalActions,
  overflow,
  showAll,
  onToggleShowAll,
}: {
  isConnected: boolean;
  loading: boolean;
  actions: DiscoveredTool[];
  totalActions: number;
  overflow: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3 t-13 font-medium">
        <span className="text-text">
          {isConnected ? "Ce que Hearst fait pour toi" : "Ce que ton agent pourra faire"}
        </span>
        {totalActions > 0 && (
          <>
            <span className="text-text-ghost">·</span>
            <span className="text-text-faint font-light">{totalActions}</span>
          </>
        )}
      </div>

      {loading ? (
        <ul className="space-y-1">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="rounded-none"
              style={{
                background: "var(--surface-2)",
                height: "var(--space-8)",
                opacity: 0.6,
              }}
              aria-hidden
            />
          ))}
        </ul>
      ) : actions.length === 0 ? (
        <p className="t-11 text-text-faint">
          Aucune action listée pour ce service. Connecte-le et Hearst découvrira automatiquement ce
          qu&apos;il peut faire.
        </p>
      ) : (
        <ul className="space-y-px">
          {actions.map((a) => (
            <ActionBullet key={a.name} action={a} />
          ))}
          {(overflow > 0 || showAll) && (
            <li className="pt-2">
              <button
                type="button"
                onClick={onToggleShowAll}
                className="t-11 font-medium text-[var(--accent-teal-deep)] hover:text-(--accent-teal) transition-colors"
              >
                {showAll ? "← Réduire" : `Voir les ${totalActions} actions →`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ActionBullet({ action }: { action: DiscoveredTool }) {
  const title = actionLabel(action);
  const desc = truncateDescription(action.description);
  return (
    <li
      className="flex items-start gap-3 py-2 border-b"
      style={{ borderColor: "var(--border-soft)" }}
    >
      <span className="t-13 leading-none text-(--accent-teal) mt-1" aria-hidden>
        ·
      </span>
      <div className="flex-1 min-w-0">
        <div className="t-13" style={{ fontWeight: "var(--weight-medium)", color: "var(--text)" }}>
          {title}
        </div>
        {desc && (
          <div className="t-11 mt-1 text-text-faint" style={{ lineHeight: "var(--leading-snug)" }}>
            {desc}
          </div>
        )}
      </div>
    </li>
  );
}
