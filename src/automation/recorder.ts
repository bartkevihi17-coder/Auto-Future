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
  private recordingStartedAt = 0;
  private pageSequence = 0;
  private pageIds = new Map<Page, string>();
  private trackedPages = new Map<Page, { pageId: string; startedAtMs: number }>();
  private lastRecordedUrlByPage = new Map<string, string>();

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
    this.recordingStartedAt = Date.now();
    this.pageSequence = 0;
    this.pageIds.clear();
    this.trackedPages.clear();
    this.lastRecordedUrlByPage.clear();

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
      optimizationEnabled: true,
      notificationsEnabled: false,
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
        key?: string;
        code?: string;
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        metaKey?: boolean;
        x?: number;
        y?: number;
      };

      const sourcePage = source.page ?? source.frame.page();

      if (sourcePage && !this.pageIds.has(sourcePage)) {
        this.registerPage(sourcePage);
      }

      if (sourcePage) {
        this.page = sourcePage;
      }

      const sourceUrl = data.url ?? source.frame.url() ?? sourcePage?.url() ?? initialUrl;

      if (data.type === "navigate") {
        if (sourcePage) {
          this.recordNavigation(sourcePage, sourceUrl);
        }
        return;
      }

      if (
        data.type !== "click" &&
        data.type !== "input" &&
        data.type !== "key"
      ) return;

      this.recordAction({
        type: data.type,
        selector: data.selector,
        value: data.value,
        url: sourceUrl,
        isSecret: Boolean(data.isSecret),
        key: data.key,
        code: data.code,
        ctrlKey: Boolean(data.ctrlKey),
        altKey: Boolean(data.altKey),
        shiftKey: Boolean(data.shiftKey),
        metaKey: Boolean(data.metaKey),
        frameUrl: source.frame.url(),
        frameName: source.frame.name() || undefined,
        x: Number.isFinite(data.x) ? Number(data.x) : undefined,
        y: Number.isFinite(data.y) ? Number(data.y) : undefined,
        pageId: sourcePage ? this.pageIds.get(sourcePage) : undefined,
      });
    });

    await this.context.addInitScript({
      content: `
(() => {
  if (window.__autoFutureRecorderInstalled) return;
  window.__autoFutureRecorderInstalled = true;
  window.__autoFutureRecorderReady = false;

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

  let lastUrl = location.href;

  const reportNavigationIfChanged = () => {
    const current = location.href;
    if (!current || current === lastUrl) return;
    lastUrl = current;
    send({ type: "navigate" });
  };

  try {
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      const result = originalPushState(...args);
      queueMicrotask(reportNavigationIfChanged);
      return result;
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      const result = originalReplaceState(...args);
      queueMicrotask(reportNavigationIfChanged);
      return result;
    };
  } catch {
    // Some pages lock down History API methods. Click/input capture must
    // continue even when SPA navigation hooks cannot be patched.
  }

  window.addEventListener("popstate", reportNavigationIfChanged, true);
  window.addEventListener("hashchange", reportNavigationIfChanged, true);

  const navigationPoll = window.setInterval(reportNavigationIfChanged, 250);
  window.addEventListener("pagehide", () => {
    window.clearInterval(navigationPoll);
  }, { once: true });

  window.addEventListener("click", (event) => {
    const target = eventTarget(event);
    if (!target) return;

    send({
      type: "click",
      selector: selectorFor(target),
      ...pointFor(target, event)
    });

    window.setTimeout(reportNavigationIfChanged, 0);
    window.setTimeout(reportNavigationIfChanged, 120);
    window.setTimeout(reportNavigationIfChanged, 400);
  }, true);

  window.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;

    const target = eventTarget(event);
    const isPassword =
      target instanceof HTMLInputElement &&
      target.type === "password";

    if (isPassword) return;

    send({
      type: "key",
      selector: target ? selectorFor(target) : "",
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ...pointFor(target)
    });
  }, true);

  const inputTimers = new WeakMap();

  const reportInput = (target) => {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    const pending = inputTimers.get(target);
    if (pending) window.clearTimeout(pending);

    const isSecret = target instanceof HTMLInputElement && target.type === "password";
    send({
      type: "input",
      selector: selectorFor(target),
      value: isSecret ? "" : target.value,
      isSecret,
      ...pointFor(target)
    });

    inputTimers.delete(target);
  };

  document.addEventListener("input", (event) => {
    const target = eventTarget(event);
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    const pending = inputTimers.get(target);
    if (pending) window.clearTimeout(pending);

    const timer = window.setTimeout(() => reportInput(target), 300);
    inputTimers.set(target, timer);
  }, true);

  document.addEventListener("change", (event) => {
    reportInput(eventTarget(event));
  }, true);

  document.addEventListener("focusout", (event) => {
    reportInput(eventTarget(event));
  }, true);

  window.__autoFutureRecorderReady = true;
})();
`,
    });

    const restoredPages = this.context.pages();
    this.page = restoredPages[0] ?? await this.context.newPage();

    for (const page of this.context.pages()) {
      this.registerPage(page);
    }

    this.context.on("page", (page) => {
      this.registerPage(page);
      this.page = page;
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
    const pageVideos = [...this.trackedPages.entries()].map(([page, meta]) => ({
      page,
      meta,
      video: page.video(),
      url: page.url(),
    }));

    const segments = [];

    for (const entry of pageVideos) {
      if (!entry.video) continue;

      const finalPath = path.join(
        this.videoDir,
        finished.id + "-" + entry.meta.pageId + ".webm"
      );

      if (!entry.page.isClosed()) {
        await entry.page.close({ runBeforeUnload: false }).catch(() => undefined);
      }

      let saved = await entry.video
        .saveAs(finalPath)
        .then(() => true)
        .catch(() => false);

      if (!saved) {
        const rawPath = await entry.video.path().catch(() => null);

        if (rawPath) {
          saved = await fs
            .copyFile(rawPath, finalPath)
            .then(() => true)
            .catch(() => false);
        }
      }

      if (!saved) continue;

      segments.push({
        pageId: entry.meta.pageId,
        startedAtMs: entry.meta.startedAtMs,
        videoPath: finalPath,
        url: entry.url,
      });
    }

    await this.context?.close().catch(() => undefined);

    finished.videoSegments = segments;

    const firstSegment = [...segments].sort((a, b) => a.startedAtMs - b.startedAtMs)[0];
    if (firstSegment?.videoPath) {
      finished.videoPath = firstSegment.videoPath;
    }

    this.recording = null;
    this.page = null;
    this.context = null;
    this.pageIds.clear();
    this.trackedPages.clear();
    this.lastRecordedUrlByPage.clear();

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

  private registerPage(page: Page): void {
    if (this.pageIds.has(page)) return;

    const pageId = "p" + (++this.pageSequence);
    const startedAtMs = Math.max(0, Date.now() - this.recordingStartedAt);

    this.pageIds.set(page, pageId);
    this.trackedPages.set(page, { pageId, startedAtMs });

    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame()) return;

      const url = frame.url();
      if (!url || url === "about:blank") return;

      this.page = page;
      this.recordNavigation(page, url);
      this.scheduleReadabilityCheck(2500, 0);
    });

    page.on("domcontentloaded", () => {
      this.page = page;
      this.recordNavigation(page, page.url());
    });

    page.on("load", () => {
      this.page = page;
      this.recordNavigation(page, page.url());
    });

    page.on("crash", () => {
      void this.abortForUnsupportedPage({
        url: page.url() || this.recording?.initialUrl || "",
        reason: "page-crashed",
        details: "Uma aba do navegador travou enquanto o Auto Future tentava acompanhar a pagina.",
      });
    });

    page.on("close", () => {
      if (this.page === page) {
        const fallback = [...this.trackedPages.keys()].find(
          (candidate) => candidate !== page && !candidate.isClosed()
        );

        if (fallback) this.page = fallback;
      }
    });
  }

  private recordNavigation(page: Page, url: string): void {
    if (!url || url === "about:blank") return;

    const pageId = this.pageIds.get(page);
    if (!pageId) return;

    const normalized = url.split("#")[0] + (url.includes("#") ? "#" + url.split("#").slice(1).join("#") : "");
    const previous = this.lastRecordedUrlByPage.get(pageId);

    if (previous === normalized) return;

    this.lastRecordedUrlByPage.set(pageId, normalized);
    this.recordAction({
      type: "navigate",
      url,
      pageId,
    });
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
    this.pageIds.clear();
    this.trackedPages.clear();
    this.lastRecordedUrlByPage.clear();

    await context?.close().catch(() => undefined);
    this.onUnsupported?.(info);
  }

  private recordAction(
    partial: Pick<AutomationAction, "type" | "url"> &
      Partial<
        Pick<
          AutomationAction,
          "selector" | "value" | "isSecret" | "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "frameUrl" | "frameName" | "pageId" | "x" | "y"
        >
      >
  ): void {
    if (!this.recording) return;

    const now = Date.now();
    const previous = this.recording.actions[this.recording.actions.length - 1];

    if (
      partial.type === "input" &&
      previous?.type === "input" &&
      previous.pageId === partial.pageId &&
      previous.frameUrl === partial.frameUrl &&
      previous.selector === partial.selector &&
      now - previous.timestamp <= 2000
    ) {
      previous.value = partial.value;
      previous.isSecret = partial.isSecret;
      previous.url = partial.url;
      previous.timestamp = now;
      previous.x = partial.x;
      previous.y = partial.y;
      this.lastTimestamp = now;
      return;
    }

    const action: AutomationAction = {
      id: randomUUID(),
      type: partial.type,
      timestamp: now,
      delayMs: Math.max(0, now - this.lastTimestamp),
      url: partial.url,
      selector: partial.selector,
      value: partial.value,
      isSecret: partial.isSecret,
      key: partial.key,
      code: partial.code,
      ctrlKey: partial.ctrlKey,
      altKey: partial.altKey,
      shiftKey: partial.shiftKey,
      metaKey: partial.metaKey,
      frameUrl: partial.frameUrl,
      frameName: partial.frameName,
      pageId: partial.pageId,
      x: partial.x,
      y: partial.y,
    };

    this.lastTimestamp = now;
    this.recording.actions.push(action);
    this.onAction?.(action);
  }
}
