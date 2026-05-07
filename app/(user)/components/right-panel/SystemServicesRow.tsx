"use client";
// lint-visual-disable-file
// Fallback hex pour Three.js Color (la valeur réelle vient de --cykan via getComputedStyle).

/**
 * SystemServicesRow — Strate 1 du ContextRail (cockpit / chat).
 *
 * Bandeau horizontal de particules WebGL : chaque service Composio sollicité
 * récemment (dérivé des events SSE `tool_call_*`) apparaît en cluster cykan
 * AdditiveBlending. Au tool_call : burst pop. Idle : scintillement subtil.
 * Fade-out 30 s sans nouvelle activité.
 *
 * Pattern aligné avec [HearstParticlesCloud.tsx](app/(user)/components/cockpit/HearstParticlesCloud.tsx) :
 * vanilla three, ResizeObserver, cleanup propre, couleur cykan lue runtime
 * via `getComputedStyle`. R3F est banni dans ce repo (commit `00fa04b`).
 *
 * Labels texte : HTML overlay absolu (pas de sprites texturés — meilleur
 * ratio résolution + a11y).
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md) §5
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useRuntimeStore } from "@/stores/runtime";
import {
  deriveActiveServicesFromEvents,
  type ActiveService,
} from "@/lib/cockpit/agents";

// ── Layout ───────────────────────────────────────────────────

const PARTICLES_PER_BURST = 60;
/** Taille en **pixels écran** (sizeAttenuation:false en OrthographicCamera). */
const PARTICLE_SIZE_PX = 4;
const REFRESH_TICK_MS = 1_000;
const MAX_VISIBLE_SERVICES = 6;

const SERVICE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Agenda",
  drive: "Drive",
  slack: "Slack",
  notion: "Notion",
  github: "GitHub",
  linear: "Linear",
  hubspot: "HubSpot",
  stripe: "Stripe",
};

