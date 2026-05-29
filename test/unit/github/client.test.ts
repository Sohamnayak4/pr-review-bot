import { generateKeyPairSync } from "node:crypto";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createGitHubClient } from "../../../src/github/client.js";

const apiBaseUrl = "https://api.github.test";
const server = setupServer();

describe("createGitHubClient", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("creates a token-authenticated Octokit client", async () => {
    expect.assertions(2);
    server.use(
      http.get(`${apiBaseUrl}/rate_limit`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("token test-token");
        return HttpResponse.json({ resources: {}, rate: { limit: 5000 } });
      }),
    );

    const octokit = await createGitHubClient({
      mode: "token",
      token: "test-token",
      baseUrl: apiBaseUrl,
    });

    await expect(octokit.rest.rateLimit.get()).resolves.toMatchObject({
      data: { rate: { limit: 5000 } },
    });
  });

  it("creates an App installation Octokit client with the same REST interface", async () => {
    expect.assertions(3);
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs1" }).toString();

    server.use(
      http.post(`${apiBaseUrl}/app/installations/123/access_tokens`, ({ request }) => {
        expect(request.headers.get("authorization")).toMatch(/^bearer /);
        return HttpResponse.json({
          token: "installation-token",
          expires_at: "2030-01-01T00:00:00Z",
          permissions: { pull_requests: "write", contents: "read" },
          repository_selection: "selected",
        });
      }),
      http.get(`${apiBaseUrl}/repos/acme/widgets/pulls/7`, ({ request }) => {
        expect(request.headers.get("authorization")).toBe("token installation-token");
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
    );

    const octokit = await createGitHubClient({
      mode: "app",
      appId: 42,
      privateKey: privateKeyPem,
      installationId: 123,
      baseUrl: apiBaseUrl,
    });

    await expect(
      octokit.rest.pulls.get({
        owner: "acme",
        repo: "widgets",
        pull_number: 7,
      }),
    ).resolves.toMatchObject({ data: { title: "Add widget" } });
  });
});
