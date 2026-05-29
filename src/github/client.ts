import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

import type { GitHubClient } from "./types.js";

interface BaseClientOptions {
  baseUrl?: string;
  userAgent?: string;
}

export interface TokenGitHubClientOptions extends BaseClientOptions {
  mode: "token";
  token: string;
}

export interface AppInstallationGitHubClientOptions extends BaseClientOptions {
  mode: "app";
  appId: number | string;
  privateKey: string;
  installationId: number;
}

export type GitHubClientOptions = TokenGitHubClientOptions | AppInstallationGitHubClientOptions;

function octokitDefaults(options: BaseClientOptions) {
  return {
    baseUrl: options.baseUrl,
    userAgent: options.userAgent ?? "pr-review-bot",
  };
}

export async function createGitHubClient(options: GitHubClientOptions): Promise<GitHubClient> {
  if (options.mode === "token") {
    return new Octokit({
      ...octokitDefaults(options),
      auth: options.token,
    });
  }

  const InstallationOctokit = Octokit.defaults(octokitDefaults(options));
  const app = new App({
    appId: options.appId,
    privateKey: options.privateKey,
    Octokit: InstallationOctokit,
  });

  return app.getInstallationOctokit(options.installationId) as Promise<GitHubClient>;
}
