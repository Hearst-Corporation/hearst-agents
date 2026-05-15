export function PlaceholderStage({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32">
      <span
        className="font-mono text-[10px] uppercase tracking-[0.3em]"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        Stage en construction
      </span>
      <span className="text-2xl font-light" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </span>
    </div>
  );
}
