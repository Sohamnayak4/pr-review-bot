import OpenAI from "openai";

import { LLMError } from "../util/errors.js";
import type { LLMCompleteParams, LLMCompleteResult, LLMProvider } from "./provider.js";

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  name?: LLMProvider["name"];
}

const defaultModel = "gpt-4o-mini";

function statusFromError(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "LLM provider request failed.";
}

export function mapOpenAICompatibleError(error: unknown, signal?: AbortSignal): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  if (signal?.aborted) {
    return new LLMError("TIMEOUT", "LLM request was cancelled or timed out.", { cause: error });
  }

  const status = statusFromError(error);

  if (status === 401 || status === 403) {
    return new LLMError("AUTH", "LLM provider rejected authentication.", { cause: error });
  }

  if (status === 429) {
    return new LLMError("RATE_LIMIT", "LLM provider rate limit exceeded.", { cause: error });
  }

  if (status === 400 || status === 422) {
    return new LLMError("BAD_REQUEST", "LLM provider rejected the request.", { cause: error });
  }

  if (status !== undefined && status >= 500) {
    return new LLMError("UPSTREAM", "LLM provider returned an upstream error.", { cause: error });
  }

  if (error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`)) {
    return new LLMError("TIMEOUT", "LLM request was cancelled or timed out.", { cause: error });
  }

  return new LLMError("UNKNOWN", messageFromError(error), { cause: error });
}

export class OpenAIProvider implements LLMProvider {
  readonly name: LLMProvider["name"];

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    this.name = options.name ?? "openai";
    this.model = options.model ?? defaultModel;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      maxRetries: 0,
    });
  }

  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    try {
      const model = params.model ?? this.model;
      const response = await this.client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          temperature: params.temperature ?? 0.2,
          max_tokens: params.maxOutputTokens ?? 4096,
          response_format: params.json ? { type: "json_object" } : undefined,
        },
        { signal: params.signal },
      );
      const text = response.choices[0]?.message.content ?? "";

      return {
        text,
        usage:
          response.usage?.prompt_tokens !== undefined &&
          response.usage.completion_tokens !== undefined
            ? {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
              }
            : undefined,
        model: response.model ?? model,
        raw: response,
      };
    } catch (error) {
      throw mapOpenAICompatibleError(error, params.signal);
    }
  }
}
