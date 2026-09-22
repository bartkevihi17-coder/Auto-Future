import { chromium } from "playwright";
import { AutomationActionType, AutomationRecording, RunOptions } from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

export interface RunProgressEvent {
  index: number;
  total: number;
  percent: number;
  type?: AutomationActionType;
  phase: "starting" | "completed";
}

type ProgressSink = (event: RunProgressEvent) => void;

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

  if (preparedProfile.profileDirectory) {
    launchArgs.push("--profile-directory=" + preparedProfile.profileDirectory);
  }

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
        "O " + preparedProfile.browserName +
        " ja esta usando esse perfil. Feche todas as janelas do navegador padrao antes de executar a automacao."
      );
    }

    throw new Error(
      "Nao consegui abrir o navegador padrao (" + preparedProfile.browserName +
      ") com o perfil real. " + message
    );
  }

  try {
    const existingPages = context.pages();
    const page = existingPages[0] ?? await context.newPage();

    for (const extraPage of existingPages.slice(1)) {
      await extraPage.close().catch(() => undefined);
    }

    if (recording.initialUrl && page.url() !== recording.initialUrl) {
      await page.goto(recording.initialUrl, { waitUntil: "domcontentloaded" });
    }

    const total = recording.actions.length;

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

      const delayMs = Math.max(0, Number(action.delayMs) || 0);
      if (delayMs > 0) {
        await page.waitForTimeout(delayMs);
      }

      switch (action.type) {
        case "navigate": {
          if (page.url() !== action.url) {
            await page.goto(action.url, { waitUntil: "domcontentloaded" });
          }
          break;
        }

        case "click": {
          if (!action.selector) break;
          const locator = page.locator(action.selector).first();
          await locator.waitFor({ state: "visible", timeout: 15_000 });
          await locator.click();
          break;
        }

        case "input": {
          if (!action.selector) break;

          if (action.isSecret) {
            throw new Error(
              "A gravacao contem um campo secreto. Variaveis seguras ainda nao foram configuradas."
            );
          }

          const locator = page.locator(action.selector).first();
          await locator.waitFor({ state: "visible", timeout: 15_000 });
          await locator.fill(action.value ?? "");
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
