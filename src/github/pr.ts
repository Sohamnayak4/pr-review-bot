import { Buffer } from "node:buffer";

import { parseRepoConfigYaml } from "../config/repo-config.js";
import { ConfigError, GitHubError } from "../util/errors.js";
import type {
  GitHubClient,
  LoadRepoConfigResult,
  PullRequestFile,
  PullRequestInfo,
  PullRequestRef,
} from "./types.js";

function statusFromError(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function mapGitHubError(error: unknown, fallback: string): GitHubError {
  if (error instanceof GitHubError) {
    return error;
  }

  const status = statusFromError(error);

  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return new GitHubError("AUTH", "GitHub rejected authentication.", { cause: error });
    }

    if (status === 404) {
      return new GitHubError("NOT_FOUND", fallback, { cause: error });
    }

    if (status === 429) {
      return new GitHubError("RATE_LIMIT", "GitHub API rate limit exceeded.", { cause: error });
    }

    if (status === 400 || status === 422) {
      return new GitHubError("BAD_REQUEST", "GitHub rejected the request.", { cause: error });
    }

    if (status >= 500) {
      return new GitHubError("UPSTREAM", "GitHub returned an upstream error.", { cause: error });
    }
  }

  const message = error instanceof Error ? error.message : fallback;
  return new GitHubError("UNKNOWN", message, { cause: error });
}

export async function fetchPR(
  octokit: GitHubClient,
  ref: PullRequestRef,
): Promise<PullRequestInfo> {
  try {
    const { data } = await octokit.rest.pulls.get({
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.prNumber,
    });

    return {
      ...ref,
      title: data.title,
      body: data.body,
      author: data.user?.login ?? "unknown",
      headSha: data.head.sha,
      baseSha: data.base.sha,
      url: data.html_url,
    };
  } catch (error) {
    throw mapGitHubError(error, `Pull request ${ref.owner}/${ref.repo}#${ref.prNumber} not found.`);
  }
}

export async function fetchFiles(
  octokit: GitHubClient,
  ref: PullRequestRef,
): Promise<PullRequestFile[]> {
  try {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.prNumber,
      per_page: 100,
    });

    return files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename,
    }));
  } catch (error) {
    throw mapGitHubError(
      error,
      `Could not fetch files for ${ref.owner}/${ref.repo}#${ref.prNumber}.`,
    );
  }
}

export async function fetchDiff(octokit: GitHubClient, ref: PullRequestRef): Promise<string> {
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.prNumber,
      mediaType: {
        format: "diff",
      },
    });

    return String(response.data);
  } catch (error) {
    throw mapGitHubError(
      error,
      `Could not fetch diff for ${ref.owner}/${ref.repo}#${ref.prNumber}.`,
    );
  }
}

function decodeGitHubContent(content: string, encoding?: string): string {
  if (encoding !== "base64") {
    return content;
  }

  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

export async function loadRepoConfig(
  octokit: GitHubClient,
  ref: PullRequestRef,
): Promise<LoadRepoConfigResult> {
  try {
    const pr = await fetchPR(octokit, ref);
    const { data } = await octokit.rest.repos.getContent({
      owner: ref.owner,
      repo: ref.repo,
      path: ".prbot.yml",
      ref: pr.headSha,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return { config: {}, source: "default" };
    }

    return {
      config: parseRepoConfigYaml(decodeGitHubContent(data.content, data.encoding)),
      source: "repo",
    };
  } catch (error) {
    if (statusFromError(error) === 404) {
      return { config: {}, source: "default" };
    }

    if (error instanceof ConfigError) {
      throw error;
    }

    throw mapGitHubError(
      error,
      `Could not load .prbot.yml for ${ref.owner}/${ref.repo}#${ref.prNumber}.`,
    );
  }
}
