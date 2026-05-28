import type { ResolvedRepoConfig } from "./repo-config.js";

export const DEFAULT_REPO_CONFIG = {
  enabled: true,
  review: {
    on_events: ["opened", "synchronize"],
    trigger_command: "/review",
    inline_comments: true,
    max_files: 50,
    summary_position: "top",
  },
  ignore: {
    paths: ["**/*.lock", "**/dist/**", "**/*.min.js"],
    authors: [],
  },
  llm: {
    model: null,
    temperature: 0.2,
    max_output_tokens: 4096,
  },
  prompt: {
    persona: "a senior staff engineer",
    focus: ["security", "performance", "test coverage"],
    language: "english",
    extra_instructions: "",
  },
} satisfies ResolvedRepoConfig;
