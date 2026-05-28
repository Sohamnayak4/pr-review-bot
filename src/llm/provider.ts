export interface LLMCompleteParams {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** When true, request JSON-mode / structured output if the provider supports it. */
  json?: boolean;
  signal?: AbortSignal;
}

export interface LLMCompleteResult {
  text: string;
  /** Provider-reported usage, when available. */
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
  /** Raw provider response, for debugging only. Must never be logged at info level. */
  raw?: unknown;
}

export interface LLMProvider {
  readonly name: "openai" | "anthropic" | "google" | "openrouter" | "local";
  complete(params: LLMCompleteParams): Promise<LLMCompleteResult>;
}
