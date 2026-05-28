import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { LLMProvider } from "../../../src/llm/provider.js";
import { LLMError, type LLMErrorCode } from "../../../src/util/errors.js";

const contractResponse = {
  id: "llm-contract-response",
  model: "contract-model",
  choices: [
    {
      message: { content: "contract response" },
      text: "contract response",
    },
  ],
  content: [{ type: "text", text: "contract response" }],
  candidates: [{ content: { parts: [{ text: "contract response" }] } }],
  usage: {
    input_tokens: 11,
    output_tokens: 7,
    prompt_tokens: 11,
    completion_tokens: 7,
  },
};

const server = setupServer(
  http.all("*", async ({ request }) => {
    const body = await request.text();

    if (body.includes("__contract_auth__")) {
      return HttpResponse.json({ error: { message: "contract auth failure" } }, { status: 401 });
    }

    if (body.includes("__contract_rate_limit__")) {
      return HttpResponse.json(
        { error: { message: "contract rate limit failure" } },
        { status: 429 },
      );
    }

    if (body.includes("__contract_timeout__") || body.includes("__contract_cancel__")) {
      await delay(1000);
    }

    return HttpResponse.json(contractResponse);
  }),
);

async function expectLLMError(
  action: () => Promise<unknown>,
  expectedCode: LLMErrorCode,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(LLMError);
    expect((error as LLMError).code).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected LLMError with code ${expectedCode}`);
}

function contractParams(user: string, signal?: AbortSignal) {
  return {
    system: "contract system prompt",
    user,
    model: "contract-model",
    temperature: 0.2,
    maxOutputTokens: 16,
    signal,
  };
}

export function runLLMProviderContractTests(createProvider: () => LLMProvider): void {
  describe("LLMProvider contract", () => {
    beforeAll(() => {
      server.listen({ onUnhandledRequest: "error" });
    });

    afterEach(() => {
      server.resetHandlers();
    });

    afterAll(() => {
      server.close();
    });

    it("maps authentication failures to LLMError AUTH", async () => {
      const provider = createProvider();

      await expectLLMError(() => provider.complete(contractParams("__contract_auth__")), "AUTH");
    });

    it("maps rate-limit failures to LLMError RATE_LIMIT", async () => {
      const provider = createProvider();

      await expectLLMError(
        () => provider.complete(contractParams("__contract_rate_limit__")),
        "RATE_LIMIT",
      );
    });

    it("maps timeout aborts to LLMError TIMEOUT", async () => {
      const provider = createProvider();
      const signal = AbortSignal.timeout(10);

      await expectLLMError(
        () => provider.complete(contractParams("__contract_timeout__", signal)),
        "TIMEOUT",
      );
    });

    it("respects cancellation via AbortSignal", async () => {
      const provider = createProvider();
      const controller = new AbortController();
      const result = provider.complete(contractParams("__contract_cancel__", controller.signal));

      controller.abort();

      await expectLLMError(() => result, "TIMEOUT");
    });
  });
}
