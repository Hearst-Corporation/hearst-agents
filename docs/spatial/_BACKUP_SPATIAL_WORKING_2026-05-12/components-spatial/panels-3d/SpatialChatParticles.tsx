"use client";

import { useState, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { panelRegistry } from "@/lib/spatial/panel-registry";
import gsap from "gsap";

export function SpatialChatParticles() {
  const [active, setActive] = useState(false);
  const [targetPos, setTargetPos] = useState<THREE.Vector3 | null>(null);
  const sparklesRef = useRef<THREE.Group>(null);
  const progress = useRef({ value: 0 });

  useEffect(() => {
    const handleSumbit = (e: any) => {
      const { target } = e.detail;
      const pos = target ? panelRegistry.get(target) : null;
      
      setTargetPos(pos ? pos.clone() : new THREE.Vector3(0, 5, -10));
      setActive(true);
      progress.current.value = 0;

      gsap.to(progress.current, {
        value: 1,
        duration: 1.6,
        ease: "power2.out",
        onComplete: () => setActive(false)
      });
    };

    window.addEventListener('spatial-chat-submit', handleSumbit);
    return () => window.removeEventListener('spatial-chat-submit', handleSumbit);
  }, []);

  useFrame(() => {
    if (!active || !sparklesRef.current || !targetPos) return;

    // Start position: approximation of bottom center in 3D world
    const startPos = new THREE.Vector3(0, -5, 5);
    
    sparklesRef.current.position.lerpVectors(
      startPos,
      targetPos,
      progress.current.value
    );
  });

  if (!active) return null;

  return (
    <group ref={sparklesRef} name="chat-particles">
      <Sparkles 
        count={25} 
        scale={1} 
        size={2} 
        speed={2} 
        opacity={0.8} 
        color="#00e5cc" 
      />
    </group>
  );
}
