import {
  app,
  BrowserWindow,
  shell,
  nativeTheme,
  Menu,
  ipcMain,
  clipboard,
  Notification,
  dialog,
  Tray,
  nativeImage,
} from "electron";
import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import * as http from "http";
import * as net from "net";

const isDev =
  (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp === true ||
  process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
let serverPort = 9000;
let tray: Tray | null = null;

// ── Protocol — deeplinks hearst:// ──────────────────────────────────────────

const PROTOCOL = "hearst";

if (!app.isDefaultProtocolClient(PROTOCOL)) {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Capture deeplink sur macOS (second-instance / open-url)
app.on("open-url", (_event, url) => {
  handleDeeplink(url);
});

// Capture deeplink sur Windows/Linux (second-instance)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deeplink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deeplink) handleDeeplink(deeplink);
  });
}

function handleDeeplink(url: string): void {
  if (!mainWindow) return;
  try {
    const parsed = new URL(url);
    // hearst://open?path=/missions/abc → navigate in the renderer
    const path = parsed.searchParams.get("path") ?? parsed.pathname;
    if (path) {
      mainWindow.webContents.send("deeplink:navigate", { path });
    }
  } catch {
    console.warn("[electron] deeplink invalide :", url);
  }
}

// ── Port discovery ──────────────────────────────────────────────────────────

function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(preferred, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
    s.on("error", () => {
      const fallback = net.createServer();
      fallback.listen(0, "127.0.0.1", () => {
        const port = (fallback.address() as net.AddressInfo).port;
        fallback.close(() => resolve(port));
      });
    });
  });
}

// ── Server readiness polling ─────────────────────────────────────────────────

function waitForServer(port: number, maxMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;

    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          scheduleRetry();
        }
      });
      req.on("error", scheduleRetry);
      req.setTimeout(2000, () => {
        req.destroy();
        scheduleRetry();
      });
    };

    const scheduleRetry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Le serveur Next.js n'a pas démarré en ${maxMs}ms`));
      } else {
        setTimeout(attempt, 600);
      }
    };

    attempt();
  });
}

// ── Next.js standalone server (prod only) ───────────────────────────────────

async function startNextServer(): Promise<void> {
  if (isDev) return;

  serverPort = await findFreePort(9001);

  const serverScript = join(
    process.resourcesPath,
    ".next",
    "standalone",
    "server.js",
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(serverPort),
    HOSTNAME: "127.0.0.1",
    NEXTAUTH_URL: `http://127.0.0.1:${serverPort}`,
    NODE_ENV: "production",
  };

  nextServer = spawn(process.execPath, [serverScript], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: join(process.resourcesPath, ".next", "standalone"),
  });

  nextServer.stdout?.on("data", (d: Buffer) =>
    process.stdout.write(`[next] ${d}`),
  );
  nextServer.stderr?.on("data", (d: Buffer) =>
    process.stderr.write(`[next] ${d}`),
  );
  nextServer.on("error", (err: Error) =>
    console.error("[electron] Échec du serveur Next.js :", err),
  );
}

// ── Native menus ─────────────────────────────────────────────────────────────

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Fichier",
      submenu: [
        {
          label: "Nouvelle conversation",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new-thread"),
        },
        { type: "separator" },
        {
          label: "Missions",
          accelerator: "CmdOrCtrl+M",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/missions" }),
        },
        {
          label: "Assets",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/assets" }),
        },
        { type: "separator" },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "Vue",
      submenu: [
        {
          label: "Cockpit",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/" }),
        },
        {
          label: "Missions",
          accelerator: "CmdOrCtrl+2",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/missions" }),
        },
        {
          label: "Reports",
          accelerator: "CmdOrCtrl+3",
          click: () => mainWindow?.webContents.send("menu:navigate", { path: "/reports" }),
        },
        { type: "separator" },
        { role: "reload" as const },
        { role: "forceReload" as const },
        ...(isDev ? [{ role: "toggleDevTools" as const }] : []),
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Fenêtre",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("https://hearst.so/docs"),
        },
        {
          label: "Signaler un bug",
          click: () => shell.openExternal("https://hearst.so/feedback"),
        },
        ...(isDev
          ? [
              { type: "separator" as const },
              {
                label: "Admin",
                click: () => mainWindow?.webContents.send("menu:navigate", { path: "/admin" }),
              },
            ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Tray icon ────────────────────────────────────────────────────────────────

function createTray(): void {
  // Tray icon minimal — utilise une image vide de 16x16 si le fichier n'est pas présent.
  const iconPath = join(__dirname, "..", "public", "hearst-tray.png");
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Hearst OS");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Ouvrir Hearst",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    { label: "Quitter", click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ── IPC channels ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Clipboard
  ipcMain.handle("clipboard:write-text", (_event, text: string) => {
    clipboard.writeText(text);
  });
  ipcMain.handle("clipboard:read-text", () => clipboard.readText());

  // Notifications natives OS
  ipcMain.handle(
    "notification:show",
    (_event, opts: { title: string; body: string }) => {
      if (Notification.isSupported()) {
        new Notification({ title: opts.title, body: opts.body }).show();
      }
    },
  );

  // Sélecteur de fichier (upload document)
  ipcMain.handle(
    "dialog:open-file",
    async (_event, opts: { filters?: Electron.FileFilter[] } = {}) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        filters: opts.filters ?? [{ name: "Tous les fichiers", extensions: ["*"] }],
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  // Ouvrir une URL externe dans le navigateur système
  ipcMain.handle("shell:open-external", (_event, url: string) => {
    void shell.openExternal(url);
  });

  // Navigation interne (depuis la page web → passer une route Next.js)
  ipcMain.on("navigate", (_event, path: string) => {
    const base = isDev ? "http://localhost:9001" : `http://127.0.0.1:${serverPort}`;
    void mainWindow?.loadURL(`${base}${path}`);
  });

  // OAuth popup — ouvre une BrowserWindow dédiée, capture le redirect et ferme
  ipcMain.handle(
    "oauth:open-popup",
    (_event, opts: { url: string; redirectHost: string }) => {
      return new Promise<{ code: string } | null>((resolve) => {
        const popup = new BrowserWindow({
          width: 500,
          height: 700,
          parent: mainWindow ?? undefined,
          modal: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
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
    },
  );
}

// ── BrowserWindow ────────────────────────────────────────────────────────────

function createWindow(): void {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const base = isDev ? "http://localhost:9001" : `http://127.0.0.1:${serverPort}`;
  const startUrl = isDev ? `${base}/api/auth/dev-login` : base;

  void mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) mainWindow?.webContents.openDevTools({ mode: "detach" });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    const isLocal =
      target.startsWith("http://localhost:") ||
      target.startsWith("http://127.0.0.1:");
    if (isLocal) return { action: "allow" };
    void shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    await startNextServer();
    if (!isDev) await waitForServer(serverPort);
    registerIpcHandlers();
    buildMenu();
    createWindow();
    if (process.platform !== "linux") createTray();
  } catch (err) {
    console.error("[electron] Démarrage échoué :", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (nextServer) {
    nextServer.stdout?.removeAllListeners();
    nextServer.stderr?.removeAllListeners();
    nextServer.kill("SIGTERM");
  }
  tray?.destroy();
});
