export type QwenRegion = "us" | "singapore";

export interface QwenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenRequestOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface QwenClientSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface QwenChatResult {
  content: string;
  model?: string;
  id?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

let qwenRateQueue: Promise<void> = Promise.resolve();
let qwenNextAllowedAt = 0;
let qwenAdaptiveSpacingMs = 650;

async function enterQwenRateGate(): Promise<() => void> {
  const previous = qwenRateQueue;
  let release!: () => void;

  qwenRateQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  const waitMs = Math.max(0, qwenNextAllowedAt - Date.now());

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  return release;
}

function parseDurationMs(value: string | null): number | null {
  if (!value) return null;

  const trimmed = value.trim();

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Number(trimmed) * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  let total = 0;
  let matched = false;
  const pattern = /(\d+(?:\.\d+)?)\s*(ms|s|m|h)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(trimmed))) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "ms") total += amount;
    else if (unit === "s") total += amount * 1000;
    else if (unit === "m") total += amount * 60_000;
    else if (unit === "h") total += amount * 3_600_000;
  }

  return matched ? Math.max(0, total) : null;
}

function rateLimitWaitMs(response: Response, attempt: number): number {
  const retryAfter =
    parseDurationMs(response.headers.get("retry-after")) ??
    parseDurationMs(response.headers.get("x-ratelimit-reset-requests")) ??
    parseDurationMs(response.headers.get("x-ratelimit-reset-tokens"));

  const fallback = 2_500 * Math.pow(2, attempt);

  return Math.min(
    90_000,
    Math.max(1_500, retryAfter ?? fallback) + 250
  );
}

export async function callQwen(
  settings: QwenClientSettings,
  messages: QwenMessage[],
  options: QwenRequestOptions = {}
): Promise<QwenChatResult> {
  const apiKey = settings.apiKey.trim();

  if (!apiKey) {
    throw new Error("A chave da API Qwen ainda nao foi configurada.");
  }

  const baseUrl = normalizeBaseUrl(settings.baseUrl.trim());

  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error("A URL base da API Qwen precisa usar HTTPS.");
  }

  const model = settings.model.trim();

  if (!model) {
    throw new Error("Escolha um modelo Qwen antes de testar.");
  }

  const releaseRateGate = await enterQwenRateGate();
  const maxRateLimitRetries = 4;

  try {
    for (let attempt = 0; attempt <= maxRateLimitRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.max(1_000, options.timeoutMs ?? 35_000)
      );

      try {
        const response = await fetch(baseUrl + "/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.1,
            max_tokens: options.maxTokens ?? 512,
          }),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload: any = null;

        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = null;
        }

        if (response.status === 429) {
          if (attempt >= maxRateLimitRetries) {
            const apiMessage =
              payload?.error?.message ||
              payload?.message ||
              "Limite temporário da Groq atingido.";

            throw new Error(
              "A Groq continua limitando as chamadas após várias tentativas. " +
                "Aguarde um pouco e tente novamente. Detalhe: " +
                String(apiMessage).slice(0, 500)
            );
          }

          const waitMs = rateLimitWaitMs(response, attempt);
          qwenAdaptiveSpacingMs = Math.min(
            12_000,
            Math.max(qwenAdaptiveSpacingMs * 1.7, Math.min(waitMs, 8_000))
          );
          qwenNextAllowedAt = Date.now() + waitMs;
          await sleep(waitMs);
          continue;
        }

        if (!response.ok) {
          const apiMessage =
            payload?.error?.message ||
            payload?.message ||
            text ||
            "Falha sem mensagem detalhada.";

          throw new Error(
            "Qwen respondeu HTTP " +
              response.status +
              ": " +
              String(apiMessage).slice(0, 900)
          );
        }

        const content = payload?.choices?.[0]?.message?.content;

        if (typeof content !== "string" || !content.trim()) {
          throw new Error("A Qwen respondeu, mas nao retornou conteudo de texto.");
        }

        const remainingRequests = Number(
          response.headers.get("x-ratelimit-remaining-requests")
        );
        const requestResetMs = parseDurationMs(
          response.headers.get("x-ratelimit-reset-requests")
        );

        if (
          Number.isFinite(remainingRequests) &&
          remainingRequests >= 0 &&
          requestResetMs &&
          requestResetMs > 0 &&
          remainingRequests <= 4
        ) {
          qwenAdaptiveSpacingMs = Math.min(
            15_000,
            Math.max(
              qwenAdaptiveSpacingMs,
              Math.ceil(requestResetMs / Math.max(1, remainingRequests + 1))
            )
          );
        } else {
          qwenAdaptiveSpacingMs = Math.max(
            650,
            Math.round(qwenAdaptiveSpacingMs * 0.82)
          );
        }

        qwenNextAllowedAt = Date.now() + qwenAdaptiveSpacingMs;

        return {
          content: content.trim(),
          model: payload?.model,
          id: payload?.id,
          usage: payload?.usage,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("A chamada para a Qwen excedeu o tempo limite.");
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error("A chamada para a Qwen não pôde ser concluída.");
  } finally {
    releaseRateGate();
  }
}
