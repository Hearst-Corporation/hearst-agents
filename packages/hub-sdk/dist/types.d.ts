export interface HearstHub {
    version: 1;
    isHub: true;
    context: {
        productId: string;
        env: "local" | "prod";
        accent: string;
        theme: "dark";
    };
    onContext(cb: (c: HearstHub["context"]) => void): () => void;
    storage: {
        get(k: string): Promise<string | null>;
        set(k: string, v: string): Promise<boolean>;
        remove(k: string): Promise<boolean>;
    };
    files: {
        save(a: {
            suggestedName: string;
            data: string;
            mime?: string;
        }): Promise<boolean>;
        open(a?: {
            accept?: string;
        }): Promise<{
            name: string;
            data: string;
        } | null>;
    };
    secrets: {
        get(name: string): Promise<string | null>;
        set(name: string, v: string): Promise<boolean>;
    };
    openExternal(url: string): Promise<void>;
    notify(a: {
        title: string;
        body?: string;
    }): Promise<void>;
    telemetry(event: string, payload?: unknown): void;
}
export type HubCapability = "storage" | "files" | "secrets" | "openExternal" | "notify";
declare global {
    interface Window {
        hearstHub?: HearstHub;
    }
}
