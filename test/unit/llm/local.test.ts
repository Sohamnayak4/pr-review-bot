import { describe } from "vitest";

import { LocalProvider } from "../../../src/llm/local.js";
import { runLLMProviderContractTests } from "./_contract.js";

describe("LocalProvider", () => {
  runLLMProviderContractTests(
    () =>
      new LocalProvider({
        baseURL: "https://local-llm.test/v1",
      }),
  );
});
