"use client";

import { Grid, OrbitControls, Stats } from "@react-three/drei";
import { SpatialGrid3D } from "./SpatialGrid3D";
import { SpatialObjectLabel } from "./SpatialObjectLabel";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";

function SpatialDevHUDUpdater() {
  const { camera, scene } = useThree();

  useEffect(() => {
    const list = document.getElementById("dev-hud-objects");
    if (list) {
      const names: string[] = [];
      scene.traverse(obj => {
        if (obj.name && !obj.name.includes("dev-grid-labels")) names.push(obj.name);
      });
      const uniqueNames = Array.from(new Set(names)).sort();
      list.innerHTML = uniqueNames.map(n => `<div>${n}</div>`).join("");
    }
  }, [scene]);

  useFrame(() => {
    const posEl = document.getElementById("dev-hud-cam-pos");
    const dirEl = document.getElementById("dev-hud-cam-dir");
    if (posEl) posEl.innerText = `Pos: [${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}]`;
    
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (dirEl) dirEl.innerText = `Dir: [${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)}]`;
  });

  return null;
}

export function SpatialDevHelpers() {
  const { scene } = useThree();
  const [monoliths, setMonoliths] = useState<{ target: THREE.Object3D; name: string }[]>([]);

  useEffect(() => {
    const found: { target: THREE.Object3D; name: string }[] = [];
    scene.traverse((obj) => {
      if (obj.name && (obj.name.startsWith("pillar-") || obj.name === "environment-model")) {
        found.push({ target: obj, name: obj.name });
      }
    });
    setMonoliths(found);
  }, [scene]);

  return (
    <group name="dev-helpers">
      <Stats className="spatial-stats" />
      <SpatialDevHUDUpdater />
      <Grid
        position={[0, -4, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={1}
        cellColor="#ffffff"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#808080"
        fadeDistance={40}
        fadeStrength={1}
        infiniteGrid
      />
      <axesHelper args={[2]} />
      <SpatialGrid3D />
      
      {monoliths.map((m, i) => (
        <SpatialObjectLabel key={i} target={m.target} name={m.name} />
      ))}
      
      <OrbitControls makeDefault />
    </group>
  );
}
