import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../src/agent/system-prompt.js";
import {
  createAgentToolRegistry,
  type TurnToolContext
} from "../src/agent/tool-registry.js";
import type { ViewportContext, MemorySummary } from "@vlc/contracts";

describe("Slice 2: System Prompt & Pure Tool Registry", () => {
  const dummyContext: ViewportContext = {
    contextId: "ctx-123",
    source: {
      canonicalUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      safeUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      hostname: "developer.mozilla.org",
      title: "JavaScript MDN"
    },
    anchor: {
      heading: "Closures",
      textQuote: "A closure is the combination of a function bundled together...",
      scrollRatio: 0.45,
      fingerprint: "sha256:abc12345"
    },
    visibleText: "A closure is the combination of a function bundled together with references to its surrounding state.",
    visibleCodeBlocks: ["function makeAdder(x) { return function(y) { return x + y; }; }"],
    capturedAt: new Date().toISOString()
  };

  const dummyMemories: MemorySummary[] = [
    {
      id: "mem-1",
      source: dummyContext.source,
      anchor: dummyContext.anchor,
      status: "NOT_UNDERSTOOD",
      note: "Chưa hiểu rõ lexical environment",
      question: "Closure lưu state ở đâu?",
      answerSummary: "Closure giữ tham chiếu tới lexical environment khi hàm được tạo.",
      updatedAt: new Date().toISOString(),
      revision: 1,
      matchScore: 0.95,
      matchReason: "EXACT_FINGERPRINT"
    },
    {
      id: "mem-2",
      source: dummyContext.source,
      anchor: {
        heading: "Scope chain",
        textQuote: "Scope is the current context of code...",
        scrollRatio: 0.2,
        fingerprint: "sha256:def67890"
      },
      status: "UNDERSTOOD",
      note: "Đã hiểu global scope vs function scope",
      updatedAt: new Date().toISOString(),
      revision: 1,
      matchScore: 0.7,
      matchReason: "SAME_PAGE_HEADING"
    }
  ];

  function makeTurnContext(allowWebSearch = false): TurnToolContext {
    return {
      turnId: "turn-test-1",
      context: dummyContext,
      relatedMemories: dummyMemories,
      permissions: { allowWebSearch }
    };
  }

  it("buildSystemPrompt contains core grounded principles", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Viewport Learning Companion");
    expect(prompt).toContain("get_viewport_context");
    expect(prompt).toContain("propose_marker");
    expect(prompt).toContain("sidebar");
    expect(prompt).toContain("INSUFFICIENT");
  });

  it("get_viewport_context returns current turn context", async () => {
    const registry = createAgentToolRegistry(makeTurnContext());
    const tool = registry.get("get_viewport_context");
    expect(tool).toBeDefined();

    const result = await tool!.execute({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(dummyContext);
    }
  });

  it("search_memory searches and filters preloaded memories", async () => {
    const registry = createAgentToolRegistry(makeTurnContext());
    const tool = registry.get("search_memory");
    expect(tool).toBeDefined();

    // Query matches "lexical" in mem-1 note
    const result1 = await tool!.execute({ query: "lexical" });
    expect(result1.ok).toBe(true);
    if (result1.ok) {
      const list = result1.data as MemorySummary[];
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe("mem-1");
    }

    // Status filter
    const result2 = await tool!.execute({ query: "scope", status: "UNDERSTOOD" });
    expect(result2.ok).toBe(true);
    if (result2.ok) {
      const list = result2.data as MemorySummary[];
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe("mem-2");
    }

    // General overview query ("đã học") matches all preloaded memories
    const result3 = await tool!.execute({ query: "đã học" });
    expect(result3.ok).toBe(true);
    if (result3.ok) {
      const list = result3.data as MemorySummary[];
      expect(list.length).toBe(2);
    }
  });

  it("read_memory retrieves preloaded memory or returns MEMORY_NOT_FOUND", async () => {
    const registry = createAgentToolRegistry(makeTurnContext());
    const tool = registry.get("read_memory");
    expect(tool).toBeDefined();

    // Known ID
    const resSuccess = await tool!.execute({ memoryId: "mem-1" });
    expect(resSuccess.ok).toBe(true);
    if (resSuccess.ok) {
      expect((resSuccess.data as MemorySummary).id).toBe("mem-1");
    }

    // Unknown ID outside preload set
    const resNotFound = await tool!.execute({ memoryId: "mem-unknown-999" });
    expect(resNotFound.ok).toBe(false);
    if (!resNotFound.ok) {
      expect(resNotFound.error.code).toBe("MEMORY_NOT_FOUND");
    }
  });

  it("can search and read a bounded marker from another website", async () => {
    const other: MemorySummary = {
      ...dummyMemories[0]!, id: "promise-other-site", matchReason: "CROSS_SITE",
      source: { canonicalUrl: "https://example.org/promise", safeUrl: "https://example.org/promise", hostname: "example.org", title: "Promise" },
      anchor: { ...dummyContext.anchor, heading: "Promise resolve reject" },
    };
    const registry = createAgentToolRegistry({ ...makeTurnContext(), relatedMemories: [...dummyMemories, other] });
    const all = await registry.get("search_memory")!.execute({ query: "all" });
    expect(all.ok).toBe(true);
    if (all.ok) expect((all.data as MemorySummary[]).map(item => item.id)).toContain(other.id);
    const read = await registry.get("read_memory")!.execute({ memoryId: other.id });
    expect(read.ok).toBe(true);
    if (read.ok) expect((read.data as MemorySummary).source.hostname).toBe("example.org");
    const missing = await registry.get("read_memory")!.execute({ memoryId: "not-preloaded" });
    expect(missing.ok).toBe(false);
  });

  it("propose_marker returns PendingUserAction proposal", async () => {
    const registry = createAgentToolRegistry(makeTurnContext());
    const tool = registry.get("propose_marker");
    expect(tool).toBeDefined();

    const result = await tool!.execute({
      status: "NOT_UNDERSTOOD",
      note: "Cần xem lại lexical scoping",
      reason: "Người học thắc mắc về scope"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const action = result.data as any;
      expect(action.type).toBe("CONFIRM_MARKER");
      expect(action.payload.status).toBe("NOT_UNDERSTOOD");
      expect(action.payload.note).toBe("Cần xem lại lexical scoping");
      expect(action.confirmationText).toContain("NOT_UNDERSTOOD");
    }
  });

  it("search_web respects allowWebSearch permission", async () => {
    // 1. When permission is false -> PERMISSION_DENIED
    const registryDenied = createAgentToolRegistry(makeTurnContext(false));
    const toolDenied = registryDenied.get("search_web");
    const resultDenied = await toolDenied!.execute({ query: "javascript closures" });
    expect(resultDenied.ok).toBe(false);
    if (!resultDenied.ok) {
      expect(resultDenied.error.code).toBe("PERMISSION_DENIED");
    }

    // 2. When permission is true with mock searcher
    const registryAllowed = createAgentToolRegistry(makeTurnContext(true), {
      webSearcher: async (query) => ({
        ok: true,
        data: {
          results: [{ title: "Search title", url: "https://example.com", snippet: `Found for ${query}` }]
        }
      })
    });
    const toolAllowed = registryAllowed.get("search_web");
    const resultAllowed = await toolAllowed!.execute({ query: "javascript closures" });
    expect(resultAllowed.ok).toBe(true);
    if (resultAllowed.ok) {
      const data = resultAllowed.data as any;
      expect(data.results[0].title).toBe("Search title");
    }
  });

  it("tools return VALIDATION_ERROR on invalid argument schema", async () => {
    const registry = createAgentToolRegistry(makeTurnContext());

    const readTool = registry.get("read_memory");
    const resBadArgs = await readTool!.execute({}); // missing memoryId
    expect(resBadArgs.ok).toBe(false);
    if (!resBadArgs.ok) {
      expect(resBadArgs.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
