import { describe, expect, it, vi } from "vitest";
import { highlightOrResumeInEnvironment } from "../src/content/highlight-or-resume";

describe("highlightOrResumeInEnvironment", () => {
  it("prefers the saved text quote", async () => {
    const paragraph = fakeElement("P", "The agent validates the tool result.");
    const environment = fakeEnvironment([paragraph]);

    const result = await highlightOrResumeInEnvironment(resumeInput(), environment);

    expect(result).toMatchObject({
      ok: true,
      data: { found: true, strategy: "TEXT_QUOTE" },
    });
    expect(paragraph.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("falls back to heading when the quote changed", async () => {
    const heading = fakeElement("H2", "Tool execution");
    const environment = fakeEnvironment([heading]);

    const result = await highlightOrResumeInEnvironment(
      resumeInput({ textQuote: "Old paragraph", heading: "Tool execution" }),
      environment,
    );

    expect(result).toMatchObject({
      ok: true,
      data: { found: true, strategy: "HEADING" },
    });
  });

  it("falls back to scroll ratio when text and heading are gone", async () => {
    const environment = fakeEnvironment([]);

    const result = await highlightOrResumeInEnvironment(
      resumeInput({ textQuote: "Missing", heading: "Missing", scrollRatio: 0.5 }),
      environment,
    );

    expect(result).toMatchObject({
      ok: true,
      data: { found: true, strategy: "SCROLL_RATIO", appliedScrollRatio: 0.5 },
    });
    expect(environment.scrollTo).toHaveBeenCalledWith({ top: 700, behavior: "smooth" });
  });

  it("refuses to resume on a different page", async () => {
    const result = await highlightOrResumeInEnvironment(
      resumeInput(),
      fakeEnvironment([], "https://example.com/other"),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONTEXT_STALE" } });
  });
});

function resumeInput(
  overrides: Partial<{
    heading: string;
    textQuote: string;
    scrollRatio: number;
  }> = {},
) {
  return {
    tabId: 1,
    expectedCanonicalUrl: "https://example.com/guide",
    anchor: {
      heading: overrides.heading ?? "Tool execution",
      textQuote: overrides.textQuote ?? "validates the tool result",
      scrollRatio: overrides.scrollRatio ?? 0.4,
      fingerprint: "sha256:test",
    },
  };
}

function fakeEnvironment(elements: HTMLElement[], locationHref = "https://example.com/guide") {
  return {
    document: {
      querySelectorAll: () => elements,
      documentElement: { scrollHeight: 2000 },
      body: { scrollHeight: 2000 },
    } as unknown as Document,
    locationHref,
    innerHeight: 600,
    scrollTo: vi.fn(),
    setTimeout: vi.fn(() => 1),
  };
}

function fakeElement(tagName: string, textContent: string) {
  return {
    tagName,
    textContent,
    style: {
      outline: "",
      outlineOffset: "",
      backgroundColor: "",
    },
    scrollIntoView: vi.fn(),
  } as unknown as HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> };
}
