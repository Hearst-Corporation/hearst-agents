import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload — bridge IPC renderer ↔ main process.
 *
 * Exposé via contextBridge sous window.hearstBridge.
 * Node integration désactivée côté renderer : rien de Node n'est accessible
 * directement. Tout passe par ce contrat explicite.
 */

contextBridge.exposeInMainWorld("hearstBridge", {
  /** true quand le renderer tourne dans Electron (false en browser web). */
  isElectron: true as const,

  /** Plateforme hôte : "darwin" | "win32" | "linux" */
  platform: process.platform,

  // ── Clipboard ──────────────────────────────────────────────────────
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke("clipboard:write-text", text),
    readText: (): Promise<string> => ipcRenderer.invoke("clipboard:read-text"),
  },

  // ── Notifications natives ───────────────────────────────────────────
  notification: {
    show: (opts: { title: string; body: string }) => ipcRenderer.invoke("notification:show", opts),
  },

  // ── Dialogs ────────────────────────────────────────────────────────
  dialog: {
    openFile: (opts?: { filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke("dialog:open-file", opts),
  },

  // ── Shell ──────────────────────────────────────────────────────────
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  },

  // ── Navigation ────────────────────────────────────────────────────
  navigate: (path: string) => ipcRenderer.send("navigate", path),

  // ── OAuth popup ───────────────────────────────────────────────────
  oauth: {
    openPopup: (opts: { url: string; redirectHost: string }): Promise<{ code: string } | null> =>
      ipcRenderer.invoke("oauth:open-popup", opts),
  },

  // ── Event listeners (menu / deeplinks) ────────────────────────────
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const allowed = ["menu:new-thread", "menu:navigate", "deeplink:navigate"];
    if (!allowed.includes(channel)) return;
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.off(channel, wrapped);
  },
});
