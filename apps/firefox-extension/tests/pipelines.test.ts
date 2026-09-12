import { describe, expect, it, vi } from "vitest";
import {
  AgentTurnRequestSchema,
  type AgentTurnResponse,
  type MemoryMarker,
  type MemorySummary,
  type ShortSession,
  type SourcePolicySettings,
  type ViewportContext,
} from "@vlc/contracts";
import type { Clock, IdGenerator, MemoryRepository } from "@vlc/memory";
import {
  buildAgentTurnRequest,
  runAskAgentPipeline,
} from "../src/pipeline/ask-agent-pipeline";
import {
  type ConfirmedMemoryCommandInput,
  executeConfirmedMemoryCommand,
  executeConfirmedMemoryWithRecapture,
} from "../src/pipeline/confirmed-memory-command";
import { runOpenSidebarPipeline } from "../src/pipeline/open-sidebar-pipeline";

const NOW = "2026-09-12T12:00:00.000Z";
const clock: Clock = { now: () => new Date(NOW) };
const idGenerator: IdGenerator = { createId: () => "generated-id" };
const settings: SourcePolicySettings = {
  allowedDomains: [],
  blockedDomains: [],
  updatedAt: NOW,
};

describe("runOpenSidebarPipeline", () => {
  it("stops before capture and memory when policy blocks the source", async () => {
    const capture = vi.fn();
    const searchMemory = vi.fn();
    const result = await runOpenSidebarPipeline(
      { tabId: 7, url: "https://youtube.com/watch?v=1" },
      {
        getPolicySettings: async () => ({ ok: true, data: settings }),
        checkPolicy: async () => ({
          ok: true,
          data: {
            decision: "BLOCK",
            sourceType: "VIDEO_PLATFORM",
            reasonCode: "VIDEO_NOT_SUPPORTED",
            safeUrl: "https://youtube.com/watch",
            hostname: "youtube.com",
            userMessage: "Không đọc video.",
          },
        }),
        capture,
        memoryRepository: fakeRepository({ searchMemory }),
        clock,
        idGenerator,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { session: { tabId: 7, status: "BLOCKED" } },
    });
    expect(capture).not.toHaveBeenCalled();
    expect(searchMemory).not.toHaveBeenCalled();
  });

  it("captures and recalls an existing marker without calling the model", async () => {
    const context = makeContext();
    const related = makeMemorySummary(context);
    const result = await runOpenSidebarPipeline(
      { tabId: 9, url: context.source.canonicalUrl, title: "Agent loops" },
      {
        getPolicySettings: async () => ({ ok: true, data: settings }),
        checkPolicy: async () => ({
          ok: true,
          data: {
            decision: "ALLOW",
            sourceType: "DOCUMENTATION",
            reasonCode: "SUPPORTED_HTML",
            safeUrl: context.source.safeUrl,
            hostname: context.source.hostname,
            userMessage: "Có thể đọc.",
          },
        }),
        capture: async () => ({ ok: true, data: context }),
        memoryRepository: fakeRepository({
          searchMemory: async () => ({ ok: true, data: [related] }),
        }),
        clock,
        idGenerator,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        session: {
          tabId: 9,
          status: "READY_WITH_MEMORY",
          relatedMemories: [{ id: "memory-1" }],
        },
      },
    });
  });
});

