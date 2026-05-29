import type { Octokit } from "@octokit/rest";

import type { RepoConfig } from "../config/repo-config.js";

export type GitHubClient = Octokit;

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface PullRequestRef extends GitHubRepoRef {
  prNumber: number;
}

export interface PullRequestInfo extends PullRequestRef {
  title: string;
  body: string | null;
  author: string;
  headSha: string;
  baseSha: string;
  url: string;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
}

export interface LoadRepoConfigResult {
  config: RepoConfig;
  source: "repo" | "default";
}
