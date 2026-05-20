import { RowSkeleton } from "@/app/(user)/components/ui";

export default function RunsLoading() {
  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <div className="mb-(--space-8)">
        <h1 className="t-24 font-light text-text">Runs</h1>
        <p className="mt-(--space-1) t-13 text-text-muted">
          Chaque exécution, chaque trace, chaque token.
        </p>
      </div>
      <RowSkeleton count={8} />
    </div>
  );
}
