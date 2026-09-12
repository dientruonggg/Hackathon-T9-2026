import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { LlmProvider, LlmGenerateOutput } from "../src/providers/llm-provider.js";
import type { AgentTurnRequest, ViewportContext, Result } from "@vlc/contracts";

describe("Slice 5: Safe Logging & Data Sanitization", () => {
  const secretViewport = "CONFIDENTIAL_VIEWPORT_DATA_SECRET_12345";
  const secretQuestion = "MY_PRIVATE_QUESTION_ABOUT_SECRET_TAX";

  const dummyContext: ViewportContext = {
    contextId: "ctx-log-test",
    source: {
      canonicalUrl: "https://example.com/sensitive",
      safeUrl: "https://example.com/sensitive",
      hostname: "example.com",
      title: "Sensitive Doc"
    },
    anchor: {
      heading: "Top Secret",
      textQuote: "Private quote",
      scrollRatio: 0.5,
      fingerprint: "sha256:logtest"
    },
    visibleText: secretViewport,
    visibleCodeBlocks: [],
    capturedAt: new Date().toISOString()
  };

  const dummyRequest: AgentTurnRequest = {
    contractVersion: "0.1",
    turnId: "turn-log-123",
    question: secretQuestion,
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
          text: "Safe answer without leaking raw data.",
          model: { provider: "fake-provider", name: "test-model" }
        }
      };
    }
  };

  it("does not log raw viewport text, question or secrets to console", async () => {
    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];

    const stdoutSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      stdoutLogs.push(args.join(" "));
    });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      stderrLogs.push(args.join(" "));
    });

    const app = buildApp({ provider: fakeProvider });
    const response = await app.inject({
      method: "POST",
      url: "/v1/agent/turn",
      payload: dummyRequest
    });

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();

    expect(response.statusCode).toBe(200);

    const allLogs = [...stdoutLogs, ...stderrLogs].join(" ");
    expect(allLogs).not.toContain(secretViewport);
    expect(allLogs).not.toContain(secretQuestion);
  });
});
