import { describe } from "vitest";

import { OpenAIProvider } from "../../../src/llm/openai.js";
import { runLLMProviderContractTests } from "./_contract.js";

describe("OpenAIProvider", () => {
  runLLMProviderContractTests(
    () =>
      new OpenAIProvider({
        apiKey: "test-openai-key",
        baseURL: "https://openai.test/v1",
      }),
  );
});
