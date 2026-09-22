import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BrowserRecorder } from "./automation/recorder";
import { runRecording } from "./automation/runner";
import {
  getBrowserProfileStatus,
  launchBrowserProfileSetup,
  markBrowserProfileReady,
} from "./automation/browser-profile";
import { AutomationAction, AutomationRecording, ExecutionSpeed } from "./shared/types";

let mainWindow: BrowserWindow | null = null;
let lastRecording: AutomationRecording | null = null;
let recorder: BrowserRecorder;

function recordingsDir(): string {
  return path.join(app.getPath("userData"), "recordings");
}

function videosDir(): string {
  return path.join(recordingsDir(), "videos");
}

function browserProfileDir(): string {
  return path.join(app.getPath("userData"), "browser-profile");
}

async function persistRecording(recording: AutomationRecording): Promise<string> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, recording.id + ".json");
  await fs.writeFile(filePath, JSON.stringify(recording, null, 2), "utf8");
  return filePath;
}

function normalizeExecutionSpeed(value: unknown): ExecutionSpeed {
  const numeric = Number(value);
  if (numeric === 1.5) return 1.5;
  if (numeric === 2) return 2;
  return 1;
}

function withVideoUrl(recording: AutomationRecording) {
  return {
    ...recording,
    executionSpeed: normalizeExecutionSpeed(recording.executionSpeed),
    videoUrl: recording.videoPath ? pathToFileURL(recording.videoPath).href : null,
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 650,
    backgroundColor: "#f6f6fb",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  void mainWindow.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));
}

app.whenReady().then(async () => {
  await fs.mkdir(videosDir(), { recursive: true });

  recorder = new BrowserRecorder(
    videosDir(),
    browserProfileDir(),
    (action) => {
      mainWindow?.webContents.send("recording:action", action);
    },
    (info) => {
      mainWindow?.webContents.send("recording:unsupported-page", info);
    }
  );

  // Login temporariamente desabilitado: qualquer clique em Entrar libera o app.
  ipcMain.handle("auth:login", async () => ({
    ok: true,
    user: {
      email: "admin@autofuture.local",
      name: "Administrador",
      role: "admin",
    },
  }));

  ipcMain.handle("auth:logout", async () => {
    if (recorder?.isRecording()) {
      await recorder.stop().catch(() => undefined);
    }
    return { ok: true };
  });

  ipcMain.handle("browser:profile-status", async () => {
    return getBrowserProfileStatus(browserProfileDir());
  });

  ipcMain.handle("browser:setup-profile", async () => {
    return launchBrowserProfileSetup(browserProfileDir());
  });

  ipcMain.handle("browser:complete-profile-setup", async () => {
    return markBrowserProfileReady(browserProfileDir());
  });

  ipcMain.handle("recording:start", async (_event, payload: { url: string; name?: string }) => {
    const url = new URL(payload.url).toString();
    const recording = await recorder.start(url, payload.name?.trim() || "Nova automacao");
    const browser = recorder.getBrowserSessionInfo();
    return {
      id: recording.id,
      createdAt: recording.createdAt,
      browserName: browser.browserName,
      firstUse: browser.firstUse,
    };
  });

  ipcMain.handle("recording:stop", async () => {
    const recording = await recorder.stop();
    lastRecording = recording;
    const filePath = await persistRecording(recording);

    return {
      recording: withVideoUrl(recording),
      filePath,
    };
  });

  ipcMain.handle("recording:update-last", async (_event, payload: {
    actions: AutomationAction[];
    executionSpeed?: ExecutionSpeed;
  }) => {
    if (!lastRecording) {
      throw new Error("Nenhuma gravacao carregada.");
    }

    lastRecording.actions = payload.actions;
    lastRecording.executionSpeed = normalizeExecutionSpeed(payload.executionSpeed);
    await persistRecording(lastRecording);

    return {
      ok: true,
      recording: withVideoUrl(lastRecording),
    };
  });

  ipcMain.handle("recording:update-speed", async (_event, speed?: ExecutionSpeed) => {
    if (!lastRecording) {
      throw new Error("Nenhuma gravacao carregada.");
    }

    lastRecording.executionSpeed = normalizeExecutionSpeed(speed);
    await persistRecording(lastRecording);

    return {
      ok: true,
      executionSpeed: lastRecording.executionSpeed,
    };
  });

  ipcMain.handle("recording:run-last", async (_event, payload?: { headless?: boolean }) => {
    if (!lastRecording) {
      throw new Error("Nenhuma gravacao foi finalizada nesta sessao.");
    }

    await runRecording(
      lastRecording,
      browserProfileDir(),
      { headless: Boolean(payload?.headless) },
      (progress) => {
        mainWindow?.webContents.send("execution:progress", progress);
      }
    );

    return { ok: true };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
