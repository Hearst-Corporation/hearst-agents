const TEAL = "#4A8B86";
const GOLD = "#FFBC3A";

type NodeState = "done" | "active" | "approval" | "pending";

interface TimelineStep {
  label: string;
  detail: string;
  time: string;
  state: NodeState;
}

const STEPS: TimelineStep[] = [
  {
    label: "Lecture emails entrants",
    detail: "OAuth token actif · 47 threads non lus récupérés",
    time: "0.4s",
    state: "done",
  },
  {
    label: "Classement par priorité",
    detail: "Urgents : 2 · À traiter : 3 · FYI : 18 · Newsletters : 24",
    time: "3.1s",
    state: "done",
  },
  {
    label: "Rédaction 5 drafts",
    detail: "5 drafts générés dans ta voix · prêts pour relecture",
    time: "8.2s",
    state: "approval",
  },
  {
    label: "Approbation utilisateur",
    detail: "En attente de validation avant envoi",
    time: "—",
    state: "active",
  },
  {
    label: "Envoi final",
    detail: "Emails approuvés envoyés depuis ton compte",
    time: "—",
    state: "pending",
  },
];

const OUTPUTS = [
  { value: "47", label: "emails lus" },
  { value: "5", label: "drafts rédigés" },
  { value: "3", label: "contacts KG enrichis" },
];

function NodeDot({ state }: { state: NodeState }) {
  if (state === "done") {
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ background: TEAL, color: "black" }}
      >
        ✓
      </div>
    );
  }
  if (state === "approval") {
    return (
      <div className="relative w-7 h-7 shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ background: GOLD, color: "black" }}
        >
          !
        </div>
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: GOLD, opacity: 0.3 }}
        />
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="relative w-7 h-7 shrink-0">
        <div className="w-7 h-7 rounded-full border-2" style={{ borderColor: TEAL }} />
        <div className="absolute inset-1 rounded-full animate-pulse" style={{ background: TEAL }} />
      </div>
    );
  }
  // pending
  return (
    <div
      className="w-7 h-7 rounded-full border shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.15)", opacity: 0.35 }}
    />
  );
}

export function MissionStage() {
  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Mission active · triage Gmail
          </span>
          {/* Running badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ border: `1px solid ${TEAL}22` }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: TEAL }} />
            <span
              className="font-mono text-[9px] uppercase tracking-[0.15em]"
              style={{ color: TEAL }}
            >
              RUNNING
            </span>
          </div>
        </div>
        <h2
          className="text-3xl font-medium"
          style={{ letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)" }}
        >
          Gmail Triage &amp; Draft
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Approbation requise avant l&apos;envoi.
        </p>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-0">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className="flex gap-4"
            style={{ opacity: step.state === "pending" ? 0.35 : 1 }}
          >
            {/* Node + connector */}
            <div className="flex flex-col items-center">
              <NodeDot state={step.state} />
              {i < STEPS.length - 1 && (
                <div
                  className="w-px flex-1 my-1"
                  style={{ background: "rgba(255,255,255,0.08)", minHeight: 24 }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {step.label}
                </span>
                <span
                  className="font-mono text-[10px] shrink-0"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {step.time}
                </span>
              </div>
              <p
                className="text-xs mt-1 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {step.detail}
              </p>

              {/* Approval bar */}
              {step.state === "approval" && (
                <div
                  className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: `${GOLD}0d`,
                    border: `1px solid ${GOLD}33`,
                  }}
                >
                  <span className="flex-1 text-xs" style={{ color: GOLD }}>
                    ⚠ 5 drafts prêts à envoyer — relire avant envoi
                  </span>
                  <button
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-80"
                    style={{ background: GOLD, color: "black" }}
                  >
                    Approuver
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-60"
                    style={{
                      border: `1px solid ${GOLD}55`,
                      color: GOLD,
                      background: "transparent",
                    }}
                  >
                    Voir drafts
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Outputs */}
      <div className="flex gap-6">
        {OUTPUTS.map((o) => (
          <div
            key={o.label}
            className="flex-1 rounded-xl px-5 py-4 flex flex-col gap-1"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span className="text-3xl font-extralight" style={{ color: "rgba(255,255,255,0.9)" }}>
              {o.value}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {o.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
