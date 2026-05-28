import { describe, expect, it } from "vitest";

import { parseEnv } from "../../../src/config/env.js";
import { ConfigError } from "../../../src/util/errors.js";

const validEnv = {
  GITHUB_TOKEN: "ghs_example",
  LLM_PROVIDER: "openai",
  LLM_API_KEY: "sk-example",
};

describe("parseEnv", () => {
  it("parses required env vars and applies defaults", () => {
    expect(parseEnv(validEnv)).toMatchObject({
      PRBOT_MODE: "cli",
      GITHUB_TOKEN: "ghs_example",
      LLM_PROVIDER: "openai",
      LLM_API_KEY: "sk-example",
      LOG_LEVEL: "info",
      PORT: 3000,
      MAX_DIFF_BYTES: 500000,
    });
  });

  it("names the missing required env var in an actionable error", () => {
    expect(() => parseEnv({ GITHUB_TOKEN: "ghs_example" })).toThrow(ConfigError);

    try {
      parseEnv({ GITHUB_TOKEN: "ghs_example" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).code).toBe("MISSING_ENV");
      expect((error as Error).message).toContain("LLM_PROVIDER");
      expect((error as Error).message).toContain("Set LLM_PROVIDER");
    }
  });

  it("requires LLM_API_KEY for hosted providers", () => {
    expect(() => parseEnv({ GITHUB_TOKEN: "ghs_example", LLM_PROVIDER: "anthropic" })).toThrow(
      /LLM_API_KEY is required/,
    );
  });

  it("does not require LLM_API_KEY for local provider", () => {
    expect(parseEnv({ GITHUB_TOKEN: "ghs_example", LLM_PROVIDER: "local" })).toMatchObject({
      LLM_PROVIDER: "local",
    });
  });

  it("requires app credentials in app mode", () => {
    expect(() =>
      parseEnv({
        PRBOT_MODE: "app",
        LLM_PROVIDER: "local",
        GITHUB_APP_ID: "123",
      }),
    ).toThrow(/GITHUB_APP_PRIVATE_KEY is required in App mode/);
  });
});
