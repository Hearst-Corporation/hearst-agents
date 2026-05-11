"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useSpatialSelection } from "@/stores/spatial-selection";
import { panelRegistry } from "@/lib/spatial/panel-registry";
import gsap from "gsap";
import * as THREE from "three";

export function useSpatialCameraFocus() {
  const { camera } = useThree();
  const selected = useSpatialSelection((s) => s.selected);
  const initialPos = useRef(new THREE.Vector3(0, 1.5, 12));
  const initialLookAt = useRef(new THREE.Vector3(0, 0, -10));
  const currentTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (selected.length > 0) {
      const id = selected[0];
      const pos = panelRegistry.get(id);
      
      if (pos) {
        currentTarget.current = pos.clone();
        
        // Target camera position: offset +4 in Z from panel
        const targetPos = pos.clone().add(new THREE.Vector3(0, 0, 4));
        
        gsap.to(camera.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 1.8,
          ease: "power3.inOut",
          onUpdate: () => {
            camera.lookAt(pos);
          }
        });
      }
    } else {
      currentTarget.current = null;
      
      gsap.to(camera.position, {
        x: initialPos.current.x,
        y: initialPos.current.y,
        z: initialPos.current.z,
        duration: 1.6,
        ease: "power3.inOut",
        onUpdate: () => {
          camera.lookAt(initialLookAt.current);
        }
      });
    }
  }, [selected, camera]);

  return null;
}
