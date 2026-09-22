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
