"use client";

import { useEffect, useState } from "react";
import type { AssetVariant } from "@/lib/assets/variants";

interface CodeRunnerProps {
  variant: AssetVariant;
}

interface CodeOutput {
  code?: string;
  stdout?: string;
  stderr?: string;
  outputs?: Array<{ type: "text" | "image"; data: string }>;
  error?: string;
}

function CodeResults({ storageUrl }: { storageUrl: string }) {
  const [result, setResult] = useState<CodeOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetch(storageUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CodeOutput>;
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storageUrl, retryCount]);

  if (loading) {
    return <p className="t-13 font-light text-text-muted">Chargement des résultats…</p>;
  }
  if (fetchError || !result) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="t-13 text-(--danger)">
          {fetchError ?? "Impossible de charger les résultats"}
        </p>
        <button
          type="button"
          onClick={() => setRetryCount((n) => n + 1)}
          className="t-13 text-(--accent-teal) hover:underline focus-visible:ring-1 focus-visible:ring-(--accent-teal)/50 focus-visible:outline-none"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      {result.stdout && (
        <pre
          className="t-11 font-mono text-text-muted bg-surface-1 rounded-sm overflow-x-auto"
          style={{ padding: "var(--space-4)" }}
        >
          {result.stdout}
        </pre>
      )}
      {(result.error || result.stderr) && (
        <pre
          className="t-11 font-mono text-(--danger) bg-surface-1 rounded-sm overflow-x-auto"
          style={{ padding: "var(--space-4)" }}
        >
          {result.error ?? result.stderr}
        </pre>
      )}
      {result.outputs?.map((out, i) =>
        out.type === "image" ? (
          // Data URL (output Python/JS) — next/image n'apporte rien sur du
          // base64 inline ; on garde <img> mais on donne width/height pour
          // éviter le CLS (ratio 4:3 = défaut matplotlib/PIL).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={out.data}
            alt={`output-${i}`}
            width={800}
            height={600}
            className="w-full h-auto rounded-sm border border-(--border-shell)"
          />
        ) : (
          <pre
            key={i}
            className="t-11 font-mono text-text-muted bg-surface-1 rounded-sm overflow-x-auto"
            style={{ padding: "var(--space-4)" }}
          >
            {out.data}
          </pre>
        ),
      )}
    </div>
  );
}

export function CodeRunner({ variant }: CodeRunnerProps) {
  const isReady = variant.status === "ready" && !!variant.storageUrl;
  const isFailed = variant.status === "failed";

  return (
    <div className="border border-[var(--surface-2)] rounded-md bg-surface-1 p-6">
      <header className="flex items-center mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-pill ${
              isReady
                ? "bg-(--accent-teal)"
                : isFailed
                  ? "bg-(--danger)"
                  : "bg-(--warn) animate-pulse"
            }`}
            style={{ width: "var(--space-2)", height: "var(--space-2)" }}
            aria-hidden
          />
          <span
            className={`t-13 font-medium ${
              isReady ? "text-(--accent-teal)" : isFailed ? "text-(--danger)" : "text-(--warn)"
            }`}
          >
            {isReady ? "Code prêt" : isFailed ? "Échec" : "Exécution…"}
          </span>
        </div>
      </header>

      {isReady && variant.storageUrl ? (
        <CodeResults storageUrl={variant.storageUrl} />
      ) : isFailed ? (
        <p className="t-13 text-(--danger)">{variant.error ?? "Génération échouée"}</p>
      ) : (
        <p className="t-13 font-light text-text-muted">Exécution sandbox E2B…</p>
      )}
    </div>
  );
}
