"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type MissionLike, missionToFocal } from "@/lib/ui/focal-mappers";
import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";

export default function MissionDeepLinkPage() {
  const params = useParams();
  const router = useRouter();
  const setFocal = useFocalStore((s) => s.setFocal);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const [error, setError] = useState<string | null>(null);

  const missionId = (params?.id as string) || "";

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;

    async function loadAndRedirect() {
      try {
        const res = await fetch("/api/v2/missions");
        if (!res.ok) throw new Error("Failed to load missions");
        const data = await res.json();
        if (cancelled) return;
        const mission = (data.missions as MissionLike[] | undefined)?.find(
          (m) => m.id === missionId,
        );
        if (!mission) {
          setError("Mission introuvable");
          return;
        }
        setFocal(missionToFocal(mission, activeThreadId));
        router.replace("/");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Échec du chargement de la mission");
      }
    }

    loadAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [missionId, activeThreadId, setFocal, router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="t-15 font-medium text-(--danger)">Erreur</p>
            <p className="t-13 text-text-muted max-w-sm">{error}</p>
            <button
              onClick={() => router.push("/missions")}
              className="t-13 font-light text-text-faint hover:text-(--accent-teal) transition-colors"
            >
              ← Missions
            </button>
          </>
        ) : (
          <p className="t-13 font-light text-text-faint animate-pulse">Chargement de la mission…</p>
        )}
      </div>
    </div>
  );
}
