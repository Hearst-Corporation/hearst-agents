export interface CapShims {
    copyText(s: string): Promise<boolean>;
    saveFile(name: string, data: string): Promise<boolean>;
    openExternal(url: string): Promise<void>;
    secureGet(k: string): Promise<string | null>;
    secureSet(k: string, v: string): Promise<boolean>;
    notify(title: string, body?: string): Promise<void>;
}
export declare function makeCap(): CapShims;
