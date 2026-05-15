import { CockpitScene } from "../scenes/CockpitScene";

export function CockpitLegacyStage() {
  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
      <CockpitScene />
    </div>
  );
}
