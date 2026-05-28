import { describe } from "vitest";

import { GoogleProvider } from "../../../src/llm/google.js";
import { runLLMProviderContractTests } from "./_contract.js";

describe("GoogleProvider", () => {
  runLLMProviderContractTests(
    () =>
      new GoogleProvider({
        apiKey: "test-google-key",
        baseURL: "https://google.test",
      }),
  );
});
