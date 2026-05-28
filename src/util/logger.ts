import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

const SENSITIVE_KEY_PATTERN = /(api[_-]?key|token|authorization|private[_-]?key)/i;

export const REDACT_PATHS = [
  "api_key",
  "apiKey",
  "token",
  "authorization",
  "private_key",
  "privateKey",
  "LLM_API_KEY",
  "GITHUB_TOKEN",
  "GITHUB_APP_PRIVATE_KEY",
  "*.api_key",
  "*.apiKey",
  "*.token",
  "*.authorization",
  "*.private_key",
  "*.privateKey",
  "*.LLM_API_KEY",
  "*.GITHUB_TOKEN",
  "*.GITHUB_APP_PRIVATE_KEY",
];

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "***" : redactValue(nestedValue);
  }

  return redacted;
}

export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  return pino(
    {
      ...options,
      redact: {
        paths: REDACT_PATHS,
        censor: "***",
        ...(typeof options.redact === "object" && !Array.isArray(options.redact)
          ? options.redact
          : {}),
      },
      hooks: {
        ...options.hooks,
        logMethod(args, method) {
          const redactedArgs = args.map(redactValue);
          (method as (...methodArgs: unknown[]) => void).apply(this, redactedArgs);
        },
      },
    },
    destination,
  );
}

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
});
