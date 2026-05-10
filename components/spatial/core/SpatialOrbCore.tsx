// lint-visual-disable-file
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshTransmissionMaterial, Sphere, Float, Html } from "@react-three/drei";
import type { SpatialStage } from "@/lib/spatial/types";
import { ORB_RADIUS } from "@/lib/spatial/constants";
import { useSpatialMouseContext } from "@/providers/spatial/SpatialMouseProvider";

interface SpatialOrbCoreProps {
  stage: SpatialStage;
  hovered?: boolean;
  onClick?: () => void;
  logoSrc?: string;
}

interface StageVisual {
  scale: number;
  innerGlow: number;          // emissive intensity du core (très faible)
  haloOpacity: number;        // halo extérieur — drastiquement réduit
  haloScale: number;
  distortion: number;
  chromaticAberration: number;
  flowSpeed: number;          // vitesse du flux interne volumétrique
  attractionStrength: number;
}

/**
 * 3 états visuels du noyau :
 *  - idle    : froid, dense, respiration lente, halo quasi-invisible
 *  - focus   : un peu plus de matière interne, halo discret, légère attraction curseur
 *  - mission : noyau condensé, presque éteint — l'attention va aux agents
 */
const STAGE_VISUALS: Record<SpatialStage, StageVisual> = {
  idle:       { scale: 1.00, innerGlow: 0.06, haloOpacity: 0.030, haloScale: 1.18, distortion: 0.06, chromaticAberration: 0.012, flowSpeed: 0.08, attractionStrength: 0.0 },
  focus:      { scale: 1.06, innerGlow: 0.12, haloOpacity: 0.075, haloScale: 1.30, distortion: 0.10, chromaticAberration: 0.020, flowSpeed: 0.18, attractionStrength: 0.14 },
  mission:    { scale: 0.78, innerGlow: 0.04, haloOpacity: 0.020, haloScale: 1.12, distortion: 0.05, chromaticAberration: 0.010, flowSpeed: 0.06, attractionStrength: 0.04 },
  asset:      { scale: 0.55, innerGlow: 0.03, haloOpacity: 0.015, haloScale: 1.10, distortion: 0.04, chromaticAberration: 0.008, flowSpeed: 0.04, attractionStrength: 0.0 },
  expert:     { scale: 0.45, innerGlow: 0.02, haloOpacity: 0.012, haloScale: 1.08, distortion: 0.03, chromaticAberration: 0.008, flowSpeed: 0.03, attractionStrength: 0.0 },
  transition: { scale: 0.92, innerGlow: 0.05, haloOpacity: 0.025, haloScale: 1.15, distortion: 0.06, chromaticAberration: 0.012, flowSpeed: 0.10, attractionStrength: 0.0 },
};

/**
 * Shader procédural — flux interne volumétrique.
 * Trois nappes de noise lent qui se croisent, donnent l'illusion d'une matière
 * liquide froide en suspension. Aucun bloom, aucune émission directe.
 */
const flowVertexShader = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDirection = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const flowFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uOpacity;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  // 3D simplex-like noise — léger, suffisant pour un flux ambient
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m*m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float t = uTime * uFlowSpeed;
    vec3 p = vPosition * 1.6;

    // 3 nappes de flux qui se croisent → matière "liquide" lente
    float n1 = snoise(p + vec3(0.0, t,        0.0));
    float n2 = snoise(p * 1.4 + vec3(t * 0.7, 0.0, t * 0.3));
    float n3 = snoise(p * 0.8 + vec3(-t * 0.5, t * 0.4, 0.0));
    float density = (n1 * 0.5 + n2 * 0.35 + n3 * 0.25) * 0.5 + 0.5;
    density = smoothstep(0.35, 0.85, density);

    // Fresnel — la matière est plus visible aux bords vus de profil
    float fresnel = 1.0 - max(dot(vNormal, vViewDirection), 0.0);
    fresnel = pow(fresnel, 1.6);

    // Couleur : blanc cassé, pas de teinte chaude
    vec3 color = mix(vec3(0.78, 0.82, 0.88), vec3(0.95, 0.97, 1.00), density);

    float alpha = density * fresnel * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface FlowUniforms extends Record<string, THREE.IUniform> {
  uTime: { value: number };
  uFlowSpeed: { value: number };
  uOpacity: { value: number };
}

function createFlowUniforms(): FlowUniforms {
  return {
    uTime: { value: 0 },
    uFlowSpeed: { value: 0.08 },
    uOpacity: { value: 0.45 },
  };
}

