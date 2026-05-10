"use client";

/**
 * /spatial/playground — hub de comparaison des assets visuels Spatial OS.
 *
 * Organisé par FAMILLE (noyau, nodes, agents, asset card, background).
 * Chaque famille a ses propres variantes définies dans le registry.
 *
 * Layout : sidebar familles à gauche, Canvas central, sidebar variantes
 * à droite. Tout vit dans la même page : on switche famille et variante
 * sans navigation. Sélection persistée (localStorage).
 *
 * Note : seule la famille "core" est branchée pour l'instant. Les autres
 * affichent un placeholder en attendant que Gemini livre les assets.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, PerspectiveCamera, Lightformer } from "@react-three/drei";
import { Suspense } from "react";
import {
  CORE_VARIANTS,
  DEFAULT_VARIANT_ID,
  FAMILIES,
  getVariant,
  type CoreStage,
  type FamilyId,
} from "../components/proposals/registry";

const STORAGE_FAMILY = "hearst.spatial.playground.family";
const STORAGE_VARIANT = "hearst.spatial.playground.variant";
const STAGE_OPTIONS: ReadonlyArray<CoreStage> = ["idle", "focus", "mission", "asset"];

export default function SpatialPlayground() {
  const [family, setFamily] = useState<FamilyId>("core");
  const [variantId, setVariantId] = useState<string>(DEFAULT_VARIANT_ID);
  const [stage, setStage] = useState<CoreStage>("idle");
  const [hovered, setHovered] = useState(false);

  // Restore last selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedFamily = window.localStorage.getItem(STORAGE_FAMILY) as FamilyId | null;
    if (savedFamily && FAMILIES.some((f) => f.id === savedFamily)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore localStorage au mount, prototype hors DS
      setFamily(savedFamily);
    }
    const savedVariant = window.localStorage.getItem(STORAGE_VARIANT);
    if (savedVariant && CORE_VARIANTS.some((v) => v.id === savedVariant)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore localStorage au mount, prototype hors DS
      setVariantId(savedVariant);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_FAMILY, family);
    }
  }, [family]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_VARIANT, variantId);
    }
  }, [variantId]);

  const variant = useMemo(() => getVariant(variantId), [variantId]);
  const currentIndex = useMemo(
    () => CORE_VARIANTS.findIndex((v) => v.id === variantId),
    [variantId]
  );
  const familyMeta = useMemo(() => FAMILIES.find((f) => f.id === family)!, [family]);

  const cycle = useCallback(
    (direction: 1 | -1) => {
      if (family !== "core") return;
      const next = (currentIndex + direction + CORE_VARIANTS.length) % CORE_VARIANTS.length;
      setVariantId(CORE_VARIANTS[next].id);
    },
    [currentIndex, family]
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") cycle(1);
      else if (e.key === "ArrowLeft") cycle(-1);
      else if (e.key >= "1" && e.key <= "4") {
        setStage(STAGE_OPTIONS[parseInt(e.key, 10) - 1]);
      } else if (e.key.toLowerCase() === "h") {
        setHovered((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  const Core = variant.Component;
  const fakeHoveredNode = hovered ? "playground-hover" : null;

  return (
    <main className="fixed inset-0 w-screen h-screen bg-black overflow-hidden font-sans z-50 flex">
      {/* SIDEBAR GAUCHE — Familles */}
      <FamilyNav family={family} onSelect={setFamily} />

      {/* CANVAS CENTRAL */}
      <section className="relative flex-1 overflow-hidden">
        {family === "core" ? (
          <CoreStage
            Core={Core}
            stage={stage}
            hoveredNode={fakeHoveredNode}
            variantLabel={variant.label}
            variantIndex={currentIndex}
            variantTotal={CORE_VARIANTS.length}
            brief={variant.brief}
            stageValue={stage}
            onStageChange={setStage}
            hovered={hovered}
            onHoverToggle={() => setHovered((h) => !h)}
          />
        ) : (
          <FamilyPlaceholder family={familyMeta.label} description={familyMeta.description} />
        )}

        {/* Lien retour /spatial */}
        <a
          href="/spatial"
          className="absolute top-0 right-0 z-10 text-white/40 hover:text-white/80 text-xs transition-colors"
          style={{ padding: "var(--space-8)" }}
        >
          ← retour /spatial
        </a>
      </section>

      {/* SIDEBAR DROITE — Variantes (uniquement pour la famille core pour l'instant) */}
      {family === "core" ? (
        <VariantNav variantId={variantId} onSelect={setVariantId} />
      ) : null}
    </main>
  );
}

