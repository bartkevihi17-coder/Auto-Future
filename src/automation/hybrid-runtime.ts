import { Page } from "playwright";
import {
  AutomationAction,
  AutomationHybridDirective,
  AutomationRecording,
} from "../shared/types";

export interface HybridRuntimeElement {
  id: string;
  tag: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  placeholder?: string;
  title?: string;
  href?: string;
  inputType?: string;
  disabled?: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HybridRuntimeSnapshot {
  url: string;
  title: string;
  text: string;
  textBlocks: string[];
  elements: HybridRuntimeElement[];
}

export interface HybridRuntimeReportCandidate {
  label: string;
  value: string;
}

export type HybridRuntimeProposal =
  | {
      status: "done";
      label?: string;
      reportEntries?: HybridRuntimeReportCandidate[];
    }
  | {
      status: "action";
      action: "click" | "input" | "key" | "navigate" | "back" | "wait" | "scroll";
      targetId?: string;
      value?: string;
      key?: string;
      url?: string;
      direction?: "up" | "down";
      label?: string;
      reportEntries?: HybridRuntimeReportCandidate[];
    };

export interface HybridRuntimePlanRequest {
  recording: AutomationRecording;
  directive: AutomationHybridDirective;
  demonstrationActions: AutomationAction[];
  loopIndex: number;
  loopTotal: number;
  sequenceValue?: string;
  snapshot: HybridRuntimeSnapshot;
  recentEvents: Array<Record<string, unknown>>;
  visitedTargets: string[];
  visitedPages: string[];
  step: number;
}

export type HybridRuntimePlanner = (
  request: HybridRuntimePlanRequest
) => Promise<HybridRuntimeProposal>;

function clean(value: unknown, limit: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function looksLikeHybridCopyControl(
  element: HybridRuntimeElement | undefined
): boolean {
  if (!element) return false;

  return /\b(copiar|copy|clipboard|copiado|c[oó]pia)\b/i.test(
    [
      element.text,
      element.ariaLabel,
      element.title,
      element.role,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

async function readHybridClipboardText(page: Page): Promise<string> {
  try {
    const url = new URL(page.url());

    if (url.protocol === "http:" || url.protocol === "https:") {
      await page.context().grantPermissions(
        ["clipboard-read", "clipboard-write"],
        { origin: url.origin }
      ).catch(() => undefined);
    }

    const value = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return "";
      }
    });

    return clean(value, 8000);
  } catch {
    return "";
  }
}

export async function captureHybridRuntimeSnapshot(
  page: Page
): Promise<HybridRuntimeSnapshot> {
  return page.evaluate(() => {
    const cleanText = (value: unknown, limit: number) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);

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

    document.querySelectorAll("[data-af-hybrid-id]").forEach((element) => {
      element.removeAttribute("data-af-hybrid-id");
    });

    const selector = [
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
      "[tabindex]",
    ].join(",");

    const elements: HybridRuntimeElement[] = [];

    for (const element of document.querySelectorAll(selector)) {
      if (elements.length >= 90) break;
      if (!visible(element)) continue;

      const id = "hy-" + (elements.length + 1);
      element.setAttribute("data-af-hybrid-id", id);

      const rect = element.getBoundingClientRect();
      const tag = element.tagName.toLowerCase();
      const inputType =
        element instanceof HTMLInputElement
          ? cleanText(element.type || "text", 30)
          : "";

      const text =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
          ? cleanText(
              element.getAttribute("aria-label") ||
                element.getAttribute("placeholder"),
              140
            )
          : cleanText(
              (element as HTMLElement).innerText || element.textContent,
              140
            );

      elements.push({
        id,
        tag,
        role: cleanText(element.getAttribute("role"), 40),
        text,
        ariaLabel: cleanText(element.getAttribute("aria-label"), 140),
        placeholder: cleanText(element.getAttribute("placeholder"), 140),
        title: cleanText(element.getAttribute("title"), 140),
        href:
          element instanceof HTMLAnchorElement
            ? cleanText(element.href, 320)
            : "",
        inputType,
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
      });
    }

    const textBlocks: string[] = [];
    const seenBlocks = new Set<string>();
    const textBlockSelector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "li",
      "tr",
      "td",
      "th",
      "dt",
      "dd",
      "article",
      "code",
      "pre",
      "[role=row]",
      "[role=listitem]",
      "[role=article]",
      "[role=status]",
      "[role=alert]",
    ].join(",");

    for (const element of document.querySelectorAll(textBlockSelector)) {
      if (textBlocks.length >= 70) break;
      if (!visible(element)) continue;

      const value = cleanText(
        (element as HTMLElement).innerText || element.textContent,
        240
      );

      if (value.length < 2) continue;

      const key = value.toLocaleLowerCase("pt-BR");
      if (seenBlocks.has(key)) continue;

      seenBlocks.add(key);
      textBlocks.push(value);
    }

    return {
      url: location.href,
      title: document.title,
      text: cleanText(document.body?.innerText, 2200),
      textBlocks,
      elements,
    };
  });
}

async function targetFor(
  page: Page,
  targetId: string | undefined
): Promise<ReturnType<Page["locator"]> | null> {
  const id = clean(targetId, 60);
  if (!id) return null;

  const locator = page.locator(
    '[data-af-hybrid-id="' + id.replace(/"/g, '\"') + '"]'
  );

  const count = await locator.count().catch(() => 0);
  if (count < 1) return null;
  return locator.first();
}

