import { RowSkeleton } from "@/app/(user)/components/ui";

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="t-24 font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-(--ct-text-muted)">Signaux, rapports, exports</p>
        </div>
        <RowSkeleton count={5} height="var(--space-16)" />
      </div>
    </div>
  );
}
