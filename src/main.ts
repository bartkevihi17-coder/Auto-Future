import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { BrowserRecorder } from "./automation/recorder";
import { runRecording, RunProgressEvent } from "./automation/runner";
import {
  getBrowserProfileStatus,
  launchBrowserProfileSetup,
  markBrowserProfileReady,
} from "./automation/browser-profile";
import {
  AutomationAction,
  AutomationRecording,
  AutomationRunRecord,
  AutomationRunSource,
  AutomationSchedule,
  ExecutionSpeed,
} from "./shared/types";

let mainWindow: BrowserWindow | null = null;
let lastRecording: AutomationRecording | null = null;
let recorder: BrowserRecorder;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let executionQueue: Promise<unknown> = Promise.resolve();

function recordingsDir(): string {
  return path.join(app.getPath("userData"), "recordings");
}

function videosDir(): string {
  return path.join(recordingsDir(), "videos");
}

function stateDir(): string {
  return path.join(app.getPath("userData"), "state");
}

function schedulesPath(): string {
  return path.join(stateDir(), "schedules.json");
}

function runsPath(): string {
  return path.join(stateDir(), "runs.json");
}

function browserProfileDir(): string {
  return path.join(app.getPath("userData"), "browser-profile");
}

function normalizeExecutionSpeed(value: unknown): ExecutionSpeed {
  const numeric = Number(value);
  if (numeric === 1.5) return 1.5;
  if (numeric === 2) return 2;
  return 1;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function localTimeKey(date: Date): string {
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function withVideoUrl(recording: AutomationRecording) {
  return {
    ...recording,
    executionSpeed: normalizeExecutionSpeed(recording.executionSpeed),
    videoUrl: recording.videoPath
      ? pathToFileURL(recording.videoPath).href
      : null,
    videoSegments: (recording.videoSegments || []).map((segment) => ({
      ...segment,
      videoUrl: segment.videoPath
        ? pathToFileURL(segment.videoPath).href
        : null,
    })),
  };
}

async function persistRecording(recording: AutomationRecording): Promise<string> {
  const dir = recordingsDir();
  await fs.mkdir(dir, { recursive: true });

  recording.updatedAt = new Date().toISOString();
  recording.executionSpeed = normalizeExecutionSpeed(recording.executionSpeed);

  const filePath = path.join(dir, recording.id + ".json");
  await fs.writeFile(filePath, JSON.stringify(recording, null, 2), "utf8");
  return filePath;
}

async function loadRecordingById(id: string): Promise<AutomationRecording> {
  const filePath = path.join(recordingsDir(), id + ".json");
  const raw = await fs.readFile(filePath, "utf8");
  const recording = JSON.parse(raw) as AutomationRecording;
  recording.executionSpeed = normalizeExecutionSpeed(recording.executionSpeed);
  return recording;
}

async function listRecordings(): Promise<AutomationRecording[]> {
  await fs.mkdir(recordingsDir(), { recursive: true });

  const entries = await fs.readdir(recordingsDir(), { withFileTypes: true });
  const recordings: AutomationRecording[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    try {
      const raw = await fs.readFile(path.join(recordingsDir(), entry.name), "utf8");
      const recording = JSON.parse(raw) as AutomationRecording;
      recording.executionSpeed = normalizeExecutionSpeed(recording.executionSpeed);
      recordings.push(recording);
    } catch {
      // Keep loading the rest of the persistent library if one file is damaged.
    }
  }

  return recordings.sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return bTime - aTime;
  });
}