export async function executeHybridRuntimeProposal(
  page: Page,
  proposal: HybridRuntimeProposal
): Promise<void> {
  if (proposal.status === "done") return;

  if (proposal.action === "wait") {
    await page.waitForTimeout(850);
    return;
  }

  if (proposal.action === "navigate") {
    const url = clean(proposal.url, 1200);
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("A IA híbrida retornou uma URL inválida.");
    }

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    return;
  }

  if (proposal.action === "back") {
    await page.goBack({
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    }).catch(() => null);
    return;
  }

  if (proposal.action === "scroll") {
    const delta = proposal.direction === "up" ? -560 : 560;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(250);
    return;
  }

  const target = await targetFor(page, proposal.targetId);

  if (!target) {
    throw new Error(
      "O elemento escolhido pela IA híbrida não existe mais no estado atual."
    );
  }

  await target.scrollIntoViewIfNeeded().catch(() => undefined);

  if (proposal.action === "click") {
    await target.click({
      timeout: 8_000,
    });
    return;
  }

  if (proposal.action === "input") {
    const inputType = await target
      .getAttribute("type")
      .then((value) => String(value || "").toLowerCase())
      .catch(() => "");

    if (inputType === "password") {
      throw new Error(
        "A execução híbrida não preenche campos de senha automaticamente."
      );
    }

    await target.fill(String(proposal.value ?? ""), {
      timeout: 8_000,
    });
    return;
  }

  if (proposal.action === "key") {
    await target.focus();
    await page.keyboard.press(clean(proposal.key, 60) || "Enter");
  }
}

export async function runHybridDirective(
  page: Page,
  recording: AutomationRecording,
  directive: AutomationHybridDirective,
  demonstrationActions: AutomationAction[],
  planner: HybridRuntimePlanner,
  options: {
    loopIndex: number;
    loopTotal: number;
    sequenceValue?: string;
    maxSteps?: number;
    onReportEntry?: (entry: {
      kind: "copied" | "written" | "important";
      label: string;
      value: string;
      url?: string;
    }) => void;
  }
): Promise<void> {
  const maxSteps = Math.min(
    180,
    Math.max(12, Math.trunc(options.maxSteps || 120))
  );
  const recentEvents: Array<Record<string, unknown>> = [];
  const visitedTargets = new Set<string>();
  const visitedPages = new Set<string>();

  for (let step = 1; step <= maxSteps; step += 1) {
    await page
      .waitForLoadState("domcontentloaded", { timeout: 12_000 })
      .catch(() => undefined);

    const snapshot = await captureHybridRuntimeSnapshot(page);

    visitedPages.add(snapshot.url);

    const proposal = await planner({
      recording,
      directive,
      demonstrationActions,
      loopIndex: options.loopIndex,
      loopTotal: options.loopTotal,
      sequenceValue: options.sequenceValue,
      snapshot,
      recentEvents: recentEvents.slice(-30),
      visitedTargets: [...visitedTargets].slice(-120),
      visitedPages: [...visitedPages].slice(-80),
      step,
    });

    for (const reportEntry of proposal.reportEntries || []) {
      const label = clean(reportEntry.label, 180);
      const value = clean(reportEntry.value, 6000);

      if (label && value) {
        options.onReportEntry?.({
          kind: "important",
          label,
          value,
          url: snapshot.url,
        });
      }
    }

    if (proposal.status === "done") {
      return;
    }

    const targetElement =
      proposal.status === "action" && proposal.targetId
        ? snapshot.elements.find(
            (element) => element.id === proposal.targetId
          )
        : undefined;

    const event: Record<string, unknown> = {
      step,
      action: proposal.action,
      targetId: proposal.targetId || null,
      target: targetElement
        ? {
            tag: targetElement.tag,
            role: targetElement.role,
            text: clean(targetElement.text, 140),
            ariaLabel: clean(targetElement.ariaLabel, 140),
            placeholder: clean(targetElement.placeholder, 140),
            href: clean(targetElement.href, 320),
          }
        : undefined,
      value:
        proposal.action === "input"
          ? clean(proposal.value, 240)
          : undefined,
      key: proposal.key || undefined,
      url: proposal.url || undefined,
      label: proposal.label || undefined,
      pageUrl: snapshot.url,
    };

    try {
      await executeHybridRuntimeProposal(page, proposal);
      event.status = "ok";

      if (proposal.action === "input") {
        options.onReportEntry?.({
          kind: "written",
          label:
            clean(
              targetElement?.ariaLabel ||
                targetElement?.placeholder ||
                targetElement?.text ||
                proposal.label ||
                "Campo preenchido",
              180
            ) || "Campo preenchido",
          value: clean(proposal.value, 6000) || "[campo limpo]",
          url: snapshot.url,
        });
      }

      if (
        proposal.action === "click" &&
        targetElement
      ) {
        if (looksLikeHybridCopyControl(targetElement)) {
          await page.waitForTimeout(120).catch(() => undefined);
          const copiedValue = await readHybridClipboardText(page);

          if (copiedValue) {
            options.onReportEntry?.({
              kind: "copied",
              label:
                clean(
                  targetElement.ariaLabel ||
                    targetElement.text ||
                    targetElement.title ||
                    "Conteúdo copiado",
                  180
                ) || "Conteúdo copiado",
              value: copiedValue,
              url: snapshot.url,
            });
          }
        }

        const fingerprint = [
          snapshot.url,
          clean(targetElement.href, 320),
          clean(
            targetElement.text ||
              targetElement.ariaLabel ||
              targetElement.title,
            180
          ),
        ]
          .filter(Boolean)
          .join(" | ");

        if (fingerprint) visitedTargets.add(fingerprint);
      }
    } catch (error) {
      event.status = "failed";
      event.error =
        error instanceof Error ? error.message : String(error);
    }

    recentEvents.push(event);
    if (recentEvents.length > 40) recentEvents.shift();

    await page.waitForTimeout(450);
  }

  throw new Error(
    "O bloco híbrido excedeu o limite de passos sem confirmar que o objetivo foi concluído."
  );
}
