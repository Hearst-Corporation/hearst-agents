"use client";

/**
 * ReportActions — barre d'actions header pour un report rendu :
 *
 *   - Exporter PDF / Excel / CSV  → GET /api/reports/[reportId]/export?format=...
 *   - Partager (signed URL)       → POST /api/reports/share
 *   - Commentaires                → drawer interne (fetch /api/reports/[reportId]/comments)
 *
 * Volontairement compact : trois boutons + popover/drawer simples. Toute la
 * logique métier vit côté API. Composant client-only (browser fetch).
 */

import { useCallback, useEffect, useState } from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { toast } from "@/app/hooks/use-toast";
import { Action } from "./ui";

interface ReportActionsProps {
  /** L'asset.id du report (optionnel — sans, on n'expose pas les actions). */
  reportId?: string | null;
  /** Titre suggéré pour le filename d'export (sanitizé côté serveur). */
  title?: string;
}

type Panel = "share" | "comments" | null;

export function ReportActions({ reportId, title }: ReportActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  if (!reportId) return null;

  return (
    <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
      <ExportMenu reportId={reportId} title={title} />
      <ActionButton
        label="Partager"
        onClick={() => setPanel(panel === "share" ? null : "share")}
        active={panel === "share"}
      />
      <ActionButton
        label="Commenter"
        onClick={() => setPanel(panel === "comments" ? null : "comments")}
        active={panel === "comments"}
      />
      {/* T-J10 (it.4) : mount conditionnel = équivalent open=true. La prop
          `open` était dead code (toujours true) et a été retirée de
          PopoverShell + descendants. useModalA11y est piloté par `true`
          fixé tant que le composant est monté, et le parent contrôle le
          mount/unmount via `panel`. */}
      {panel === "share" && <SharePopover reportId={reportId} onClose={() => setPanel(null)} />}
      {panel === "comments" && (
        <CommentsDrawer reportId={reportId} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}

// ── Export menu ──────────────────────────────────────────────

function ExportMenu({ reportId, title }: { reportId: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const triggerExport = useCallback(
    async (format: "pdf" | "xlsx" | "csv") => {
      setOpen(false);
      const url = `/api/reports/${encodeURIComponent(reportId)}/export?format=${format}`;
      // Force le download via un anchor, plus fiable que window.location
      // pour les Content-Disposition.
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title ?? "report"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [reportId, title],
  );

  return (
    <div className="relative">
      <ActionButton label="Exporter" onClick={() => setOpen((v) => !v)} active={open} />
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10"
          style={{
            top: "calc(100% + var(--space-2))",
            background: "var(--card-flat-bg)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            padding: "var(--space-1)",
            minWidth: "var(--space-32, 160px)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <MenuItem onClick={() => void triggerExport("pdf")}>PDF</MenuItem>
          <MenuItem onClick={() => void triggerExport("xlsx")}>Excel</MenuItem>
          <MenuItem onClick={() => void triggerExport("csv")}>CSV</MenuItem>
        </div>
      )}
    </div>
  );
}

// ── Share popover ────────────────────────────────────────────

const TTL_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: "24 h", hours: 24 },
  { label: "7 jours", hours: 168 },
  { label: "30 jours", hours: 720 },
];

function SharePopover({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [ttlHours, setTtlHours] = useState(24);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: reportId, ttlHours: Math.min(ttlHours, 168) }),
      });
      const json = await res.json();
      if (!res.ok) {
        const apiMsg = typeof json.error === "string" ? json.error : "share_failed";
        setError(apiMsg);
        toast.error("Partage échoué", apiMsg);
        return;
      }
      setShareUrl(json.shareUrl as string);
      setExpiresAt(json.expiresAt as string);
    } catch (e) {
      const msg = sanitizeApiError(e);
      setError(msg);
      // Toast complète le state error inline (le bouton "Réessayer" rendu
      // sous l'erreur fait office d'action côté UI).
      toast.error("Partage échoué", msg);
    } finally {
      setLoading(false);
    }
  }, [reportId, ttlHours]);

  return (
    <PopoverShell onClose={onClose} title="Partager le rapport">
      <p
        className="t-11 font-light text-text-muted"
        style={{
          marginBottom: "var(--space-2)",
        }}
      >
        Durée du lien
      </p>
      <div className="flex" style={{ gap: "var(--space-2)" }}>
        {TTL_OPTIONS.map((o) => (
          <button
            key={o.hours}
            type="button"
            onClick={() => setTtlHours(o.hours)}
            className="t-11 font-light"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border:
                "1px solid " + (ttlHours === o.hours ? "var(--accent-teal)" : "var(--surface-2)"),
              borderRadius: "var(--radius-xs)",
              background: "transparent",
              color: ttlHours === o.hours ? "var(--accent-teal)" : "var(--text-muted)",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "var(--space-3)" }}>
        <Action
          variant="primary"
          tone="brand"
          size="sm"
          onClick={() => void generate()}
          loading={loading}
        >
          Créer un lien
        </Action>
      </div>
      {error && (
        <div
          className="flex items-center"
          style={{ marginTop: "var(--space-2)", gap: "var(--space-2)" }}
        >
          <p className="t-9" style={{ color: "var(--danger)", margin: 0 }}>
            Erreur : {error}
          </p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="t-9 font-light"
            style={{
              padding: "var(--space-1) var(--space-2)",
              border: "1px solid var(--surface-2)",
              borderRadius: "var(--radius-xs)",
              background: "transparent",
              color: "var(--text-muted)",
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {shareUrl && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="t-9 w-full"
            style={{
              padding: "var(--space-2)",
              border: "1px solid var(--surface-2)",
              borderRadius: "var(--radius-xs)",
              background: "var(--card-flat-bg)",
              color: "var(--text)",
              fontFamily: "monospace",
            }}
          />
          {expiresAt && (
            <p
              className="t-11 font-light"
              style={{
                color: "var(--text-faint)",
                marginTop: "var(--space-1)",
              }}
            >
              Expire le {new Date(expiresAt).toLocaleString("fr-FR")}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              if (shareUrl) void navigator.clipboard?.writeText(shareUrl);
            }}
            className="t-11 font-light"
            style={{
              marginTop: "var(--space-2)",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--surface-2)",
              borderRadius: "var(--radius-xs)",
              background: "transparent",
              color: "var(--text-muted)",
            }}
          >
            Copier
          </button>
        </div>
      )}
    </PopoverShell>
  );
}

// ── Comments drawer ──────────────────────────────────────────

interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  blockRef: string | null;
}

function CommentsDrawer({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/comments`);
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "load_failed");
        return;
      }
      setComments((json.comments as CommentRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    }
  }, [reportId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "post_failed");
        return;
      }
      setBody("");
      toast.success("Commentaire enregistré");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally {
      setLoading(false);
    }
  }, [body, reportId, load]);

  return (
    <PopoverShell onClose={onClose} title="Commentaires">
      <div
        style={{
          maxHeight: "var(--space-64, 320px)",
          overflowY: "auto",
          marginBottom: "var(--space-3)",
        }}
      >
        {comments.length === 0 ? (
          <p className="t-9" style={{ color: "var(--text-muted)" }}>
            Pas encore de commentaire.
          </p>
        ) : (
          <ul className="list-none p-0 m-0">
            {comments.map((c) => (
              <li
                key={c.id}
                style={{
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--surface-2)",
                }}
              >
                <p className="t-13" style={{ whiteSpace: "pre-wrap" }}>
                  {c.body}
                </p>
                <p className="t-9 font-mono" style={{ color: "var(--text-faint)" }}>
                  {new Date(c.createdAt).toLocaleString("fr-FR")}
                  {c.blockRef ? ` · bloc ${c.blockRef}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        rows={3}
        placeholder="Ton commentaire…"
        className="t-13 w-full"
        style={{
          padding: "var(--space-2)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
          background: "var(--card-flat-bg)",
          color: "var(--text)",
          resize: "vertical",
        }}
      />
      <div
        className="flex items-center"
        style={{ marginTop: "var(--space-2)", gap: "var(--space-2)" }}
      >
        <Action
          variant="primary"
          tone="brand"
          size="sm"
          onClick={() => void submit()}
          disabled={!body.trim()}
          loading={loading}
        >
          Publier
        </Action>
        {error && (
          <span className="t-9" style={{ color: "var(--danger)" }}>
            {error}
          </span>
        )}
      </div>
    </PopoverShell>
  );
}

// ── UI primitives ────────────────────────────────────────────

function ActionButton({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t-11 font-light hover:text-(--accent-teal)"
      style={{
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--surface-2)",
        borderRadius: "var(--radius-xs)",
        background: "transparent",
        color: active ? "var(--accent-teal)" : "var(--text-muted)",
        transition: "color var(--duration-fast) var(--ease-standard)",
      }}
    >
      {label}
    </button>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t-11 font-light block w-full text-left hover:text-(--accent-teal)"
      style={{
        padding: "var(--space-2) var(--space-3)",
        background: "transparent",
        color: "var(--text-muted)",
        border: 0,
      }}
    >
      {children}
    </button>
  );
}

function PopoverShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  // T-J10 (it.4) : la prop `open` a été retirée — le parent (ReportActions)
  // mount/unmount le composant via `panel === "share" | "comments"`, donc
  // tant que ce composant est monté il est par définition ouvert. Le `true`
  // hardcodé passé à useModalA11y est l'équivalent exact de l'ancien `open`.
  //
  // lockBodyScroll:false → c'est un popover positionné absolument, pas une
  // modale bloquante. On garde focus trap + Escape + restore focus.
  //
  // autoFocus:true (T-5 it.3 follow-up) → le bouton "Fermer" est le premier
  // focusable du DOM order (rendu en tête, dans le header avant `children`),
  // donc le hook le focalise naturellement. Plus besoin de closeBtnRef +
  // useEffect manuel.
  const ref = useModalA11y<HTMLDivElement>(true, {
    onClose,
    lockBodyScroll: false,
    autoFocus: true,
  });

  // Click-outside ferme le popover (le hook a11y ne gère pas l'outside-click).
  // Escape + focus restore sont délégués à useModalA11y.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // setTimeout pour ne pas capter le click qui vient d'ouvrir le popover.
    const t = window.setTimeout(() => {
      window.addEventListener("mousedown", onClick);
    }, 0);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.clearTimeout(t);
    };
  }, [onClose, ref]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute right-0 z-20"
      style={{
        top: "calc(100% + var(--space-3))",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        minWidth: "var(--space-80, 320px)",
        maxWidth: "var(--space-96, 400px)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
        <h3
          className="t-11 font-light"
          style={{
            color: "var(--text)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="t-11 font-light"
          style={{
            padding: "var(--space-1) var(--space-2)",
            background: "transparent",
            color: "var(--text-muted)",
            border: 0,
          }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}
