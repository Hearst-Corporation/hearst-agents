"use client";

import { Html } from "@react-three/drei";

export function SpatialGrid3D() {
  const gridCells = [];
  
  for (let c = 0; c < 10; c++) {
    const x = -9 + c * 2;
    const colName = String.fromCharCode(65 + c);
    
    for (let r = 0; r < 8; r++) {
      const z = -r * 2;
      const rowName = (r + 1).toString();
      const label = `${colName}${rowName}`;
      
      gridCells.push(
        <group name={`grid-cell-${label}`} key={`${c}-${r}`} position={[x, -3.9, z]}>
          <Html center transform zIndexRange={[100, 0]}>
            <div className="text-[8px] font-mono text-white/60 pointer-events-none select-none px-1 py-0.5 rounded bg-black/40 border border-white/10">
              {label}
            </div>
          </Html>
        </group>
      );
    }
  }

  return <group name="dev-grid-labels">{gridCells}</group>;
}
