import type { EnvConfig } from "../config/env.js";
import { ConfigError } from "../util/errors.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";
import { LocalProvider } from "./local.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { LLMProvider } from "./provider.js";

export interface LLMProviderRouterConfig
  extends Pick<EnvConfig, "LLM_API_KEY" | "LLM_BASE_URL" | "LLM_MODEL"> {
  LLM_PROVIDER: string;
}

export function createLLMProvider(config: LLMProviderRouterConfig): LLMProvider {
  switch (config.LLM_PROVIDER) {
    case "openai":
      return new OpenAIProvider({
        apiKey: requiredApiKey(config),
        model: config.LLM_MODEL,
      });
    case "anthropic":
      return new AnthropicProvider({
        apiKey: requiredApiKey(config),
        model: config.LLM_MODEL,
      });
    case "google":
      return new GoogleProvider({
        apiKey: requiredApiKey(config),
        model: config.LLM_MODEL,
      });
    case "openrouter":
      return new OpenRouterProvider({
        apiKey: requiredApiKey(config),
        model: config.LLM_MODEL,
        baseURL: config.LLM_BASE_URL,
      });
    case "local":
      return new LocalProvider({
        apiKey: config.LLM_API_KEY,
        model: config.LLM_MODEL,
        baseURL: requiredBaseURL(config),
      });
    default:
      throw new ConfigError(
        "INVALID_ENV",
        `Unknown LLM_PROVIDER "${config.LLM_PROVIDER}". Set LLM_PROVIDER to one of: openai, anthropic, google, openrouter, local.`,
      );
  }
}

function requiredApiKey(config: LLMProviderRouterConfig): string {
  if (!config.LLM_API_KEY) {
    throw new ConfigError(
      "MISSING_ENV",
      `LLM_API_KEY is required when LLM_PROVIDER is ${config.LLM_PROVIDER}.`,
    );
  }

  return config.LLM_API_KEY;
}

function requiredBaseURL(config: LLMProviderRouterConfig): string {
  if (!config.LLM_BASE_URL) {
    throw new ConfigError("MISSING_ENV", "LLM_BASE_URL is required when LLM_PROVIDER is local.");
  }

  return config.LLM_BASE_URL;
}

export type { LLMCompleteParams, LLMCompleteResult, LLMProvider } from "./provider.js";
