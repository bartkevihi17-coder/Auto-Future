import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { BrowserRecorder } from "./automation/recorder";
import { runRecording } from "./automation/runner";
import { AutomationRecording } from "./shared/types";

let mainWindow: BrowserWindow | null = null;
let lastRecording: AutomationRecording | null = null;
let authenticated = false;

const ADMIN_USER = {
  email: "admin@autofuture.local",
  password: "AutoFuture@2026",
  name: "Administrador",
};

const recorder = new BrowserRecorder((action) => {
  mainWindow?.webContents.send("recording:action", action);
});

function assertAuthenticated(): void {
  if (!authenticated) {
    throw new Error("Sessao nao autenticada.");
  }
}

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
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 650,
    backgroundColor: "#07111b",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  void mainWindow.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("auth:login", async (_event, payload: { email?: string; password?: string }) => {
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const password = String(payload?.password ?? "");

    if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
      authenticated = true;
      return {
        ok: true,
        user: {
          email: ADMIN_USER.email,
          name: ADMIN_USER.name,
          role: "admin",
        },
      };
    }

    return {
      ok: false,
      message: "E-mail ou senha incorretos.",
    };
  });

  ipcMain.handle("auth:logout", async () => {
    authenticated = false;

    if (recorder.isRecording()) {
      await recorder.stop().catch(() => undefined);
    }

    return { ok: true };
  });

  ipcMain.handle("recording:start", async (_event, payload: { url: string; name?: string }) => {
    assertAuthenticated();

    const url = new URL(payload.url).toString();
    const recording = await recorder.start(url, payload.name?.trim() || "Nova automacao");
    return { id: recording.id, createdAt: recording.createdAt };
  });

  ipcMain.handle("recording:stop", async () => {
    assertAuthenticated();

    const recording = await recorder.stop();
    lastRecording = recording;
    const filePath = await persistRecording(recording);

    return {
      recording,
      filePath,
    };
  });

  ipcMain.handle("recording:run-last", async (_event, payload?: { headless?: boolean }) => {
    assertAuthenticated();

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
