"use client";

import { useState } from "react";
import { Action } from "@/app/(user)/components/ui";

interface AgentLockState {
  locked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  reason: string | null;
}

interface Props {
  initial: AgentLockState;
}

export default function AgentLockCard({ initial }: Props) {
  const [state, setState] = useState<AgentLockState>(initial);
  const [reasonDraft, setReasonDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/agent-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locked: !state.locked,
          reason: !state.locked ? reasonDraft : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as AgentLockState;
      setState(next);
      setReasonDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  if (state.locked) {
    return (
      <div className="rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/40 p-(--space-5) space-y-(--space-3)">
        <div className="flex items-start justify-between gap-(--space-4)">
          <div className="flex items-start gap-(--space-3) min-w-0">
            <span className="size-(--space-3) rounded-(--radius-full) bg-danger animate-pulse shrink-0 mt-(--space-1)" />
            <div className="min-w-0 space-y-(--space-1)">
              <p className="t-11 font-medium text-danger">Agents verrouillés</p>
              <p className="t-15 text-text">
                Aucun agent ne peut écrire ou exécuter d&apos;action destructive.
              </p>
              <p className="t-12 text-text-muted">
                Verrouillé{" "}
                {state.lockedAt && `le ${new Date(state.lockedAt).toLocaleString("fr-FR")}`}
                {state.lockedBy && ` · par ${state.lockedBy.slice(0, 8)}…`}
              </p>
              {state.reason && <p className="t-12 text-text-soft italic">« {state.reason} »</p>}
            </div>
          </div>
          <Action
            variant="secondary"
            tone="brand"
            onClick={toggle}
            disabled={busy}
            loading={busy}
            className="shrink-0"
          >
            Déverrouiller
          </Action>
        </div>
        {error && <p className="t-12 text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-5) space-y-(--space-3)">
      <div className="flex items-start justify-between gap-(--space-4)">
        <div className="flex items-start gap-(--space-3) min-w-0">
          <span className="size-(--space-3) rounded-(--radius-full) bg-money shrink-0 mt-(--space-1)" />
          <div className="min-w-0 space-y-(--space-1)">
            <p className="t-11 font-medium text-text-faint">Édition libre</p>
            <p className="t-15 text-text">
              Les agents peuvent écrire selon les invariants des features verrouillées.
            </p>
            <p className="t-12 text-text-muted">
              Verrouille pour bloquer toute écriture agent (Edit, Write, NotebookEdit) jusqu&apos;à
              ton retour en admin.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-(--space-3) pt-(--space-2) border-t border-line">
        <input
          type="text"
          value={reasonDraft}
          onChange={(e) => setReasonDraft(e.target.value)}
          placeholder="Raison (optionnel) — ex. déploiement prod en cours"
          maxLength={280}
          className="flex-1 t-12 bg-(--surface-2) border border-line rounded-(--radius-sm) px-(--space-3) py-(--space-2) text-text placeholder:text-text-ghost focus:border-(--accent-teal) focus:outline-none"
        />
        <Action
          variant="secondary"
          tone="danger"
          onClick={toggle}
          disabled={busy}
          loading={busy}
          className="shrink-0"
        >
          Verrouiller les agents
        </Action>
      </div>
      {error && <p className="t-12 text-danger">{error}</p>}
    </div>
  );
}
