import { describe, it, expect, vi } from "vitest";
import { createOpenAICompatibleProvider } from "../src/providers/openai-compatible-provider.js";
import OpenAI from "openai";

describe("Slice 5: Provider Error Mapping", () => {
  it("maps TimeoutError to AGENT_UNAVAILABLE with retryable: true", async () => {
    const mockClient = new OpenAI({ apiKey: "test-key" });
    vi.spyOn(mockClient.chat.completions, "create").mockRejectedValueOnce(
      new Error("Request timed out after 30000ms")
    );

    const provider = createOpenAICompatibleProvider({
      model: "test-model",
      client: mockClient
    });

    const result = await provider.generate({
      messages: [{ role: "user", content: "Hello" }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AGENT_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("maps regular API failure to MODEL_ERROR with retryable: false", async () => {
    const mockClient = new OpenAI({ apiKey: "test-key" });
    vi.spyOn(mockClient.chat.completions, "create").mockRejectedValueOnce(
      new Error("401 Unauthorized: Invalid API key")
    );

    const provider = createOpenAICompatibleProvider({
      model: "test-model",
      client: mockClient
    });

    const result = await provider.generate({
      messages: [{ role: "user", content: "Hello" }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
      expect(result.error.retryable).toBe(false);
    }
  });
});
