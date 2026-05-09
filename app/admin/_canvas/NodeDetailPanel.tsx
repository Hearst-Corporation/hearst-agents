"use client";

import type { CanvasNode, NodeId } from "./topology";
import { useCanvasStore, type NodeState } from "./store";

interface Props {
  node: CanvasNode | null;
  onClear: () => void;
}

const STATE_COLOR: Record<NodeState, string> = {
  idle: "text-text-faint",
  active: "text-(--cykan)",
  success: "text-(--color-success)",
  failed: "text-(--color-danger)",
  blocked: "text-(--color-warning, var(--gold))",
  disabled: "text-text-ghost",
};

const STATE_LABEL: Record<NodeState, string> = {
  idle: "En attente",
  active: "En cours",
  success: "Réussi",
  failed: "Échec",
  blocked: "Bloqué",
  disabled: "Inactif",
};

const KIND_LABEL: Record<NodeId, string> = {
  entry: "Point d'entrée",
  router: "Routeur d'intention",
  safety: "Contrôle de sécurité",
  intent: "Analyse d'intention",
  preflight: "Vérification pré-vol",
  tools: "Exécution d'outils",
  agent: "Délégation agent",
  research: "Recherche documentaire",
  pipeline: "Pipeline LLM",
  complete: "Complétion du run",
};

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-(--space-3) py-(--space-2) border-b border-line last:border-0">
      <span className="t-11 text-text-muted shrink-0">{label}</span>
      <span className={["t-11 font-medium truncate text-right", valueClass ?? "text-text"].join(" ")}>
        {value}
      </span>
    </div>
  );
}

export default function NodeDetailPanel({ node, onClear }: Props) {
  const nodeStates = useCanvasStore((s) => s.nodeStates);
  const lastEventAt = useCanvasStore((s) => s.lastEventAt);

  if (!node) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-(--space-3) px-(--space-5) text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-ghost">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <p className="t-11 text-text-faint">Clique un stage pour sa fiche</p>
      </div>
    );
  }

  const state = nodeStates[node.id];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between gap-(--space-3) px-(--space-4) py-(--space-3) border-b border-line shrink-0">
        <div className="flex flex-col gap-(--space-1) min-w-0">
          <span className="t-13 font-medium text-text truncate">{node.label}</span>
          <span className="t-11 text-text-muted truncate">{KIND_LABEL[node.id]}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 flex items-center justify-center size-(--space-7) rounded-(--radius-xs) text-text-muted hover:text-text hover:bg-surface transition-colors duration-(--duration-base)"
          title="Fermer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-(--space-4) py-(--space-3)">
        <div className="flex flex-col">
          <StatRow
            label="État"
            value={STATE_LABEL[state]}
            valueClass={STATE_COLOR[state]}
          />
          <StatRow
            label="Identifiant"
            value={node.id}
            valueClass="text-text-faint font-mono"
          />
          {lastEventAt && (
            <StatRow
              label="Dernier événement"
              value={new Date(lastEventAt).toLocaleTimeString("fr-FR")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
