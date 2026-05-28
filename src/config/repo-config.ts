import yaml from "js-yaml";
import { z } from "zod";

import { ConfigError } from "../util/errors.js";
import { DEFAULT_REPO_CONFIG } from "./defaults.js";

export const RepoConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    review: z
      .object({
        on_events: z
          .array(z.enum(["opened", "synchronize", "reopened", "comment_command"]))
          .min(1, "review.on_events must include at least one event.")
          .optional(),
        trigger_command: z.string().trim().min(1).optional(),
        inline_comments: z.boolean().optional(),
        max_files: z.number().int().positive().optional(),
        summary_position: z.enum(["top", "bottom"]).optional(),
      })
      .strict()
      .optional(),
    ignore: z
      .object({
        paths: z.array(z.string().trim().min(1)).optional(),
        authors: z.array(z.string().trim().min(1)).optional(),
      })
      .strict()
      .optional(),
    llm: z
      .object({
        model: z.string().trim().min(1).nullable().optional(),
        temperature: z.number().min(0).max(2).optional(),
        max_output_tokens: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    prompt: z
      .object({
        persona: z.string().trim().min(1).optional(),
        focus: z.array(z.string().trim().min(1)).optional(),
        language: z.string().trim().min(1).optional(),
        extra_instructions: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type RepoConfig = z.infer<typeof RepoConfigSchema>;

export const ResolvedRepoConfigSchema = RepoConfigSchema.required({
  enabled: true,
  review: true,
  ignore: true,
  llm: true,
  prompt: true,
}).extend({
  review: RepoConfigSchema.shape.review.unwrap().required({
    on_events: true,
    trigger_command: true,
    inline_comments: true,
    max_files: true,
    summary_position: true,
  }),
  ignore: RepoConfigSchema.shape.ignore.unwrap().required({
    paths: true,
    authors: true,
  }),
  llm: RepoConfigSchema.shape.llm.unwrap().required({
    model: true,
    temperature: true,
    max_output_tokens: true,
  }),
  prompt: RepoConfigSchema.shape.prompt.unwrap().required({
    persona: true,
    focus: true,
    language: true,
    extra_instructions: true,
  }),
});

export type ResolvedRepoConfig = z.infer<typeof ResolvedRepoConfigSchema>;

function formatRepoConfigError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || ".prbot.yml";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

export function parseRepoConfig(input: unknown): RepoConfig {
  const result = RepoConfigSchema.safeParse(input ?? {});

  if (!result.success) {
    throw new ConfigError(
      "INVALID_REPO_CONFIG",
      `Invalid .prbot.yml:\n${formatRepoConfigError(result.error)}`,
      { cause: result.error },
    );
  }

  return result.data;
}

export function parseRepoConfigYaml(contents: string): RepoConfig {
  try {
    return parseRepoConfig(yaml.load(contents) ?? {});
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    throw new ConfigError(
      "INVALID_REPO_CONFIG",
      `Invalid .prbot.yml YAML: ${(error as Error).message}`,
      {
        cause: error,
      },
    );
  }
}

export function resolveRepoConfig(config: RepoConfig): ResolvedRepoConfig {
  const defaults = ResolvedRepoConfigSchema.parse(DEFAULT_REPO_CONFIG);

  return ResolvedRepoConfigSchema.parse({
    ...defaults,
    ...config,
    review: { ...defaults.review, ...config.review },
    ignore: { ...defaults.ignore, ...config.ignore },
    llm: { ...defaults.llm, ...config.llm },
    prompt: { ...defaults.prompt, ...config.prompt },
  });
}
