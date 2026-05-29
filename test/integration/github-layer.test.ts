import { Octokit } from "@octokit/rest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchDiff, fetchFiles, fetchPR, loadRepoConfig } from "../../src/github/pr.js";
import { postReview } from "../../src/github/review.js";

const apiBaseUrl = "https://api.github.test";
const octokit = new Octokit({ auth: "test-token", baseUrl: apiBaseUrl });
const ref = { owner: "acme", repo: "widgets", prNumber: 7 };
const server = setupServer();

describe("GitHub layer integration", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("fetches PR context and posts a single review without real GitHub calls", async () => {
    const calls: string[] = [];

    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7`, ({ request }) => {
        const accept = request.headers.get("accept") ?? "";
        calls.push(accept.includes("diff") ? "diff" : "pr");

        if (accept.includes("diff")) {
          return HttpResponse.text("diff --git a/src/widget.ts b/src/widget.ts\n");
        }

        return HttpResponse.json({
          number: 7,
          title: "Add widget",
          body: null,
          html_url: "https://github.test/acme/widgets/pull/7",
          user: { login: "octo" },
          head: { sha: "head-sha" },
          base: { sha: "base-sha" },
        });
      }),
      http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7/files`, () => {
        calls.push("files");
        return HttpResponse.json([
          {
            filename: "src/widget.ts",
            status: "modified",
            additions: 2,
            deletions: 0,
            changes: 2,
          },
        ]);
      }),
      http.get(`${apiBaseUrl}/repos/acme/widgets/contents/.prbot.yml`, () => {
        calls.push("config");
        return HttpResponse.json({
          type: "file",
          encoding: "base64",
          content: Buffer.from("review:\n  inline_comments: true\n").toString("base64"),
        });
      }),
      http.post(`${apiBaseUrl}/repos/acme/widgets/pulls/7/reviews`, async ({ request }) => {
        calls.push("review");
        const body = (await request.json()) as { comments: unknown[] };
        expect(body.comments).toHaveLength(1);

        return HttpResponse.json({
          id: 321,
          html_url: "https://github.test/acme/widgets/pull/7#pullrequestreview-321",
        });
      }),
    );

    await expect(fetchPR(octokit, ref)).resolves.toMatchObject({ headSha: "head-sha" });
    await expect(fetchFiles(octokit, ref)).resolves.toHaveLength(1);
    await expect(fetchDiff(octokit, ref)).resolves.toContain("diff --git");
    await expect(loadRepoConfig(octokit, ref)).resolves.toMatchObject({ source: "repo" });
    await expect(
      postReview(octokit, {
        ...ref,
        result: {
          summary: "One thing to inspect.",
          verdict: "comment",
          inline: [
            {
              path: "src/widget.ts",
              line: 2,
              severity: "suggestion",
              body: "Consider an explicit test.",
            },
          ],
        },
      }),
    ).resolves.toMatchObject({ id: 321 });

    expect(calls).toEqual(["pr", "files", "diff", "pr", "config", "review"]);
  });
});
