import { CardSkeleton, RowSkeleton } from "@/app/(user)/components/ui";

export default function AnalyticsLoading() {
  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <header className="mb-(--space-8) flex flex-col gap-(--space-2)">
        <h1 className="t-24 font-light text-text">Analytics cross-tenant</h1>
        <p className="t-13 text-text-muted">
          Usage agrégé par tenant : runs, cost LLM, missions, assets et users actifs.
        </p>
      </header>
      <div className="space-y-(--space-6)">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-(--space-4)">
          <CardSkeleton count={4} />
        </div>
        <RowSkeleton count={6} />
      </div>
    </div>
  );
}