describe("ask pipeline", () => {
  it("builds a request accepted by the shared schema and omits browser tabId", () => {
    const request = buildAgentTurnRequest({
      turnId: "turn-1",
      question: "  Đoạn này nói gì?  ",
      session: makeSession(makeContext()),
      permissions: { allowWebSearch: false },
    });

    expect(AgentTurnRequestSchema.safeParse(request).success).toBe(true);
    expect(request.question).toBe("Đoạn này nói gì?");
    expect(request).not.toHaveProperty("tabId");
  });

  it("recaptures on every explicit ask and returns the API response", async () => {
    const context = makeContext();
    const capture = vi.fn(async () => ({ ok: true as const, data: context }));
    const requestAgentTurn = vi.fn(async (_request: ReturnType<typeof buildAgentTurnRequest>) => ({
      ok: true as const,
      data: makeAgentResponse(),
    }));
    const result = await runAskAgentPipeline(
      { question: "Giải thích agent loop", session: makeSession(context) },
      { capture, requestAgentTurn, clock, idGenerator },
    );

    expect(result).toMatchObject({ ok: true, data: { answer: "Agent loop gọi tool rồi quan sát kết quả." } });
    expect(capture).toHaveBeenCalledOnce();
    expect(requestAgentTurn).toHaveBeenCalledOnce();
  });

  it("replaces the session context with the latest captured viewport", async () => {
    const stale = makeContext("2026-09-12T11:58:00.000Z");
    const fresh = makeContext(NOW, "fresh-context");
    const session = makeSession(stale);
    const capture = vi.fn(async () => ({ ok: true as const, data: fresh }));
    const requestAgentTurn = vi.fn(async (_request: ReturnType<typeof buildAgentTurnRequest>) => ({
      ok: true as const,
      data: makeAgentResponse(),
    }));

    await runAskAgentPipeline(
      { question: "Tiếp tục", session },
      { capture, requestAgentTurn, clock, idGenerator },
    );

    expect(capture).toHaveBeenCalledWith({
      tabId: 11,
      expectedUrl: stale.source.canonicalUrl,
    });
    expect(session.context?.contextId).toBe("fresh-context");
    expect(requestAgentTurn.mock.calls[0]?.[0].context.contextId).toBe("fresh-context");
  });

  it("does not call the API when refreshing stale context fails", async () => {
    const requestAgentTurn = vi.fn();
    const result = await runAskAgentPipeline(
      {
        question: "Tiếp tục",
        session: makeSession(makeContext("2026-09-12T11:00:00.000Z")),
      },
      {
        capture: async () => ({
          ok: false,
          error: { code: "CONTEXT_STALE", message: "Tab đã đổi trang.", retryable: true },
        }),
        requestAgentTurn,
        clock,
        idGenerator,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONTEXT_STALE" } });
    expect(requestAgentTurn).not.toHaveBeenCalled();
  });
});

describe("executeConfirmedMemoryCommand", () => {
  it("refuses runtime input without literal user confirmation", async () => {
    const saveMarker = vi.fn();
    const invalid = {
      status: "UNDERSTOOD",
      session: makeSession(makeContext()),
      userConfirmed: false,
    } as unknown as ConfirmedMemoryCommandInput;

    const result = await executeConfirmedMemoryCommand(invalid, {
      memoryRepository: fakeRepository({ saveMarker }),
      clock,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(saveMarker).not.toHaveBeenCalled();
  });

  it("saves question and answer only after confirmation", async () => {
    const context = makeContext();
    const marker = makeMarker(context);
    const saveMarker = vi.fn(async () => ({ ok: true as const, data: marker }));
    const session = makeSession(context);
    session.messages = [
      { role: "user", content: "Agent loop là gì?" },
      { role: "assistant", content: "Một vòng lặp dùng tool." },
    ];

    const result = await executeConfirmedMemoryCommand(
      { status: "NOT_UNDERSTOOD", session, userConfirmed: true },
      { memoryRepository: fakeRepository({ saveMarker }), clock },
    );

    expect(result.ok).toBe(true);
    expect(saveMarker).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "NOT_UNDERSTOOD",
        question: "Agent loop là gì?",
        answerSummary: "Một vòng lặp dùng tool.",
        userConfirmed: true,
      }),
    );
  });

  it("recaptures latest viewport on scroll before saving marker", async () => {
    const initialContext = makeContext(NOW, "ctx-initial");
    initialContext.anchor.heading = "Top of page";
    initialContext.anchor.scrollRatio = 0.05;

    const scrolledContext = makeContext(NOW, "ctx-scrolled");
    scrolledContext.anchor.heading = "Deep Section";
    scrolledContext.anchor.scrollRatio = 0.85;

    const capture = vi.fn(async () => ({ ok: true as const, data: scrolledContext }));
    const saveMarker = vi.fn(async (input: any) => ({
      ok: true as const,
      data: { ...makeMarker(scrolledContext), anchor: input.anchor },
    }));

    const session = makeSession(initialContext);
    const result = await executeConfirmedMemoryWithRecapture(
      { status: "UNDERSTOOD", session, userConfirmed: true },
      { capture, memoryRepository: fakeRepository({ saveMarker }), clock },
    );

    expect(result.ok).toBe(true);
    expect(capture).toHaveBeenCalledWith({
      tabId: session.tabId,
      expectedUrl: initialContext.source.canonicalUrl,
    });
    expect(saveMarker).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: expect.objectContaining({
          heading: "Deep Section",
          scrollRatio: 0.85,
        }),
      }),
    );
    expect(session.context?.anchor.heading).toBe("Deep Section");
  });

  it("aborts save and returns error if recapture fails", async () => {
    const initialContext = makeContext();
    const capture = vi.fn(async () => ({
      ok: false as const,
      error: { code: "CONTEXT_STALE" as const, message: "Tab đã chuyển trang.", retryable: true },
    }));
    const saveMarker = vi.fn();

    const session = makeSession(initialContext);
    const result = await executeConfirmedMemoryWithRecapture(
      { status: "UNDERSTOOD", session, userConfirmed: true },
      { capture, memoryRepository: fakeRepository({ saveMarker }), clock },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONTEXT_STALE");
    expect(saveMarker).not.toHaveBeenCalled();
  });
});

