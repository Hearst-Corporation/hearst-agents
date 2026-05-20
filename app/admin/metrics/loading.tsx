import { CardSkeleton, RowSkeleton } from "@/app/(user)/components/ui";

export default function MetricsLoading() {
  return (
    <div className="p-(--space-8) overflow-y-auto h-full">
      <div className="mb-(--space-8)">
        <h1 className="t-24 font-light text-text">Métriques système</h1>
      </div>
      <div className="space-y-(--space-6)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-(--space-4)">
          <CardSkeleton count={4} />
        </div>
        <RowSkeleton count={6} />
      </div>
    </div>
  );
}
