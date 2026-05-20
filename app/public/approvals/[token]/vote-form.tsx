"use client";

/**
 * Form client pour la page publique d'approbation. Géré ici en client
 * component pour pouvoir POSTer vers /api/v2/approvals/[token]/vote sans
 * page reload, afficher les erreurs inline et confirmer visuellement.
 *
 * Pas de dépendance app/(user) — on reste sur des styles inline pour
 * rester totalement indépendant du shell user (cette page est publique).
 */

import { useState } from "react";

interface ApprovalVoteFormProps {
  token: string;
  presetAction: "approved" | "rejected" | null;
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "success";
      vote: "approved" | "rejected";
      sessionApproved: boolean;
      sessionRejected: boolean;
    }
  | { kind: "error"; message: string };

export function ApprovalVoteForm({ token, presetAction }: ApprovalVoteFormProps) {
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  // presetAction sert à mettre visuellement en avant le bouton choisi
  // dans l'email (ring de focus). Le clic reste obligatoire (CSRF-safe).
  const approvePreselect = presetAction === "approved";
  const rejectPreselect = presetAction === "rejected";

  const submit = async (vote: "approved" | "rejected") => {
    setState({ kind: "submitting" });
    try {
      const res = await fetch(`/api/v2/approvals/${encodeURIComponent(token)}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vote, comment: comment.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionApproved?: boolean;
        sessionRejected?: boolean;
      };
      if (!res.ok) {
        const errorLabels: Record<string, string> = {
          already_voted: "Vous avez déjà voté.",
          session_rejected: "La session a déjà été clôturée par un rejet.",
          expired: "Le lien a expiré.",
          bad_signature: "Lien invalide.",
          malformed: "Lien invalide.",
          not_found: "Demande d'approbation introuvable.",
        };
        const message = data.error
          ? (errorLabels[data.error] ?? `Erreur : ${data.error}`)
          : `Erreur HTTP ${res.status}`;
        setState({ kind: "error", message });
        return;
      }
      setState({
        kind: "success",
        vote,
        sessionApproved: Boolean(data.sessionApproved),
        sessionRejected: Boolean(data.sessionRejected),
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  };

  if (state.kind === "success") {
    return (
      <div
        style={{
          padding: "var(--space-5)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md, 8px)",
          textAlign: "center",
          background: "var(--bg-elev)",
        }}
      >
        <p className="t-15" style={{ color: "var(--text)", margin: 0 }}>
          Votre vote <strong>{state.vote === "approved" ? "Approuver" : "Rejeter"}</strong> a été
          enregistré.
        </p>
        {state.sessionApproved ? (
          <p
            className="t-11"
            style={{
              color: "var(--accent-teal)",
              marginTop: "var(--space-2)",
              margin: 0,
            }}
          >
            Tous les approbateurs ont validé — la mission va s&apos;exécuter.
          </p>
        ) : state.sessionRejected ? (
          <p
            className="t-11"
            style={{
              color: "var(--text-faint)",
              marginTop: "var(--space-2)",
              margin: 0,
            }}
          >
            La mission a été annulée.
          </p>
        ) : (
          <p
            className="t-11"
            style={{
              color: "var(--text-faint)",
              marginTop: "var(--space-2)",
              margin: 0,
            }}
          >
            En attente des autres approbateurs.
          </p>
        )}
      </div>
    );
  }

  const submitting = state.kind === "submitting";

  return (
    <div>
      <label
        className="t-9"
        style={{
          display: "block",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-caption)",
          marginBottom: "var(--space-2)",
        }}
      >
        Commentaire (optionnel)
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Précision, contrainte, condition…"
        maxLength={1000}
        disabled={submitting}
        style={{
          width: "100%",
          padding: "var(--space-3)",
          background: "var(--bg-elev)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md, 8px)",
          color: "var(--text)",
          fontSize: "var(--ct-font-size-sm)",
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: "80px",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          marginTop: "var(--space-4)",
        }}
      >
        <button
          type="button"
          onClick={() => submit("approved")}
          disabled={submitting}
          style={{
            flex: 1,
            padding: "var(--space-3) var(--space-5)",
            background: "var(--accent-teal)",
            color: "var(--text-on-accent, var(--bg))",
            border: approvePreselect ? "2px solid var(--accent-teal)" : "none",
            borderRadius: "var(--radius-pill, 9999px)",
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.5 : 1,
            transition: "opacity 200ms ease",
          }}
        >
          {submitting ? "Envoi…" : "Approuver"}
        </button>
        <button
          type="button"
          onClick={() => submit("rejected")}
          disabled={submitting}
          style={{
            flex: 1,
            padding: "var(--space-3) var(--space-5)",
            background: "transparent",
            color: "var(--text)",
            border: rejectPreselect ? "2px solid var(--text)" : "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-pill, 9999px)",
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.5 : 1,
            transition: "opacity 200ms ease",
          }}
        >
          {submitting ? "Envoi…" : "Rejeter"}
        </button>
      </div>
      {state.kind === "error" ? (
        <p
          className="t-11"
          style={{
            color: "var(--danger)",
            marginTop: "var(--space-3)",
            margin: 0,
          }}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
