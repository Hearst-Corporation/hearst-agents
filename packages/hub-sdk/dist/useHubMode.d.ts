import type { HubCapability } from "./types.js";
interface HubModeSnapshot {
    isHub: boolean;
    ready: boolean;
    accent: string | undefined;
    productCtx: {
        id: string;
        name?: string;
        env: string;
    } | null;
    cap: HubCapability[];
}
export declare function useHubMode(): HubModeSnapshot;
export {};
