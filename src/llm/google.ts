import { GoogleGenAI } from "@google/genai";

import { LLMError } from "../util/errors.js";
import type { LLMCompleteParams, LLMCompleteResult, LLMProvider } from "./provider.js";

export interface GoogleProviderOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

const defaultModel = "gemini-2.0-flash";

function statusFromError(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  for (const key of ["status", "statusCode", "code"]) {
    if (key in error) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "number") {
        return value;
      }
    }
  }

  return undefined;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Google request failed.";
}

function mapGoogleError(error: unknown, signal?: AbortSignal): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  if (signal?.aborted) {
    return new LLMError("TIMEOUT", "LLM request was cancelled or timed out.", { cause: error });
  }

  const status = statusFromError(error);
  const message = messageFromError(error);

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

  if (/Unauthorized|Forbidden/i.test(message)) {
    return new LLMError("AUTH", "LLM provider rejected authentication.", { cause: error });
  }

  if (/Too Many Requests|rate limit/i.test(message)) {
    return new LLMError("RATE_LIMIT", "LLM provider rate limit exceeded.", { cause: error });
  }

  if (/Bad Request|Unprocessable/i.test(message)) {
    return new LLMError("BAD_REQUEST", "LLM provider rejected the request.", { cause: error });
  }

  if (
    /Service Unavailable|Internal Server Error|Bad Gateway|Gateway Timeout|Retryable HTTP Error/i.test(
      message,
    )
  ) {
    return new LLMError("UPSTREAM", "LLM provider returned an upstream error.", { cause: error });
  }

  if (error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`)) {
    return new LLMError("TIMEOUT", "LLM request was cancelled or timed out.", { cause: error });
  }

  return new LLMError("UNKNOWN", message, { cause: error });
}

export class GoogleProvider implements LLMProvider {
  readonly name = "google" as const;

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GoogleProviderOptions) {
    this.model = options.model ?? defaultModel;
    this.client = new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: {
        baseUrl: options.baseURL,
        retryOptions: { attempts: 1 },
      },
    });
  }

  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    try {
      const model = params.model ?? this.model;
      const response = await withAbortSignal(
        this.client.models.generateContent({
          model,
          contents: params.user,
          config: {
            systemInstruction: params.system,
            temperature: params.temperature ?? 0.2,
            maxOutputTokens: params.maxOutputTokens ?? 4096,
            responseMimeType: params.json ? "application/json" : undefined,
            abortSignal: params.signal,
          },
        }),
        params.signal,
      );

      return {
        text: response.text ?? "",
        usage:
          response.usageMetadata?.promptTokenCount !== undefined &&
          response.usageMetadata.candidatesTokenCount !== undefined
            ? {
                inputTokens: response.usageMetadata.promptTokenCount,
                outputTokens: response.usageMetadata.candidatesTokenCount,
              }
            : undefined,
        model: response.modelVersion ?? model,
        raw: response,
      };
    } catch (error) {
      throw mapGoogleError(error, params.signal);
    }
  }
}

function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(new LLMError("TIMEOUT", "LLM request was cancelled or timed out."));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      reject(new LLMError("TIMEOUT", "LLM request was cancelled or timed out."));
    };

    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}
