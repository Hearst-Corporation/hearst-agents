import { CardSkeleton } from "@/app/(user)/components/ui";

export default function AgentsLoading() {
  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <div className="mb-(--space-8)">
        <h1 className="t-24 font-light text-text">Agents</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4)">
        <CardSkeleton count={6} />
      </div>
    </div>
  );
}