/* ─────────── Family Nav (gauche) ─────────── */

function FamilyNav({
  family,
  onSelect,
}: {
  family: FamilyId;
  onSelect: (f: FamilyId) => void;
}) {
  return (
    <aside
      className="relative z-20 flex flex-col border-r border-white/5 bg-black/60 backdrop-blur-xl"
      style={{ width: "240px", padding: "var(--space-6)" }}
    >
      <header style={{ marginBottom: "var(--space-6)" }}>
        <div
          className="text-white/40 text-xs tracking-wide"
          style={{ marginBottom: "var(--space-1)" }}
        >
          Spatial Playground
        </div>
        <h1 className="text-white/90 text-base font-light">Familles d&apos;assets</h1>
      </header>

      <nav className="flex flex-col" style={{ gap: "var(--space-1)" }}>
        {FAMILIES.map((f) => {
          const isActive = f.id === family;
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              className="text-left transition-colors"
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--surface-2)" : "transparent",
                border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "transparent"}`,
                color: isActive ? "var(--text-l0)" : "var(--text-muted)",
                opacity: f.available ? 1 : 0.55,
              }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-light">{f.label}</span>
                <span
                  className="text-xs font-mono tabular-nums"
                  style={{ color: f.available ? "var(--text-faint)" : "var(--text-ghost)" }}
                >
                  {f.available ? f.count : "—"}
                </span>
              </div>
              <div
                className="text-white/40 text-xs font-light leading-snug"
                style={{ marginTop: "var(--space-1)" }}
              >
                {f.available ? f.description : "À venir"}
              </div>
            </button>
          );
        })}
      </nav>

      <footer className="mt-auto" style={{ paddingTop: "var(--space-6)" }}>
        <div
          className="text-white/30 text-xs font-light leading-relaxed"
          style={{ marginBottom: "var(--space-2)" }}
        >
          Raccourcis
        </div>
        <ul
          className="text-white/40 text-xs font-light leading-relaxed"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
        >
          <li>← / → : changer de variante</li>
          <li>1–4 : stage idle / focus / mission / asset</li>
          <li>h : simuler un hover de node</li>
        </ul>
      </footer>
    </aside>
  );
}

/* ─────────── Variant Nav (droite) ─────────── */

function VariantNav({
  variantId,
  onSelect,
}: {
  variantId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside
      className="relative z-20 flex flex-col border-l border-white/5 bg-black/60 backdrop-blur-xl"
      style={{ width: "260px", padding: "var(--space-6)" }}
    >
      <header style={{ marginBottom: "var(--space-6)" }}>
        <div
          className="text-white/40 text-xs tracking-wide"
          style={{ marginBottom: "var(--space-1)" }}
        >
          Variantes
        </div>
        <h2 className="text-white/90 text-base font-light">Noyau central</h2>
      </header>

      <nav className="flex flex-col" style={{ gap: "var(--space-1)" }}>
        {CORE_VARIANTS.map((v, i) => {
          const isActive = v.id === variantId;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              className="text-left transition-colors"
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--surface-2)" : "transparent",
                border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "transparent"}`,
                color: isActive ? "var(--text-l0)" : "var(--text-muted)",
              }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-light">{v.label}</span>
                <span className="text-white/30 text-xs font-mono tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div
                className="text-white/40 text-xs font-light leading-snug"
                style={{ marginTop: "var(--space-1)" }}
              >
                {v.source === "gemini" ? "Gemini" : "Original"}
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ─────────── Core Stage (Canvas + chrome) ─────────── */

function CoreStage({
  Core,
  stage,
  hoveredNode,
  variantLabel,
  variantIndex,
  variantTotal,
  brief,
  stageValue,
  onStageChange,
  hovered,
  onHoverToggle,
}: {
  Core: React.ComponentType<{
    stage: CoreStage;
    hoveredNode: string | null;
    onClick: () => void;
  }>;
  stage: CoreStage;
  hoveredNode: string | null;
  variantLabel: string;
  variantIndex: number;
  variantTotal: number;
  brief: string;
  stageValue: CoreStage;
  onStageChange: (s: CoreStage) => void;
  hovered: boolean;
  onHoverToggle: () => void;
}) {
  return (
    <>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} fov={45} />
        <color attach="background" args={["#000000"]} />

        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        <Suspense fallback={null}>
          <Environment resolution={512}>
            <Lightformer intensity={3} position={[0, 4, 4]} scale={[8, 8, 1]} />
            <Lightformer intensity={1.2} position={[0, -2, -6]} scale={[10, 10, 1]} />
          </Environment>

          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <Core stage={stage} hoveredNode={hoveredNode} onClick={() => {}} />
          </Float>
        </Suspense>
      </Canvas>

      {/* Top — nom variante */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{ padding: "var(--space-8)" }}
      >
        <div
          className="text-white/30 text-xs tracking-wide"
          style={{ marginBottom: "var(--space-1)" }}
        >
          Variante {variantIndex + 1} / {variantTotal}
        </div>
        <div className="text-white/90 text-2xl font-light">{variantLabel}</div>
      </div>

      {/* Bottom — controls + brief */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center"
        style={{ padding: "var(--space-8)", gap: "var(--space-4)" }}
      >
        <div
          className="flex pointer-events-auto"
          style={{
            gap: "var(--space-1)",
            padding: "var(--space-1)",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-2)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {STAGE_OPTIONS.map((s) => {
            const isActive = stageValue === s;
            return (
              <button
                key={s}
                onClick={() => onStageChange(s)}
                className="text-xs font-light transition-colors"
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-pill)",
                  background: isActive ? "var(--text-l0)" : "transparent",
                  color: isActive ? "#000" : "var(--text-muted)",
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            onClick={onHoverToggle}
            className="text-xs font-light transition-colors"
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-pill)",
              background: hovered ? "var(--accent-teal)" : "transparent",
              color: hovered ? "#000" : "var(--text-muted)",
              marginLeft: "var(--space-2)",
            }}
          >
            hover {hovered ? "on" : "off"}
          </button>
        </div>

        <div
          className="text-white/50 text-xs font-light leading-relaxed text-center"
          style={{ maxWidth: "640px" }}
        >
          {brief}
        </div>
      </div>
    </>
  );
}

/* ─────────── Placeholder pour les familles vides ─────────── */

function FamilyPlaceholder({
  family,
  description,
}: {
  family: string;
  description: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <div
        className="text-white/30 text-xs tracking-wide"
        style={{ marginBottom: "var(--space-2)" }}
      >
        À venir
      </div>
      <div
        className="text-white/80 text-2xl font-light"
        style={{ marginBottom: "var(--space-2)" }}
      >
        {family}
      </div>
      <p
        className="text-white/40 text-sm font-light leading-relaxed"
        style={{ maxWidth: "420px" }}
      >
        {description}
      </p>
      <p
        className="text-white/30 text-xs font-light leading-relaxed"
        style={{ marginTop: "var(--space-6)", maxWidth: "420px" }}
      >
        Une fois les variantes générées par Gemini et ajoutées au registry,
        elles apparaîtront ici avec le même format de comparaison que le noyau.
      </p>
    </div>
  );
}
