const TEAL = "#4A8B86";

type StepState = "done" | "running" | "pending";

const STEPS: { label: string; state: StepState }[] = [
  { label: "Navigation vers booking.com", state: "done" },
  { label: "Recherche vol Paris–LIS 18 mai", state: "done" },
  { label: "Sélection vol 08:15 Air France €189", state: "running" },
  { label: "Confirmation & paiement", state: "pending" },
];

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: TEAL, color: "black" }}
      >
        ✓
      </div>
    );
  }
  if (state === "running") {
    return (
      <div className="relative w-5 h-5 shrink-0">
        <div className="w-5 h-5 rounded-full animate-pulse" style={{ background: `${TEAL}55` }} />
        <div className="absolute inset-1.5 rounded-full" style={{ background: TEAL }} />
      </div>
    );
  }
  return (
    <div
      className="w-5 h-5 rounded-full border shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.15)" }}
    />
  );
}

export function BrowserStage() {
  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Browserbase · Stagehand · navigateur cloud
        </span>
        <h2
          className="text-3xl font-medium"
          style={{ letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)" }}
        >
          L&apos;agent pilote un vrai navigateur.
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Tâche : « réserve le vol Paris → Lisbonne mardi prochain, classe économique »
        </p>
      </div>

      {/* Browser frame */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Chrome bar */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
          </div>
          {/* URL */}
          <div
            className="flex-1 font-mono text-[11px] px-3 py-1 rounded-md"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            🔒 booking.com/flights/paris-lisbon
          </div>
          {/* Live badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{
              background: "rgba(140,100,255,0.15)",
              border: "1px solid rgba(140,100,255,0.3)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "#bb9eff" }}
            />
            <span
              className="font-mono text-[9px] uppercase tracking-[0.12em]"
              style={{ color: "#bb9eff" }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative p-6" style={{ background: "#f8f9fa", minHeight: 220 }}>
          {/* Mock form */}
          <div className="max-w-xs">
            <h3 className="text-base font-semibold mb-1" style={{ color: "#111" }}>
              Réserver votre vol
            </h3>
            <p className="text-xs mb-4" style={{ color: "#666" }}>
              Sélectionnez vos dates et destination. À partir de 89€ en économique.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs w-14 text-right" style={{ color: "#555" }}>
                  Départ
                </label>
                <input
                  readOnly
                  value="Paris CDG"
                  className="flex-1 text-xs px-2 py-1.5 rounded border"
                  style={{ borderColor: "#ddd", background: "white", color: "#333" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs w-14 text-right" style={{ color: "#555" }}>
                  Retour
                </label>
                <input
                  readOnly
                  value="Lisbonne LIS"
                  className="flex-1 text-xs px-2 py-1.5 rounded border"
                  style={{ borderColor: "#ddd", background: "white", color: "#333" }}
                />
              </div>
            </div>
            {/* Search button with teal halo */}
            <div className="relative inline-block">
              <div
                className="absolute inset-0 rounded-lg animate-pulse"
                style={{ background: `${TEAL}33`, transform: "scale(1.15)", filter: "blur(6px)" }}
              />
              <button
                className="relative px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: TEAL }}
              >
                Rechercher
              </button>
            </div>
          </div>

          {/* Cursor */}
          <div className="absolute pointer-events-none" style={{ left: "38%", top: "65%" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 1l10 6-4 1 2 5-2 1-2-5-3 3V1z"
                fill="white"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="0.6"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {STEPS.map((step) => (
          <div
            key={step.label}
            className="flex items-center gap-3"
            style={{ opacity: step.state === "pending" ? 0.35 : 1 }}
          >
            <StepDot state={step.state} />
            <span
              className="text-sm font-light"
              style={{
                color:
                  step.state === "running" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
