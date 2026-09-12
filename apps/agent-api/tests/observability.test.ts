import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryAgentObserver } from "../src/observability/agent-observer.js";
import type { LlmProvider, LlmGenerateOutput } from "../src/providers/llm-provider.js";
import type {
  AgentTurnRequest,
  ViewportContext,
  Result,
  MemorySummary
} from "@vlc/contracts";

describe("Task 05: Safe Agent API Observability", () => {
  const secretViewport = "CONFIDENTIAL_VIEWPORT_DATA_SECRET_98765";
  const secretQuestion = "MY_HIGHLY_SENSITIVE_QUESTION_ABOUT_SECRET_TAX_FORM";
  const secretMemory = "SECRET_MEMORY_NOTE_DATA_XYZ";
  const secretSystemPrompt = "System instructions containing internal prompt guidelines";

  const dummyContext: ViewportContext = {
    contextId: "ctx-obs-test",
    source: {
      canonicalUrl: "https://example.com/sensitive-doc?token=SECRET_TOKEN_URL_123",
      safeUrl: "https://example.com/sensitive-doc",
      hostname: "example.com",
      title: "Sensitive Doc Title"
    },
    anchor: {
      heading: "Top Secret Header",
      textQuote: "Private quote text",
      scrollRatio: 0.5,
      fingerprint: "sha256:obstest"
    },
    visibleText: secretViewport,
    visibleCodeBlocks: ["const secretApiKey = 'xyz';"],
    capturedAt: new Date().toISOString()
  };

  const dummyMemory: MemorySummary = {
    id: "mem-1",
    source: dummyContext.source,
    anchor: dummyContext.anchor,
    status: "UNDERSTOOD",
    note: secretMemory,
    updatedAt: new Date().toISOString(),
    revision: 1,
    matchScore: 0.95,
    matchReason: "EXACT_FINGERPRINT"
  };

  const dummyRequest: AgentTurnRequest = {
    contractVersion: "0.1",
    turnId: "turn-obs-456",
    question: secretQuestion,
    context: dummyContext,
    relatedMemories: [dummyMemory],
    history: [],
    permissions: { allowWebSearch: true }
  };

  it("1. Successful turn emits started -> tool.completed (SUCCESS) -> completed with non-negative duration and accurate toolCount", async () => {
    const observer = new MemoryAgentObserver();

    let callCount = 0;
    const mockProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          // Model invokes propose_marker tool
          return {
            ok: true,
            data: {
              text: "Calling propose_marker tool",
              toolCalls: [
                {
                  id: "call-1",
                  name: "propose_marker",
                  arguments: {
                    status: "UNDERSTOOD",
                    reason: "User understood the concept",
                    note: "Summary note"
                  }
                }
              ],
              model: { provider: "mock-provider", name: "qwen-2.5-coder" }
            }
          };
        }

        // Final text answer
        return {
          ok: true,
          data: {
            text: "This is the final safe answer grounded in viewport.",
            model: { provider: "mock-provider", name: "qwen-2.5-coder" }
          }
        };
      }
    };

    const app = buildApp({ provider: mockProvider, observer });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    expect(response.statusCode).toBe(200);
    expect(observer.events).toHaveLength(3);

    // Event 1: started
    const startEvent = observer.events[0];
    expect(startEvent).toBeDefined();
    expect(startEvent?.event).toBe("agent.turn.started");
    if (startEvent && startEvent.event === "agent.turn.started") {
      expect(startEvent.turnId).toBe(dummyRequest.turnId);
    }

    // Event 2: tool completed (SUCCESS, no errorCode)
    const toolEvent = observer.events[1];
    expect(toolEvent).toBeDefined();
    expect(toolEvent?.event).toBe("agent.tool.completed");
    if (toolEvent && toolEvent.event === "agent.tool.completed") {
      expect(toolEvent.turnId).toBe(dummyRequest.turnId);
      expect(toolEvent.step).toBe(1);
      expect(toolEvent.toolName).toBe("propose_marker");
      expect(toolEvent.status).toBe("SUCCESS");
      expect("errorCode" in toolEvent).toBe(false);
    }

    // Event 3: turn completed
    const completeEvent = observer.events[2];
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.event).toBe("agent.turn.completed");
    if (completeEvent && completeEvent.event === "agent.turn.completed") {
      expect(completeEvent.turnId).toBe(dummyRequest.turnId);
      expect(completeEvent.durationMs).toBeGreaterThanOrEqual(0);
      expect(completeEvent.grounding).toBe("VIEWPORT");
      expect(completeEvent.toolCount).toBe(1);
      expect(completeEvent.modelName).toBe("qwen-2.5-coder");
    }
  });

  it("2. Provider error emits started -> failed with correct errorCode and retryable flag", async () => {
    const observer = new MemoryAgentObserver();

    const failingProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        return {
          ok: false,
          error: {
            code: "MODEL_ERROR",
            message: "Model API rate limit or context length exceeded",
            retryable: true
          }
        };
      }
    };

    const app = buildApp({ provider: failingProvider, observer });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    expect(response.statusCode).toBe(503);
    expect(observer.events).toHaveLength(2);

    const startEvent = observer.events[0];
    expect(startEvent).toBeDefined();
    expect(startEvent?.event).toBe("agent.turn.started");
    if (startEvent && startEvent.event === "agent.turn.started") {
      expect(startEvent.turnId).toBe(dummyRequest.turnId);
    }

    const failedEvent = observer.events[1];
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.event).toBe("agent.turn.failed");
    if (failedEvent && failedEvent.event === "agent.turn.failed") {
      expect(failedEvent.turnId).toBe(dummyRequest.turnId);
      expect(failedEvent.durationMs).toBeGreaterThanOrEqual(0);
      expect(failedEvent.errorCode).toBe("MODEL_ERROR");
      expect(failedEvent.retryable).toBe(true);
    }
  });

  it("3. Tool execution failure emits agent.tool.completed with ERROR and errorCode, and terminal event is completed", async () => {
    const observer = new MemoryAgentObserver();

    let callCount = 0;
    const mockProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          // Call read_memory with non-existent memoryId to trigger MEMORY_NOT_FOUND error
          return {
            ok: true,
            data: {
              text: "Calling read_memory tool",
              toolCalls: [
                {
                  id: "call-err-1",
                  name: "read_memory",
                  arguments: { memoryId: "non-existent-mem-id" }
                }
              ],
              model: { provider: "mock-provider", name: "qwen-2.5-coder" }
            }
          };
        }

        return {
          ok: true,
          data: {
            text: "Recovered from tool error to give answer.",
            model: { provider: "mock-provider", name: "qwen-2.5-coder" }
          }
        };
      }
    };

    const app = buildApp({ provider: mockProvider, observer });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    expect(response.statusCode).toBe(200);
    expect(observer.events).toHaveLength(3);

    const toolEvent = observer.events[1];
    expect(toolEvent).toBeDefined();
    expect(toolEvent?.event).toBe("agent.tool.completed");
    if (toolEvent && toolEvent.event === "agent.tool.completed") {
      expect(toolEvent.status).toBe("ERROR");
      if (toolEvent.status === "ERROR") {
        expect(toolEvent.errorCode).toBe("MEMORY_NOT_FOUND");
      }
      expect(toolEvent.step).toBe(1);
    }

    const completeEvent = observer.events[2];
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.event).toBe("agent.turn.completed");
    if (completeEvent && completeEvent.event === "agent.turn.completed") {
      expect(completeEvent.toolCount).toBe(1);
      expect(completeEvent.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("4. Missing provider emits started -> failed with AGENT_UNAVAILABLE and exactly one terminal event", async () => {
    const observer = new MemoryAgentObserver();

    const app = buildApp({ provider: undefined, observer });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    expect(response.statusCode).toBe(503);
    expect(observer.events).toHaveLength(2);

    const startEvent = observer.events[0];
    expect(startEvent).toBeDefined();
    expect(startEvent?.event).toBe("agent.turn.started");
    if (startEvent && startEvent.event === "agent.turn.started") {
      expect(startEvent.turnId).toBe(dummyRequest.turnId);
    }

    const failedEvent = observer.events[1];
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.event).toBe("agent.turn.failed");
    if (failedEvent && failedEvent.event === "agent.turn.failed") {
      expect(failedEvent.turnId).toBe(dummyRequest.turnId);
      expect(failedEvent.errorCode).toBe("AGENT_UNAVAILABLE");
      expect(failedEvent.retryable).toBe(true);
      expect(failedEvent.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("5. Malformed request does not emit started event", async () => {
    const observer = new MemoryAgentObserver();
    const app = buildApp({ observer });

    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: { invalid: "payload" }
    });

    expect(response.statusCode).toBe(400);
    expect(observer.events).toHaveLength(0);
  });

  it("6. Serialized captured events guarantee zero data leakage of sensitive content or stack trace", async () => {
    const observer = new MemoryAgentObserver();

    let callCount = 0;
    const mockProvider: LlmProvider = {
      async generate(): Promise<Result<LlmGenerateOutput>> {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            data: {
              text: "Tool execution step",
              toolCalls: [
                {
                  id: "call-2",
                  name: "search_memory",
                  arguments: { query: "secret memory query" }
                }
              ],
              model: { provider: "mock-provider", name: "qwen-2.5-coder" }
            }
          };
        }

        return {
          ok: true,
          data: {
            text: "Safe answer grounded in memory.",
            model: { provider: "mock-provider", name: "qwen-2.5-coder" }
          }
        };
      }
    };

    const app = buildApp({ provider: mockProvider, observer });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    expect(response.statusCode).toBe(200);

    // Serialize all observer events
    const serializedEvents = observer.events.map((e) => JSON.stringify(e)).join("\n");

    // Assert zero leakage of private content
    expect(serializedEvents).not.toContain(secretViewport);
    expect(serializedEvents).not.toContain(secretQuestion);
    expect(serializedEvents).not.toContain(secretMemory);
    expect(serializedEvents).not.toContain(secretSystemPrompt);
    expect(serializedEvents).not.toContain("SECRET_TOKEN_URL_123");
    expect(serializedEvents).not.toContain("secretApiKey");
    expect(serializedEvents).not.toContain("Top Secret Header");
    expect(serializedEvents).not.toContain("Private quote text");
    expect(serializedEvents).not.toContain("stack");

    // HTTP response body also has zero stack trace
    const responseJson = response.json();
    expect(JSON.stringify(responseJson)).not.toContain("stack");
  });
});
