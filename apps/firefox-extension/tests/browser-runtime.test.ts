import { describe, expect, it, vi } from "vitest";
import type { CaptureViewportInput, ViewportContext } from "@vlc/contracts";
import { ensureContentScriptOnTab, type TabsLike } from "../src/background/index";
import { captureTabViewport, getActiveTab, resumeTabAtMarker } from "../src/services/browser-runtime";

const fakeContext: ViewportContext = {
  contextId: "ctx-1",
  source: {
    canonicalUrl: "https://www.w3schools.com/html/html_intro.asp",
    safeUrl: "https://www.w3schools.com/html/html_intro.asp",
    hostname: "www.w3schools.com",
    title: "HTML Introduction",
  },
  anchor: {
    heading: "HTML Introduction",
    textQuote: "HTML is the standard markup language for Web pages.",
    scrollRatio: 0.1,
    fingerprint: "sha256:abcd1234abcd1234",
  },
  visibleText: "HTML is the standard markup language for Web pages.",
  visibleCodeBlocks: [],
  capturedAt: "2026-09-12T12:00:00.000Z",
};

describe("ensureContentScriptOnTab", () => {
  it("returns injected=false immediately if content script already responds to ping", async () => {
    const tabs: TabsLike = {
      sendMessage: vi.fn(async () => ({ ok: true, pong: true })),
      executeScript: vi.fn(),
    };

    const result = await ensureContentScriptOnTab(10, tabs);

    expect(result).toEqual({ ok: true, injected: false });
    expect(tabs.sendMessage).toHaveBeenCalledWith(10, { type: "PING_CONTENT_SCRIPT" });
    expect(tabs.executeScript).not.toHaveBeenCalled();
  });

  it("injects script and retries ping if first ping fails", async () => {
    let pingCount = 0;
    const tabs: TabsLike = {
      sendMessage: vi.fn(async () => {
        pingCount++;
        if (pingCount === 1) throw new Error("Could not establish connection.");
        return { ok: true, pong: true };
      }),
      executeScript: vi.fn(async () => undefined),
    };

    const result = await ensureContentScriptOnTab(10, tabs);

    expect(result).toEqual({ ok: true, injected: true });
    expect(tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(tabs.executeScript).toHaveBeenCalledWith(10, { file: "src/content/index.js" });
  });

  it("returns INJECTION_FAILED if executeScript fails", async () => {
    const tabs: TabsLike = {
      sendMessage: vi.fn(async () => {
        throw new Error("Could not establish connection.");
      }),
      executeScript: vi.fn(async () => {
        throw new Error("Missing host permission for that domain");
      }),
    };

    const result = await ensureContentScriptOnTab(10, tabs);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INJECTION_FAILED");
    expect(result.error.message).toContain("Missing host permission");
  });

  it("returns CONTENT_SCRIPT_UNAVAILABLE if retry ping also fails after injection", async () => {
    const tabs: TabsLike = {
      sendMessage: vi.fn(async () => {
        throw new Error("Receiving end does not exist.");
      }),
      executeScript: vi.fn(async () => undefined),
    };

    const result = await ensureContentScriptOnTab(10, tabs);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
  });
});

describe("captureTabViewport with Handshake", () => {
  const input: CaptureViewportInput = {
    tabId: 10,
    expectedUrl: "https://www.w3schools.com/html/html_intro.asp",
  };

  it("returns context directly if initial send succeeds", async () => {
    const sendTab = vi.fn(async () => ({ ok: true, data: fakeContext }));
    const sendRuntime = vi.fn();

    const result = await captureTabViewport(input, {
      sendTabMessage: sendTab,
      sendRuntimeMessage: sendRuntime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("HTML Introduction");
    expect(sendRuntime).not.toHaveBeenCalled();
  });

  it("recovers via ENSURE_CONTENT_SCRIPT handshake when initial send fails", async () => {
    let sendCount = 0;
    const sendTab = vi.fn(async () => {
      sendCount++;
      if (sendCount === 1) throw new Error("Could not establish connection.");
      return { ok: true, data: fakeContext };
    });
    const sendRuntime = vi.fn(async (msg: unknown) => {
      const m = msg as { type?: string };
      if (m.type === "ENSURE_CONTENT_SCRIPT") return { ok: true, injected: true };
      return undefined;
    });

    const result = await captureTabViewport(input, {
      sendTabMessage: sendTab,
      sendRuntimeMessage: sendRuntime,
    });

    expect(result.ok).toBe(true);
    expect(sendRuntime).toHaveBeenCalledWith({
      type: "ENSURE_CONTENT_SCRIPT",
      tabId: 10,
    });
    expect(sendTab).toHaveBeenCalledTimes(2);
  });

  it("returns clear PERMISSION_DENIED error if handshake injection fails", async () => {
    const sendTab = vi.fn(async () => {
      throw new Error("Could not establish connection.");
    });
    const sendRuntime = vi.fn(async () => ({
      ok: false,
      error: {
        code: "INJECTION_FAILED",
        message: "Không thể nạp script vào trang: Missing host permission",
        retryable: false,
      },
    }));

    const result = await captureTabViewport(input, {
      sendTabMessage: sendTab,
      sendRuntimeMessage: sendRuntime,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PERMISSION_DENIED");
    expect(result.error.message).toContain("Missing host permission");
  });

  it("returns error if retry send fails after successful injection", async () => {
    let sendCount = 0;
    const sendTab = vi.fn(async () => {
      sendCount++;
      throw new Error("Timed out waiting for response");
    });
    const sendRuntime = vi.fn(async () => ({ ok: true, injected: true }));

    const result = await captureTabViewport(input, {
      sendTabMessage: sendTab,
      sendRuntimeMessage: sendRuntime,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PERMISSION_DENIED");
    expect(result.error.message).toContain("Không thể đọc trang sau khi nạp script");
  });
});

describe("getActiveTab and resumeTabAtMarker with services", () => {
  it("returns active tab info", async () => {
    const sendRuntime = vi.fn(async () => ({ id: 5, url: "https://example.com", title: "Example" }));
    const result = await getActiveTab({ sendRuntimeMessage: sendRuntime });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(5);
    expect(result.data.url).toBe("https://example.com");
  });

  it("resumes tab at marker", async () => {
    const sendTab = vi.fn(async () => ({
      ok: true,
      data: { found: true, strategy: "TEXT_QUOTE" },
    }));

    const result = await resumeTabAtMarker(
      {
        tabId: 5,
        expectedCanonicalUrl: "https://example.com",
        anchor: fakeContext.anchor,
      },
      { sendTabMessage: sendTab },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.found).toBe(true);
    expect(result.data.strategy).toBe("TEXT_QUOTE");
  });
});