export function SpatialOrbCore({
  stage,
  hovered = false,
  onClick,
  logoSrc = "/hearst-dot-h.svg",
}: SpatialOrbCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const flowRef = useRef<THREE.Mesh>(null);
  const flowMatRef = useRef<THREE.ShaderMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const transmissionRef = useRef<{ distortion: number; chromaticAberration: number } | null>(null);
  const htmlRef = useRef<HTMLDivElement>(null);

  const { smoothX, smoothY } = useSpatialMouseContext();

  const live = useRef({
    scale: 1,
    innerGlow: 0.06,
    halo: 0.03,
    haloScale: 1.18,
    distortion: 0.06,
    chromatic: 0.012,
    flowSpeed: 0.08,
    attraction: 0,
  });

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const target = STAGE_VISUALS[stage];

    // Hover gain — un peu plus marqué en idle pour rendre l'affordance évidente
    const hoverGain = hovered ? (stage === "idle" ? 1.35 : 1.18) : 1;

    const k = 0.05;
    live.current.scale       = THREE.MathUtils.lerp(live.current.scale, target.scale, k);
    live.current.innerGlow   = THREE.MathUtils.lerp(live.current.innerGlow, target.innerGlow * hoverGain, k);
    live.current.halo        = THREE.MathUtils.lerp(live.current.halo, target.haloOpacity * hoverGain, k);
    live.current.haloScale   = THREE.MathUtils.lerp(live.current.haloScale, target.haloScale, k);
    live.current.distortion  = THREE.MathUtils.lerp(live.current.distortion, target.distortion, k);
    live.current.chromatic   = THREE.MathUtils.lerp(live.current.chromatic, target.chromaticAberration, k);
    live.current.flowSpeed   = THREE.MathUtils.lerp(live.current.flowSpeed, target.flowSpeed, k);
    live.current.attraction  = THREE.MathUtils.lerp(live.current.attraction, target.attractionStrength, k);

    // Respiration lente — amplitude plus discrète
    const breathAmp = stage === "idle" ? 0.025 : stage === "focus" ? 0.018 : 0.010;
    const breath = Math.sin(t * 1.0) * breathAmp;

    if (groupRef.current) {
      const s = live.current.scale + breath;
      groupRef.current.scale.set(s, s, s);

      // Attraction curseur
      const mx = smoothX.get();
      const my = smoothY.get();
      const a = live.current.attraction;
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, mx * a * 1.2, 0.06);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, -my * a * 1.2, 0.06);
    }

    if (outerRef.current) {
      const rotSpeed = stage === "focus" ? 0.10 : 0.05;
      outerRef.current.rotation.y = t * rotSpeed;
      outerRef.current.rotation.x = Math.sin(t * 0.25) * 0.06;
    }

    // Inner core — légère pulse interne (très basse intensité, jamais "lampe")
    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = live.current.innerGlow;
    }

    // Flow material — uniforms live (mutation directe, hors render)
    if (flowMatRef.current) {
      const u = flowMatRef.current.uniforms as FlowUniforms;
      u.uTime.value = t;
      u.uFlowSpeed.value = live.current.flowSpeed;
      u.uOpacity.value = stage === "focus" ? 0.55 : stage === "idle" ? 0.45 : 0.30;
    }
    if (flowRef.current) {
      flowRef.current.rotation.y = t * 0.04;
      flowRef.current.rotation.x = Math.cos(t * 0.06) * 0.1;
    }

    // Halo — très réduit, pas de bloom
    if (haloMatRef.current) {
      haloMatRef.current.opacity = live.current.halo;
    }
    if (haloRef.current) {
      const hs = live.current.haloScale;
      haloRef.current.scale.set(hs, hs, hs);
    }

    // Logo HTML — drop-shadow très subtil, pas de filter glow
    if (htmlRef.current && groupRef.current) {
      const s = groupRef.current.scale.x;
      htmlRef.current.style.transform = `scale(${s})`;
      htmlRef.current.style.opacity = String(0.55 + live.current.innerGlow * 1.5);
      htmlRef.current.style.filter = `drop-shadow(0 0 ${1 + live.current.innerGlow * 6}px rgba(255,255,255,0.35))`;
    }

    if (transmissionRef.current) {
      transmissionRef.current.distortion = live.current.distortion;
      transmissionRef.current.chromaticAberration = live.current.chromatic;
    }
  });

  return (
    <Float speed={0.8} rotationIntensity={0.08} floatIntensity={0.3}>
      <group
        ref={groupRef}
        onClick={onClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        {/* Halo discret (additive) — drastiquement réduit, sans bloom */}
        <Sphere ref={haloRef} args={[ORB_RADIUS.outer * 1.12, 32, 32]}>
          <meshBasicMaterial
            ref={haloMatRef}
            color="#dbe3ee"
            transparent
            opacity={0.03}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </Sphere>

        {/* Flow volumétrique interne — matière liquide froide en suspension */}
        <Sphere ref={flowRef} args={[ORB_RADIUS.outer * 0.94, 80, 80]}>
          <shaderMaterial
            ref={flowMatRef}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            vertexShader={flowVertexShader}
            fragmentShader={flowFragmentShader}
            uniforms={createFlowUniforms()}
          />
        </Sphere>

        {/* Inner core — dense, sombre, légère émission froide */}
        <Sphere ref={innerRef} args={[ORB_RADIUS.inner * 0.85, 64, 64]}>
          <meshStandardMaterial
            color="#080a0e"
            emissive="#c8d4e4"
            emissiveIntensity={0.06}
            roughness={0.7}
            metalness={0.0}
          />
        </Sphere>

        {/* Frozen glass shell — translucide, froid, ior plus haut */}
        <Sphere ref={outerRef} args={[ORB_RADIUS.outer, 96, 96]}>
          <MeshTransmissionMaterial
            ref={transmissionRef as never}
            samples={14}
            thickness={0.45}
            chromaticAberration={0.012}
            anisotropy={0.12}
            distortion={0.06}
            distortionScale={0.18}
            temporalDistortion={0}
            ior={1.42}
            clearcoat={1}
            clearcoatRoughness={0.02}
            roughness={0.08}
            attenuationDistance={1.6}
            attenuationColor="#cfd8e4"
            color="#eef2f7"
          />
        </Sphere>

        {/* HTML logo — opacité plus contrôlée, pas de filter halo */}
        <Html center pointerEvents="none" zIndexRange={[100, 0]}>
          <div ref={htmlRef} className="flex items-center justify-center will-change-transform">
            <div
              style={{
                width: "80px",
                height: "88px",
                backgroundColor: "#ffffff",
                maskImage: `url('${logoSrc}')`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskImage: `url('${logoSrc}')`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
        </Html>
      </group>
    </Float>
  );
}