function serviceLabel(id: string): string {
  return SERVICE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function readCykanInt(): number {
  if (typeof window === "undefined") return 0x2dd4bf;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--cykan")
    .trim();
  if (!v) return 0x2dd4bf;
  const m = v.match(/^#([0-9a-fA-F]{6})$/);
  return m ? parseInt(m[1], 16) : 0x2dd4bf;
}

// ── Particle system ──────────────────────────────────────────

interface ServiceCluster {
  id: string;
  centerX: number;
  /** Y central du cluster (légèrement décalé vers le bas pour laisser le
   *  label HTML overlay en haut de la zone). */
  centerY: number;
  bornAt: number;
  lastSeenAt: number;
  /** Indices dans le buffer global réservés à ce cluster. */
  particleStart: number;
  particleCount: number;
  /** Origine random par particule pour idle scintillation. */
  seeds: Float32Array;
}

class ServicesField {
  container: HTMLDivElement;
  color: number;
  scene!: THREE.Scene;
  camera!: THREE.OrthographicCamera;
  renderer!: THREE.WebGLRenderer;
  geometry!: THREE.BufferGeometry;
  material!: THREE.PointsMaterial;
  points!: THREE.Points;
  positions!: Float32Array;
  opacities!: Float32Array;
  velocities!: Float32Array;
  clusters: Map<string, ServiceCluster> = new Map();
  clock = new THREE.Clock();
  resizeObserver?: ResizeObserver;
  rafId?: number;
  totalParticles: number;

  constructor(container: HTMLDivElement, color: number, maxServices: number) {
    this.container = container;
    this.color = color;
    this.totalParticles = maxServices * PARTICLES_PER_BURST;
    this.initScene();
    this.initParticles();
    this.startLoop();
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
    // Ortho : -1..1 horizontal, vertical conserve le ratio.
    const halfH = h / w;
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
    this.positions = new Float32Array(this.totalParticles * 3);
    this.opacities = new Float32Array(this.totalParticles);
    this.velocities = new Float32Array(this.totalParticles * 3);

    // Initialement tout invisible et hors champ.
    for (let i = 0; i < this.totalParticles; i++) {
      this.positions[i * 3] = 99;
      this.positions[i * 3 + 1] = 99;
      this.positions[i * 3 + 2] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );

    this.material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE_PX,
      sizeAttenuation: false, // OBLIGATOIRE en OrthographicCamera
      color: this.color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    // Sans ça, Three frustum-cull les Points car la bounding box initiale
    // englobe les positions "hors champ" (99, 99) et n'est jamais recalculée
    // quand on bouge les particules. On a peu de points (≤ 360) — coût nul.
    this.points.frustumCulled = false;
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

  setActiveServices(services: ActiveService[], now: number) {
    // Layout : services égaux espacés sur la largeur normalisée (-0.85 à 0.85).
    const visible = services.slice(0, MAX_VISIBLE_SERVICES);
    const span = 1.7;
    const step = visible.length > 1 ? span / (visible.length - 1) : 0;
    const startX = visible.length > 1 ? -span / 2 : 0;

    // Clusters disparus : marquer pour fade-out.
    const visibleIds = new Set(visible.map((s) => s.id));
    for (const [id, cluster] of this.clusters.entries()) {
      if (!visibleIds.has(id)) {
        // Enterre les particules hors champ progressivement.
        for (let i = 0; i < cluster.particleCount; i++) {
          const idx = (cluster.particleStart + i) * 3;
          this.positions[idx] = 99;
          this.positions[idx + 1] = 99;
        }
        this.clusters.delete(id);
      }
    }

    // Réindexation des slots disponibles.
    const usedSlots = new Set(
      Array.from(this.clusters.values()).map((c) =>
        Math.floor(c.particleStart / PARTICLES_PER_BURST),
      ),
    );
    const freeSlots: number[] = [];
    for (let s = 0; s < MAX_VISIBLE_SERVICES; s++) {
      if (!usedSlots.has(s)) freeSlots.push(s);
    }

    // Y central des clusters (légèrement sous le centre du canvas pour
    // laisser le label HTML en haut). Bandeau 64 px → cam aspect ≈ 0.23 →
    // -0.06 cale les particules juste sous le label.
    const CLUSTER_CENTER_Y = -0.06;

    visible.forEach((service, i) => {
      const centerX = startX + step * i;
      let cluster = this.clusters.get(service.id);
      if (!cluster) {
        const slot = freeSlots.shift();
        if (slot === undefined) return;
        const start = slot * PARTICLES_PER_BURST;
        const seeds = new Float32Array(PARTICLES_PER_BURST * 2);
        for (let p = 0; p < PARTICLES_PER_BURST; p++) {
          seeds[p * 2] = Math.random();
          seeds[p * 2 + 1] = Math.random();
        }
        cluster = {
          id: service.id,
          centerX,
          centerY: CLUSTER_CENTER_Y,
          bornAt: now,
          lastSeenAt: service.lastEventTs,
          particleStart: start,
          particleCount: PARTICLES_PER_BURST,
          seeds,
        };
        this.clusters.set(service.id, cluster);
        // Spawn : positions au centre, vélocités à zéro. La force de rappel
        // orbitale dans updateFrame() les place naturellement sur leur orbite
        // en ~5 frames (damping 0.75 + attraction 0.18).
        for (let p = 0; p < PARTICLES_PER_BURST; p++) {
          const idx = (start + p) * 3;
          this.positions[idx] = centerX;
          this.positions[idx + 1] = CLUSTER_CENTER_Y;
          this.positions[idx + 2] = 0;
          this.velocities[idx] = 0;
          this.velocities[idx + 1] = 0;
          this.velocities[idx + 2] = 0;
        }
      } else {
        cluster.centerX = centerX;
        cluster.centerY = CLUSTER_CENTER_Y;
        if (service.lastEventTs > cluster.lastSeenAt) {
          cluster.lastSeenAt = service.lastEventTs;
          // Re-pulse : on fait juste glow + recall, vélocités déjà en place.
        }
      }
    });
  }

  updateFrame(now: number) {
    if (!this.positions) return;
    // Date.now()-based age (lastSeenAt vient de service.lastEventTs = Date.now()).
    const realNow = Date.now();
    for (const cluster of this.clusters.values()) {
      const ageMs = realNow - cluster.lastSeenAt;
      // Fade-out après 30 s d'inactivité — au-delà on évacue les particules.
      if (ageMs > 30_000) {
        for (let p = 0; p < cluster.particleCount; p++) {
          const idx = (cluster.particleStart + p) * 3;
          this.positions[idx] = 99;
          this.positions[idx + 1] = 99;
        }
        this.clusters.delete(cluster.id);
        continue;
      }
      for (let p = 0; p < cluster.particleCount; p++) {
        const i3 = (cluster.particleStart + p) * 3;
        const seedIdx = p * 2;
        const sx = cluster.seeds[seedIdx];
        const sy = cluster.seeds[seedIdx + 1];

        // Pattern aligné avec ConstellationField (Strate 2) : attraction
        // orbitale directe, damping 0.75. Plus stable que l'approche dt*5
        // qui pouvait éjecter les particules au burst initial.
        const orbitRadius = 0.06 + sx * 0.05;
        const orbitSpeed = 0.4 + sy * 0.6;
        const t = (now / 1000) * orbitSpeed + sx * Math.PI * 2;
        const targetX = cluster.centerX + Math.cos(t) * orbitRadius;
        const targetY = cluster.centerY + Math.sin(t) * orbitRadius * 0.5;

        const dx = targetX - this.positions[i3];
        const dy = targetY - this.positions[i3 + 1];
        this.velocities[i3] = (this.velocities[i3] + dx * 0.18) * 0.75;
        this.velocities[i3 + 1] = (this.velocities[i3 + 1] + dy * 0.18) * 0.75;
        this.positions[i3] += this.velocities[i3];
        this.positions[i3 + 1] += this.velocities[i3 + 1];
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  animate = () => {
    void this.clock.getDelta();
    this.updateFrame(performance.now());
    this.renderer.render(this.scene, this.camera);
  };

  startLoop = () => {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      this.animate();
    };
    tick();
  };

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

export function SystemServicesRow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<ServicesField | null>(null);
  const events = useRuntimeStore((s) => s.events);

  // Tick pour décay (1 s suffit, le RAF gère le reste à 60 fps).
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Init field une fois.
  useEffect(() => {
    if (!containerRef.current) return;
    const color = readCykanInt();
    const initTimer = setTimeout(() => {
      if (!containerRef.current) return;
      if (fieldRef.current) {
        fieldRef.current.destroy();
        fieldRef.current = null;
      }
      fieldRef.current = new ServicesField(
        containerRef.current,
        color,
        MAX_VISIBLE_SERVICES,
      );
    }, 50);
    return () => {
      clearTimeout(initTimer);
      fieldRef.current?.destroy();
      fieldRef.current = null;
    };
  }, []);

  // Sync state.
  const activeServices = deriveActiveServicesFromEvents(events, now);
  useEffect(() => {
    fieldRef.current?.setActiveServices(activeServices, performance.now());
  }, [activeServices]);

  return (
    <div
      style={{
        position: "relative",
        height: "var(--space-16)",
        borderBottom: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      {/* Canvas WebGL : remplit la zone, particules dans la moitié basse. */}
      <div
        ref={containerRef}
        aria-label="Services sollicités"
        style={{ position: "absolute", inset: 0 }}
      />
      {/* Labels en haut (no overlap avec les particules en bas). */}
      <ServiceLabelsOverlay services={activeServices} />
    </div>
  );
}

function ServiceLabelsOverlay({ services }: { services: ActiveService[] }) {
  const visible = services.slice(0, MAX_VISIBLE_SERVICES);
  if (visible.length === 0) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <span
          className="t-9 font-light"
          style={{ color: "var(--text-faint)" }}
        >
          Aucun service sollicité
        </span>
      </div>
    );
  }
  const span = 85; // % horizontal occupé (laisse 7.5% de chaque côté)
  const step = visible.length > 1 ? span / (visible.length - 1) : 0;
  const startPct = visible.length > 1 ? (100 - span) / 2 : 50;
  // Labels positionnés en haut du bandeau (espace réservé : ~22 px),
  // les particules WebGL occupent la moitié basse — pas de chevauchement.
  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: "var(--space-5)" }}>
      {visible.map((s, i) => {
        const leftPct = visible.length > 1 ? startPct + step * i : startPct;
        return (
          <span
            key={s.id}
            className="t-9 font-medium"
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              color: "var(--text-l2)",
              whiteSpace: "nowrap",
            }}
          >
            {serviceLabel(s.id)}
          </span>
        );
      })}
    </div>
  );
}
