import type { ServiceDefinition } from "@/lib/integrations/types";

export interface ChatInputProps {
  onSubmit: (
    message: string,
    opts?: { attachedAssetIds?: string[] },
  ) => void;
  placeholder?: string;
  connectedServices?: ServiceDefinition[];
  onProviderMention?: (providerId: string) => void;
}

export interface PdfAttachment {
  fileName: string;
  text: string;
  pageCount: number;
}

export type InlineGenStatus = "idle" | "pending" | "error";
