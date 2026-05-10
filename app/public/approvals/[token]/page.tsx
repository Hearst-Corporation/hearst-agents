/**
 * Page publique d'approbation collaborative (Q3-D).
 *
 * Server component — pas de SessionProvider. L'auth est portée par la
 * signature HMAC du token dans l'URL.
 *
 * Affiche : contexte mission + 2 boutons Approuver / Rejeter qui POSTent
 * vers /api/v2/approvals/[token]/vote. Mode dark only, langage visuel
 * "silent luxury" — aligné sur app/public/reports/[token]/page.tsx.
 *
 * Le query param `?action=approve|reject` (présent dans le lien email)
 * ne pré-confirme pas le vote — il pré-sélectionne juste le bouton mis en
 * avant ; l'utilisateur doit toujours cliquer pour valider (CSRF-safe).
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  verifyApprovalToken,
  getApprovalByTokenHash,
  getApprovalState,
} from "@/lib/missions/approvals";
import { createClient } from "@supabase/supabase-js";
import { ApprovalVoteForm } from "./vote-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string }>;
}

interface ApprovalContext {
  status: "ok";
  approvalId: string;
  missionId: string;
  missionName: string;
  missionInput: string;
  approverEmail: string;
  vote: "pending" | "approved" | "rejected";
  expiresAt: string;
  state: {
    mode: "all" | "any" | "majority";
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    isApproved: boolean;
    isRejected: boolean;
  } | null;
}

interface ApprovalError {
  status: "error";
  code: string;
}

async function loadApproval(
  token: string,
): Promise<ApprovalContext | ApprovalError> {
  const v = verifyApprovalToken(token);
  if (!v.ok) {
    return { status: "error", code: v.reason };
  }
  const row = await getApprovalByTokenHash(v.tokenHash);
  if (!row) return { status: "error", code: "not_found" };

  // Lookup mission name + input depuis Supabase
  let missionName = "Mission";
  let missionInput = "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: mission } = await sb
      .from("missions")
      .select("title, actions")
      .eq("id", row.mission_id)
      .maybeSingle();
    if (mission) {
      missionName = mission.title ?? missionName;
      const actions = mission.actions as Record<string, unknown> | null;
      missionInput = (actions?.input as string) ?? "";
    }
  }

  const state = await getApprovalState(row.mission_id);

  return {
    status: "ok",
    approvalId: row.id,
    missionId: row.mission_id,
    missionName,
    missionInput,
    approverEmail: row.approver_email,
    vote: row.vote,
    expiresAt: row.expires_at,
    state: state
      ? {
          mode: state.mode,
          total: state.total,
          approved: state.approved,
          rejected: state.rejected,
          pending: state.pending,
          isApproved: state.isApproved,
          isRejected: state.isRejected,
        }
      : null,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await loadApproval(token);
  if (result.status === "error") {
    return {
      robots: { index: false, follow: false, nocache: true },
      title: "Approbation indisponible — Hearst OS",
    };
  }
  return {
    robots: { index: false, follow: false, nocache: true },
    title: `Approbation — ${result.missionName} — Hearst OS`,
  };
}

const MODE_LABELS: Record<"all" | "any" | "majority", string> = {
  all: "Unanimité requise",
  any: "Une approbation suffit",
  majority: "Majorité requise",
};

export default async function PublicApprovalPage({
  params,
  searchParams,
}: PageProps) {
  await headers();
  const { token } = await params;
  const { action } = await searchParams;
  const result = await loadApproval(token);

  if (result.status === "error") {
    const errorMessages: Record<string, string> = {
      malformed: "Lien invalide.",
      bad_signature: "Lien invalide.",
      expired: "Ce lien a expiré.",
      no_secret: "Service d'approbation indisponible.",
      not_found: "Cette demande d'approbation n'existe plus.",
    };
    const message =
      errorMessages[result.code] ?? "Cette demande d'approbation n'est plus valide.";
    return (
      <>
        <BrandedHeader />
        <main
          style={{
            padding: "var(--space-12) var(--space-6)",
            maxWidth: "560px",
            margin: "0 auto",
            color: "var(--text)",
            minHeight: "60vh",
          }}
        >
          <h1
            className="t-28"
            style={{ fontWeight: 300, letterSpacing: "-0.02em", margin: 0 }}
          >
            Approbation indisponible
          </h1>
          <p
            className="t-13"
            style={{ color: "var(--text-soft)", marginTop: "var(--space-3)" }}
          >
            {message}
          </p>
        </main>
        <MinimalFooter />
      </>
    );
  }

  const alreadyVoted = result.vote !== "pending";
  const sessionLocked = result.state?.isRejected ?? false;
  const presetAction = action === "reject" ? "rejected" : action === "approve" ? "approved" : null;

  return (
    <>
      <BrandedHeader />
      <main
        style={{
          padding: "var(--space-12) var(--space-6)",
          maxWidth: "640px",
          margin: "0 auto",
          color: "var(--text)",
        }}
      >
        <header style={{ marginBottom: "var(--space-8)" }}>
          <p
            className="t-9"
            style={{
              color: "var(--text-faint)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--space-2)",
            }}
          >
            Approbation requise
          </p>
          <h1
            className="t-28"
            style={{
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: 0,
            }}
          >
            {result.missionName}
          </h1>
          {result.missionInput ? (
            <p
              className="t-13"
              style={{
                color: "var(--text-soft)",
                marginTop: "var(--space-4)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {result.missionInput}
            </p>
          ) : null}
        </header>

        {result.state ? (
          <div
            style={{
              padding: "var(--space-4) var(--space-5)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md, 8px)",
              background: "var(--bg-elev)",
              marginBottom: "var(--space-6)",
            }}
          >
            <p
              className="t-9"
              style={{
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: 0,
                marginBottom: "var(--space-2)",
              }}
            >
              Statut session — {MODE_LABELS[result.state.mode]}
            </p>
            <p className="t-13" style={{ color: "var(--text)", margin: 0 }}>
              {result.state.approved} approuvé{result.state.approved > 1 ? "s" : ""} ·{" "}
              {result.state.pending} en attente
              {result.state.rejected > 0
                ? ` · ${result.state.rejected} rejeté${result.state.rejected > 1 ? "s" : ""}`
                : ""}{" "}
              sur {result.state.total}
            </p>
          </div>
        ) : null}

        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md, 8px)",
            marginBottom: "var(--space-6)",
          }}
        >
          <p
            className="t-9"
            style={{
              color: "var(--text-faint)",
              margin: 0,
              marginBottom: "var(--space-1)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Approbateur
          </p>
          <p className="t-13" style={{ color: "var(--text)", margin: 0 }}>
            {result.approverEmail}
          </p>
        </div>

        {alreadyVoted ? (
          <div
            style={{
              padding: "var(--space-5)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md, 8px)",
              textAlign: "center",
            }}
          >
            <p className="t-15" style={{ color: "var(--text)", margin: 0 }}>
              Vous avez déjà voté{" "}
              <strong>
                {result.vote === "approved" ? "Approuver" : "Rejeter"}
              </strong>
              .
            </p>
            <p
              className="t-11"
              style={{
                color: "var(--text-faint)",
                marginTop: "var(--space-2)",
                margin: 0,
              }}
            >
              Merci pour votre réponse.
            </p>
          </div>
        ) : sessionLocked ? (
          <div
            style={{
              padding: "var(--space-5)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md, 8px)",
              textAlign: "center",
            }}
          >
            <p className="t-15" style={{ color: "var(--text)", margin: 0 }}>
              Cette session a été clôturée par un autre approbateur (rejet).
            </p>
          </div>
        ) : (
          <ApprovalVoteForm token={token} presetAction={presetAction} />
        )}

        <p
          className="t-9"
          style={{
            color: "var(--text-faint)",
            marginTop: "var(--space-6)",
          }}
        >
          Lien personnel — ne pas transférer. Valide jusqu&apos;au{" "}
          {new Date(result.expiresAt).toLocaleString("fr-FR")}.
        </p>
      </main>
      <MinimalFooter />
    </>
  );
}

// ── Header / footer (alignés sur public/reports) ──────────────

function BrandedHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-6)",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <Link
        href="https://hearstcorporation.io"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          textDecoration: "none",
          color: "var(--text)",
        }}
      >
        <Image
          src="/hearst-logo.svg"
          alt="Hearst OS"
          width={64}
          height={16}
          style={{ height: "16px", width: "auto" }}
          priority
        />
      </Link>
      <span
        className="t-11"
        style={{ color: "var(--text-faint)", fontWeight: 300 }}
      >
        Approbation collaborative
      </span>
    </header>
  );
}

function MinimalFooter() {
  return (
    <footer
      style={{
        padding: "var(--space-6)",
        textAlign: "center",
        borderTop: "1px solid var(--border-subtle)",
        marginTop: "var(--space-12)",
      }}
    >
      <p
        className="t-9"
        style={{
          color: "var(--text-faint)",
          fontWeight: 300,
          margin: 0,
        }}
      >
        © 2026 Hearst Corporation · Approbation collaborative
      </p>
    </footer>
  );
}
