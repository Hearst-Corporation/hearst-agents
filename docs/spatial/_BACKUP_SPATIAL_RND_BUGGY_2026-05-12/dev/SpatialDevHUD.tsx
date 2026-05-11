"use client";

import { useSpatialSceneStore } from "@/stores/spatial-scene";

export function SpatialDevHUD() {
  const reset = useSpatialSceneStore((state) => state.reset);

  return (
    <div className="fixed top-4 right-4 z-[9999] glass-panel p-4 w-[340px] font-mono text-spatial-xs text-white/80 space-y-3 pointer-events-auto backdrop-blur-md bg-black/40 border border-white/10 rounded-lg">
      <div className="flex justify-between font-bold text-white">
        <span>DEV HUD</span>
      </div>
      
      <div className="space-y-1">
        <div className="text-white/40">Camera</div>
        <div id="dev-hud-cam-pos">Pos: [0.00, 0.00, 0.00]</div>
        <div id="dev-hud-cam-dir">Dir: [0.00, 0.00, 0.00]</div>
      </div>

      <div className="space-y-1">
        <div className="text-white/40">Named Objects</div>
        <div id="dev-hud-objects" className="max-h-[100px] overflow-y-auto space-y-1 text-[10px]">
          {/* Populated by InnerHUD */}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={() => {
            const camPos = document.getElementById("dev-hud-cam-pos")?.innerText || "";
            const camDir = document.getElementById("dev-hud-cam-dir")?.innerText || "";
            // on copie "position: [x,y,z], lookAt: [x,y,z]"
            const pMatch = camPos.match(/\[(.*?)\]/);
            const dMatch = camDir.match(/\[(.*?)\]/);
            const p = pMatch ? `position: [${pMatch[1]}]` : "";
            const d = dMatch ? `lookAt: [${dMatch[1]}]` : "";
            navigator.clipboard.writeText(`${p}, ${d}`);
            alert("Position caméra copiée !");
          }}
          className="bg-white/10 hover:bg-white/20 transition-colors py-1.5 rounded text-center font-sans text-spatial-sm cursor-pointer border border-white/10"
        >
          Copier position caméra
        </button>
        <button
          onClick={() => reset()}
          className="bg-red-500/20 hover:bg-red-500/40 text-red-100 transition-colors py-1.5 rounded text-center font-sans text-spatial-sm cursor-pointer border border-red-500/30"
        >
          Reset caméra (store)
        </button>
      </div>
    </div>
  );
}
