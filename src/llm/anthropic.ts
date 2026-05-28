import Anthropic from "@anthropic-ai/sdk";

import { LLMError } from "../util/errors.js";
import type { LLMCompleteParams, LLMCompleteResult, LLMProvider } from "./provider.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

const defaultModel = "claude-3-5-haiku-latest";

function statusFromError(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Anthropic request failed.";
}

function mapAnthropicError(error: unknown, signal?: AbortSignal): LLMError {
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

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.model = options.model ?? defaultModel;
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      maxRetries: 0,
    });
  }

  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    try {
      const model = params.model ?? this.model;
      const response = await this.client.messages.create(
        {
          model,
          system: params.system,
          messages: [{ role: "user", content: params.user }],
          temperature: params.temperature ?? 0.2,
          max_tokens: params.maxOutputTokens ?? 4096,
        },
        { signal: params.signal },
      );
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model ?? model,
        raw: response,
      };
    } catch (error) {
      throw mapAnthropicError(error, params.signal);
    }
  }
}
