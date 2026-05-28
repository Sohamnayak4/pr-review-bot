export type LLMErrorCode =
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "UNKNOWN";

export type GitHubErrorCode =
  | "AUTH"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "UNKNOWN";

export type ConfigErrorCode = "MISSING_ENV" | "INVALID_ENV" | "INVALID_REPO_CONFIG";

interface BotErrorOptions {
  cause?: unknown;
}

export class LLMError extends Error {
  readonly code: LLMErrorCode;

  constructor(code: LLMErrorCode, message: string, options: BotErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "LLMError";
    this.code = code;
  }
}

export class GitHubError extends Error {
  readonly code: GitHubErrorCode;

  constructor(code: GitHubErrorCode, message: string, options: BotErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "GitHubError";
    this.code = code;
  }
}

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;

  constructor(code: ConfigErrorCode, message: string, options: BotErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "ConfigError";
    this.code = code;
  }
}
