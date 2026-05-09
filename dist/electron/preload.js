"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("hearstBridge", {
  /** true quand le renderer tourne dans Electron (false en browser web). */
  isElectron: true,
  /** Plateforme hôte : "darwin" | "win32" | "linux" */
  platform: process.platform,
  // ── Clipboard ──────────────────────────────────────────────────────
  clipboard: {
    writeText: (text) => import_electron.ipcRenderer.invoke("clipboard:write-text", text),
    readText: () => import_electron.ipcRenderer.invoke("clipboard:read-text")
  },
  // ── Notifications natives ───────────────────────────────────────────
  notification: {
    show: (opts) => import_electron.ipcRenderer.invoke("notification:show", opts)
  },
  // ── Dialogs ────────────────────────────────────────────────────────
  dialog: {
    openFile: (opts) => import_electron.ipcRenderer.invoke("dialog:open-file", opts)
  },
  // ── Shell ──────────────────────────────────────────────────────────
  shell: {
    openExternal: (url) => import_electron.ipcRenderer.invoke("shell:open-external", url)
  },
  // ── Navigation ────────────────────────────────────────────────────
  navigate: (path) => import_electron.ipcRenderer.send("navigate", path),
  // ── OAuth popup ───────────────────────────────────────────────────
  oauth: {
    openPopup: (opts) => import_electron.ipcRenderer.invoke("oauth:open-popup", opts)
  },
  // ── Event listeners (menu / deeplinks) ────────────────────────────
  on: (channel, listener) => {
    const allowed = [
      "menu:new-thread",
      "menu:navigate",
      "deeplink:navigate"
    ];
    if (!allowed.includes(channel)) return;
    const wrapped = (_event, ...args) => listener(...args);
    import_electron.ipcRenderer.on(channel, wrapped);
    return () => import_electron.ipcRenderer.off(channel, wrapped);
  }
});
