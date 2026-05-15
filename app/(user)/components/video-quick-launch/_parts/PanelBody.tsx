"use client";

import type { RefObject } from "react";
import type {
  BatchPhase,
  BatchVariantForm,
  BatchVariantRun,
  DurationOption,
  Provider,
  RatioOption,
  SinglePhase,
} from "../types";
import { VideoBatchForm } from "../VideoBatchForm";
import { VideoSimpleForm } from "../VideoSimpleForm";

interface PanelBodyProps {
  batchMode: boolean;
  // Single
  prompt: string;
  setPrompt: (v: string) => void;
  provider: Provider;
  setProvider: (v: Provider) => void;
  duration: DurationOption;
  setDuration: (v: DurationOption) => void;
  ratio: RatioOption;
  setRatio: (v: RatioOption) => void;
  singlePhase: SinglePhase;
  singleProgress: number;
  phaseLabel: string;
  singleErrorMsg: string | null;
  isSingleBusy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  // Batch
  batchForms: BatchVariantForm[];
  updateBatchForm: (localId: string, patch: Partial<BatchVariantForm>) => void;
  addBatchForm: () => void;
  removeBatchForm: (localId: string) => void;
  isBatchBusy: boolean;
  batchDone: boolean;
  batchRuns: BatchVariantRun[];
  batchPhase: BatchPhase;
  batchError: string | null;
}

export function PanelBody({
  batchMode,
  prompt,
  setPrompt,
  provider,
  setProvider,
  duration,
  setDuration,
  ratio,
  setRatio,
  singlePhase,
  singleProgress,
  phaseLabel,
  singleErrorMsg,
  isSingleBusy,
  textareaRef,
  batchForms,
  updateBatchForm,
  addBatchForm,
  removeBatchForm,
  isBatchBusy,
  batchDone,
  batchRuns,
  batchPhase,
  batchError,
}: PanelBodyProps) {
  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto"
      style={{ padding: "var(--space-6)", gap: "var(--space-5)" }}
    >
      {!batchMode ? (
        <VideoSimpleForm
          prompt={prompt}
          setPrompt={setPrompt}
          provider={provider}
          setProvider={setProvider}
          duration={duration}
          setDuration={setDuration}
          ratio={ratio}
          setRatio={setRatio}
          phase={singlePhase}
          progress={singleProgress}
          phaseLabel={phaseLabel}
          errorMsg={singleErrorMsg}
          isBusy={isSingleBusy}
          textareaRef={textareaRef}
        />
      ) : (
        <VideoBatchForm
          forms={batchForms}
          updateForm={updateBatchForm}
          addForm={addBatchForm}
          removeForm={removeBatchForm}
          isBusy={isBatchBusy || batchDone}
          runs={batchRuns}
          batchPhase={batchPhase}
          batchError={batchError}
        />
      )}
    </div>
  );
}
