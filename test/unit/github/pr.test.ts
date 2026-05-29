import { Octokit } from "@octokit/rest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { fetchDiff, fetchFiles, fetchPR, loadRepoConfig } from "../../../src/github/pr.js";
import { ConfigError } from "../../../src/util/errors.js";

const apiBaseUrl = "https://api.github.test";
const octokit = new Octokit({ auth: "test-token", baseUrl: apiBaseUrl });
const prRef = { owner: "acme", repo: "widgets", prNumber: 7 };
const server = setupServer();

function mockPullRequest() {
  server.use(
    http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7`, () =>
      HttpResponse.json({
        number: 7,
        title: "Add widget",
        body: "Useful widget",
        html_url: "https://github.test/acme/widgets/pull/7",
        user: { login: "octo" },
        head: { sha: "head-sha" },
        base: { sha: "base-sha" },
      }),
    ),
  );
}

describe("github PR helpers", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("fetches pull request metadata", async () => {
    mockPullRequest();

    await expect(fetchPR(octokit, prRef)).resolves.toMatchObject({
      owner: "acme",
      repo: "widgets",
      prNumber: 7,
      title: "Add widget",
      body: "Useful widget",
      author: "octo",
      headSha: "head-sha",
      baseSha: "base-sha",
    });
  });

  it("fetches changed files through the paginated REST endpoint", async () => {
    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7/files`, () =>
        HttpResponse.json([
          {
            filename: "src/widget.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            changes: 4,
            patch: "@@ -1 +1 @@",
          },
        ]),
      ),
    );

    await expect(fetchFiles(octokit, prRef)).resolves.toEqual([
      {
        filename: "src/widget.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        changes: 4,
        patch: "@@ -1 +1 @@",
        previousFilename: undefined,
      },
    ]);
  });

  it("fetches the unified diff via the diff media type", async () => {
    expect.assertions(2);
    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7`, ({ request }) => {
        expect(request.headers.get("accept")).toContain("diff");
        return HttpResponse.text("diff --git a/src/widget.ts b/src/widget.ts\n");
      }),
    );

    await expect(fetchDiff(octokit, prRef)).resolves.toBe(
      "diff --git a/src/widget.ts b/src/widget.ts\n",
    );
  });

  it("loads .prbot.yml from the PR head SHA", async () => {
    expect.assertions(2);
    mockPullRequest();
    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/contents/.prbot.yml`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("ref")).toBe("head-sha");
        return HttpResponse.json({
          type: "file",
          encoding: "base64",
          content: Buffer.from("enabled: false\nreview:\n  max_files: 3\n").toString("base64"),
        });
      }),
    );

    await expect(loadRepoConfig(octokit, prRef)).resolves.toEqual({
      source: "repo",
      config: { enabled: false, review: { max_files: 3 } },
    });
  });

  it("falls back to defaults when .prbot.yml is absent", async () => {
    mockPullRequest();
    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/contents/.prbot.yml`, () =>
        HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );

    await expect(loadRepoConfig(octokit, prRef)).resolves.toEqual({
      source: "default",
      config: {},
    });
  });

  it("surfaces invalid .prbot.yml as a config error", async () => {
    mockPullRequest();
    server.use(
      http.get(`${apiBaseUrl}/repos/acme/widgets/contents/.prbot.yml`, () =>
        HttpResponse.json({
          type: "file",
          encoding: "base64",
          content: Buffer.from("llm:\n  api_key: sk-nope\n").toString("base64"),
        }),
      ),
    );

    await expect(loadRepoConfig(octokit, prRef)).rejects.toBeInstanceOf(ConfigError);
  });
});
