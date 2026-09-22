import { BrowserContext, Page, chromium } from "playwright";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { AutomationAction, AutomationRecording } from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

type EventSink = (action: AutomationAction) => void;

export class BrowserRecorder {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private recording: AutomationRecording | null = null;
  private lastTimestamp = 0;
  private browserName = "Chromium";
  private browserFirstUse = false;

  constructor(
    private readonly videoDir: string,
    private readonly browserProfileDir: string,
    private readonly onAction?: EventSink
  ) {}

  async start(initialUrl: string, name = "Nova automacao"): Promise<AutomationRecording> {
    if (this.recording) {
      throw new Error("Ja existe uma gravacao em andamento.");
    }

    await fs.mkdir(this.videoDir, { recursive: true });

    const preparedProfile = await prepareBrowserProfile(this.browserProfileDir);
    this.browserName = preparedProfile.browserName;
    this.browserFirstUse = preparedProfile.firstUse;

    const launchArgs = [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
    ];

    try {
      this.context = await chromium.launchPersistentContext(preparedProfile.userDataDir, {
        headless: false,
        channel: preparedProfile.channel,
        executablePath: preparedProfile.executablePath,
        viewport: { width: 1280, height: 720 },
        recordVideo: {
          dir: this.videoDir,
          size: { width: 1280, height: 720 },
        },
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
          " ja esta em uso. Feche a janela de navegador aberta pelo Auto Future e tente novamente."
        );
      }

      throw new Error(
        "Nao consegui abrir " + preparedProfile.browserName +
        " com o perfil persistente do Auto Future. " + message
      );
    }

    this.recording = {
      id: randomUUID(),
      name,
      initialUrl,
      createdAt: new Date().toISOString(),
      actions: [],
      executionSpeed: 1,
    };

    this.lastTimestamp = Date.now();

    await this.context.exposeBinding("__autoFutureRecord", async (_source, payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as { type?: string; selector?: string; value?: string; url?: string; isSecret?: boolean };
      if (data.type !== "click" && data.type !== "input") return;

      this.recordAction({
        type: data.type,
        selector: data.selector,
        value: data.value,
        url: data.url ?? this.page?.url() ?? initialUrl,
        isSecret: Boolean(data.isSecret),
      });
    });

    await this.context.addInitScript({
      content: `
(() => {
  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  };

  const selectorFor = (element) => {
    if (!(element instanceof Element)) return "";

    const testId = element.getAttribute("data-testid");
    if (testId) return '[data-testid="' + String(testId).replace(/"/g, '\\\\"') + '"]';

    if (element.id) return "#" + cssEscape(element.id);

    const name = element.getAttribute("name");
    if (name) {
      const byName = element.tagName.toLowerCase() + '[name="' + String(name).replace(/"/g, '\\\\"') + '"]';
      if (document.querySelectorAll(byName).length === 1) return byName;
    }

    const text = (element.textContent || "").trim().replace(/\\s+/g, " ");
    if (text && text.length <= 60) {
      const tag = element.tagName.toLowerCase();
      const matches = Array.from(document.querySelectorAll(tag)).filter((node) => (node.textContent || "").trim().replace(/\\s+/g, " ") === text);
      if (matches.length === 1) return tag + ':has-text("' + text.replace(/"/g, '\\\\"') + '")';
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      let part = current.tagName.toLowerCase();
      const parent = current.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) {
          part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
      }

      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (document.querySelectorAll(candidate).length === 1) return candidate;
      current = parent;
    }

    return parts.join(" > ");
  };

  const send = (payload) => {
    const fn = window.__autoFutureRecord;
    if (typeof fn === "function") {
      fn({ ...payload, url: location.href });
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    send({ type: "click", selector: selectorFor(target) });
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    const isSecret = target instanceof HTMLInputElement && target.type === "password";
    send({
      type: "input",
      selector: selectorFor(target),
      value: isSecret ? "" : target.value,
      isSecret
    });
  }, true);
})();
`,
    });

    const restoredPages = this.context.pages();
    this.page = restoredPages[0] ?? await this.context.newPage();

    for (const extraPage of restoredPages.slice(1)) {
      await extraPage.close().catch(() => undefined);
    }

    this.page.on("framenavigated", (frame) => {
      if (frame !== this.page?.mainFrame()) return;
      const url = frame.url();
      if (!url || url === "about:blank") return;
      this.recordAction({ type: "navigate", url });
    });

    try {
      await this.page.goto(initialUrl, { waitUntil: "domcontentloaded" });
    } catch (error) {
      await this.context.close().catch(() => undefined);
      this.context = null;
      this.page = null;
      this.recording = null;
      throw error;
    }

    return this.recording;
  }

  async stop(): Promise<AutomationRecording> {
    if (!this.recording) {
      throw new Error("Nao existe gravacao em andamento.");
    }

    const finished = this.recording;
    const video = this.page?.video();

    await this.context?.close().catch(() => undefined);

    if (video) {
      const rawVideoPath = await video.path().catch(() => null);
      if (rawVideoPath) {
        const finalPath = path.join(this.videoDir, finished.id + ".webm");
        if (rawVideoPath !== finalPath) {
          await fs.rename(rawVideoPath, finalPath).catch(async () => {
            await fs.copyFile(rawVideoPath, finalPath);
          });
        }
        finished.videoPath = finalPath;
      }
    }

    this.recording = null;
    this.page = null;
    this.context = null;

    return finished;
  }

  isRecording(): boolean {
    return Boolean(this.recording);
  }

  getBrowserSessionInfo(): { browserName: string; firstUse: boolean } {
    return {
      browserName: this.browserName,
      firstUse: this.browserFirstUse,
    };
  }

  private recordAction(
    partial: Pick<AutomationAction, "type" | "url"> &
      Partial<Pick<AutomationAction, "selector" | "value" | "isSecret">>
  ): void {
    if (!this.recording) return;

    const now = Date.now();
    const action: AutomationAction = {
      id: randomUUID(),
      type: partial.type,
      timestamp: now,
      delayMs: Math.max(0, now - this.lastTimestamp),
      url: partial.url,
      selector: partial.selector,
      value: partial.value,
      isSecret: partial.isSecret,
    };

    this.lastTimestamp = now;
    this.recording.actions.push(action);
    this.onAction?.(action);
  }
}
