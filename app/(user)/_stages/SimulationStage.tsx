"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { toast } from "@/app/hooks/use-toast";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { StageLayout } from "../_shell/StageLayout";
import { ConfirmModal } from "../components/ConfirmModal";
import { Action, IconButton, StageErrorBanner } from "../components/ui";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

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
  const [simulationError, setSimulationError] = useState<string | null>(null);
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

  // Undo suppression variable : stocke temporairement la variable retirée.
  const [undoRemoved, setUndoRemoved] = useState<{ variable: Variable; idx: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addVariable = useCallback(
    (variable?: Variable) => setVariables((prev) => [...prev, variable ?? { key: "", value: "" }]),
    [],
  );

  const removeVariable = useCallback(
    (idx: number) => {
      setVariables((prev) => {
        if (prev.length === 1) return prev;
        const removed = prev[idx];
        // Enregistre pour undo (4s).
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoRemoved({ variable: removed, idx });
        undoTimerRef.current = setTimeout(() => setUndoRemoved(null), 4000);
        toast.info("Variable retirée", "Cliquez sur Rétablir pour annuler.");
        return prev.filter((_, i) => i !== idx);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleUndoRemove = useCallback(() => {
    if (!undoRemoved) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setVariables((prev) => {
      const next = [...prev];
      next.splice(undoRemoved.idx, 0, undoRemoved.variable);
      return next;
    });
    setUndoRemoved(null);
  }, [undoRemoved]);

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
      setSimulationError(null);

      try {
        const res = await fetch("/api/v2/simulations/start", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, variables: cleanedVars }),
        });
        const data = (await res.json()) as SimulationResponse;
        if (!res.ok || !Array.isArray(data.scenarios)) {
          const errorMsg = sanitizeApiError(data.message ?? data.error);
          setSimulationError(errorMsg);
          toast.error("Échec simulation", errorMsg);
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
        setSimulationError(null);
      } catch (err) {
        const errorMsg = sanitizeApiError(err);
        setSimulationError(errorMsg);
        toast.error("Erreur réseau", errorMsg);
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
      <StageLayout
        eyebrow="Simulation"
        title={
          phase === "idle"
            ? "Chambre de simulation"
            : phase === "running"
              ? "Raisonnement…"
              : "Scénarios"
        }
        subtitle="DeepSeek R1 · Raisonnement stratégique"
      >
        {/* Bannière erreur — affichée prioritairement */}
        {simulationError && <StageErrorBanner message={simulationError} />}

        {/* Idle — formulaire */}
        {phase === "idle" && (
          <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
            <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              <span className="t-11 font-light text-text-ghost">Scénario</span>
              <textarea
                value={scenarioInput}
                onChange={(e) => setScenarioInput(e.target.value)}
                placeholder="ex: lancer une nouvelle ligne SaaS PME en Europe au Q3, budget 800k€"
                rows={4}
                className="w-full bg-transparent t-13 font-light text-text-faint placeholder:text-text-ghost resize-y focus:outline-none focus:border-(--border-input)"
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
                <span className="t-11 font-light text-text-ghost">Variables clés</span>
                <Action variant="ghost" tone="neutral" size="sm" onClick={() => addVariable()}>
                  + Ajouter
                </Action>
              </div>
              <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
                {variables.map((variable, idx) => (
                  <div key={idx} className="flex items-center" style={{ gap: "var(--space-2)" }}>
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => updateVariable(idx, { key: e.target.value })}
                      placeholder="Variable"
                      className="flex-1 min-w-0 bg-transparent t-13 font-light text-text-faint placeholder:text-text-ghost focus:outline-none focus:border-(--border-input)"
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
                      className="flex-1 min-w-0 bg-transparent t-13 font-light text-text-faint placeholder:text-text-ghost focus:outline-none focus:border-(--border-input)"
                      style={{
                        padding: "var(--space-2) var(--space-3)",
                        border: "1px solid var(--border-shell)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-1)",
                        transition: "border-color var(--duration-base)",
                      }}
                    />
                    <IconButton
                      icon="×"
                      label="Retirer"
                      tone="muted"
                      size="xs"
                      onClick={() => removeVariable(idx)}
                      disabled={variables.length === 1}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bannière undo suppression variable */}
            {undoRemoved && (
              <div
                className="flex items-center justify-between"
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-shell)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span className="t-11 font-light text-text-ghost">Variable retirée.</span>
                <Action variant="ghost" tone="neutral" size="sm" onClick={handleUndoRemove}>
                  Rétablir
                </Action>
              </div>
            )}

            <Action
              variant="primary"
              tone="brand"
              onClick={() => void launchSimulation()}
              disabled={!scenarioInput.trim()}
              className="self-start"
            >
              Lancer la simulation
            </Action>
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
                className="t-13 font-light text-text-ghost"
                style={{ lineHeight: "var(--leading-snug)" }}
              >
                {scenarioInput}
              </span>
            </div>
            <p className="t-11 font-light text-text-ghost">DeepSeek R1 raisonne — 30-50 secondes</p>
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
                  className="w-full flex items-center justify-between t-11 font-light text-text-ghost hover:text-text-faint transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent-teal)"
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
                    className="t-11 font-mono text-text-ghost overflow-auto"
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      maxHeight: "var(--max-height-simulation-reasoning)",
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
                <Action
                  variant="secondary"
                  tone="neutral"
                  size="sm"
                  onClick={() => setStageMode({ mode: "asset", assetId })}
                >
                  Voir l&apos;asset
                </Action>
              )}
              <Action variant="secondary" tone="neutral" size="sm" onClick={reset}>
                Nouvelle simulation
              </Action>
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
      </StageLayout>
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
        <h3 className="t-14 font-medium text-(--text-soft)">{scenario.name}</h3>
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
          className="t-13 font-light text-text-ghost"
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
              <dt className="t-9 font-mono text-text-ghost truncate flex-1 min-w-0">
                {label.replace(/_/g, " ")}
              </dt>
              <dd className="t-13 font-mono text-text-faint shrink-0">{String(value)}</dd>
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
