import { BrowserContext, Page, chromium } from "playwright";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import {
  AutomationAction,
  AutomationHybridDirective,
  AutomationRecording,
} from "../shared/types";
import { prepareBrowserProfile } from "./browser-profile";

type EventSink = (action: AutomationAction) => void;

export interface UnsupportedPageInfo {
  url: string;
  title?: string;
  reason: "capture-unavailable" | "opaque-content" | "product-editor-unreadable" | "page-crashed";
  details: string;
}

type UnsupportedSink = (info: UnsupportedPageInfo) => void;

export interface EditableFieldInfo {
  selector: string;
  url: string;
  label?: string;
  placeholder?: string;
  inputType?: string;
  frameUrl?: string;
  frameName?: string;
  pageId?: string;
  x?: number;
  y?: number;
  requestComment?: boolean;
}

export interface HybridRecordingSnapshot {
  url: string;
  title: string;
  text: string;
  anchor?: Record<string, unknown>;
  elements: Array<Record<string, unknown>>;
  paginationCandidates: Array<Record<string, unknown>>;
  repeatedGroups: Array<Record<string, unknown>>;
}

type EditableSink = (info: EditableFieldInfo) => void;

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
  private domainIconPromise: Promise<void> | null = null;
  private activeHybridDirectiveId: string | null = null;

  constructor(
    private readonly videoDir: string,
    private readonly iconDir: string,
    private readonly browserProfileDir: string,
    private readonly onAction?: EventSink,
    private readonly onUnsupported?: UnsupportedSink,
    private readonly onEditable?: EditableSink
  ) {}

  async start(initialUrl: string, name = "Nova automacao"): Promise<AutomationRecording> {
    if (this.recording) {
      throw new Error("Ja existe uma gravacao em andamento.");
    }

    await fs.mkdir(this.videoDir, { recursive: true });
    await fs.mkdir(this.iconDir, { recursive: true });

    const preparedProfile = await prepareBrowserProfile(this.browserProfileDir);
    this.browserName = preparedProfile.browserName;
    this.browserFirstUse = preparedProfile.firstUse;
    this.unsupportedTriggered = false;
    this.recordingStartedAt = Date.now();
    this.pageSequence = 0;
    this.pageIds.clear();
    this.trackedPages.clear();
    this.lastRecordedUrlByPage.clear();
    this.domainIconPromise = null;
    this.activeHybridDirectiveId = null;

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
      hybridDirectives: [],
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
        label?: string;
        placeholder?: string;
        inputType?: string;
        targetText?: string;
        targetAriaLabel?: string;
        targetRole?: string;
        targetTitle?: string;
      };

      const sourcePage = source.page ?? source.frame.page();

      if (sourcePage && !this.pageIds.has(sourcePage)) {
        this.registerPage(sourcePage);
      }

      if (sourcePage) {
        this.page = sourcePage;
      }

      const sourceUrl = data.url ?? source.frame.url() ?? sourcePage?.url() ?? initialUrl;

      if (
        data.type === "editable-focus" ||
        data.type === "editable-comment"
      ) {
        this.onEditable?.({
          selector: String(data.selector || ""),
          url: sourceUrl,
          label: data.label,
          placeholder: data.placeholder,
          inputType: data.inputType,
          frameUrl: source.frame.url(),
          frameName: source.frame.name() || undefined,
          pageId: sourcePage ? this.pageIds.get(sourcePage) : undefined,
          x: Number.isFinite(data.x) ? Number(data.x) : undefined,
          y: Number.isFinite(data.y) ? Number(data.y) : undefined,
          requestComment: data.type === "editable-comment",
        });
        return;
      }

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
        targetText: data.targetText,
        targetAriaLabel: data.targetAriaLabel,
        targetRole: data.targetRole,
        targetTitle: data.targetTitle,
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

  const isEditable = (element) =>
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable);

  const isCommentableEditable = (element) => {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLElement && element.isContentEditable) return true;
    if (!(element instanceof HTMLInputElement)) return false;

    const type = String(element.type || "text").toLowerCase();

    return ![
      "password",
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "file",
      "range",
      "color",
      "hidden",
    ].includes(type);
  };

  const editableLabel = (element) => {
    if (!(element instanceof Element)) return "";

    const aria = element.getAttribute("aria-label");
    if (aria) return aria;

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
        .trim();

      if (text) return text;
    }

    if (element.id) {
      try {
        const label = document.querySelector(
          'label[for="' + cssEscape(element.id) + '"]'
        );
        const text = (label?.textContent || "").trim();
        if (text) return text;
      } catch {}
    }

    const wrappingLabel = element.closest("label");
    if (wrappingLabel) {
      const text = (wrappingLabel.textContent || "").trim();
      if (text) return text;
    }

    return (
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      ""
    );
  };

  const semanticMeta = (element) => {
    if (!(element instanceof Element)) {
      return {
        targetText: "",
        targetAriaLabel: "",
        targetRole: "",
        targetTitle: ""
      };
    }

    return {
      targetText: String(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
          ? editableLabel(element)
          : element.innerText || element.textContent || ""
      ).replace(/\s+/g, " ").trim().slice(0, 220),
      targetAriaLabel: String(
        element.getAttribute("aria-label") || ""
      ).replace(/\s+/g, " ").trim().slice(0, 180),
      targetRole: String(
        element.getAttribute("role") || ""
      ).replace(/\s+/g, " ").trim().slice(0, 60),
      targetTitle: String(
        element.getAttribute("title") || ""
      ).replace(/\s+/g, " ").trim().slice(0, 180)
    };
  };

  let commentButton = null;
  let commentTarget = null;

  const removeCommentButton = () => {
    commentButton?.remove();
    commentButton = null;
    commentTarget = null;
  };

  const positionCommentButton = () => {
    if (!commentButton || !commentTarget || !document.contains(commentTarget)) {
      removeCommentButton();
      return;
    }

    const rect = commentTarget.getBoundingClientRect();

    if (
      rect.width <= 2 ||
      rect.height <= 2 ||
      rect.bottom < 0 ||
      rect.right < 0 ||
      rect.top > innerHeight ||
      rect.left > innerWidth
    ) {
      commentButton.style.display = "none";
      return;
    }

    commentButton.style.display = "inline-flex";
    const buttonRect = commentButton.getBoundingClientRect();
    const gap = 8;
    let left = rect.right - buttonRect.width;
    left = Math.max(8, Math.min(innerWidth - buttonRect.width - 8, left));

    let top = rect.top - buttonRect.height - gap;
    if (top < 8) {
      top = Math.min(innerHeight - buttonRect.height - 8, rect.bottom + gap);
    }

    commentButton.style.left = left + "px";
    commentButton.style.top = top + "px";
  };

  const showCommentButton = (target) => {
    if (!isCommentableEditable(target)) return;

    commentTarget = target;

    if (!commentButton) {
      commentButton = document.createElement("button");
      commentButton.type = "button";
      commentButton.dataset.autoFutureUi = "comment";
      commentButton.textContent = "✦ Comentar";
      commentButton.setAttribute("aria-label", "Comentar esta etapa da automação");
      commentButton.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "height:30px",
        "padding:0 11px",
        "border:1px solid rgba(133,104,190,.45)",
        "border-radius:999px",
        "background:rgba(39,39,42,.96)",
        "color:#f5f1ff",
        "box-shadow:0 10px 28px rgba(0,0,0,.25)",
        "font:700 12px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
        "cursor:pointer",
        "user-select:none"
      ].join(";");

      commentButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      }, true);

      commentButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!commentTarget || !isEditable(commentTarget)) return;

        send({
          type: "editable-comment",
          selector: selectorFor(commentTarget),
          label: editableLabel(commentTarget),
          placeholder: commentTarget.getAttribute("placeholder") || "",
          inputType:
            commentTarget instanceof HTMLInputElement
              ? commentTarget.type || "text"
              : commentTarget.tagName.toLowerCase(),
          ...pointFor(commentTarget)
        });
      }, true);

      document.documentElement.appendChild(commentButton);
    }

    positionCommentButton();
  };

  document.addEventListener("focusin", (event) => {
    const target = eventTarget(event);
    if (!target || !isCommentableEditable(target)) return;

    showCommentButton(target);

    send({
      type: "editable-focus",
      selector: selectorFor(target),
      label: editableLabel(target),
      placeholder: target.getAttribute("placeholder") || "",
      inputType:
        target instanceof HTMLInputElement
          ? target.type || "text"
          : target.tagName.toLowerCase(),
      ...pointFor(target)
    });
  }, true);

  window.addEventListener("scroll", positionCommentButton, true);
  window.addEventListener("resize", positionCommentButton, true);

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
    if (target.closest?.("[data-auto-future-ui]")) return;

    send({
      type: "click",
      selector: selectorFor(target),
      ...semanticMeta(target),
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
      ...semanticMeta(target),
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
    if (!isEditable(target)) return;

    const pending = inputTimers.get(target);
    if (pending) window.clearTimeout(pending);

    const isSecret = target instanceof HTMLInputElement && target.type === "password";
    const value =
      target instanceof HTMLElement && target.isContentEditable
        ? target.innerText
        : "value" in target
          ? target.value
          : "";

    send({
      type: "input",
      selector: selectorFor(target),
      ...semanticMeta(target),
      value: isSecret ? "" : value,
      isSecret,
      ...pointFor(target)
    });

    inputTimers.delete(target);
  };

  document.addEventListener("input", (event) => {
    const target = eventTarget(event);
    if (!target || !isEditable(target)) return;

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
      this.domainIconPromise = this.captureDomainIcon(this.page, initialUrl).catch(
        () => undefined
      );
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

    await this.domainIconPromise?.catch(() => undefined);

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
    this.domainIconPromise = null;
    this.activeHybridDirectiveId = null;

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

  getCurrentRecording(): AutomationRecording | null {
    return this.recording;
  }

  async focusBrowser(): Promise<void> {
    if (this.recording) {
      this.lastTimestamp = Date.now();
    }

    await this.page?.bringToFront().catch(() => undefined);
  }

  async captureHybridSnapshot(
    field: EditableFieldInfo
  ): Promise<HybridRecordingSnapshot> {
    const page = this.page;

    if (!page || page.isClosed()) {
      throw new Error("A página da gravação não está mais disponível.");
    }

    const frame =
      page
        .frames()
        .find((candidate) =>
          field.frameUrl
            ? candidate.url() === field.frameUrl
            : field.frameName
              ? candidate.name() === field.frameName
              : false
        ) || page.mainFrame();

    return frame.evaluate(
      ({ anchorSelector }) => {
        const clean = (value: unknown, limit = 180) =>
          String(value || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, limit);

        const cssEscape = (value: string) => {
          if (window.CSS && typeof window.CSS.escape === "function") {
            return window.CSS.escape(value);
          }

          return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
        };

        const quote = (value: string) =>
          String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        const safeCount = (selector: string) => {
          try {
            return document.querySelectorAll(selector).length;
          } catch {
            return 0;
          }
        };

        const selectorFor = (element: Element | null): string => {
          if (!element) return "";

          const testId =
            element.getAttribute("data-testid") ||
            element.getAttribute("data-test");

          if (testId) {
            const attr = element.hasAttribute("data-testid")
              ? "data-testid"
              : "data-test";
            const selector = "[" + attr + '="' + quote(testId) + '"]';
            if (safeCount(selector) === 1) return selector;
          }

          if ((element as HTMLElement).id) {
            const selector = "#" + cssEscape((element as HTMLElement).id);
            if (safeCount(selector) === 1) return selector;
          }

          for (const attr of ["name", "aria-label", "placeholder", "title"]) {
            const value = element.getAttribute(attr);
            if (!value) continue;

            const selector =
              element.tagName.toLowerCase() +
              "[" +
              attr +
              '="' +
              quote(value) +
              '"]';

            if (safeCount(selector) === 1) return selector;
          }

          const parts: string[] = [];
          let current: Element | null = element;

          while (current && parts.length < 6) {
            let part = current.tagName.toLowerCase();
            const currentTagName = current.tagName;
            const parent: HTMLElement | null = current.parentElement;

            if (parent) {
              const siblings: Element[] = Array.from(parent.children).filter(
                (child: Element) => child.tagName === currentTagName
              );

              if (siblings.length > 1) {
                part +=
                  ":nth-of-type(" +
                  (siblings.indexOf(current) + 1) +
                  ")";
              }
            }

            parts.unshift(part);
            const candidate = parts.join(" > ");

            if (safeCount(candidate) === 1) return candidate;
            current = parent;
          }

          return parts.join(" > ");
        };

        const visible = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          return (
            rect.width > 2 &&
            rect.height > 2 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < innerHeight &&
            rect.left < innerWidth &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0.02
          );
        };

        const describe = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const tag = element.tagName.toLowerCase();

          return {
            selector: selectorFor(element),
            tag,
            role: clean(element.getAttribute("role"), 50),
            text: clean(
              tag === "input" || tag === "textarea"
                ? element.getAttribute("aria-label") ||
                    element.getAttribute("placeholder")
                : (element as HTMLElement).innerText || element.textContent,
              160
            ),
            ariaLabel: clean(element.getAttribute("aria-label"), 160),
            placeholder: clean(element.getAttribute("placeholder"), 160),
            title: clean(element.getAttribute("title"), 160),
            href:
              element instanceof HTMLAnchorElement
                ? clean(element.href, 400)
                : "",
            disabled: Boolean(
              (element as HTMLButtonElement).disabled ||
                element.getAttribute("aria-disabled") === "true"
            ),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          };
        };

        let anchor: Element | null = null;

        try {
          anchor = anchorSelector
            ? document.querySelector(anchorSelector)
            : null;
        } catch {
          anchor = null;
        }

        const interactiveSelector = [
          "button",
          "a[href]",
          "input",
          "textarea",
          "select",
          "[contenteditable=true]",
          "[role=button]",
          "[role=link]",
          "[role=menuitem]",
          "[role=checkbox]",
          "[role=radio]",
          "[role=tab]",
          "[role=option]",
        ].join(",");

        const elements = Array.from(
          document.querySelectorAll(interactiveSelector)
        )
          .filter((element) => visible(element))
          .slice(0, 90)
          .map(describe);

        const paginationWords =
          /^(pr[oó]xim[ao]|next|seguinte|avan[cç]ar|mais|›|»|>|→)$/i;

        const paginationCandidates = Array.from(
          document.querySelectorAll(
            "button,a[href],[role=button],[role=link]"
          )
        )
          .filter((element) => visible(element))
          .map((element) => {
            const description = describe(element);
            const semantic = clean(
              [
                description.text,
                description.ariaLabel,
                description.title,
              ]
                .filter(Boolean)
                .join(" "),
              220
            );

            return {
              ...description,
              semantic,
            };
          })
          .filter((item) => paginationWords.test(item.semantic))
          .slice(0, 16);

        const repeatedGroups: Array<Record<string, unknown>> = [];
        const containers = Array.from(
          document.querySelectorAll(
            "ul,ol,tbody,[role=list],[role=grid],[role=table]"
          )
        );

        for (const container of containers) {
          if (repeatedGroups.length >= 12 || !visible(container)) continue;

          const children = Array.from(container.children).filter(
            (child) => visible(child)
          );

          if (children.length < 3) continue;

          const signatures = new Map<
            string,
            { count: number; items: Element[] }
          >();

          for (const child of children) {
            const className =
              child instanceof HTMLElement
                ? Array.from(child.classList)
                    .filter((name) => name.length < 50)
                    .slice(0, 3)
                    .sort()
                    .join(".")
                : "";
            const signature =
              child.tagName.toLowerCase() +
              (className ? "." + className : "");

            const current = signatures.get(signature) || {
              count: 0,
              items: [],
            };

            current.count += 1;
            if (current.items.length < 4) current.items.push(child);
            signatures.set(signature, current);
          }

          const dominant = [...signatures.entries()].sort(
            (a, b) => b[1].count - a[1].count
          )[0];

          if (!dominant || dominant[1].count < 3) continue;

          const sampleItems = dominant[1].items;
          const firstLink = sampleItems
            .flatMap((item) => Array.from(item.querySelectorAll("a[href]")))
            .find((link) => visible(link));

          repeatedGroups.push({
            containerSelector: selectorFor(container),
            itemSignature: dominant[0],
            itemCount: dominant[1].count,
            sampleTexts: sampleItems.map((item) =>
              clean((item as HTMLElement).innerText || item.textContent, 220)
            ),
            itemLinkSelector: selectorFor(firstLink || null),
          });
        }

        return {
          url: location.href,
          title: document.title,
          text: clean(document.body?.innerText, 5000),
          anchor: anchor ? describe(anchor) : undefined,
          elements,
          paginationCandidates,
          repeatedGroups,
        };
      },
      {
        anchorSelector: field.selector,
      }
    );
  }

  applyHybridDirective(
    directive: AutomationHybridDirective
  ): AutomationHybridDirective {
    if (!this.recording) {
      throw new Error("Não existe uma gravação em andamento.");
    }

    const actions = this.recording.actions;
    let anchorIndex = -1;

    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const action = actions[index];

      if (
        action.type === "input" &&
        action.selector === directive.anchorSelector
      ) {
        anchorIndex = index;
        break;
      }
    }

    if (anchorIndex >= 0) {
      const anchor = actions[anchorIndex];
      anchor.hybridDirectiveId = directive.id;
      directive.anchorActionId = anchor.id;
      directive.startActionIndex = anchorIndex;

      if (directive.inputPlan?.mode === "sequence") {
        const values = (directive.inputPlan.values || [])
          .map((value) => String(value || "").trim())
          .filter(Boolean);

        if (values.length) {
          anchor.dynamicValueSequence = values;
          anchor.dynamicValuePrompt = undefined;
          anchor.dynamicValueContext = directive.runtimeObjective;

          if ((this.recording.loopCount || 1) <= 1 && values.length > 1) {
            this.recording.loopCount = Math.min(99, values.length);
          }
        }
      } else if (
        directive.inputPlan?.mode === "ai" &&
        directive.inputPlan.prompt
      ) {
        anchor.dynamicValuePrompt = directive.inputPlan.prompt;
        anchor.dynamicValueContext = directive.runtimeObjective;
        anchor.dynamicValueSequence = undefined;
      }
    } else {
      directive.startActionIndex = actions.length;
    }

    const consumesFollowing = directive.consumeFollowingActions === true;
    const fromIndex = Math.max(0, directive.startActionIndex || 0);
    const demonstrationActionIds: string[] = [];

    if (anchorIndex >= 0 && !consumesFollowing) {
      const anchor = actions[anchorIndex];
      anchor.hybridDirectiveId = directive.id;
      demonstrationActionIds.push(anchor.id);
    } else if (consumesFollowing) {
      for (let index = fromIndex; index < actions.length; index += 1) {
        actions[index].hybridDirectiveId = directive.id;
        demonstrationActionIds.push(actions[index].id);
      }
    }

    directive.demonstrationActionIds = demonstrationActionIds;
    directive.updatedAt = new Date().toISOString();

    const directives = this.recording.hybridDirectives || [];
    const existingIndex = directives.findIndex(
      (item) => item.id === directive.id
    );

    if (existingIndex >= 0) {
      directives[existingIndex] = directive;
    } else {
      directives.push(directive);
    }

    this.recording.hybridDirectives = directives;
    this.activeHybridDirectiveId =
      anchorIndex >= 0 && !consumesFollowing
        ? null
        : directive.id;

    return directive;
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

  private async captureDomainIcon(page: Page, initialUrl: string): Promise<void> {
    const recording = this.recording;
    const context = this.context;

    if (!recording || !context || page.isClosed()) return;

    await page
      .waitForLoadState("load", { timeout: 4_000 })
      .catch(() => undefined);

    const discoveredIcon = await page
      .evaluate(() => {
        const links = Array.from(
          document.querySelectorAll<HTMLLinkElement>("link[rel][href]")
        );

        const icons = links
          .filter((link) =>
            link.rel
              .toLocaleLowerCase()
              .split(/\s+/)
              .some((token) => token.includes("icon"))
          )
          .map((link) => {
            const type = (link.type || "").toLocaleLowerCase();
            const rel = link.rel.toLocaleLowerCase();
            const sizes = link.sizes?.value || "";
            const sizeMatch = sizes.match(/(\d+)x(\d+)/i);
            const sizeScore = sizeMatch ? Number(sizeMatch[1]) : 0;

            let score = sizeScore;

            if (type.includes("svg")) score += 10_000;
            if (rel === "icon") score += 4_000;
            if (rel.includes("shortcut")) score += 3_000;
            if (rel.includes("apple-touch-icon")) score += 2_000;

            return {
              href: link.href,
              score,
            };
          })
          .filter((entry) => Boolean(entry.href))
          .sort((a, b) => b.score - a.score);

        return icons[0]?.href || null;
      })
      .catch(() => null);

    let fallbackIcon: string | null = null;

    try {
      fallbackIcon = new URL("/favicon.ico", initialUrl).href;
    } catch {
      fallbackIcon = null;
    }

    const candidates = [...new Set([discoveredIcon, fallbackIcon].filter(Boolean))] as string[];

    for (const candidate of candidates) {
      let contentType = "";
      let bytes: Buffer | null = null;

      if (candidate.startsWith("data:")) {
        const match = candidate.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);

        if (!match) continue;

        contentType = (match[1] || "image/svg+xml").toLocaleLowerCase();

        try {
          bytes = match[2]
            ? Buffer.from(match[3], "base64")
            : Buffer.from(decodeURIComponent(match[3]), "utf8");
        } catch {
          bytes = null;
        }
      } else if (/^https?:/i.test(candidate)) {
        const response = await context.request
          .get(candidate, {
            timeout: 4_000,
            failOnStatusCode: false,
          })
          .catch(() => null);

        if (!response || !response.ok()) continue;

        contentType = String(
          response.headers()["content-type"] || ""
        )
          .split(";")[0]
          .trim()
          .toLocaleLowerCase();

        bytes = await response.body().catch(() => null);
      }

      if (!bytes || bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
        continue;
      }

      const pathname = (() => {
        try {
          return new URL(candidate).pathname.toLocaleLowerCase();
        } catch {
          return "";
        }
      })();

      let extension = "ico";

      if (contentType.includes("svg") || pathname.endsWith(".svg")) {
        extension = "svg";
      } else if (contentType.includes("png") || pathname.endsWith(".png")) {
        extension = "png";
      } else if (
        contentType.includes("webp") ||
        pathname.endsWith(".webp")
      ) {
        extension = "webp";
      } else if (
        contentType.includes("jpeg") ||
        contentType.includes("jpg") ||
        pathname.endsWith(".jpg") ||
        pathname.endsWith(".jpeg")
      ) {
        extension = "jpg";
      }

      const finalPath = path.join(
        this.iconDir,
        recording.id + "." + extension
      );

      await fs.writeFile(finalPath, bytes);

      if (this.recording?.id === recording.id) {
        recording.domainIconPath = finalPath;
        recording.domainIconSourceUrl = candidate;
      }

      return;
    }
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
    this.domainIconPromise = null;

    await context?.close().catch(() => undefined);
    this.onUnsupported?.(info);
  }

  private recordAction(
    partial: Pick<AutomationAction, "type" | "url"> &
      Partial<
        Pick<
          AutomationAction,
          "selector" | "targetText" | "targetAriaLabel" | "targetRole" | "targetTitle" | "value" | "isSecret" | "key" | "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey" | "frameUrl" | "frameName" | "pageId" | "x" | "y"
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
      previous.targetText = partial.targetText;
      previous.targetAriaLabel = partial.targetAriaLabel;
      previous.targetRole = partial.targetRole;
      previous.targetTitle = partial.targetTitle;
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
      targetText: partial.targetText,
      targetAriaLabel: partial.targetAriaLabel,
      targetRole: partial.targetRole,
      targetTitle: partial.targetTitle,
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
      hybridDirectiveId: undefined,
    };

    if (this.activeHybridDirectiveId) {
      const directive = (this.recording.hybridDirectives || []).find(
        (item) => item.id === this.activeHybridDirectiveId
      );

      if (directive) {
        const isAnchorAction =
          action.type === "input" &&
          action.selector === directive.anchorSelector;
        const shouldTagAction =
          directive.consumeFollowingActions === true || isAnchorAction;

        if (shouldTagAction) {
          action.hybridDirectiveId = directive.id;

          const demonstrationActionIds =
            directive.demonstrationActionIds || [];

          if (!demonstrationActionIds.includes(action.id)) {
            demonstrationActionIds.push(action.id);
          }

          directive.demonstrationActionIds = demonstrationActionIds;
        }

        if (!directive.anchorActionId && isAnchorAction) {
          directive.anchorActionId = action.id;
          directive.startActionIndex = this.recording.actions.length;

          if (directive.inputPlan?.mode === "sequence") {
            const values = (directive.inputPlan.values || [])
              .map((value) => String(value || "").trim())
              .filter(Boolean);

            if (values.length) {
              action.dynamicValueSequence = values;
              action.dynamicValueContext = directive.runtimeObjective;
              if ((this.recording.loopCount || 1) <= 1 && values.length > 1) {
                this.recording.loopCount = Math.min(99, values.length);
              }
            }
          } else if (
            directive.inputPlan?.mode === "ai" &&
            directive.inputPlan.prompt
          ) {
            action.dynamicValuePrompt = directive.inputPlan.prompt;
            action.dynamicValueContext = directive.runtimeObjective;
          }

          if (directive.consumeFollowingActions !== true) {
            this.activeHybridDirectiveId = null;
          }
        }

        directive.updatedAt = new Date().toISOString();
      }
    }

    this.lastTimestamp = now;
    this.recording.actions.push(action);
    this.onAction?.(action);
  }
}
