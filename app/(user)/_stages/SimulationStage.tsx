"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { toast } from "@/app/hooks/use-toast";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { ConfirmModal } from "../components/ConfirmModal";
import type { RailItem } from "./types";

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: VISION_EASE } },
};

interface Variable {
  key: string;
  value: string;
}

interface Scenario {
  name: string;
  narrative: string;
  metrics: Record<string, string>;
  risks: string[];
  probability: number;
}

type Phase = "idle" | "running" | "done";

interface SimulationResponse {
  scenarios?: Scenario[];
  reasoning?: string | null;
  assetId?: string;
  error?: string;
  message?: string;
}

type Props = { mode?: string };

export function SimulationStage({ mode = "simulation" }: Props) {
  const stagePayload = useStageStore((s) => s.current);
  const setStageMode = useStageStore((s) => s.setMode);

  const initialScenario = stagePayload.mode === "simulation" ? stagePayload.scenario : undefined;

  const [phase, setPhase] = useState<Phase>("idle");
  const [scenarioInput, setScenarioInput] = useState(initialScenario ?? "");
  const [variables, setVariables] = useState<Variable[]>([{ key: "", value: "" }]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const autoRanRef = useRef(false);
  // Confirm avant de jeter scenarios + reasoning (30-50s de regen DeepSeek
  // perdus si l'utilisateur clique par erreur).
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const setSimulationSlice = useStageData((s) => s.setSimulation);
  useEffect(() => {
    setSimulationSlice({ scenario: scenarioInput, variables, scenarios, phase });
  }, [scenarioInput, variables, scenarios, phase, setSimulationSlice]);

  useEffect(() => {
    const items: RailItem[] =
      phase === "done"
        ? scenarios.slice(0, 4).map((sc) => ({
            t: sc.name,
            s: `${Math.round(sc.probability * 100)}%`,
            hot: sc.probability > 0.6,
          }))
        : [];
    useStageData
      .getState()
      .setShellData(
        phase === "idle" ? "Variables" : phase === "running" ? "En cours…" : "Scénarios",
        items,
      );
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [phase, scenarios]);

  const updateVariable = useCallback(
    (idx: number, patch: Partial<Variable>) =>
      setVariables((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))),
    [],
  );

  const addVariable = useCallback(
    () => setVariables((prev) => [...prev, { key: "", value: "" }]),
    [],
  );

  const removeVariable = useCallback(
    (idx: number) =>
      setVariables((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))),
    [],
  );

  const performReset = useCallback(() => {
    setPhase("idle");
    setScenarios([]);
    setReasoning(null);
    setAssetId(null);
    autoRanRef.current = false;
  }, []);

  // Si on a déjà du travail (scenarios OU reasoning), demander confirm avant
  // de reset. Sinon reset direct.
  const reset = useCallback(() => {
    if (scenarios.length > 0 || reasoning) {
      setConfirmResetOpen(true);
      return;
    }
    performReset();
  }, [scenarios.length, reasoning, performReset]);

  const handleConfirmReset = useCallback(() => {
    performReset();
    setConfirmResetOpen(false);
  }, [performReset]);

  const launchSimulation = useCallback(
    async (scenarioOverride?: string) => {
      const scenario = (scenarioOverride ?? scenarioInput).trim();
      if (!scenario) {
        toast.error("Scénario requis", "Décris le scénario business à simuler.");
        return;
      }
      const cleanedVars = variables
        .map((v) => ({ key: v.key.trim(), value: v.value.trim() }))
        .filter((v) => v.key.length > 0);

      setPhase("running");
      setScenarios([]);
      setReasoning(null);
      setAssetId(null);

      try {
        const res = await fetch("/api/v2/simulations/start", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, variables: cleanedVars }),
        });
        const data = (await res.json()) as SimulationResponse;
        if (!res.ok || !Array.isArray(data.scenarios)) {
          toast.error("Échec simulation", sanitizeApiError(data.message ?? data.error));
          setPhase("idle");
          // Reset autoRanRef sur path d'erreur — sinon un retry manuel (ou
          // remount avec même initialScenario) reste gated et ne relance jamais.
          autoRanRef.current = false;
          return;
        }
        setScenarios(data.scenarios);
        setReasoning(data.reasoning ?? null);
        setAssetId(data.assetId ?? null);
        setPhase("done");
      } catch (err) {
        toast.error("Erreur réseau", sanitizeApiError(err));
        setPhase("idle");
        autoRanRef.current = false;
      }
    },
    [scenarioInput, variables],
  );

  useEffect(() => {
    if (autoRanRef.current || !initialScenario || phase !== "idle") return;
    autoRanRef.current = true;
    setScenarioInput(initialScenario);
    void launchSimulation(initialScenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, launchSimulation, initialScenario]);

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col"
      style={{ gap: "var(--space-10)" }}
    >
      {/* Header */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h2 className="t-28 font-light text-[var(--text)]">
          {phase === "idle"
            ? "Chambre de simulation"
            : phase === "running"
              ? "Raisonnement…"
              : "Scénarios"}
        </h2>
        <p
          className="t-13 font-light text-[var(--text-ghost)]"
          style={{ lineHeight: "var(--leading-base)" }}
        >
          {phase === "idle"
            ? "DeepSeek R1 génère des scénarios business probabilistes."
            : phase === "running"
              ? "DeepSeek R1 raisonne sur votre scénario — 30-50 secondes."
              : `${scenarios.length} scénario${scenarios.length > 1 ? "s" : ""} générés.`}
        </p>
      </div>

      {/* Idle — formulaire */}
      {phase === "idle" && (
        <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <span className="t-11 font-light text-[var(--text-ghost)]">Scénario</span>
            <textarea
              value={scenarioInput}
              onChange={(e) => setScenarioInput(e.target.value)}
              placeholder="ex: lancer une nouvelle ligne SaaS PME en Europe au Q3, budget 800k€"
              rows={4}
              className="w-full bg-transparent t-13 font-light text-[var(--text-faint)] placeholder:text-[var(--text-ghost)] resize-y focus:outline-none focus:border-[var(--border-input)]"
              style={{
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--border-shell)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-1)",
                lineHeight: "var(--leading-base)",
                transition: "border-color var(--duration-base)",
              }}
            />
          </div>

          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <div className="flex items-center justify-between">
              <span className="t-11 font-light text-[var(--text-ghost)]">Variables clés</span>
              <button
                type="button"
                onClick={addVariable}
                className="t-11 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors focus-visible:outline-none"
                style={{
                  padding: "var(--space-1) var(--space-3)",
                  border: "1px solid var(--border-shell)",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                + Ajouter
              </button>
            </div>
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              {variables.map((variable, idx) => (
                <div key={idx} className="flex items-center" style={{ gap: "var(--space-2)" }}>
                  <input
                    type="text"
                    value={variable.key}
                    onChange={(e) => updateVariable(idx, { key: e.target.value })}
                    placeholder="Variable"
                    className="flex-1 min-w-0 bg-transparent t-13 font-light text-[var(--text-faint)] placeholder:text-[var(--text-ghost)] focus:outline-none focus:border-[var(--border-input)]"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      border: "1px solid var(--border-shell)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-1)",
                      transition: "border-color var(--duration-base)",
                    }}
                  />
                  <input
                    type="text"
                    value={variable.value}
                    onChange={(e) => updateVariable(idx, { value: e.target.value })}
                    placeholder="Valeur"
                    className="flex-1 min-w-0 bg-transparent t-13 font-light text-[var(--text-faint)] placeholder:text-[var(--text-ghost)] focus:outline-none focus:border-[var(--border-input)]"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      border: "1px solid var(--border-shell)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-1)",
                      transition: "border-color var(--duration-base)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeVariable(idx)}
                    disabled={variables.length === 1}
                    className="t-15 text-[var(--text-ghost)] hover:text-[var(--danger)] transition-colors disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline-none"
                    style={{
                      width: "var(--space-6)",
                      height: "var(--space-6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void launchSimulation()}
            disabled={!scenarioInput.trim()}
            className="self-start t-13 font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-input)]"
            style={{
              padding: "var(--space-2-5) var(--space-6)",
              background: "var(--surface-2)",
              border: "1px solid var(--border-input)",
              borderRadius: "var(--radius-pill)",
              color: "var(--text-muted)",
            }}
          >
            Lancer la simulation
          </button>
        </div>
      )}

      {/* Running */}
      {phase === "running" && (
        <div className="flex flex-col items-start" style={{ gap: "var(--space-4)" }}>
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <span
              className="rounded-full animate-pulse shrink-0"
              style={{
                width: "var(--space-2)",
                height: "var(--space-2)",
                background: "var(--accent-agent)",
                flexShrink: 0,
              }}
              aria-hidden
            />
            <span
              className="t-13 font-light text-[var(--text-ghost)]"
              style={{ lineHeight: "var(--leading-snug)" }}
            >
              {scenarioInput}
            </span>
          </div>
          <p className="t-11 font-light text-[var(--text-ghost)]">
            DeepSeek R1 raisonne — 30-50 secondes
          </p>
        </div>
      )}

      {/* Done — résultats */}
      {phase === "done" && (
        <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
          {reasoning && (
            <div
              style={{
                border: "1px solid var(--border-shell)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setThinkingOpen((o) => !o)}
                className="w-full flex items-center justify-between t-11 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors focus-visible:outline-none"
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--surface-1)",
                }}
              >
                <span>Raisonnement DeepSeek</span>
                <span>{thinkingOpen ? "−" : "+"}</span>
              </button>
              {thinkingOpen && (
                <pre
                  className="t-11 font-mono text-[var(--text-ghost)] overflow-auto"
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    maxHeight: "240px",
                    whiteSpace: "pre-wrap",
                    lineHeight: "var(--leading-relaxed)",
                  }}
                >
                  {reasoning}
                </pre>
              )}
            </div>
          )}

          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden"
            animate="show"
            className="flex flex-col"
            style={{ gap: "var(--space-4)" }}
          >
            {scenarios.map((scenario, idx) => (
              <ScenarioCard key={idx} scenario={scenario} />
            ))}
          </motion.div>

          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            {assetId !== null && (
              <button
                type="button"
                onClick={() => setStageMode({ mode: "asset", assetId })}
                className="t-13 font-medium text-[var(--text-muted)] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-input)]"
                style={{
                  padding: "var(--space-2) var(--space-5)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                Voir l'asset
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="t-13 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors focus-visible:outline-none"
              style={{
                padding: "var(--space-2) var(--space-5)",
                border: "1px solid var(--border-shell)",
                borderRadius: "var(--radius-pill)",
              }}
            >
              Nouvelle simulation
            </button>
          </div>
        </div>
      )}

      {/* Confirm restart simulation */}
      <ConfirmModal
        open={confirmResetOpen}
        title="Redémarrer la simulation ?"
        description="Les scenarios et le raisonnement actuels seront perdus (re-génération 30-50s)."
        confirmLabel="Redémarrer"
        variant="danger"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </motion.section>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const pct = Math.max(0, Math.min(100, Math.round(scenario.probability * 100)));
  const metricsEntries = Object.entries(scenario.metrics ?? {});
  const risks = Array.isArray(scenario.risks) ? scenario.risks : [];

  return (
    <motion.article
      variants={CARD_VARIANTS}
      className="flex flex-col"
      style={{
        padding: "var(--space-5) var(--space-6)",
        background: "var(--surface-1)",
        border: "1px solid var(--border-shell)",
        borderLeft: "2px solid var(--border-input)",
        borderRadius: "var(--radius-md)",
        gap: "var(--space-4)",
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <h3 className="t-15 font-semibold text-[var(--text-muted)]">{scenario.name}</h3>
        <span
          className="t-11 font-mono tabular-nums shrink-0"
          style={{ color: pct >= 60 ? "var(--text-faint)" : "var(--text-ghost)" }}
        >
          {pct}%
        </span>
      </header>

      <div
        className="w-full"
        style={{ height: "1px", background: "var(--border-shell)", position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "1px",
            width: `${pct}%`,
            background: "var(--border-input)",
          }}
        />
      </div>

      {scenario.narrative && (
        <p
          className="t-13 font-light text-[var(--text-ghost)]"
          style={{ lineHeight: "var(--leading-base)" }}
        >
          {scenario.narrative}
        </p>
      )}

      {metricsEntries.length > 0 && (
        <dl
          className="flex flex-col"
          style={{
            gap: "var(--space-1-5)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--border-shell)",
          }}
        >
          {metricsEntries.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="t-9 font-mono text-[var(--text-ghost)] truncate flex-1 min-w-0">
                {label.replace(/_/g, " ")}
              </dt>
              <dd className="t-13 font-mono text-[var(--text-faint)] shrink-0">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {risks.length > 0 && (
        <ul
          className="flex flex-col"
          style={{
            gap: "var(--space-1-5)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--border-shell)",
            listStyle: "none",
            paddingLeft: 0,
          }}
        >
          {risks.map((risk, idx) => (
            <li
              key={idx}
              className="flex items-start t-11 font-light"
              style={{
                gap: "var(--space-2)",
                color: "var(--accent-agent)",
                lineHeight: "var(--leading-base)",
              }}
            >
              <span className="shrink-0 mt-0.5" aria-hidden>
                ▲
              </span>
              <span className="flex-1 min-w-0">{risk}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.article>
  );
}
