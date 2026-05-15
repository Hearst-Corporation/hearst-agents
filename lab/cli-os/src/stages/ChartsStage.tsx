import { ChartsScene } from "../scenes/ChartsScene";

export function ChartsStage() {
  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
      <ChartsScene />
    </div>
  );
}
