import { Frame, Locator, Page, chromium } from "playwright";
import { AutomationAction, AutomationActionType, AutomationRecording, RunOptions } from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

export interface RunProgressEvent {
  index: number;
  total: number;
  percent: number;
  type?: AutomationActionType;
  phase: "starting" | "completed";
  loopIndex?: number;
  loopTotal?: number;
}

type ProgressSink = (event: RunProgressEvent) => void;
type DynamicValueResolver = (action: AutomationAction) => Promise<string>;

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

async function waitForOptimizedPage(page: Page): Promise<void> {
  await page
    .waitForLoadState("domcontentloaded", { timeout: 15_000 })
    .catch(() => undefined);

  await page
    .waitForFunction(
      () => document.readyState === "complete",
      undefined,
      { timeout: 12_000 }
    )
    .catch(() => undefined);

  // Apps with polling/websockets may never reach networkidle. Treat it as a
  // best-effort final stabilization step instead of blocking the automation.
  await page
    .waitForLoadState("networkidle", { timeout: 2_500 })
    .catch(() => undefined);
}

async function findVisibleLocator(
  frame: Frame,
  selector: string,
  timeoutMs: number,
  requireActionable = false
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const locator = frame.locator(selector);
    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < Math.min(count, 30); index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible().catch(() => false);

      if (!visible) continue;

      if (requireActionable) {
        const actionable = await candidate
          .click({ trial: true, timeout: 700 })
          .then(() => true)
          .catch(() => false);

        if (!actionable) continue;
      }

      return candidate;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return null;
}

