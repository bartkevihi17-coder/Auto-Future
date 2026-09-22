import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BrowserRecorder } from "./automation/recorder";
import { runRecording } from "./automation/runner";
import { AutomationAction, AutomationRecording } from "./shared/types";

let mainWindow: BrowserWindow | null = null;
let lastRecording: AutomationRecording | null = null;
let recorder: BrowserRecorder;

function recordingsDir(): string {
  return path.join(app.getPath("userData"), "recordings");
}

function videosDir(): string {
  return path.join(recordingsDir(), "videos");
}

async function persistRecording(recording: AutomationRecording): Promise<string> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, recording.id + ".json");
  await fs.writeFile(filePath, JSON.stringify(recording, null, 2), "utf8");
  return filePath;
}

function withVideoUrl(recording: AutomationRecording) {
  return {
    ...recording,
    videoUrl: recording.videoPath ? pathToFileURL(recording.videoPath).href : null,
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 650,
    backgroundColor: "#07111b",
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

  recorder = new BrowserRecorder(videosDir(), (action) => {
    mainWindow?.webContents.send("recording:action", action);
  });

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

  ipcMain.handle("recording:start", async (_event, payload: { url: string; name?: string }) => {
    const url = new URL(payload.url).toString();
    const recording = await recorder.start(url, payload.name?.trim() || "Nova automacao");
    return { id: recording.id, createdAt: recording.createdAt };
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

  ipcMain.handle("recording:update-last", async (_event, payload: { actions: AutomationAction[] }) => {
    if (!lastRecording) {
      throw new Error("Nenhuma gravacao carregada.");
    }

    lastRecording.actions = payload.actions;
    await persistRecording(lastRecording);

    return {
      ok: true,
      recording: withVideoUrl(lastRecording),
    };
  });

  ipcMain.handle("recording:run-last", async (_event, payload?: { headless?: boolean }) => {
    if (!lastRecording) {
      throw new Error("Nenhuma gravacao foi finalizada nesta sessao.");
    }

    await runRecording(lastRecording, { headless: Boolean(payload?.headless) });
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
