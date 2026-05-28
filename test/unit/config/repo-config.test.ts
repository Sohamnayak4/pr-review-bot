import { describe, expect, it } from "vitest";

import {
  parseRepoConfig,
  parseRepoConfigYaml,
  resolveRepoConfig,
} from "../../../src/config/repo-config.js";
import { ConfigError } from "../../../src/util/errors.js";

describe("repo config schema", () => {
  it("parses an empty repo config and resolves defaults", () => {
    const resolved = resolveRepoConfig(parseRepoConfig({}));

    expect(resolved).toMatchObject({
      enabled: true,
      review: {
        on_events: ["opened", "synchronize"],
        trigger_command: "/review",
        inline_comments: true,
        max_files: 50,
        summary_position: "top",
      },
      llm: {
        model: null,
        temperature: 0.2,
        max_output_tokens: 4096,
      },
    });
  });

  it("parses valid YAML overrides", () => {
    const config = parseRepoConfigYaml(`
enabled: false
review:
  on_events: [reopened, comment_command]
  max_files: 10
prompt:
  language: spanish
`);

    expect(resolveRepoConfig(config)).toMatchObject({
      enabled: false,
      review: {
        on_events: ["reopened", "comment_command"],
        max_files: 10,
        trigger_command: "/review",
      },
      prompt: {
        language: "spanish",
      },
    });
  });

  it("rejects invalid repo config with a clear path", () => {
    expect(() => parseRepoConfig({ review: { summary_position: "middle" } })).toThrow(
      /review.summary_position/,
    );
  });

  it("rejects API keys and base URLs in repo config", () => {
    expect(() => parseRepoConfig({ llm: { api_key: "sk-leaked" } })).toThrow(ConfigError);
    expect(() => parseRepoConfig({ llm: { base_url: "https://evil.example" } })).toThrow(
      /Unrecognized key/,
    );
  });
});
