import { describe, expect, it } from "vitest";
import { captureViewportFromEnvironment } from "../src/content/capture-current-viewport";

type FakeElementOptions = {
  tagName?: string;
  text?: string;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
  display?: string;
  excluded?: boolean;
  insidePre?: boolean;
};

describe("captureViewportFromEnvironment", () => {
  it("captures visible text and excludes hidden or off-screen blocks", async () => {
    const visibleHeading = fakeElement({ tagName: "H2", text: "Agent loop", top: 20 });
    const visibleParagraph = fakeElement({ text: "A model chooses and executes a tool.", top: 70 });
    const hiddenParagraph = fakeElement({ text: "Hidden password", top: 100, display: "none" });
    const offscreenParagraph = fakeElement({ text: "Outside viewport", top: 900, bottom: 940 });
    const formParagraph = fakeElement({ text: "Form secret", top: 120, excluded: true });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide?utm_source=test#part" },
      fakeEnvironment([
        visibleHeading,
        visibleParagraph,
        hiddenParagraph,
        offscreenParagraph,
        formParagraph,
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.anchor.heading).toBe("Agent loop");
    expect(result.data.visibleText).toContain("A model chooses and executes a tool.");
    expect(result.data.visibleText).not.toMatch(/password|Outside viewport|Form secret/);
    expect(result.data.source.safeUrl).toBe("https://example.com/guide");
    expect(result.data.source.canonicalUrl).toBe("https://example.com/guide");
    expect(result.data.anchor.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("enforces text, code and anchor limits", async () => {
    const heading = fakeElement({ tagName: "H3", text: "Limits", top: 10 });
    const paragraph = fakeElement({ text: "x".repeat(5000), top: 50 });
    const code1 = fakeElement({ tagName: "PRE", text: "a".repeat(1500), top: 100 });
    const code2 = fakeElement({ tagName: "CODE", text: "second", top: 150 });
    const code3 = fakeElement({ tagName: "CODE", text: "third", top: 200 });
    const code4 = fakeElement({ tagName: "CODE", text: "fourth", top: 250 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/limits" },
      fakeEnvironment(
        [heading, paragraph, code1, code2, code3, code4],
        "https://example.com/limits",
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.visibleText.length).toBeLessThanOrEqual(4000);
    expect(result.data.anchor.textQuote.length).toBeLessThanOrEqual(240);
    expect(result.data.visibleCodeBlocks).toHaveLength(3);
    expect(result.data.visibleCodeBlocks[0]).toHaveLength(1000);
  });

  it("fails when the tab navigated after policy approval", async () => {
    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/first" },
      fakeEnvironment([fakeElement({ text: "Visible" })], "https://example.com/second"),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONTEXT_STALE" } });
  });
});

function fakeEnvironment(elements: HTMLElement[], locationHref = "https://example.com/guide") {
  const documentLike = {
    title: "Example guide",
    querySelectorAll: () => elements,
    documentElement: { scrollHeight: 2000 },
    body: { scrollHeight: 2000 },
  } as unknown as Document;

  return {
    document: documentLike,
    locationHref,
    innerWidth: 800,
    innerHeight: 600,
    scrollY: 300,
    getComputedStyle: (element: Element) =>
      ({
        display: (element as unknown as { fakeDisplay: string }).fakeDisplay,
        visibility: "visible",
        opacity: "1",
      }) as CSSStyleDeclaration,
    crypto,
  };
}

function fakeElement(options: FakeElementOptions): HTMLElement {
  const top = options.top ?? 20;
  const bottom = options.bottom ?? top + (options.height ?? 30);
  const element = {
    tagName: options.tagName ?? "P",
    textContent: options.text ?? "Visible paragraph",
    fakeDisplay: options.display ?? "block",
    closest: (selector: string) => {
      if (options.excluded && selector.includes("form")) return element;
      if (options.insidePre && selector === "pre") return element;
      return null;
    },
    getBoundingClientRect: () => ({
      top,
      bottom,
      left: 0,
      right: options.width ?? 400,
      width: options.width ?? 400,
      height: options.height ?? 30,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  };
  return element as unknown as HTMLElement;
}
