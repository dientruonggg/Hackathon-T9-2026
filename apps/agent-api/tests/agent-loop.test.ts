import { describe, it, expect } from "vitest";
import { runAgentTurn } from "../src/agent/run-agent-turn.js";
import type { LlmProvider, LlmGenerateInput, LlmGenerateOutput } from "../src/providers/llm-provider.js";
import type { AgentTurnRequest, ViewportContext, MemorySummary, Result } from "@vlc/contracts";

describe("Slice 4: ReAct Agent Loop with Fake Provider", () => {
  const dummyContext: ViewportContext = {
    contextId: "ctx-react-1",
    source: {
      canonicalUrl: "https://example.com/docs/closures",
      safeUrl: "https://example.com/docs/closures",
      hostname: "example.com",
      title: "JavaScript Closures"
    },
    anchor: {
      heading: "Practical Closures",
      textQuote: "Closures allow associating data with a function...",
      scrollRatio: 0.5,
      fingerprint: "sha256:11223344"
    },
    visibleText: "Closures allow associating data with a function that operates on that data.",
    visibleCodeBlocks: [],
    capturedAt: new Date().toISOString()
  };

  const dummyMemory: MemorySummary = {
    id: "mem-rec-1",
    source: dummyContext.source,
    anchor: dummyContext.anchor,
    status: "NOT_UNDERSTOOD",
    note: "Vướng ở phần private state",
    question: "Tại sao closure tạo được private variables?",
    updatedAt: new Date().toISOString(),
    revision: 1,
    matchScore: 0.9,
    matchReason: "EXACT_FINGERPRINT"
  };

  const dummyRequest: AgentTurnRequest = {
    contractVersion: "0.1",
    turnId: "turn-react-1",
    question: "Đoạn này giải thích điều gì?",
    context: dummyContext,
    relatedMemories: [dummyMemory],
    history: [],
    permissions: { allowWebSearch: false }
  };

  it("Scenario 1: Model calls get_viewport_context then returns final text answer", async () => {
    let callCount = 0;

    const fakeProvider: LlmProvider = {
      async generate(input: LlmGenerateInput): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          // Turn 1: model wants to call get_viewport_context
          return {
            ok: true,
            data: {
              toolCalls: [
                {
                  id: "call-1",
                  name: "get_viewport_context",
                  arguments: {}
                }
              ],
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        } else {
          // Turn 2: model has received tool result, outputs final answer
          // Verify that tool result was passed in messages
          const lastMsg = input.messages[input.messages.length - 1];
          expect(lastMsg?.role).toBe("tool");

          return {
            ok: true,
            data: {
              text: "Đoạn này giải thích cách closures liên kết dữ liệu với hàm.",
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        }
      }
    };

    const result = await runAgentTurn(dummyRequest, { provider: fakeProvider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.answer).toContain("liên kết dữ liệu");
      expect(result.data.grounding).toBe("VIEWPORT");
      expect(result.data.toolTrace).toHaveLength(1);
      expect(result.data.toolTrace[0]?.toolName).toBe("get_viewport_context");
      expect(result.data.toolTrace[0]?.status).toBe("SUCCESS");
    }
  });

  it("Scenario 2: Model calls search_memory and propose_marker", async () => {
    let callCount = 0;

    const fakeProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            data: {
              toolCalls: [
                {
                  id: "call-search",
                  name: "search_memory",
                  arguments: { query: "private" }
                },
                {
                  id: "call-prop",
                  name: "propose_marker",
                  arguments: {
                    status: "REVIEW_LATER",
                    note: "Cần đọc lại phần private variables",
                    reason: "Khái niệm quan trọng"
                  }
                }
              ],
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        } else {
          return {
            ok: true,
            data: {
              text: "Bạn từng có ghi chú về private variables tại phần này.",
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        }
      }
    };

    const result = await runAgentTurn(dummyRequest, { provider: fakeProvider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.grounding).toBe("MEMORY");
      expect(result.data.toolTrace).toHaveLength(2);
      expect(result.data.suggestedActions).toHaveLength(1);
      expect(result.data.suggestedActions[0]?.payload.status).toBe("REVIEW_LATER");
    }
  });

  it("Scenario 3: Exceeding 3 model steps returns AGENT_MAX_STEPS error", async () => {
    // Fake provider that constantly returns a tool call
    const infiniteToolProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        return {
          ok: true,
          data: {
            toolCalls: [
              {
                id: "call-loop",
                name: "get_viewport_context",
                arguments: {}
              }
            ],
            model: { provider: "fake-provider", name: "test-model" }
          }
        };
      }
    };

    const result = await runAgentTurn(dummyRequest, { provider: infiniteToolProvider });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AGENT_MAX_STEPS");
    }
  });

  it("Scenario 4: Model calling unknown tool records controlled error in toolTrace", async () => {
    let callCount = 0;

    const fakeProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            data: {
              toolCalls: [
                {
                  id: "call-unknown",
                  name: "non_existent_tool" as any,
                  arguments: {}
                }
              ],
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        } else {
          return {
            ok: true,
            data: {
              text: "Tôi không thể sử dụng công cụ đó.",
              model: { provider: "fake-provider", name: "test-model" }
            }
          };
        }
      }
    };

    const result = await runAgentTurn(dummyRequest, { provider: fakeProvider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.answer).toBe("Tôi không thể sử dụng công cụ đó.");
    }
  });

  it("Scenario 5: Empty visibleText in viewport returns NO_READABLE_CONTENT", async () => {
    const invalidContextReq: AgentTurnRequest = {
      ...dummyRequest,
      context: {
        ...dummyContext,
        visibleText: "   "
      }
    };

    const fakeProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        return {
          ok: true,
          data: { text: "answer", model: { provider: "test", name: "m" } }
        };
      }
    };

    const result = await runAgentTurn(invalidContextReq, { provider: fakeProvider });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_READABLE_CONTENT");
    }
  });
});
