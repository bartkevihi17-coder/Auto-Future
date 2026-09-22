import { chromium } from "playwright";
import { AutomationRecording, RunOptions } from "../shared/types";

export async function runRecording(
  recording: AutomationRecording,
  options: RunOptions = { headless: false }
): Promise<void> {
  const browser = await chromium.launch({ headless: options.headless });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const action of recording.actions) {
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
            throw new Error("A gravacao contem um campo secreto. Variaveis seguras ainda nao foram configuradas.");
          }

          const locator = page.locator(action.selector).first();
          await locator.waitFor({ state: "visible", timeout: 15_000 });
          await locator.fill(action.value ?? "");
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }
}
