"use client";
// lint-visual-disable-file
// Fallback hex pour Three.js Color (la valeur réelle vient de --cykan via getComputedStyle).

/**
 * SystemConstellation — Strate 2 du ContextRail (cockpit / chat).
 *
 * 6 rôles agents (lentille honnête sur events SSE — cf.
 * [lib/cockpit/agents.ts](lib/cockpit/agents.ts)) disposés en hexagone.
 * Chaque rôle est un noyau central + couronne de particules WebGL.
 *
 *   Idle   : noyau --text-faint, particules en respiration douce
 *   Active : noyau --cykan, burst orbital, particules AdditiveBlending
 *   Co-actifs (même runId, ≤ 2 s) : pont de particules entre 2 nodes
 *
 * Click sur un node → useSelectionStore.select({ kind: "agent", id }).
 * Aucun side-effect Stage (select-then-act).
 *
 * Pattern aligné avec [HearstParticlesCloud.tsx](app/(user)/components/cockpit/HearstParticlesCloud.tsx) :
 * vanilla three, ResizeObserver, cleanup propre, couleur cykan lue runtime.
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md) §5
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useRuntimeStore } from "@/stores/runtime";
import { useSelectionStore } from "@/stores/selection";
import {
  AGENT_METADATA,
  deriveActiveRolesFromEvents,
  deriveCoActivePairs,
  type AgentRoleId,
  type ActiveRole,
} from "@/lib/cockpit/agents";

// ── Layout ───────────────────────────────────────────────────

const REFRESH_TICK_MS = 500;
const PARTICLES_PER_NODE = 90;
const PARTICLES_PER_BRIDGE = 24;
const NODE_RADIUS = 0.085;
const HEX_RADIUS = 0.55;
const PARTICLE_SIZE_BASE = 0.045;

// Ordre canonique autour de l'hexagone (12h, 2h, 4h, 6h, 8h, 10h).
const HEX_ORDER: AgentRoleId[] = [
  "scribe",
  "pilot",
  "delve",
  "cortex",
  "pulse",
  "warden",
];

interface NodeLayout {
  id: AgentRoleId;
  x: number;
  y: number;
}

const NODE_LAYOUT: NodeLayout[] = HEX_ORDER.map((id, i) => {
  const angle = (-90 + i * 60) * (Math.PI / 180);
  return {
    id,
    x: HEX_RADIUS * Math.cos(angle),
    y: HEX_RADIUS * Math.sin(angle),
  };
});

const NODE_BY_ID: Record<AgentRoleId, NodeLayout> = NODE_LAYOUT.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<AgentRoleId, NodeLayout>,
);

function readCykanInt(): number {
  if (typeof window === "undefined") return 0x2dd4bf;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--cykan")
    .trim();
  if (!v) return 0x2dd4bf;
  const m = v.match(/^#([0-9a-fA-F]{6})$/);
  return m ? parseInt(m[1], 16) : 0x2dd4bf;
}

// ── Particle field ──────────────────────────────────────────

const TOTAL_NODES = 6;
const TOTAL_BRIDGES = 6; // au max chaque rôle peut être lié à un seul autre simultanément (12 / 2)
const TOTAL_PARTICLES =
  TOTAL_NODES * PARTICLES_PER_NODE + TOTAL_BRIDGES * PARTICLES_PER_BRIDGE;

class ConstellationField {
  container: HTMLDivElement;
  cykanColor: number;
  faintColor: number;
  scene!: THREE.Scene;
  camera!: THREE.OrthographicCamera;
  renderer!: THREE.WebGLRenderer;
  geometry!: THREE.BufferGeometry;
  material!: THREE.PointsMaterial;
  points!: THREE.Points;
  positions!: Float32Array;
  colors!: Float32Array;
  velocities!: Float32Array;
  /** Per-particle seed (random 0..1) pour décorréler les phases. */
  seeds!: Float32Array;
  /** Active states injectés par React. */
  activeIds: Set<AgentRoleId> = new Set();
  pairs: Array<[AgentRoleId, AgentRoleId]> = [];
  selectedId: AgentRoleId | null = null;
  clock = new THREE.Clock();
  resizeObserver?: ResizeObserver;
  rafId?: number;

  constructor(container: HTMLDivElement, cykanColor: number) {
    this.container = container;
    this.cykanColor = cykanColor;
    this.faintColor = 0x4b5060; // var(--text-faint) approx — fallback only
    this.initScene();
    this.initParticles();
    this.animate = this.animate.bind(this);
    this.animate();
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  size() {
    const r = this.container.getBoundingClientRect();
    return {
      w: Math.max(1, Math.floor(r.width)),
      h: Math.max(1, Math.floor(r.height)),
    };
  }

  initScene() {
    const { w, h } = this.size();
    this.scene = new THREE.Scene();
    const halfH = h / w; // ortho aspect-corrected
    this.camera = new THREE.OrthographicCamera(-1, 1, halfH, -halfH, 0.1, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.container.appendChild(canvas);
  }

  initParticles() {
    this.positions = new Float32Array(TOTAL_PARTICLES * 3);
    this.colors = new Float32Array(TOTAL_PARTICLES * 3);
    this.velocities = new Float32Array(TOTAL_PARTICLES * 3);
    this.seeds = new Float32Array(TOTAL_PARTICLES * 2);

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      this.seeds[i * 2] = Math.random();
      this.seeds[i * 2 + 1] = Math.random();
      // Couleur initiale : faint (via vertex colors RGB). Sera réécrite par updateFrame
      // si actif.
      const c = new THREE.Color(this.faintColor);
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );

    this.material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE_BASE,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const { w, h } = this.size();
    const halfH = h / w;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setState(
    activeRoles: ActiveRole[],
    pairs: Array<[AgentRoleId, AgentRoleId]>,
    selectedId: AgentRoleId | null,
  ) {
    this.activeIds = new Set(activeRoles.map((r) => r.id));
    this.pairs = pairs;
    this.selectedId = selectedId;
  }

  updateFrame(now: number) {
    if (!this.positions) return;
    const cykan = new THREE.Color(this.cykanColor);
    const faint = new THREE.Color(this.faintColor);

    // ── Nodes (clusters orbitaux) ──
    HEX_ORDER.forEach((id, nodeIdx) => {
      const layout = NODE_BY_ID[id];
      const isActive = this.activeIds.has(id);
      const isSelected = this.selectedId === id;
      const intensity = isActive ? 1 : isSelected ? 0.55 : 0.22;
      const radiusMul = isActive ? 1.25 : 1;

      const startIdx = nodeIdx * PARTICLES_PER_NODE;
      for (let p = 0; p < PARTICLES_PER_NODE; p++) {
        const i = startIdx + p;
        const i3 = i * 3;
        const i2 = i * 2;
        const sx = this.seeds[i2];
        const sy = this.seeds[i2 + 1];

        const orbit = NODE_RADIUS * radiusMul * (0.55 + sx * 0.6);
        const speed = 0.4 + sy * 0.7;
        const t = (now / 1000) * speed + sx * Math.PI * 2;
        const tx = layout.x + Math.cos(t) * orbit;
        const ty = layout.y + Math.sin(t) * orbit * 0.85;

        // Velocity damped attraction (donne une vie résiduelle).
        const dx = tx - this.positions[i3];
        const dy = ty - this.positions[i3 + 1];
        this.velocities[i3] = (this.velocities[i3] + dx * 0.18) * 0.75;
        this.velocities[i3 + 1] =
          (this.velocities[i3 + 1] + dy * 0.18) * 0.75;
        this.positions[i3] += this.velocities[i3];
        this.positions[i3 + 1] += this.velocities[i3 + 1];
        this.positions[i3 + 2] = 0;

        // Couleur : interpolation faint→cykan selon intensity + flicker.
        const flicker = 0.85 + Math.sin(t * 3) * 0.15;
        const k = intensity * flicker;
        const r = faint.r + (cykan.r - faint.r) * k;
        const g = faint.g + (cykan.g - faint.g) * k;
        const b = faint.b + (cykan.b - faint.b) * k;
        this.colors[i3] = r;
        this.colors[i3 + 1] = g;
        this.colors[i3 + 2] = b;
      }
    });

    // ── Bridges (ponts particules entre rôles co-actifs) ──
    const bridgeStart = TOTAL_NODES * PARTICLES_PER_NODE;
    for (let bi = 0; bi < TOTAL_BRIDGES; bi++) {
      const pair = this.pairs[bi];
      const partStart = bridgeStart + bi * PARTICLES_PER_BRIDGE;
      if (!pair) {
        // Hide unused bridge particles.
        for (let p = 0; p < PARTICLES_PER_BRIDGE; p++) {
          const i3 = (partStart + p) * 3;
          this.positions[i3] = 99;
          this.positions[i3 + 1] = 99;
          this.colors[i3] = 0;
          this.colors[i3 + 1] = 0;
          this.colors[i3 + 2] = 0;
        }
        continue;
      }
      const a = NODE_BY_ID[pair[0]];
      const b = NODE_BY_ID[pair[1]];
      for (let p = 0; p < PARTICLES_PER_BRIDGE; p++) {
        const i = partStart + p;
        const i3 = i * 3;
        const i2 = i * 2;
        const seed = this.seeds[i2];
        // Phase de progression sur le segment, qui boucle.
        const phase = ((now / 1500) + seed) % 1;
        const x = a.x + (b.x - a.x) * phase;
        const y = a.y + (b.y - a.y) * phase;
        // Subtle wobble perpendiculaire.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const wobble = Math.sin(phase * Math.PI * 4 + seed * 6) * 0.012;
        this.positions[i3] = x + px * wobble;
        this.positions[i3 + 1] = y + py * wobble;
        this.positions[i3 + 2] = 0;
        const intensity = 0.7 + Math.sin(phase * Math.PI) * 0.3;
        this.colors[i3] = cykan.r * intensity;
        this.colors[i3 + 1] = cykan.g * intensity;
        this.colors[i3 + 2] = cykan.b * intensity;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  animate() {
    this.rafId = requestAnimationFrame(this.animate);
    void this.clock.getDelta();
    this.updateFrame(performance.now());
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.renderer && this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.geometry?.dispose();
    this.material?.dispose();
  }
}

// ── React component ──────────────────────────────────────────

export function SystemConstellation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<ConstellationField | null>(null);

  const events = useRuntimeStore((s) => s.events);
  const selection = useSelectionStore((s) => s.current);
  const select = useSelectionStore((s) => s.select);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const color = readCykanInt();
    const initTimer = setTimeout(() => {
      if (!containerRef.current) return;
      if (fieldRef.current) {
        fieldRef.current.destroy();
        fieldRef.current = null;
      }
      fieldRef.current = new ConstellationField(containerRef.current, color);
    }, 50);
    return () => {
      clearTimeout(initTimer);
      fieldRef.current?.destroy();
      fieldRef.current = null;
    };
  }, []);

  const activeRoles = useMemo(
    () => deriveActiveRolesFromEvents(events, now),
    [events, now],
  );
  const pairs = useMemo(() => deriveCoActivePairs(activeRoles), [activeRoles]);
  const selectedId =
    selection?.kind === "agent" ? (selection.id as AgentRoleId) : null;

  useEffect(() => {
    fieldRef.current?.setState(activeRoles, pairs, selectedId);
  }, [activeRoles, pairs, selectedId]);

  const activeIds = useMemo(
    () => new Set(activeRoles.map((r) => r.id)),
    [activeRoles],
  );

  return (
    <div
      style={{
        position: "relative",
        height: "var(--space-40)",
        borderBottom: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      <div
        ref={containerRef}
        aria-label="Constellation système — 6 rôles agents"
        style={{ position: "absolute", inset: 0 }}
      />
      {/* Hit zones + labels HTML overlay : meilleur a11y et résolution texte. */}
      <NodeOverlay
        activeIds={activeIds}
        selectedId={selectedId}
        onSelect={(id) =>
          select({ kind: "agent", id, label: AGENT_METADATA[id].label })
        }
      />
    </div>
  );
}

// ── HTML overlay pour click + labels ─────────────────────────

const HIT_RADIUS_REM = 1.6;

function NodeOverlay({
  activeIds,
  selectedId,
  onSelect,
}: {
  activeIds: Set<AgentRoleId>;
  selectedId: AgentRoleId | null;
  onSelect: (id: AgentRoleId) => void;
}) {
  return (
    <div className="absolute inset-0">
      {NODE_LAYOUT.map((n) => {
        const isActive = activeIds.has(n.id);
        const isSelected = selectedId === n.id;
        const meta = AGENT_METADATA[n.id];
        // Conversion world coords (-1..1, -ratio..+ratio) → CSS pourcentage.
        // L'aspect ortho est w/h, le canvas remplit le container ; en
        // pourcentage le mapping reste linéaire : x [-1..1] → [0..100],
        // y [+ratio..-ratio] → [0..100] (Y inversé).
        const leftPct = ((n.x + 1) / 2) * 100;
        const topPct = ((1 - (n.y + 1) / 2)) * 100;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id)}
            aria-label={meta.label}
            aria-pressed={isSelected}
            className="absolute group focus:outline-none"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translate(-50%, -50%)",
              width: `${HIT_RADIUS_REM * 2}rem`,
              height: `${HIT_RADIUS_REM * 2}rem`,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              className="absolute t-9 font-medium whitespace-nowrap pointer-events-none"
              style={{
                left: "50%",
                top: "calc(100% - 0.4rem)",
                transform: "translateX(-50%)",
                color:
                  isActive || isSelected
                    ? "var(--text-l2)"
                    : "var(--text-faint)",
                textShadow: "0 0 6px var(--bg)",
                transition: "color var(--duration-base) var(--ease-out)",
              }}
            >
              {meta.label}
            </span>
            {isSelected && (
              <span
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "var(--space-7)",
                  height: "var(--space-7)",
                  borderRadius: "50%",
                  border: "1px solid var(--cykan)",
                  opacity: 0.7,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
