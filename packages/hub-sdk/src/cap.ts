// cap.ts — capability shims with cascade: window.hearstHub → Web API → silent fallback
// SSR-safe: every function guards typeof window before touching DOM/browser APIs.
// NEVER throws — all errors are caught and return false/null/undefined.

export interface CapShims {
  copyText(s: string): Promise<boolean>;
  saveFile(name: string, data: string): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  secureGet(k: string): Promise<string | null>;
  secureSet(k: string, v: string): Promise<boolean>;
  notify(title: string, body?: string): Promise<void>;
}

export function makeCap(): CapShims {
  return {
    // ── copyText ──────────────────────────────────────────────────────────
    async copyText(s: string): Promise<boolean> {
      try {
        if (typeof window === "undefined") return false;
        // No hearstHub path for copyText (not in HearstHub interface)
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(s);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    // ── saveFile ──────────────────────────────────────────────────────────
    async saveFile(name: string, data: string): Promise<boolean> {
      try {
        if (typeof window === "undefined") return false;
        if (window.hearstHub?.files?.save) {
          return await window.hearstHub.files.save({ suggestedName: name, data });
        }
        // Web fallback: Blob + <a download>
        const blob = new Blob([data], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch {
        return false;
      }
    },

    // ── openExternal ──────────────────────────────────────────────────────
    async openExternal(url: string): Promise<void> {
      try {
        if (typeof window === "undefined") return;
        if (window.hearstHub?.openExternal) {
          await window.hearstHub.openExternal(url);
          return;
        }
        window.open(url, "_blank", "noopener");
      } catch {
        // silent
      }
    },

    // ── secureGet ─────────────────────────────────────────────────────────
    async secureGet(k: string): Promise<string | null> {
      try {
        if (typeof window === "undefined") return null;
        if (window.hearstHub?.secrets?.get) {
          // Chemin natif Electron : stockage chiffré via main process.
          return await window.hearstHub.secrets.get(k);
        }
        // FALLBACK NAVIGATEUR — NON SÉCURISÉ : la valeur est stockée EN CLAIR
        // dans localStorage, sans chiffrement. N'utiliser ce chemin que pour
        // des données non sensibles (préférences UI, tokens jetables...).
        // En production Electron, window.hearstHub est toujours disponible.
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },

    // ── secureSet ─────────────────────────────────────────────────────────
    async secureSet(k: string, v: string): Promise<boolean> {
      try {
        if (typeof window === "undefined") return false;
        if (window.hearstHub?.secrets?.set) {
          // Chemin natif Electron : stockage chiffré via main process.
          return await window.hearstHub.secrets.set(k, v);
        }
        // FALLBACK NAVIGATEUR — NON SÉCURISÉ : la valeur est écrite EN CLAIR
        // dans localStorage, visible depuis n'importe quel script de la page.
        // En production Electron, window.hearstHub est toujours disponible.
        localStorage.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },

    // ── notify ────────────────────────────────────────────────────────────
    async notify(title: string, body?: string): Promise<void> {
      try {
        if (typeof window === "undefined") return;
        if (window.hearstHub?.notify) {
          await window.hearstHub.notify({ title, body });
          return;
        }
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(title, { body });
          } else if (Notification.permission !== "denied") {
            const perm = await Notification.requestPermission();
            if (perm === "granted") new Notification(title, { body });
          }
        }
      } catch {
        // silent
      }
    },
  };
}
