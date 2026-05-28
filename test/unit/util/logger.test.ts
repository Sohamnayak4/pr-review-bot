import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "../../../src/util/logger.js";

class MemoryStream extends Writable {
  chunks: string[] = [];

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.chunks.push(chunk.toString("utf8"));
    callback();
  }
}

describe("logger redaction", () => {
  it("redacts API keys from log output", () => {
    const stream = new MemoryStream();
    const logger = createLogger({ level: "info" }, stream);

    logger.info({
      llm_api_key: "sk-secret-value",
      nested: {
        authorization: "Bearer secret-token",
      },
      safe: "visible",
    });

    const output = stream.chunks.join("");

    expect(output).toContain("***");
    expect(output).toContain("visible");
    expect(output).not.toContain("sk-secret-value");
    expect(output).not.toContain("secret-token");
  });
});
