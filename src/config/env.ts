import { z } from "zod";

import { ConfigError } from "../util/errors.js";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalNonEmptyString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);

const requiredEnv = (name: string, guidance: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string({
        required_error: `${name} is required. ${guidance}`,
        invalid_type_error: `${name} must be a string.`,
      })
      .trim()
      .min(1, `${name} is required. ${guidance}`),
  );

const numericEnv = (name: string, defaultValue: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number({
        invalid_type_error: `${name} must be a number.`,
      })
      .int(`${name} must be an integer.`)
      .positive(`${name} must be positive.`)
      .default(defaultValue),
  );

export const EnvSchema = z
  .object({
    PRBOT_MODE: z.enum(["action", "app", "cli"]).default("cli"),
    GITHUB_TOKEN: optionalNonEmptyString,
    GITHUB_APP_ID: optionalNonEmptyString,
    GITHUB_APP_PRIVATE_KEY: optionalNonEmptyString,
    GITHUB_WEBHOOK_SECRET: optionalNonEmptyString,
    LLM_PROVIDER: requiredEnv(
      "LLM_PROVIDER",
      "Set LLM_PROVIDER to one of: openai, anthropic, google, openrouter, local.",
    ).pipe(z.enum(["openai", "anthropic", "google", "openrouter", "local"])),
    LLM_API_KEY: optionalNonEmptyString,
    LLM_MODEL: optionalNonEmptyString,
    LLM_BASE_URL: optionalNonEmptyString,
    LOG_LEVEL: z
      .preprocess(
        emptyStringToUndefined,
        z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
      )
      .default("info"),
    PORT: numericEnv("PORT", 3000),
    MAX_DIFF_BYTES: numericEnv("MAX_DIFF_BYTES", 500000),
  })
  .superRefine((env, context) => {
    if (env.PRBOT_MODE === "app") {
      for (const name of [
        "GITHUB_APP_ID",
        "GITHUB_APP_PRIVATE_KEY",
        "GITHUB_WEBHOOK_SECRET",
      ] as const) {
        if (!env[name]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} is required in App mode. Set ${name} in the deployment environment.`,
          });
        }
      }
    } else if (!env.GITHUB_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GITHUB_TOKEN"],
        message: `GITHUB_TOKEN is required in ${env.PRBOT_MODE} mode. Set GITHUB_TOKEN with pull_requests:write and contents:read permissions.`,
      });
    }

    if (env.LLM_PROVIDER !== "local" && !env.LLM_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LLM_API_KEY"],
        message: `LLM_API_KEY is required when LLM_PROVIDER is ${env.LLM_PROVIDER}. Set LLM_API_KEY to your provider API key.`,
      });
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const variable = issue.path.join(".") || "environment";
      return `${variable}: ${issue.message}`;
    })
    .join("\n");
}

export function parseEnv(input: NodeJS.ProcessEnv = process.env): EnvConfig {
  const result = EnvSchema.safeParse(input);

  if (!result.success) {
    const hasMissingEnv = result.error.issues.some((issue) =>
      issue.message.includes(" is required"),
    );
    throw new ConfigError(
      hasMissingEnv ? "MISSING_ENV" : "INVALID_ENV",
      formatEnvError(result.error),
      {
        cause: result.error,
      },
    );
  }

  return result.data;
}