async function readSchedules(): Promise<AutomationSchedule[]> {
  try {
    const raw = await fs.readFile(schedulesPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AutomationSchedule[] : [];
  } catch {
    return [];
  }
}

async function writeSchedules(schedules: AutomationSchedule[]): Promise<void> {
  await fs.mkdir(stateDir(), { recursive: true });
  await fs.writeFile(
    schedulesPath(),
    JSON.stringify(schedules, null, 2),
    "utf8"
  );
}

async function readRuns(): Promise<AutomationRunRecord[]> {
  try {
    const raw = await fs.readFile(runsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AutomationRunRecord[] : [];
  } catch {
    return [];
  }
}

async function writeRuns(runs: AutomationRunRecord[]): Promise<void> {
  await fs.mkdir(stateDir(), { recursive: true });
  await fs.writeFile(
    runsPath(),
    JSON.stringify(runs.slice(0, 300), null, 2),
    "utf8"
  );
}

function scheduleSlotKeys(schedule: AutomationSchedule): string[] {
  if (!schedule.enabled) return [];

  if (schedule.repeat) {
    return [...new Set(
      (schedule.slots || []).map(
        (slot) => "w:" + slot.weekday + ":" + slot.time
      )
    )];
  }

  if (!schedule.runDate || !schedule.oneTime) return [];
  return ["d:" + schedule.runDate + ":" + schedule.oneTime];
}

function validateScheduleCapacity(
  schedules: AutomationSchedule[],
  candidate: AutomationSchedule
): void {
  const counts = new Map<string, number>();

  for (const schedule of schedules) {
    if (schedule.id === candidate.id) continue;

    for (const key of scheduleSlotKeys(schedule)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  for (const key of scheduleSlotKeys(candidate)) {
    const nextCount = (counts.get(key) || 0) + 1;

    if (nextCount > 3) {
      throw new Error(
        "Esse dia e horario ja possui 3 automacoes. O limite por horario e 3."
      );
    }
  }
}

async function appendRun(run: AutomationRunRecord): Promise<void> {
  const runs = await readRuns();
  const existingIndex = runs.findIndex((item) => item.id === run.id);

  if (existingIndex >= 0) {
    runs[existingIndex] = run;
  } else {
    runs.unshift(run);
  }

  await writeRuns(runs);
  mainWindow?.webContents.send("runs:changed");
}

async function executeRecording(
  recording: AutomationRecording,
  visible: boolean,
  source: AutomationRunSource,
  scheduleId?: string,
  onProgress?: (progress: RunProgressEvent) => void
): Promise<void> {
  const run: AutomationRunRecord = {
    id: randomUUID(),
    automationId: recording.id,
    automationName: recording.name,
    scheduleId,
    source,
    visible,
    startedAt: new Date().toISOString(),
    status: "running",
  };

  await appendRun(run);

  try {
    await runRecording(
      recording,
      browserProfileDir(),
      { headless: !visible },
      onProgress
    );

    run.status = "success";
    run.finishedAt = new Date().toISOString();
    await appendRun(run);
  } catch (error) {
    run.status = "error";
    run.finishedAt = new Date().toISOString();
    run.error = error instanceof Error ? error.message : String(error);
    await appendRun(run);
    throw error;
  }
}

function queueExecution(task: () => Promise<void>): Promise<void> {
  const next = executionQueue.then(task, task);
  executionQueue = next.catch(() => undefined);
  return next;
}

async function schedulerTick(): Promise<void> {
  if (recorder?.isRecording()) return;

  const now = new Date();
  const date = localDateKey(now);
  const time = localTimeKey(now);
  const weekday = now.getDay();

  const schedules = await readSchedules();
  let changed = false;

  for (const schedule of schedules) {
    if (!schedule.enabled) continue;

    const due = schedule.repeat
      ? (schedule.slots || []).some(
          (slot) => slot.weekday === weekday && slot.time === time
        )
      : schedule.runDate === date && schedule.oneTime === time;

    if (!due) continue;

    const triggerKey = schedule.id + ":" + date + ":" + time;
    if (schedule.lastTriggeredKey === triggerKey) continue;

    schedule.lastTriggeredKey = triggerKey;
    schedule.updatedAt = new Date().toISOString();
    changed = true;

    void queueExecution(async () => {
      const recording = await loadRecordingById(schedule.automationId);
      await executeRecording(
        recording,
        schedule.visible,
        "schedule",
        schedule.id
      );
    }).catch((error) => {
      mainWindow?.webContents.send("schedule:execution-error", {
        scheduleId: schedule.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (changed) {
    await writeSchedules(schedules);
    mainWindow?.webContents.send("schedules:changed");
  }
}

function startScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer);

  schedulerTimer = setInterval(() => {
    void schedulerTick();
  }, 15_000);

  void schedulerTick();
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

  void mainWindow.loadFile(
    path.join(__dirname, "..", "src", "renderer", "index.html")
  );
}

app.whenReady().then(async () => {
  await fs.mkdir(videosDir(), { recursive: true });
  await fs.mkdir(stateDir(), { recursive: true });

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

  ipcMain.handle("recordings:list", async () => {
    const recordings = await listRecordings();
    return recordings.map(withVideoUrl);
  });

  ipcMain.handle("recording:load", async (_event, id: string) => {
    lastRecording = await loadRecordingById(id);
    return {
      recording: withVideoUrl(lastRecording),
    };
  });

  ipcMain.handle("recording:delete", async (_event, id: string) => {
    const recording = await loadRecordingById(id).catch(() => null);

    if (recording?.videoPath) {
      await fs.rm(recording.videoPath, { force: true }).catch(() => undefined);
    }

    for (const segment of recording?.videoSegments || []) {
      if (segment.videoPath) {
        await fs.rm(segment.videoPath, { force: true }).catch(() => undefined);
      }
    }

    await fs.rm(path.join(recordingsDir(), id + ".json"), {
      force: true,
    });

    const schedules = (await readSchedules()).filter(
      (schedule) => schedule.automationId !== id
    );
    await writeSchedules(schedules);

    if (lastRecording?.id === id) lastRecording = null;

    mainWindow?.webContents.send("recordings:changed");
    mainWindow?.webContents.send("schedules:changed");

    return { ok: true };
  });

  ipcMain.handle(
    "recording:start",
    async (_event, payload: { url: string; name?: string }) => {
      const url = new URL(payload.url).toString();
      const recording = await recorder.start(
        url,
        payload.name?.trim() || "Nova automacao"
      );

      const browser = recorder.getBrowserSessionInfo();

      return {
        id: recording.id,
        createdAt: recording.createdAt,
        browserName: browser.browserName,
        firstUse: browser.firstUse,
      };
    }
  );

  ipcMain.handle("recording:stop", async () => {
    const recording = await recorder.stop();
    lastRecording = recording;
    const filePath = await persistRecording(recording);

    mainWindow?.webContents.send("recordings:changed");

    return {
      recording: withVideoUrl(recording),
      filePath,
    };
  });

  ipcMain.handle(
    "recording:update-last",
    async (
      _event,
      payload: {
        actions: AutomationAction[];
        executionSpeed?: ExecutionSpeed;
      }
    ) => {
      if (!lastRecording) {
        throw new Error("Nenhuma gravacao carregada.");
      }

      lastRecording.actions = payload.actions;
      lastRecording.executionSpeed = normalizeExecutionSpeed(
        payload.executionSpeed
      );

      await persistRecording(lastRecording);
      mainWindow?.webContents.send("recordings:changed");

      return {
        ok: true,
        recording: withVideoUrl(lastRecording),
      };
    }
  );

  ipcMain.handle(
    "recording:update-speed",
    async (_event, speed?: ExecutionSpeed) => {
      if (!lastRecording) {
        throw new Error("Nenhuma gravacao carregada.");
      }

      lastRecording.executionSpeed = normalizeExecutionSpeed(speed);
      await persistRecording(lastRecording);
      mainWindow?.webContents.send("recordings:changed");

      return {
        ok: true,
        executionSpeed: lastRecording.executionSpeed,
      };
    }
  );

  ipcMain.handle(
    "recording:run-last",
    async (_event, payload?: { headless?: boolean }) => {
      if (!lastRecording) {
        throw new Error("Nenhuma automacao carregada.");
      }

      const recording = lastRecording;
      const visible = !Boolean(payload?.headless);

      await queueExecution(() =>
        executeRecording(
          recording,
          visible,
          "manual",
          undefined,
          (progress) => {
            mainWindow?.webContents.send("execution:progress", progress);
          }
        )
      );

      return { ok: true };
    }
  );

  ipcMain.handle("schedules:list", async () => {
    return readSchedules();
  });

  ipcMain.handle(
    "schedule:save",
    async (_event, payload: Partial<AutomationSchedule>) => {
      if (!payload.automationId) {
        throw new Error("Escolha uma automacao.");
      }

      await loadRecordingById(payload.automationId);

      const now = new Date().toISOString();
      const schedule: AutomationSchedule = {
        id: payload.id || randomUUID(),
        automationId: payload.automationId,
        name: payload.name?.trim() || "Agendamento",
        enabled: payload.enabled !== false,
        visible: payload.visible !== false,
        repeat: Boolean(payload.repeat),
        slots: Array.isArray(payload.slots)
          ? payload.slots
              .filter(
                (slot) =>
                  Number.isInteger(slot.weekday) &&
                  slot.weekday >= 0 &&
                  slot.weekday <= 6 &&
                  /^\d{2}:\d{2}$/.test(slot.time)
              )
              .map((slot) => ({
                weekday: slot.weekday,
                time: slot.time,
              }))
          : [],
        runDate: payload.runDate,
        oneTime: payload.oneTime,
        createdAt: payload.createdAt || now,
        updatedAt: now,
        lastTriggeredKey: payload.lastTriggeredKey,
      };

      if (schedule.repeat && schedule.slots.length === 0) {
        throw new Error("Escolha pelo menos um dia e horario.");
      }

      if (!schedule.repeat && (!schedule.runDate || !schedule.oneTime)) {
        throw new Error("Escolha a data e o horario da execucao.");
      }

      const schedules = await readSchedules();
      validateScheduleCapacity(schedules, schedule);

      const index = schedules.findIndex((item) => item.id === schedule.id);

      if (index >= 0) {
        schedule.createdAt = schedules[index].createdAt;
        schedules[index] = schedule;
      } else {
        schedules.push(schedule);
      }

      await writeSchedules(schedules);
      mainWindow?.webContents.send("schedules:changed");

      return {
        ok: true,
        schedule,
      };
    }
  );

  ipcMain.handle(
    "schedule:save-batch",
    async (
      _event,
      payload: {
        automationIds?: string[];
        visible?: boolean;
        repeat?: boolean;
        slots?: Array<{ weekday: number; time: string }>;
        runDate?: string;
        oneTime?: string;
      }
    ) => {
      const automationIds = [...new Set(payload.automationIds || [])]
        .filter(Boolean)
        .slice(0, 3);

      if (!automationIds.length) {
        throw new Error("Escolha pelo menos uma automacao.");
      }

      if ((payload.automationIds || []).length > 3) {
        throw new Error("O limite e de 3 automacoes no mesmo agendamento.");
      }

      const recordings = await Promise.all(
        automationIds.map((id) => loadRecordingById(id))
      );

      const now = new Date().toISOString();
      const candidates: AutomationSchedule[] = recordings.map((recording) => ({
        id: randomUUID(),
        automationId: recording.id,
        name: recording.name || "Agendamento",
        enabled: true,
        visible: payload.visible !== false,
        repeat: Boolean(payload.repeat),
        slots: Array.isArray(payload.slots)
          ? payload.slots
              .filter(
                (slot) =>
                  Number.isInteger(slot.weekday) &&
                  slot.weekday >= 0 &&
                  slot.weekday <= 6 &&
                  /^\d{2}:\d{2}$/.test(slot.time)
              )
              .map((slot) => ({
                weekday: slot.weekday,
                time: slot.time,
              }))
          : [],
        runDate: payload.runDate,
        oneTime: payload.oneTime,
        createdAt: now,
        updatedAt: now,
      }));

      for (const schedule of candidates) {
        if (schedule.repeat && schedule.slots.length === 0) {
          throw new Error("Escolha pelo menos um dia e horario.");
        }

        if (!schedule.repeat && (!schedule.runDate || !schedule.oneTime)) {
          throw new Error("Escolha a data e o horario da execucao.");
        }
      }

      const schedules = await readSchedules();
      const working = [...schedules];

      for (const schedule of candidates) {
        validateScheduleCapacity(working, schedule);
        working.push(schedule);
      }

      await writeSchedules(working);
      mainWindow?.webContents.send("schedules:changed");

      return {
        ok: true,
        schedules: candidates,
      };
    }
  );

  ipcMain.handle("schedule:delete", async (_event, id: string) => {
    const schedules = (await readSchedules()).filter(
      (schedule) => schedule.id !== id
    );

    await writeSchedules(schedules);
    mainWindow?.webContents.send("schedules:changed");

    return { ok: true };
  });

  ipcMain.handle("runs:list", async () => {
    return readRuns();
  });

  createWindow();
  startScheduler();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
