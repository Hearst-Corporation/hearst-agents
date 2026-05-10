"use client";

import { useFocalStore } from "@/stores/focal";
import { useStageStore } from "@/stores/stage";
import { useSelectionStore } from "@/stores/selection";
import { assetToFocal } from "@/lib/ui/focal-mappers";
import { isPlaceholderAssetId } from "@/lib/ui/asset-id";
import type { MessageAssetRef } from "@/stores/navigation";

/* ─── Labels par type ──────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  report: "Rapport",
  brief: "Brief",
  doc: "Document",
  document: "Document",
  audio: "Audio",
  video: "Vidéo",
  image: "Image",
  code: "Code",
  synthesis: "Synthèse",
};

/* ─── Couleur accent du badge par famille de type ──────────────── */
type TypeAccent = {
  color: string;
  bg: string;
  border: string;
};

function getTypeAccent(type: string): TypeAccent {
  const t = type.toLowerCase();
  if (t === "video" || t === "audio") {
    // teal — média
    return {
      color: "var(--accent-teal)",
      bg: "var(--accent-teal-surface)",
      border: "var(--accent-teal-border)",
    };
  }
  if (t === "image") {
    // violet doux — visuel
    return {
      color: "var(--accent-llm)",
      bg: "color-mix(in srgb, var(--accent-llm) 8%, transparent)",
      border: "color-mix(in srgb, var(--accent-llm) 22%, transparent)",
    };
  }
  if (t === "report" || t === "synthesis") {
    // gold — éditorial
    return {
      color: "var(--gold)",
      bg: "var(--gold-surface)",
      border: "var(--gold-border)",
    };
  }
  // neutre — brief, doc, code et fallback
  return {
    color: "var(--text-faint)",
    bg: "var(--surface-2)",
    border: "var(--border-shell)",
  };
}

/* ─── Icônes distinctes par type ──────────────────────────────── */
function AssetIcon({ type }: { type: string }) {
  const t = type.toLowerCase();

  if (t === "video") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  }

  if (t === "audio") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }

  if (t === "image") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }

  if (t === "code") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }

  if (t === "report" || t === "synthesis") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }

  if (t === "brief") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  }

  // doc / document / fallback
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/* ─── Spinner minimaliste pour état génération ─────────────────── */
function GeneratingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ─── Composant principal ──────────────────────────────────────── */
export function ChatAssetCard({ assetRef }: { assetRef: MessageAssetRef }) {
  const setFocal = useFocalStore((s) => s.setFocal);
  const setStageMode = useStageStore((s) => s.setMode);

  const isGenerating = !assetRef.id || isPlaceholderAssetId(assetRef.id);
  const accent = getTypeAccent(assetRef.type);
  const typeLabel = TYPE_LABELS[assetRef.type.toLowerCase()] ?? assetRef.type;

  const handleOpen = () => {
    if (isGenerating) return;
    useSelectionStore.getState().select({ kind: "asset", id: assetRef.id, label: assetRef.title });
    setFocal(assetToFocal({ id: assetRef.id, name: assetRef.title, type: assetRef.type }, null));
    setStageMode({ mode: "asset", assetId: assetRef.id });
  };

  if (isGenerating) {
    return (
      <div
        className="flex items-center gap-3 w-full"
        style={{
          padding: "var(--space-3) var(--space-4)",
          border: "1px solid var(--border-shell)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-1)",
          opacity: 0.7,
        }}
      >
        {/* Icône container */}
        <span
          className="flex items-center justify-center shrink-0 text-text-faint"
          style={{
            width: "var(--space-9)",
            height: "var(--space-9)",
            borderRadius: "var(--radius-xs)",
            background: "var(--surface-2)",
          }}
        >
          <AssetIcon type={assetRef.type} />
        </span>

        {/* Contenu */}
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: "var(--space-1)" }}>
          {/* Badge type */}
          <span
            className="t-11 font-light self-start"
            style={{
              color: accent.color,
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              borderRadius: "var(--radius-pill)",
              padding: "1px var(--space-2)",
            }}
          >
            {typeLabel}
          </span>
          <span className="t-13 text-text-faint font-light truncate">
            {assetRef.title}
          </span>
        </div>

        {/* Indicateur génération */}
        <span className="flex items-center gap-2 t-11 font-light text-text-faint shrink-0">
          <GeneratingSpinner />
          En cours…
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex items-center gap-3 w-full text-left"
      style={{
        padding: "var(--space-3) var(--space-4)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-1)",
        transition: `border-color var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-standard)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-teal-border-hover)";
        (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-teal-bg-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-shell)";
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-1)";
      }}
    >
      {/* Icône container */}
      <span
        className="flex items-center justify-center shrink-0 transition-colors text-text-faint group-hover:text-(--accent-teal)"
        style={{
          width: "var(--space-9)",
          height: "var(--space-9)",
          borderRadius: "var(--radius-xs)",
          background: "var(--surface-2)",
          transition: `color var(--duration-base) var(--ease-standard)`,
        }}
      >
        <AssetIcon type={assetRef.type} />
      </span>

      {/* Contenu */}
      <div className="flex flex-col flex-1 min-w-0" style={{ gap: "var(--space-1)" }}>
        {/* Badge type coloré */}
        <span
          className="t-11 font-light self-start"
          style={{
            color: accent.color,
            background: accent.bg,
            border: `1px solid ${accent.border}`,
            borderRadius: "var(--radius-pill)",
            padding: "1px var(--space-2)",
          }}
        >
          {typeLabel}
        </span>
        <span className="t-13 text-text font-light truncate">
          {assetRef.title}
        </span>
      </div>

      {/* CTA */}
      <span
        className="t-11 font-light text-text-faint group-hover:text-(--accent-teal) shrink-0"
        style={{ transition: `color var(--duration-base) var(--ease-standard)` }}
      >
        Ouvrir →
      </span>
    </button>
  );
}
