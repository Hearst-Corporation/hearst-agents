/**
 * HubSession — session utilisateur partagée par le hub avec les produits.
 * Format strict : access_token + refresh_token Supabase + identité minimale.
 * Le produit utilise ces tokens pour créer sa propre session Supabase locale
 * via supabase.auth.setSession({ access_token, refresh_token }).
 */
export interface HubSession {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: {
        id: string;
        email: string | null;
    };
}
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
    /**
     * SSO — le hub partage sa session Supabase. Le produit l'utilise pour
     * bridger sa propre session locale. Aucun mot de passe ne transite.
     */
    auth: {
        /** Récupère la session active du hub (null si non logué). */
        getSession(): Promise<HubSession | null>;
        /** Écoute les changements de session (login/logout). Retourne unsubscribe. */
        onSessionChange(cb: (s: HubSession | null) => void): () => void;
    };
    openExternal(url: string): Promise<void>;
    notify(a: {
        title: string;
        body?: string;
    }): Promise<void>;
    telemetry(event: string, payload?: unknown): void;
}
export type HubCapability = "storage" | "files" | "secrets" | "auth" | "openExternal" | "notify";
declare global {
    interface Window {
        hearstHub?: HearstHub;
    }
}
