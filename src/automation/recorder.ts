import { Browser, BrowserContext, Page, chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { AutomationAction, AutomationRecording } from "../shared/types";

type EventSink = (action: AutomationAction) => void;

export class BrowserRecorder {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private recording: AutomationRecording | null = null;
  private lastTimestamp = 0;

  constructor(private readonly onAction?: EventSink) {}

  async start(initialUrl: string, name = "Nova automacao"): Promise<AutomationRecording> {
    if (this.recording) {
      throw new Error("Ja existe uma gravacao em andamento.");
    }

    this.recording = {
      id: randomUUID(),
      name,
      initialUrl,
      createdAt: new Date().toISOString(),
      actions: [],
    };

    this.lastTimestamp = Date.now();
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();

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

    this.page = await this.context.newPage();

    this.page.on("framenavigated", (frame) => {
      if (frame !== this.page?.mainFrame()) return;
      const url = frame.url();
      if (!url || url === "about:blank") return;
      this.recordAction({ type: "navigate", url });
    });

    await this.page.goto(initialUrl, { waitUntil: "domcontentloaded" });

    return this.recording;
  }

  async stop(): Promise<AutomationRecording> {
    if (!this.recording) {
      throw new Error("Nao existe gravacao em andamento.");
    }

    const finished = this.recording;
    this.recording = null;

    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);

    this.page = null;
    this.context = null;
    this.browser = null;

    return finished;
  }

  isRecording(): boolean {
    return Boolean(this.recording);
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
