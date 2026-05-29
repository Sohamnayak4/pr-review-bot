import { Octokit } from "@octokit/rest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { postReview } from "../../../src/github/review.js";

const apiBaseUrl = "https://api.github.test";
const octokit = new Octokit({ auth: "test-token", baseUrl: apiBaseUrl });
const server = setupServer();

describe("postReview", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("posts one REST review with batched inline comments", async () => {
    expect.assertions(3);
    server.use(
      http.post(`${apiBaseUrl}/repos/acme/widgets/pulls/7/reviews`, async ({ request }) => {
        const body = (await request.json()) as {
          body: string;
          event: string;
          comments: Array<{ path: string; line: number; side: string; body: string }>;
        };

        expect(body).toMatchObject({
          body: "Looks solid overall.",
          event: "COMMENT",
          comments: [
            {
              path: "src/widget.ts",
              line: 12,
              side: "RIGHT",
              body: "**Warning:** Check null input.",
            },
            {
              path: "src/widget.test.ts",
              line: 4,
              side: "RIGHT",
              body: "**Praise:** Nice coverage.",
            },
          ],
        });
        expect(request.headers.get("authorization")).toBe("token test-token");

        return HttpResponse.json({
          id: 99,
          html_url: "https://github.test/acme/widgets/pull/7#pullrequestreview-99",
        });
      }),
    );

    await expect(
      postReview(octokit, {
        owner: "acme",
        repo: "widgets",
        prNumber: 7,
        result: {
          summary: "Looks solid overall.",
          verdict: "comment",
          inline: [
            {
              path: "src/widget.ts",
              line: 12,
              severity: "warning",
              body: "Check null input.",
            },
            {
              path: "src/widget.test.ts",
              line: 4,
              severity: "praise",
              body: "Nice coverage.",
            },
          ],
        },
      }),
    ).resolves.toEqual({
      id: 99,
      url: "https://github.test/acme/widgets/pull/7#pullrequestreview-99",
    });
  });

  it("can suppress inline comments while still posting one review", async () => {
    expect.assertions(2);
    server.use(
      http.post(`${apiBaseUrl}/repos/acme/widgets/pulls/7/reviews`, async ({ request }) => {
        const body = (await request.json()) as { comments: unknown[]; event: string };

        expect(body).toMatchObject({ comments: [], event: "APPROVE" });
        return HttpResponse.json({
          id: 100,
          html_url: "https://github.test/acme/widgets/pull/7#pullrequestreview-100",
        });
      }),
    );

    await expect(
      postReview(octokit, {
        owner: "acme",
        repo: "widgets",
        prNumber: 7,
        inlineComments: false,
        result: {
          summary: "Great work.",
          verdict: "approve",
          inline: [{ path: "src/widget.ts", line: 1, severity: "nit", body: "Tiny nit." }],
        },
      }),
    ).resolves.toEqual({
      id: 100,
      url: "https://github.test/acme/widgets/pull/7#pullrequestreview-100",
    });
  });
});