function makeContext(capturedAt = NOW, contextId = "context-1"): ViewportContext {
  return {
    contextId,
    source: {
      canonicalUrl: "https://example.com/agent-loop",
      safeUrl: "https://example.com/agent-loop",
      hostname: "example.com",
      title: "Agent loops",
    },
    anchor: {
      heading: "Tool execution",
      textQuote: "The loop validates a tool call.",
      scrollRatio: 0.4,
      fingerprint: "sha256:test",
    },
    visibleText: "The loop validates a tool call and observes its result.",
    visibleCodeBlocks: [],
    capturedAt,
  };
}

function makeSession(context: ViewportContext): ShortSession {
  return {
    sessionId: "session-1",
    tabId: 11,
    status: "READY",
    policy: {
      decision: "ALLOW",
      sourceType: "DOCUMENTATION",
      reasonCode: "SUPPORTED_HTML",
      safeUrl: context.source.safeUrl,
      hostname: context.source.hostname,
      userMessage: "Có thể đọc.",
    },
    context,
    relatedMemories: [],
    messages: [],
  };
}

function makeMemorySummary(context: ViewportContext): MemorySummary {
  return {
    id: "memory-1",
    source: context.source,
    anchor: context.anchor,
    status: "NOT_UNDERSTOOD",
    updatedAt: NOW,
    revision: 1,
    matchScore: 1,
    matchReason: "EXACT_FINGERPRINT",
  };
}

function makeMarker(context: ViewportContext): MemoryMarker {
  return {
    schemaVersion: 1,
    id: "memory-1",
    source: context.source,
    anchor: context.anchor,
    status: "NOT_UNDERSTOOD",
    evidence: [{ kind: "USER_MARK", summary: "Đã lưu", createdAt: NOW }],
    createdAt: NOW,
    updatedAt: NOW,
    lastVisitedAt: NOW,
    revision: 1,
  };
}

function makeAgentResponse(): AgentTurnResponse {
  return {
    contractVersion: "0.1",
    turnId: "turn-1",
    answer: "Agent loop gọi tool rồi quan sát kết quả.",
    grounding: "VIEWPORT",
    groundingRefs: [{ kind: "VIEWPORT", refId: "context-1", label: "Tool execution" }],
    suggestedActions: [],
    toolTrace: [],
    model: { provider: "test", name: "test-model" },
  };
}

function fakeRepository(overrides: Partial<MemoryRepository> = {}): MemoryRepository {
  const missing = async () => ({
    ok: false as const,
    error: { code: "INTERNAL_ERROR" as const, message: "Not configured", retryable: false },
  });
  return {
    saveMarker: overrides.saveMarker ?? missing,
    searchMemory: overrides.searchMemory ?? (async () => ({ ok: true, data: [] })),
    readMemory: overrides.readMemory ?? missing,
    updateUnderstanding: overrides.updateUnderstanding ?? missing,
    forgetMemory: overrides.forgetMemory ?? missing,
    getSourcePolicySettings:
      overrides.getSourcePolicySettings ?? (async () => ({ ok: true, data: settings })),
    updateSourcePolicy: overrides.updateSourcePolicy ?? missing,
  };
}
