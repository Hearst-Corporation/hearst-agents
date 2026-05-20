import { RowSkeleton } from "@/app/(user)/components/ui";

export default function ArchiveLoading() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="t-24 font-semibold tracking-tight">Archive</h1>
          <p className="mt-1 text-sm text-white/50">Threads et assets de plus de 7 jours</p>
        </div>
        <RowSkeleton count={6} height="var(--space-12)" />
      </div>
    </div>
  );
}