async function waitForOptimizedTarget(
  page: Page,
  action: AutomationAction
): Promise<void> {
  await page
    .waitForLoadState("domcontentloaded", { timeout: 15_000 })
    .catch(() => undefined);

  if (!action.selector) {
    await waitForOptimizedPage(page);
    return;
  }

  const frame = resolveActionFrame(page, action);

  if (action.type === "click") {
    const locator = await findVisibleLocator(frame, action.selector, 12_000, true);

    if (locator) return;

    const point = await actionPoint(page, frame, action);
    if (point) return;

    throw new Error(
      "O elemento gravado nao ficou disponivel para clique dentro do tempo limite."
    );
  }

  if (action.type === "input") {
    const locator = await findVisibleLocator(frame, action.selector, 12_000);

    if (locator) return;

    const point = await actionPoint(page, frame, action);
    if (point) return;

    throw new Error(
      "O campo gravado nao ficou disponivel dentro do tempo limite."
    );
  }

  if (action.type === "key") {
    const locator = await findVisibleLocator(frame, action.selector, 12_000);

    if (locator) return;

    const point = await actionPoint(page, frame, action);
    if (point) return;
  }
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
      const locator = await findVisibleLocator(frame, action.selector, 8_000, true);

      if (locator) {
        await locator.click();
        return;
      }

      selectorError = new Error(
        "Nenhum elemento visivel e acionavel corresponde ao seletor gravado."
      );
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

async function keyAction(page: Page, action: AutomationAction): Promise<void> {
  const frame = resolveActionFrame(page, action);

  if (action.selector) {
    try {
      const locator = frame.locator(action.selector).first();
      await locator.waitFor({ state: "attached", timeout: 4_000 });
      await locator.focus();
    } catch {
      const point = await actionPoint(page, frame, action);
      if (point) {
        await page.mouse.click(point.x, point.y);
      }
    }
  } else {
    const point = await actionPoint(page, frame, action);
    if (point) {
      await page.mouse.click(point.x, point.y);
    }
  }

  const key = action.key || action.code;
  if (!key) return;

  const hasCommandModifier =
    Boolean(action.ctrlKey) ||
    Boolean(action.altKey) ||
    Boolean(action.metaKey);

  if (key.length === 1 && !hasCommandModifier) {
    await page.keyboard.insertText(key);
    return;
  }

  const parts: string[] = [];

  if (action.ctrlKey) parts.push("Control");
  if (action.altKey) parts.push("Alt");
  if (action.shiftKey) parts.push("Shift");
  if (action.metaKey) parts.push("Meta");

  const normalizedKey = key === " " ? "Space" : key;
  parts.push(normalizedKey);

  await page.keyboard.press(parts.join("+"));
}

async function inputAction(
  page: Page,
  action: AutomationAction,
  resolveDynamicValue?: DynamicValueResolver
): Promise<void> {
  const frame = resolveActionFrame(page, action);
  let selectorError: unknown = null;
  const resolvedValue =
    action.dynamicValuePrompt && resolveDynamicValue
      ? await resolveDynamicValue(action)
      : action.value ?? "";

  if (action.selector) {
    try {
      const locator = await findVisibleLocator(frame, action.selector, 8_000);

      if (locator) {
        await locator.fill(resolvedValue);
        return;
      }

      selectorError = new Error(
        "Nenhum campo visivel corresponde ao seletor gravado."
      );
    } catch (error) {
      selectorError = error;
    }
  }

  const point = await actionPoint(page, frame, action);

  if (point) {
    await page.mouse.click(point.x, point.y);
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(resolvedValue);
    return;
  }

  if (selectorError) throw selectorError;
  throw new Error("Nao foi possivel localizar o campo digitado na gravacao.");
}

export async function runRecording(
  recording: AutomationRecording,
  browserProfileDir: string,
  options: RunOptions = { headless: false },
  onProgress?: ProgressSink,
  resolveDynamicValue?: DynamicValueResolver
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
    const claimedPages = new Set<Page>();
    const pendingPages: Page[] = [];

    const claimPage = (pageId: string, target: Page): Page => {
      pageMap.set(pageId, target);
      claimedPages.add(target);

      const queuedIndex = pendingPages.indexOf(target);
      if (queuedIndex >= 0) pendingPages.splice(queuedIndex, 1);

      return target;
    };

    claimPage(firstRecordedPageId, page);

    context.on("page", (openedPage) => {
      if (!claimedPages.has(openedPage)) {
        pendingPages.push(openedPage);
      }
    });

    const resolvePageForAction = async (action: AutomationAction): Promise<Page> => {
      if (!action.pageId) return page;

      const mapped = pageMap.get(action.pageId);
      if (mapped && !mapped.isClosed()) {
        await mapped
          .waitForLoadState("domcontentloaded", { timeout: 10_000 })
          .catch(() => undefined);
        return mapped;
      }

      if (mapped?.isClosed()) {
        pageMap.delete(action.pageId);
        claimedPages.delete(mapped);
      }

      const expectedUrl = comparableUrl(action.url);
      const candidates = [
        ...pendingPages,
        ...context.pages().filter((candidate) => !pendingPages.includes(candidate)),
      ];

      const matchingPage = candidates.find(
        (candidate) =>
          !candidate.isClosed() &&
          !claimedPages.has(candidate) &&
          expectedUrl &&
          comparableUrl(candidate.url()) === expectedUrl
      );

      const availablePage =
        matchingPage ||
        candidates.find(
          (candidate) => !candidate.isClosed() && !claimedPages.has(candidate)
        );

      if (availablePage) {
        claimPage(action.pageId, availablePage);
        await availablePage
          .waitForLoadState("domcontentloaded", { timeout: 10_000 })
          .catch(() => undefined);
        return availablePage;
      }

      const openedByPreviousAction = await context
        .waitForEvent("page", { timeout: 5_000 })
        .catch(() => null);

      if (openedByPreviousAction && !openedByPreviousAction.isClosed()) {
        claimPage(action.pageId, openedByPreviousAction);
        await openedByPreviousAction
          .waitForLoadState("domcontentloaded", { timeout: 10_000 })
          .catch(() => undefined);
        return openedByPreviousAction;
      }

      if (action.type === "navigate") {
        const created = await context.newPage();
        claimPage(action.pageId, created);
        return created;
      }

      throw new Error(
        "A automacao esperava continuar em uma nova aba/janela, mas ela nao foi encontrada."
      );
    };

    const optimized = recording.optimizationEnabled !== false;

    if (recording.initialUrl && page.url() !== recording.initialUrl) {
      await page.goto(recording.initialUrl, {
        waitUntil: optimized ? "load" : "domcontentloaded",
      });

      if (optimized) {
        await waitForOptimizedPage(page);
      }
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

      if (!optimized && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const actionPage = await resolvePageForAction(action);

      if (optimized && action.type !== "navigate") {
        await waitForOptimizedTarget(actionPage, action);
      }
      const nextAction = recording.actions[index + 1];

      let expectedNewPage: Promise<Page | null> | null = null;

      if (
        action.type === "click" &&
        nextAction?.pageId &&
        nextAction.pageId !== action.pageId &&
        !pageMap.has(nextAction.pageId)
      ) {
        expectedNewPage = context
          .waitForEvent("page", { timeout: 8_000 })
          .then((openedPage) => openedPage)
          .catch(() => null);
      }

      switch (action.type) {
        case "navigate": {
          if (comparableUrl(actionPage.url()) !== comparableUrl(action.url)) {
            await actionPage.goto(action.url, {
              waitUntil: optimized ? "load" : "domcontentloaded",
            });
          }

          if (optimized) {
            await waitForOptimizedPage(actionPage);
          }

          break;
        }

        case "click": {
          await clickAction(actionPage, action);

          if (expectedNewPage && nextAction?.pageId) {
            const openedPage = await expectedNewPage;

            if (openedPage && !openedPage.isClosed()) {
              claimPage(nextAction.pageId, openedPage);
              if (optimized) {
                await waitForOptimizedPage(openedPage);
              } else {
                await openedPage
                  .waitForLoadState("domcontentloaded", { timeout: 10_000 })
                  .catch(() => undefined);
              }
            }
          }

          break;
        }

        case "input": {
          if (action.isSecret) {
            throw new Error(
              "A gravacao contem um campo secreto. Variaveis seguras ainda nao foram configuradas."
            );
          }

          await inputAction(actionPage, action, resolveDynamicValue);
          break;
        }

        case "key": {
          await keyAction(actionPage, action);
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
