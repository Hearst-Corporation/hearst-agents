"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_child_process = require("child_process");
var import_path = require("path");
var http = __toESM(require("http"));
var net = __toESM(require("net"));
var isDev = process.defaultApp === true || process.env.NODE_ENV === "development";
var mainWindow = null;
var nextServer = null;
var serverPort = 9e3;
var tray = null;
var PROTOCOL = "hearst";
if (!import_electron.app.isDefaultProtocolClient(PROTOCOL)) {
  import_electron.app.setAsDefaultProtocolClient(PROTOCOL);
}
import_electron.app.on("open-url", (_event, url) => {
  handleDeeplink(url);
});
var gotLock = import_electron.app.requestSingleInstanceLock();
if (!gotLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deeplink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deeplink) handleDeeplink(deeplink);
  });
}
function handleDeeplink(url) {
  if (!mainWindow) return;
  try {
    const parsed = new URL(url);
    const path = parsed.searchParams.get("path") ?? parsed.pathname;
    if (path) {
      mainWindow.webContents.send("deeplink:navigate", { path });
    }
  } catch {
    console.warn("[electron] deeplink invalide :", url);
  }
}
function findFreePort(preferred) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(preferred, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.on("error", () => {
      const fallback = net.createServer();
      fallback.listen(0, "127.0.0.1", () => {
        const port = fallback.address().port;
        fallback.close(() => resolve(port));
      });
    });
  });
}
function waitForServer(port, maxMs = 3e4) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;
    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode !== void 0 && res.statusCode < 500) {
          resolve();
        } else {
          scheduleRetry();
        }
      });
      req.on("error", scheduleRetry);
      req.setTimeout(2e3, () => {
        req.destroy();
        scheduleRetry();
      });
    };
    const scheduleRetry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Le serveur Next.js n'a pas d\xE9marr\xE9 en ${maxMs}ms`));
      } else {
        setTimeout(attempt, 600);
      }
    };
    attempt();
  });
}
async function startNextServer() {
  if (isDev) return;
  serverPort = await findFreePort(9001);
  const serverScript = (0, import_path.join)(
    process.resourcesPath,
    ".next",
    "standalone",
    "server.js"
  );
  const env = {
    ...process.env,
    PORT: String(serverPort),
    HOSTNAME: "127.0.0.1",
    NEXTAUTH_URL: `http://127.0.0.1:${serverPort}`,
    NODE_ENV: "production"
  };
  nextServer = (0, import_child_process.spawn)(process.execPath, [serverScript], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: (0, import_path.join)(process.resourcesPath, ".next", "standalone")
  });
  nextServer.stdout?.on(
    "data",
    (d) => process.stdout.write(`[next] ${d}`)
  );
  nextServer.stderr?.on(
    "data",
    (d) => process.stderr.write(`[next] ${d}`)
  );
  nextServer.on(
    "error",
    (err) => console.error("[electron] \xC9chec du serveur Next.js :", err)
  );
}
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [
      {
        label: import_electron.app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    {
      label: "Fichier",
      submenu: [
        {
          label: "Nouvelle conversation",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new-thread")
        },
        { type: "separator" },
        {
          label: "Missions",
          accelerator: "CmdOrCtrl+M",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/missions" })
        },
        {
          label: "Assets",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/assets" })
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "\xC9dition",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "Vue",
      submenu: [
        {
          label: "Cockpit",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/" })
        },
        {
          label: "Missions",
          accelerator: "CmdOrCtrl+2",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/missions" })
        },
        {
          label: "Reports",
          accelerator: "CmdOrCtrl+3",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/reports" })
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        ...isDev ? [{ role: "toggleDevTools" }] : [],
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Fen\xEAtre",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...isMac ? [
          { type: "separator" },
          { role: "front" }
        ] : [{ role: "close" }]
      ]
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Documentation",
          click: () => import_electron.shell.openExternal("https://hearst.so/docs")
        },
        {
          label: "Signaler un bug",
          click: () => import_electron.shell.openExternal("https://hearst.so/feedback")
        },
        ...isDev ? [
          { type: "separator" },
          {
            label: "Admin",
            click: () => mainWindow?.webContents.send("menu:navigate", { path: "/admin" })
          }
        ] : []
      ]
    }
  ];
  const menu = import_electron.Menu.buildFromTemplate(template);
  import_electron.Menu.setApplicationMenu(menu);
}
function createTray() {
  const iconPath = (0, import_path.join)(__dirname, "..", "public", "hearst-tray.png");
  let icon;
  try {
    icon = import_electron.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = import_electron.nativeImage.createEmpty();
  } catch {
    icon = import_electron.nativeImage.createEmpty();
  }
  tray = new import_electron.Tray(icon);
  tray.setToolTip("Hearst OS");
  const contextMenu = import_electron.Menu.buildFromTemplate([
    {
      label: "Ouvrir Hearst",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: "separator" },
    { label: "Quitter", click: () => import_electron.app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}
function registerIpcHandlers() {
  import_electron.ipcMain.handle("clipboard:write-text", (_event, text) => {
    import_electron.clipboard.writeText(text);
  });
  import_electron.ipcMain.handle("clipboard:read-text", () => import_electron.clipboard.readText());
  import_electron.ipcMain.handle(
    "notification:show",
    (_event, opts) => {
      if (import_electron.Notification.isSupported()) {
        new import_electron.Notification({ title: opts.title, body: opts.body }).show();
      }
    }
  );
  import_electron.ipcMain.handle(
    "dialog:open-file",
    async (_event, opts = {}) => {
      const result = await import_electron.dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: opts.filters ?? [{ name: "Tous les fichiers", extensions: ["*"] }]
      });
      return result.canceled ? null : result.filePaths[0];
    }
  );
  import_electron.ipcMain.handle("shell:open-external", (_event, url) => {
    void import_electron.shell.openExternal(url);
  });
  import_electron.ipcMain.on("navigate", (_event, path) => {
    const base = isDev ? "http://localhost:9001" : `http://127.0.0.1:${serverPort}`;
    void mainWindow?.loadURL(`${base}${path}`);
  });
  import_electron.ipcMain.handle(
    "oauth:open-popup",
    (_event, opts) => {
      return new Promise((resolve) => {
        const popup = new import_electron.BrowserWindow({
          width: 500,
          height: 700,
          parent: mainWindow ?? void 0,
          modal: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        popup.loadURL(opts.url);
        popup.webContents.on("will-redirect", (_ev, url) => {
          if (url.includes(opts.redirectHost)) {
            try {
              const parsed = new URL(url);
              const code = parsed.searchParams.get("code");
              resolve(code ? { code } : null);
            } catch {
              resolve(null);
            }
            popup.destroy();
          }
        });
        popup.on("closed", () => resolve(null));
      });
    }
  );
}
function createWindow() {
  import_electron.nativeTheme.themeSource = "dark";
  mainWindow = new import_electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: (0, import_path.join)(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });
  const base = isDev ? "http://localhost:9001" : `http://127.0.0.1:${serverPort}`;
  const startUrl = isDev ? `${base}/api/auth/dev-login` : base;
  void mainWindow.loadURL(startUrl);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) mainWindow?.webContents.openDevTools({ mode: "detach" });
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    const isLocal = target.startsWith("http://localhost:") || target.startsWith("http://127.0.0.1:");
    if (isLocal) return { action: "allow" };
    void import_electron.shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron.app.whenReady().then(async () => {
  try {
    await startNextServer();
    if (!isDev) await waitForServer(serverPort);
    registerIpcHandlers();
    buildMenu();
    createWindow();
    if (process.platform !== "linux") createTray();
  } catch (err) {
    console.error("[electron] D\xE9marrage \xE9chou\xE9 :", err);
    import_electron.app.quit();
  }
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
import_electron.app.on("before-quit", () => {
  nextServer?.kill("SIGTERM");
  tray?.destroy();
});
