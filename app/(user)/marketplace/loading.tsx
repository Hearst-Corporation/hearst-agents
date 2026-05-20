import { CardSkeleton } from "@/app/(user)/components/ui";

export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="t-30 font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-white/50 text-sm">
            Templates communautaires · workflows, rapports, personas
          </p>
        </div>
        <CardSkeleton count={6} columns={3} />
      </div>
    </div>
  );
}
