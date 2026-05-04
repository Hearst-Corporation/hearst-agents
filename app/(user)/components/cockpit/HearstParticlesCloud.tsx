"use client";
// lint-visual-disable-file
// Fallback hex pour Three.js Color (la valeur réelle vient de --cykan via getComputedStyle).

/**
 * HearstParticlesCloud — nuage de particules formant le H Hearst.
 *
 * Adapté de `MagneticParticles` du projet Hearst-app marketing. Différences
 * cockpit :
 * - Renderer dimensionné sur le container (panneau central), pas window
 * - ResizeObserver sur le container, pas window.resize
 * - Couleur lue runtime depuis `--cykan`
 * - Particle count réduit (le hero cockpit est plus petit qu'une landing)
 * - Pas d'event "explode" cockpit-wide (était lié au gate intro marketing)
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HERO_SCALE = 2.2;

function readCykanInt(): number {
  if (typeof window === "undefined") return 0x2dd4bf;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--cykan")
    .trim();
  if (!v) return 0x2dd4bf;
  const m = v.match(/^#([0-9a-fA-F]{6})$/);
  return m ? parseInt(m[1], 16) : 0x2dd4bf;
}

class ParticleCloud {
  container: HTMLDivElement;
  imageUrl: string;
  color: number;
  count: number;
  forming: boolean;
  baseOpacity: number;
  clock: THREE.Clock;
  mouse: THREE.Vector3;
  raycaster: THREE.Raycaster;
  plane: THREE.Plane;
  isMobile: boolean;
  resizeObserver?: ResizeObserver;

  normalizedCoords: { nx: number; ny: number }[] = [];

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  positions!: Float32Array;
  velocities!: Float32Array;
  targets!: Float32Array;
  geometry!: THREE.BufferGeometry;
  material!: THREE.PointsMaterial;
  points!: THREE.Points;

  animationFrameId?: number;

  constructor(container: HTMLDivElement, imageUrl: string, color: number, particleCount: number) {
    this.container = container;
    this.imageUrl = imageUrl;
    this.color = color;
    this.count = particleCount;
    this.forming = true;
    this.baseOpacity = 0.85;
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector3(9999, 9999, 9999);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this.isMobile = matchMedia("(pointer: coarse)").matches;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);

    this.initScene();
    this.loadImageAndInitParticles();
  }

  size() {
    const r = this.container.getBoundingClientRect();
    return { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
  }

  initScene() {
    const { w, h } = this.size();
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    this.container.addEventListener("mousemove", this.onMouseMove);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  loadImageAndInitParticles() {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      const aspect = img.width / img.height;
      let drawW = size;
      let drawH = size;
      if (aspect > 1) drawH = size / aspect;
      else drawW = size * aspect;
      const dx = (size - drawW) / 2;
      const dy = (size - drawH) / 2;

      ctx.drawImage(img, dx, dy, drawW, drawH);
      const imageData = ctx.getImageData(0, 0, size, size);

      const sampled: { nx: number; ny: number }[] = [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const alpha = imageData.data[(y * size + x) * 4 + 3];
          if (alpha > 128) {
            const nx = (x / size) * 2 - 1;
            const ny = -(y / size) * 2 + 1;
            sampled.push({ nx, ny });
            if (nx < minX) minX = nx;
            if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny;
            if (ny > maxY) maxY = ny;
          }
        }
      }

      if (sampled.length > 0) {
        const cx = (maxX + minX) / 2;
        const cy = (maxY + minY) / 2;
        for (const c of sampled) {
          c.nx -= cx;
          c.ny -= cy;
        }
      }

      this.normalizedCoords = sampled;
      this.initParticles();
      this.applyTargets();
      this.animate();
    };
    img.src = this.imageUrl;
  }

  initParticles() {
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.targets = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * 12;
      this.positions[i3 + 1] = (Math.random() - 0.5) * 12;
      this.positions[i3 + 2] = (Math.random() - 0.5) * 12;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      size: this.isMobile ? 0.025 : 0.014,
      color: this.color,
      transparent: true,
      opacity: this.baseOpacity,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  applyTargets() {
    if (!this.targets || this.normalizedCoords.length === 0) return;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const random =
        this.normalizedCoords[Math.floor(Math.random() * this.normalizedCoords.length)];
      this.targets[i3] = random.nx * HERO_SCALE;
      this.targets[i3 + 1] = random.ny * HERO_SCALE;
      this.targets[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }
  }

  onMouseMove(e: MouseEvent) {
    const rect = this.container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.mouse);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const { w, h } = this.size();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateParticles(dt: number) {
    if (!this.positions || !this.targets) return;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      const px = this.positions[i3];
      const py = this.positions[i3 + 1];
      const pz = this.positions[i3 + 2];

      let fx = 0, fy = 0, fz = 0;

      const dx = this.mouse.x - px;
      const dy = this.mouse.y - py;
      const dz = this.mouse.z - pz;

      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
      const strength = this.forming ? 0.4 : -2.5;

      fx += ((dx / dist) * strength) / dist;
      fy += ((dy / dist) * strength) / dist;
      fz += ((dz / dist) * strength) / dist;

      if (this.forming) {
        fx += (this.targets[i3] - px) * 1.2;
        fy += (this.targets[i3 + 1] - py) * 1.2;
        fz += (this.targets[i3 + 2] - pz) * 1.2;
      }

      this.velocities[i3] = (this.velocities[i3] + fx * dt) * 0.85;
      this.velocities[i3 + 1] = (this.velocities[i3 + 1] + fy * dt) * 0.85;
      this.velocities[i3 + 2] = (this.velocities[i3 + 2] + fz * dt) * 0.85;

      this.positions[i3] += this.velocities[i3];
      this.positions[i3 + 1] += this.velocities[i3 + 1];
      this.positions[i3 + 2] += this.velocities[i3 + 2];
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    if (this.points) this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.container.removeEventListener("mousemove", this.onMouseMove);
    this.resizeObserver?.disconnect();

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    if (this.renderer && this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }

    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}

interface HearstParticlesCloudProps {
  imageUrl?: string;
  particleCount?: number;
}

export function HearstParticlesCloud({
  imageUrl = "/hearst-mark-h.svg",
  particleCount,
}: HearstParticlesCloudProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<ParticleCloud | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const isMobile = matchMedia("(pointer: coarse)").matches;
    const count = particleCount ?? (isMobile ? 6000 : 15000);
    const color = readCykanInt();

    const initTimeout = setTimeout(() => {
      if (!containerRef.current) return;
      if (systemRef.current) {
        systemRef.current.destroy();
        systemRef.current = null;
      }
      systemRef.current = new ParticleCloud(containerRef.current, imageUrl, color, count);
    }, 50);

    return () => {
      clearTimeout(initTimeout);
      if (systemRef.current) {
        systemRef.current.destroy();
        systemRef.current = null;
      }
    };
  }, [imageUrl, particleCount]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none"
      aria-label="Logo Hearst en particules"
    />
  );
}
