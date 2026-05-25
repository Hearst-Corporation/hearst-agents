"use client";

/**
 * useCommandeurSections — construit les sections de résultats de la palette.
 *
 * Fusionne les actions hardcodées, les threads récents et les résultats
 * de la recherche hybride en sections affichables. Tightly couplé aux
 * callbacks du Commandeur (setStageMode, setOpen, etc.).
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useMemo } from "react";
import type { StagePayload } from "@/stores/stage";
import type { CommandRow } from "./use-commandeur-actions";
import type { CommandeurSearchResults } from "./use-commandeur-data";

export interface CommandSection {
  key: string;
  title: string;
  rows: CommandRow[];
}

interface UseCommandeurSectionsParams {
  query: string;
  allActions: CommandRow[];
  recentRows: CommandRow[];
  results: CommandeurSearchResults;
  setStageMode: (payload: StagePayload) => void;
  setActiveThread: (id: string) => void;
  setOpen: (v: boolean) => void;
  router: AppRouterInstance;
}

export function useCommandeurSections({
  query,
  allActions,
  recentRows,
  results,
  setStageMode,
  setActiveThread,
  setOpen,
  router,
}: UseCommandeurSectionsParams): CommandSection[] {
  return useMemo<CommandSection[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const filteredActions = !trimmed
      ? allActions
      : allActions.filter(
          (a) =>
            a.label.toLowerCase().includes(trimmed) ||
            (a.hint ?? "").toLowerCase().includes(trimmed),
        );

    const out: CommandSection[] = [];
    if (filteredActions.length > 0) {
      out.push({ key: "actions", title: "Actions", rows: filteredActions });
    }

    if (!trimmed && recentRows.length > 0) {
      out.push({ key: "recent", title: "Récents", rows: recentRows });
    }

    if (trimmed) {
      if (results.assets.length > 0) {
        out.push({
          key: "assets",
          title: "Assets",
          rows: results.assets.map((a) => ({
            id: `asset-${a.id}`,
            kind: "asset" as const,
            label: a.title,
            hint: a.kind,
            perform: () => {
              setStageMode({ mode: "asset", assetId: a.id } as StagePayload);
              setOpen(false);
            },
          })),
        });
      }
      if (results.missions.length > 0) {
        out.push({
          key: "missions",
          title: "Missions",
          rows: results.missions.map((m) => ({
            id: `mission-${m.id}`,
            kind: "mission" as const,
            label: m.title,
            hint: m.status,
            perform: () => {
              setStageMode({ mode: "mission", missionId: m.id } as StagePayload);
              setOpen(false);
            },
          })),
        });
      }
      if (results.threads.length > 0) {
        out.push({
          key: "threads",
          title: "Conversations",
          rows: results.threads.map((t) => ({
            id: `thread-${t.id}`,
            kind: "thread" as const,
            label: t.title,
            hint: t.preview.slice(0, 60),
            perform: () => {
              setActiveThread(t.id);
              setStageMode({ mode: "chat", threadId: t.id } as StagePayload);
              setOpen(false);
            },
          })),
        });
      }
      if (results.kgNodes.length > 0) {
        out.push({
          key: "kg",
          title: "Knowledge",
          rows: results.kgNodes.map((n) => ({
            id: `kg-${n.id}`,
            kind: "kg" as const,
            label: n.label,
            hint: n.type,
            perform: () => {
              setStageMode({ mode: "kg", entityId: n.id } as StagePayload);
              setOpen(false);
            },
          })),
        });
      }
      if (results.runs.length > 0) {
        out.push({
          key: "runs",
          title: "Runs",
          rows: results.runs.map((r) => ({
            id: `run-${r.id}`,
            kind: "run" as const,
            label: r.label,
            hint: r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
              : "",
            perform: () => {
              router.push(`/runs/${r.id}`);
              setOpen(false);
            },
          })),
        });
      }
    }

    return out;
  }, [allActions, recentRows, query, results, setStageMode, setActiveThread, setOpen, router]);
}
