import { describe, expect, it } from "vitest";

import { AnthropicProvider } from "../../../src/llm/anthropic.js";
import { GoogleProvider } from "../../../src/llm/google.js";
import { createLLMProvider } from "../../../src/llm/index.js";
import { LocalProvider } from "../../../src/llm/local.js";
import { OpenAIProvider } from "../../../src/llm/openai.js";
import { OpenRouterProvider } from "../../../src/llm/openrouter.js";
import { ConfigError } from "../../../src/util/errors.js";

const baseConfig = {
  LLM_API_KEY: "test-key",
  LLM_BASE_URL: "https://local-llm.test/v1",
  LLM_MODEL: "test-model",
};

describe("createLLMProvider", () => {
  it("selects OpenAI", () => {
    expect(createLLMProvider({ ...baseConfig, LLM_PROVIDER: "openai" })).toBeInstanceOf(
      OpenAIProvider,
    );
  });

  it("selects Anthropic", () => {
    expect(createLLMProvider({ ...baseConfig, LLM_PROVIDER: "anthropic" })).toBeInstanceOf(
      AnthropicProvider,
    );
  });

  it("selects Google", () => {
    expect(createLLMProvider({ ...baseConfig, LLM_PROVIDER: "google" })).toBeInstanceOf(
      GoogleProvider,
    );
  });

  it("selects OpenRouter", () => {
    expect(createLLMProvider({ ...baseConfig, LLM_PROVIDER: "openrouter" })).toBeInstanceOf(
      OpenRouterProvider,
    );
  });

  it("selects local", () => {
    expect(createLLMProvider({ ...baseConfig, LLM_PROVIDER: "local" })).toBeInstanceOf(
      LocalProvider,
    );
  });

  it("throws ConfigError for unknown providers", () => {
    expect(() => createLLMProvider({ ...baseConfig, LLM_PROVIDER: "bogus" })).toThrow(ConfigError);
  });
});
