import { Frame, Page, chromium } from "playwright";
import { AutomationAction, AutomationActionType, AutomationRecording, RunOptions } from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

export interface RunProgressEvent {
  index: number;
  total: number;
  percent: number;
  type?: AutomationActionType;
  phase: "starting" | "completed";
}

type ProgressSink = (event: RunProgressEvent) => void;

function comparableUrl(value?: string): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.origin + url.pathname + url.search;
  } catch {
    return value.split("#")[0];
  }
}

function resolveActionFrame(page: Page, action: AutomationAction): Frame {
  if (action.frameName) {
    const byName = page.frame(action.frameName);
    if (byName) return byName;
  }

  if (action.frameUrl) {
    const expected = comparableUrl(action.frameUrl);
    const byUrl = page.frames().find((frame) => comparableUrl(frame.url()) === expected);
    if (byUrl) return byUrl;
  }

  return page.mainFrame();
}

async function actionPoint(
  page: Page,
  frame: Frame,
  action: AutomationAction
): Promise<{ x: number; y: number } | null> {
  if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return null;

  const x = Number(action.x);
  const y = Number(action.y);

  if (frame === page.mainFrame()) {
    return { x, y };
  }

  try {
    const frameElement = await frame.frameElement();
    const box = await frameElement.boundingBox();

    if (!box) return null;

    return {
      x: box.x + x,
      y: box.y + y,
    };
  } catch {
    return null;
  }
}

async function clickAction(page: Page, action: AutomationAction): Promise<void> {
  const frame = resolveActionFrame(page, action);
  let selectorError: unknown = null;

  if (action.selector) {
    try {
      const locator = frame.locator(action.selector).first();
      await locator.waitFor({ state: "visible", timeout: 8_000 });
      await locator.click();
      return;
    } catch (error) {
      selectorError = error;
    }
  }

  const point = await actionPoint(page, frame, action);

  if (point) {
    await page.mouse.click(point.x, point.y);
    return;
  }

  if (selectorError) throw selectorError;
  throw new Error("Nao foi possivel localizar o ponto do clique gravado.");
}

async function inputAction(page: Page, action: AutomationAction): Promise<void> {
  const frame = resolveActionFrame(page, action);
  let selectorError: unknown = null;

  if (action.selector) {
    try {
      const locator = frame.locator(action.selector).first();
      await locator.waitFor({ state: "visible", timeout: 8_000 });
      await locator.fill(action.value ?? "");
      return;
    } catch (error) {
      selectorError = error;
    }
  }

  const point = await actionPoint(page, frame, action);

  if (point) {
    await page.mouse.click(point.x, point.y);
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(action.value ?? "");
    return;
  }

  if (selectorError) throw selectorError;
  throw new Error("Nao foi possivel localizar o campo digitado na gravacao.");
}

export async function runRecording(
  recording: AutomationRecording,
  browserProfileDir: string,
  options: RunOptions = { headless: false },
  onProgress?: ProgressSink
): Promise<void> {
  const preparedProfile = await prepareBrowserProfile(browserProfileDir);
  const launchArgs = [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
  ];

  let context;

  try {
    context = await chromium.launchPersistentContext(preparedProfile.userDataDir, {
      headless: options.headless,
      channel: preparedProfile.channel,
      executablePath: preparedProfile.executablePath,
      viewport: { width: 1280, height: 720 },
      args: launchArgs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (
      lower.includes("processsingleton") ||
      lower.includes("already in use") ||
      lower.includes("user data directory") ||
      lower.includes("profile") && lower.includes("lock")
    ) {
      throw new Error(
        "O perfil do Auto Future para " + preparedProfile.browserName +
        " ja esta em uso. Feche a janela de navegador aberta pelo Auto Future antes de executar a automacao."
      );
    }

    throw new Error(
      "Nao consegui abrir " + preparedProfile.browserName +
      " com o perfil persistente do Auto Future. " + message
    );
  }

  try {
    const existingPages = context.pages();
    const page = existingPages[0] ?? await context.newPage();

    for (const extraPage of existingPages.slice(1)) {
      await extraPage.close().catch(() => undefined);
    }

    const firstRecordedPageId =
      recording.actions.find((action) => action.pageId)?.pageId || "p1";

    const pageMap = new Map<string, Page>();
    pageMap.set(firstRecordedPageId, page);

    const resolvePageForAction = async (action: AutomationAction): Promise<Page> => {
      if (!action.pageId) return page;

      const mapped = pageMap.get(action.pageId);
      if (mapped && !mapped.isClosed()) return mapped;

      const usedPages = new Set(pageMap.values());
      const existingUnmapped = context
        .pages()
        .find((candidate) => !candidate.isClosed() && !usedPages.has(candidate));

      if (existingUnmapped) {
        pageMap.set(action.pageId, existingUnmapped);
        return existingUnmapped;
      }

      const created = await context.newPage();
      pageMap.set(action.pageId, created);
      return created;
    };

    if (recording.initialUrl && page.url() !== recording.initialUrl) {
      await page.goto(recording.initialUrl, { waitUntil: "domcontentloaded" });
    }

    const total = recording.actions.length;
    const speed =
      recording.executionSpeed === 1.5 || recording.executionSpeed === 2
        ? recording.executionSpeed
        : 1;

    if (total === 0) {
      onProgress?.({
        index: 0,
        total: 0,
        percent: 100,
        phase: "completed",
      });
      return;
    }

    for (let index = 0; index < total; index += 1) {
      const action = recording.actions[index];

      onProgress?.({
        index,
        total,
        percent: Math.round((index / total) * 100),
        type: action.type,
        phase: "starting",
      });

      const recordedDelayMs = Math.max(0, Number(action.delayMs) || 0);
      const delayMs = recordedDelayMs / speed;

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const actionPage = await resolvePageForAction(action);

      switch (action.type) {
        case "navigate": {
          if (actionPage.url() !== action.url) {
            await actionPage.goto(action.url, { waitUntil: "domcontentloaded" });
          }
          break;
        }

        case "click": {
          await clickAction(actionPage, action);
          break;
        }

        case "input": {
          if (action.isSecret) {
            throw new Error(
              "A gravacao contem um campo secreto. Variaveis seguras ainda nao foram configuradas."
            );
          }

          await inputAction(actionPage, action);
          break;
        }
      }

      onProgress?.({
        index: index + 1,
        total,
        percent: Math.round(((index + 1) / total) * 100),
        type: action.type,
        phase: "completed",
      });
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}
