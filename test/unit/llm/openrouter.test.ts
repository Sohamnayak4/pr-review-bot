import { describe } from "vitest";

import { OpenRouterProvider } from "../../../src/llm/openrouter.js";
import { runLLMProviderContractTests } from "./_contract.js";

describe("OpenRouterProvider", () => {
  runLLMProviderContractTests(
    () =>
      new OpenRouterProvider({
        apiKey: "test-openrouter-key",
        baseURL: "https://openrouter.test/api/v1",
      }),
  );
});
