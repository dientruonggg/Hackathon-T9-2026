import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import type { LlmProvider, LlmGenerateOutput } from "../src/providers/llm-provider.js";
import type { AgentTurnRequest, ViewportContext, Result } from "@vlc/contracts";

describe("Slice 4: Fastify Route POST /v1/agent/turn", () => {
  const dummyContext: ViewportContext = {
    contextId: "ctx-route-1",
    source: {
      canonicalUrl: "https://example.com/learn",
      safeUrl: "https://example.com/learn",
      hostname: "example.com",
      title: "Learning"
    },
    anchor: {
      heading: "Overview",
      textQuote: "This is overview text.",
      scrollRatio: 0.1,
      fingerprint: "sha256:11112222"
    },
    visibleText: "This is overview text explaining the fundamental basics.",
    visibleCodeBlocks: [],
    capturedAt: new Date().toISOString()
  };

  const validRequest: AgentTurnRequest = {
    contractVersion: "0.1",
    turnId: "turn-http-1",
    question: "Tóm tắt ý chính",
    context: dummyContext,
    relatedMemories: [],
    history: [],
    permissions: { allowWebSearch: false }
  };

  const fakeProvider: LlmProvider = {
    async generate(): Promise<Result<LlmGenerateOutput>> {
      return {
        ok: true,
        data: {
          text: "Tóm tắt ý chính của phần này là giới thiệu các khái niệm căn bản.",
          model: { provider: "fake-provider", name: "test-model" }
        }
      };
    }
  };

  it("POST /v1/agent/turn returns 200 and AgentTurnResponse on valid request", async () => {
    const app = buildApp({ provider: fakeProvider });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: validRequest
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.contractVersion).toBe("0.1");
    expect(json.turnId).toBe("turn-http-1");
    expect(json.answer).toContain("Tóm tắt ý chính");
    expect(json.grounding).toBe("VIEWPORT");
  });

  it("POST /v1/agent/turn returns 400 VALIDATION_ERROR when request body is invalid", async () => {
    const app = buildApp({ provider: fakeProvider });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: {
        contractVersion: "0.1",
        question: "" // invalid: empty question
      }
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.body);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("POST /v1/agent/turn returns 422 NO_READABLE_CONTENT when viewport text is empty", async () => {
    const app = buildApp({ provider: fakeProvider });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: {
        ...validRequest,
        context: {
          ...dummyContext,
          visibleText: ""
        }
      }
    });

    expect(response.statusCode).toBe(422);
    const json = JSON.parse(response.body);
    expect(json.code).toBe("NO_READABLE_CONTENT");
  });

  it("POST /v1/agent/turn returns 503 AGENT_UNAVAILABLE when provider is missing", async () => {
    const appWithoutProvider = buildApp(); // no provider
    const response = await appWithoutProvider.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: validRequest
    });

    expect(response.statusCode).toBe(503);
    const json = JSON.parse(response.body);
    expect(json.code).toBe("AGENT_UNAVAILABLE");
  });
});
