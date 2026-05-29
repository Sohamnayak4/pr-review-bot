import type { ReviewResult, ReviewResultInline } from "../types.js";
import { GitHubError } from "../util/errors.js";
import type { GitHubClient, PullRequestRef } from "./types.js";

export interface PostReviewOptions extends PullRequestRef {
  result: ReviewResult;
  inlineComments?: boolean;
}

export interface PostReviewResult {
  id: number;
  url: string;
}

const verdictEvents = {
  comment: "COMMENT",
  approve: "APPROVE",
  request_changes: "REQUEST_CHANGES",
} as const;

const severityLabels = {
  warning: "Warning",
  suggestion: "Suggestion",
  nit: "Nit",
  praise: "Praise",
} as const;

function inlineBody(comment: ReviewResultInline): string {
  return `**${severityLabels[comment.severity]}:** ${comment.body}`;
}

function mapReviewError(error: unknown): GitHubError {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;

    if (status === 401 || status === 403) {
      return new GitHubError("AUTH", "GitHub rejected review authentication.", { cause: error });
    }

    if (status === 404) {
      return new GitHubError("NOT_FOUND", "Pull request not found while posting review.", {
        cause: error,
      });
    }

    if (status === 429) {
      return new GitHubError("RATE_LIMIT", "GitHub API rate limit exceeded.", { cause: error });
    }

    if (status === 400 || status === 422) {
      return new GitHubError("BAD_REQUEST", "GitHub rejected the review payload.", {
        cause: error,
      });
    }

    if (status >= 500) {
      return new GitHubError("UPSTREAM", "GitHub returned an upstream error.", { cause: error });
    }
  }

  const message = error instanceof Error ? error.message : "Failed to post GitHub review.";
  return new GitHubError("UNKNOWN", message, { cause: error });
}

export async function postReview(
  octokit: GitHubClient,
  options: PostReviewOptions,
): Promise<PostReviewResult> {
  try {
    const response = await octokit.rest.pulls.createReview({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.prNumber,
      body: options.result.summary,
      event: verdictEvents[options.result.verdict],
      comments:
        options.inlineComments === false
          ? []
          : options.result.inline.map((comment) => ({
              path: comment.path,
              line: comment.line,
              side: "RIGHT" as const,
              body: inlineBody(comment),
            })),
    });

    return {
      id: response.data.id,
      url: response.data.html_url,
    };
  } catch (error) {
    throw mapReviewError(error);
  }
}
