import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { BrowserRecorder } from "./automation/recorder";
import { runRecording } from "./automation/runner";
import { AutomationRecording } from "./shared/types";

let mainWindow: BrowserWindow | null = null;
let lastRecording: AutomationRecording | null = null;

const recorder = new BrowserRecorder((action) => {
  mainWindow?.webContents.send("recording:action", action);
});

function recordingsDir(): string {
  return path.join(app.getPath("userData"), "recordings");
}

async function persistRecording(recording: AutomationRecording): Promise<string> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, recording.id + ".json");
  await fs.writeFile(filePath, JSON.stringify(recording, null, 2), "utf8");
  return filePath;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: "#0b1020",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  void mainWindow.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));
}

app.whenReady().then(() => {
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
      recording,
      filePath,
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
