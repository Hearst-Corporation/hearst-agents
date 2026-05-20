import { CardSkeleton, RowSkeleton } from "@/app/(user)/components/ui";

export default function HospitalityLoading() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="t-30 font-semibold tracking-tight">Hospitality</h1>
          <p className="mt-1 text-white/50 text-sm">Cockpit vertical hôtellerie</p>
        </div>

        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Indicateurs clés
          </h2>
          <CardSkeleton count={1} columns={1} height="var(--space-32)" />
        </div>

        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Workflows
          </h2>
          <RowSkeleton count={2} height="var(--space-16)" />
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Persona
          </h2>
          <CardSkeleton count={1} columns={1} height="var(--space-32)" />
        </div>
      </div>
    </div>
  );
}
