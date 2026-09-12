import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnvConfig } from "../src/config/env.js";
import { HealthResponseSchema } from "@vlc/contracts";

describe("Slice 1: Configuration & Fastify Surface", () => {
  it("GET /health returns 200 and matches HealthResponse schema", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json).toEqual({
      status: "ok",
      service: "viewport-learning-agent-api",
      contractVersion: "0.1"
    });

    const parsed = HealthResponseSchema.safeParse(json);
    expect(parsed.success).toBe(true);
  });

  it("CORS allows requests from allowed origins", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "moz-extension://some-addon-id"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "moz-extension://some-addon-id"
    );
  });

  it("CORS rejects unauthorized origin", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://evil-hacker.com"
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain("CORS origin not allowed");
  });

  it("loadEnvConfig parses default environment variables correctly", () => {
    const config = loadEnvConfig({});
    expect(config.apiHost).toBe("127.0.0.1");
    expect(config.apiPort).toBe(8787);
    expect(config.openaiBaseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(config.openaiModel).toBe("qwen3:8b");
    expect(config.openaiTimeoutMs).toBe(60_000);
    expect(config.corsOrigins).toContain("moz-extension://*");
  });

  it("loads the documented origin and provider environment variables", () => {
    const config = loadEnvConfig({
      ALLOWED_ORIGIN_PREFIXES: "moz-extension://,http://localhost:",
      OPENAI_BASE_URL: "https://qwen.example/v1",
      OPENAI_MODEL: "qwen3:8b",
      OPENAI_TIMEOUT_MS: "45000",
      OPENROUTER_HTTP_REFERER: "http://localhost"
    });

    expect(config.corsOrigins).toEqual(["moz-extension://", "http://localhost:"]);
    expect(config.openaiTimeoutMs).toBe(45_000);
    expect(config.openaiDefaultHeaders).toEqual({ "HTTP-Referer": "http://localhost" });
  });
});
