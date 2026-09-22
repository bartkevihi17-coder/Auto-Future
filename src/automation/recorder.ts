import { BrowserContext, Page, chromium } from "playwright";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { AutomationAction, AutomationRecording } from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

type EventSink = (action: AutomationAction) => void;

export interface UnsupportedPageInfo {
  url: string;
  title?: string;
  reason: "capture-unavailable" | "opaque-content" | "product-editor-unreadable" | "page-crashed";
  details: string;
}

type UnsupportedSink = (info: UnsupportedPageInfo) => void;

export class BrowserRecorder {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private recording: AutomationRecording | null = null;
  private lastTimestamp = 0;
  private browserName = "Chromium";
  private browserFirstUse = false;
  private readabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private unsupportedTriggered = false;

  constructor(
    private readonly videoDir: string,
    private readonly browserProfileDir: string,
    private readonly onAction?: EventSink,
    private readonly onUnsupported?: UnsupportedSink
  ) {}

  async start(initialUrl: string, name = "Nova automacao"): Promise<AutomationRecording> {
    if (this.recording) {
      throw new Error("Ja existe uma gravacao em andamento.");
    }

    await fs.mkdir(this.videoDir, { recursive: true });

    const preparedProfile = await prepareBrowserProfile(this.browserProfileDir);
    this.browserName = preparedProfile.browserName;
    this.browserFirstUse = preparedProfile.firstUse;
    this.unsupportedTriggered = false;

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

    await this.context.exposeBinding("__autoFutureRecord", async (source, payload: unknown) => {
      if (!payload || typeof payload !== "object") return;

      const data = payload as {
        type?: string;
        selector?: string;
        value?: string;
        url?: string;
        isSecret?: boolean;
        x?: number;
        y?: number;
      };

      if (data.type !== "click" && data.type !== "input") return;

      this.recordAction({
        type: data.type,
        selector: data.selector,
        value: data.value,
        url: data.url ?? source.frame.url() ?? this.page?.url() ?? initialUrl,
        isSecret: Boolean(data.isSecret),
        frameUrl: source.frame.url(),
        frameName: source.frame.name() || undefined,
        x: Number.isFinite(data.x) ? Number(data.x) : undefined,
        y: Number.isFinite(data.y) ? Number(data.y) : undefined,
      });
    });

    await this.context.addInitScript({
      content: `
(() => {
  window.__autoFutureRecorderReady = true;

  const eventTarget = (event) => {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const candidate = path.find((item) => item instanceof Element);
    if (candidate instanceof Element) return candidate;
    return event.target instanceof Element ? event.target : null;
  };

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  };

  const selectorFor = (element) => {
    if (!(element instanceof Element)) return "";

    const testId = element.getAttribute("data-testid") || element.getAttribute("data-test");
    if (testId) {
      const attr = element.hasAttribute("data-testid") ? "data-testid" : "data-test";
      return "[" + attr + "=\\\"" + String(testId).replace(/"/g, '\\\\"') + "\\"]";
    }

    if (element.id) return "#" + cssEscape(element.id);

    const name = element.getAttribute("name");
    if (name) {
      const byName = element.tagName.toLowerCase() + '[name="' + String(name).replace(/"/g, '\\\\"') + '"]';
      if (document.querySelectorAll(byName).length === 1) return byName;
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      const byAria = '[aria-label="' + String(ariaLabel).replace(/"/g, '\\\\"') + '"]';
      if (document.querySelectorAll(byAria).length === 1) return byAria;
    }

    const placeholder = element.getAttribute("placeholder");
    if (placeholder) {
      const byPlaceholder = element.tagName.toLowerCase() + '[placeholder="' + String(placeholder).replace(/"/g, '\\\\"') + '"]';
      if (document.querySelectorAll(byPlaceholder).length === 1) return byPlaceholder;
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

  const pointFor = (element, event) => {
    if (event && typeof event.clientX === "number" && typeof event.clientY === "number" && (event.clientX !== 0 || event.clientY !== 0)) {
      return { x: event.clientX, y: event.clientY };
    }

    if (element instanceof Element) {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    return {};
  };

  const send = (payload) => {
    const fn = window.__autoFutureRecord;
    if (typeof fn === "function") {
      fn({ ...payload, url: location.href });
    }
  };

  document.addEventListener("click", (event) => {
    const target = eventTarget(event);
    if (!target) return;
    send({ type: "click", selector: selectorFor(target), ...pointFor(target, event) });
  }, true);

  document.addEventListener("change", (event) => {
    const target = eventTarget(event);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    const isSecret = target instanceof HTMLInputElement && target.type === "password";
    send({
      type: "input",
      selector: selectorFor(target),
      value: isSecret ? "" : target.value,
      isSecret,
      ...pointFor(target)
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
      this.scheduleReadabilityCheck(2500, 0);
    });

    this.page.on("crash", () => {
      void this.abortForUnsupportedPage({
        url: this.page?.url() || initialUrl,
        reason: "page-crashed",
        details: "A aba do navegador travou enquanto o Auto Future tentava acompanhar a pagina.",
      });
    });

    try {
      await this.page.goto(initialUrl, { waitUntil: "domcontentloaded" });
      this.scheduleReadabilityCheck(2500, 0);
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

    this.clearReadabilityTimer();

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

  private clearReadabilityTimer(): void {
    if (this.readabilityTimer) {
      clearTimeout(this.readabilityTimer);
      this.readabilityTimer = null;
    }
  }

  private scheduleReadabilityCheck(delayMs: number, attempt: number): void {
    this.clearReadabilityTimer();

    this.readabilityTimer = setTimeout(() => {
      this.readabilityTimer = null;
      void this.inspectReadability(attempt);
    }, delayMs);
  }

  private async inspectReadability(attempt: number): Promise<void> {
    const page = this.page;

    if (!page || !this.recording || this.unsupportedTriggered || page.isClosed()) return;

    const url = page.url();
    if (!url || url === "about:blank") return;

    const probes: Array<{
      url: string;
      ready: boolean;
      textLength: number;
      interactiveCount: number;
      formControlCount: number;
      elementCount: number;
      canvasCount: number;
    }> = [];

    for (const frame of page.frames()) {
      try {
        const probe = await frame.evaluate(() => {
          const body = document.body;
          const text = (body?.innerText || "").trim();
          const interactive =
            "a[href],button,input,select,textarea,[contenteditable='true'],[role='button'],[role='link'],[role='textbox']";

          return {
            ready: Boolean(
              (window as unknown as { __autoFutureRecorderReady?: boolean })
                .__autoFutureRecorderReady
            ),
            textLength: text.length,
            interactiveCount: document.querySelectorAll(interactive).length,
            formControlCount: document.querySelectorAll(
              "input,select,textarea,[contenteditable='true']"
            ).length,
            elementCount: body?.querySelectorAll("*").length || 0,
            canvasCount: document.querySelectorAll("canvas").length,
          };
        });

        probes.push({
          url: frame.url(),
          ...probe,
        });
      } catch {
        probes.push({
          url: frame.url(),
          ready: false,
          textLength: 0,
          interactiveCount: 0,
          formControlCount: 0,
          elementCount: 0,
          canvasCount: 0,
        });
      }
    }

    const totals = probes.reduce(
      (sum, probe) => ({
        readyFrames: sum.readyFrames + (probe.ready ? 1 : 0),
        textLength: sum.textLength + probe.textLength,
        interactiveCount: sum.interactiveCount + probe.interactiveCount,
        formControlCount: sum.formControlCount + probe.formControlCount,
        elementCount: sum.elementCount + probe.elementCount,
        canvasCount: sum.canvasCount + probe.canvasCount,
      }),
      {
        readyFrames: 0,
        textLength: 0,
        interactiveCount: 0,
        formControlCount: 0,
        elementCount: 0,
        canvasCount: 0,
      }
    );

    const isSigeProductEditor =
      /enfoquepapelaria\.meusige\.com\.br\/sistema\/Produtos\/Edit\//i.test(url);

    let reason: UnsupportedPageInfo["reason"] | null = null;
    let details = "";

    if (totals.readyFrames === 0) {
      reason = "capture-unavailable";
      details =
        "O script de captura nao conseguiu acessar nenhum frame da pagina. " +
        "Isso normalmente acontece quando o conteudo esta isolado ou protegido.";
    } else if (
      totals.textLength < 8 &&
      totals.interactiveCount === 0 &&
      totals.elementCount < 8
    ) {
      reason = "opaque-content";
      details =
        "A pagina foi exibida, mas nao apresentou DOM utilizavel para leitura e gravacao. " +
        "Ela pode estar sendo desenhada em canvas, WebView ou outra camada opaca.";
    } else if (isSigeProductEditor && totals.formControlCount < 2) {
      reason = "product-editor-unreadable";
      details =
        "O editor de produto do SIGE abriu, mas os campos do cadastro nao ficaram acessiveis ao gravador.";
    }

    if (!reason) return;

    if (attempt < 1) {
      this.scheduleReadabilityCheck(2500, attempt + 1);
      return;
    }

    const title = await page.title().catch(() => undefined);

    await this.abortForUnsupportedPage({
      url,
      title,
      reason,
      details:
        details +
        " Frames detectados: " + probes.length +
        "; controles acessiveis ao DOM: " + totals.interactiveCount +
        "; campos de formulario: " + totals.formControlCount +
        "; canvas: " + totals.canvasCount + ".",
    });
  }

  private async abortForUnsupportedPage(info: UnsupportedPageInfo): Promise<void> {
    if (this.unsupportedTriggered) return;

    this.unsupportedTriggered = true;
    this.clearReadabilityTimer();

    const context = this.context;

    this.recording = null;
    this.page = null;
    this.context = null;

    await context?.close().catch(() => undefined);
    this.onUnsupported?.(info);
  }

  private recordAction(
    partial: Pick<AutomationAction, "type" | "url"> &
      Partial<
        Pick<
          AutomationAction,
          "selector" | "value" | "isSecret" | "frameUrl" | "frameName" | "x" | "y"
        >
      >
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
      frameUrl: partial.frameUrl,
      frameName: partial.frameName,
      x: partial.x,
      y: partial.y,
    };

    this.lastTimestamp = now;
    this.recording.actions.push(action);
    this.onAction?.(action);
  }
}
