import { describe } from "vitest";

import { AnthropicProvider } from "../../../src/llm/anthropic.js";
import { runLLMProviderContractTests } from "./_contract.js";

describe("AnthropicProvider", () => {
  runLLMProviderContractTests(
    () =>
      new AnthropicProvider({
        apiKey: "test-anthropic-key",
        baseURL: "https://anthropic.test",
      }),
  );
});
