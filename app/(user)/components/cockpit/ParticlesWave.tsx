"use client";
// lint-visual-disable-file
// Fallback hex pour Three.js Color (la valeur réelle vient de --cykan via getComputedStyle).

/**
 * ParticlesWave — onde sinusoïdale de particules pour le Stage Cockpit.
 * N rangées de particules sur des courbes sinusoïdales déphasées, animées en continu.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ROWS = 60;
const COLS = 140;
const TOTAL = ROWS * COLS;

const X_SPAN = 10;
const Z_DEPTH = 3.0;
const K = 1.4;
const ANIM_SPEED = 0.22;

function rowAmplitude(r: number): number {
  const t = r / (ROWS - 1);
  return 0.9 + 0.5 * Math.sin(t * Math.PI);
}

class WaveSystem {
  container: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  positions: Float32Array;
  baseX: Float32Array;
  baseZ: Float32Array;
  rowAmp: Float32Array;
  rowPhase: Float32Array;
  phase = 0;
  animId?: number;
  resizeObserver?: ResizeObserver;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    const { w, h } = this.size();

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000);
    this.camera.position.set(0, 2.2, 7);
    this.camera.lookAt(0, 0, -Z_DEPTH / 2);

    const isMobile = matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    const cv = this.renderer.domElement;
    cv.style.display = "block";
    cv.style.width = "100%";
    cv.style.height = "100%";

    this.positions = new Float32Array(TOTAL * 3);
    this.baseX = new Float32Array(TOTAL);
    this.baseZ = new Float32Array(TOTAL);
    this.rowAmp = new Float32Array(TOTAL);
    this.rowPhase = new Float32Array(TOTAL);

    for (let r = 0; r < ROWS; r++) {
      const z = -(r / (ROWS - 1)) * Z_DEPTH;
      const amp = rowAmplitude(r);
      const phaseOff = (r / ROWS) * Math.PI * 2.4;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = (c / (COLS - 1)) * X_SPAN - X_SPAN / 2;
        const y = amp * Math.sin(K * x + phaseOff);
        const i3 = i * 3;
        this.positions[i3] = x;
        this.positions[i3 + 1] = y;
        this.positions[i3 + 2] = z;
        this.baseX[i] = x;
        this.baseZ[i] = z;
        this.rowAmp[i] = amp;
        this.rowPhase[i] = phaseOff;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      size: isMobile ? 0.022 : 0.012,
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  size() {
    const r = this.container.getBoundingClientRect();
    return { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
  }

  onResize() {
    const { w, h } = this.size();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    this.animId = requestAnimationFrame(this.animate);
    this.phase += ANIM_SPEED * 0.016;

    for (let i = 0; i < TOTAL; i++) {
      const i3 = i * 3;
      const x = this.baseX[i];
      const amp = this.rowAmp[i] * (1 + 0.08 * Math.sin(this.phase * 1.3));
      this.positions[i3 + 1] = amp * Math.sin(K * x + this.rowPhase[i] + this.phase);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export function ParticlesWave() {
  const containerRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<WaveSystem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const t = setTimeout(() => {
      if (!containerRef.current) return;
      systemRef.current?.destroy();
      systemRef.current = new WaveSystem(containerRef.current);
    }, 60);
    return () => {
      clearTimeout(t);
      systemRef.current?.destroy();
      systemRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none pointer-events-none"
      aria-hidden
    />
  );
}
