/**
 * VideoQuickLaunch — types & constantes partagés entre les sous-composants
 * (`VideoQuickLaunchPanel`, `VideoSimpleForm`, `VideoBatchForm`,
 * `VideoBatchGrid`, hooks SSE).
 *
 * Issue du découpe `VideoQuickLaunch.tsx` (P1) — voir
 * `app/(user)/components/VideoQuickLaunch.tsx` (re-export shim).
 */

export type Provider = "runway" | "heygen";
export type DurationOption = 5 | 10;
export type RatioOption = "1280:720" | "720:1280";

export type SinglePhase =
  | "idle"
  | "creating"
  | "queued"
  | "running"
  | "done"
  | "error";

export type BatchVariantPhase = "queued" | "running" | "done" | "error";

export type BatchPhase =
  | "idle"
  | "creating"
  | "running"
  | "done"
  | "error";

export const DURATION_LABELS: Record<DurationOption, string> = {
  5: "5 sec",
  10: "10 sec",
};

export const RATIO_LABELS: Record<RatioOption, string> = {
  "1280:720": "Paysage",
  "720:1280": "Portrait",
};

export const MAX_BATCH_VARIANTS = 4;

export interface BatchVariantForm {
  /** ID local pour la stable React key. */
  localId: string;
  prompt: string;
  provider: Provider;
  duration: DurationOption;
  ratio: RatioOption;
}

export interface BatchVariantRun {
  localId: string;
  /** Index dans le tableau de soumission — utilisé pour relier card ↔ form. */
  index: number;
  /** Form snapshot (provider/duration/ratio/prompt) pour affichage. */
  form: BatchVariantForm;
  /** jobId BullMQ retourné par /assets/batch. */
  jobId: string | null;
  /** variantId asset_variants. */
  variantId: string | null;
  phase: BatchVariantPhase;
  progress: number;
  errorMsg: string | null;
}

/**
 * Labels canoniques côté client : le worker n'expose pas le `message` de
 * `reportProgress` via QueueEvents (BullMQ ne stream que la valeur). On
 * reconstruit donc le label en fonction du % connu.
 */
export function progressLabel(progress: number, provider: Provider): string {
  if (progress < 5) return "Initialisation…";
  if (progress < 20) return "Soumission au provider";
  if (progress < 80)
    return provider === "runway"
      ? "Runway génère la vidéo…"
      : "HeyGen prépare l'avatar…";
  if (progress < 90) return "Téléchargement de la vidéo";
  if (progress < 100) return "Upload sur le storage";
  return "Vidéo prête";
}

export function makeBatchForm(
  seed?: Partial<BatchVariantForm>,
): BatchVariantForm {
  return {
    localId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    prompt: seed?.prompt ?? "",
    provider: seed?.provider ?? "runway",
    duration: seed?.duration ?? 5,
    ratio: seed?.ratio ?? "1280:720",
  };
}
