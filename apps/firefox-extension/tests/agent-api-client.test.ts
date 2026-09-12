import { describe, expect, it, vi } from "vitest";
import type { AgentTurnRequest, AgentTurnResponse } from "@vlc/contracts";
import { requestAgentTurnWithOptions } from "../src/services/agent-api-client";

describe("requestAgentTurn", () => {
  it("validates and returns an Agent API response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(makeResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await requestAgentTurnWithOptions(makeRequest(), {
      endpoint: "http://127.0.0.1:8787/v1/agent/turn",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ ok: true, data: { grounding: "VIEWPORT" } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("preserves a valid structured API error", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: "AGENT_UNAVAILABLE",
          message: "Provider chưa cấu hình.",
          retryable: true,
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await requestAgentTurnWithOptions(makeRequest(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "AGENT_UNAVAILABLE",
        message: "Provider chưa cấu hình.",
        retryable: true,
      },
    });
  });

  it("rejects a success payload that violates the shared response schema", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ answer: "missing fields" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await requestAgentTurnWithOptions(makeRequest(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});

function makeRequest(): AgentTurnRequest {
  return {
    contractVersion: "0.1",
    turnId: "turn-1",
    question: "Đoạn này là gì?",
    context: {
      contextId: "context-1",
      source: {
        canonicalUrl: "https://example.com/article",
        safeUrl: "https://example.com/article",
        hostname: "example.com",
        title: "Article",
      },
      anchor: {
        heading: "Agent loop",
        textQuote: "An agent uses tools.",
        scrollRatio: 0.2,
        fingerprint: "sha256:test",
      },
      visibleText: "An agent uses tools and observes the results.",
      visibleCodeBlocks: [],
      capturedAt: "2026-09-12T12:00:00.000Z",
    },
    relatedMemories: [],
    history: [],
    permissions: { allowWebSearch: false },
  };
}

function makeResponse(): AgentTurnResponse {
  return {
    contractVersion: "0.1",
    turnId: "turn-1",
    answer: "Đây là vòng lặp Agent.",
    grounding: "VIEWPORT",
    groundingRefs: [{ kind: "VIEWPORT", refId: "context-1", label: "Agent loop" }],
    suggestedActions: [],
    toolTrace: [],
    model: { provider: "test", name: "test-model" },
  };
}
