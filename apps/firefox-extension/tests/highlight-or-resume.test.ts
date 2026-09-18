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
    const matchingParagraph = fakeElement("P", "The agent validates the tool result.");
    const environment = fakeEnvironment(
      [matchingParagraph],
      "https://example.com/other",
      [fakeRoot([matchingParagraph])],
    );
    const result = await highlightOrResumeInEnvironment(
      resumeInput(),
      environment,
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONTEXT_STALE" } });
    expect(matchingParagraph.scrollIntoView).not.toHaveBeenCalled();
    expect(environment.scrollTo).not.toHaveBeenCalled();
  });

  it("highlights an article quote instead of an earlier matching menu quote", async () => {
    const menuParagraph = fakeElement("P", "The agent validates the tool result.");
    const articleParagraph = fakeElement("P", "The agent validates the tool result.");
    const environment = fakeEnvironment(
      [menuParagraph, articleParagraph],
      "https://example.com/guide",
      [fakeRoot([articleParagraph])],
    );

    const result = await highlightOrResumeInEnvironment(resumeInput(), environment);

    expect(result).toMatchObject({ ok: true, data: { strategy: "TEXT_QUOTE" } });
    expect(articleParagraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(menuParagraph.scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses an approximate ratio for an old menu-only marker without highlighting the menu", async () => {
    const menuHeading = fakeElement("H2", "JS Advanced");
    const articleHeading = fakeElement("H1", "Asynchronous Functions");
    const articleParagraph = fakeElement("P", "JavaScript async and await make promises easier.");
    const environment = fakeEnvironment(
      [menuHeading, articleHeading, articleParagraph],
      "https://example.com/guide",
      [fakeRoot([articleHeading, articleParagraph])],
    );

    const result = await highlightOrResumeInEnvironment(
      resumeInput({ heading: "JS Advanced", textQuote: "JS Advanced", scrollRatio: 0.4 }),
      environment,
    );

    expect(result).toMatchObject({ ok: true, data: { strategy: "SCROLL_RATIO" } });
    expect(menuHeading.scrollIntoView).not.toHaveBeenCalled();
    expect(environment.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: "smooth" });
  });

  it("uses the same visible article root as Capture when a CSS-hidden main comes first", async () => {
    const hiddenParagraph = fakeElement("P", "The agent validates the tool result.");
    const articleParagraph = fakeElement("P", "The agent validates the tool result.");
    const environment = fakeEnvironment(
      [hiddenParagraph, articleParagraph],
      "https://example.com/guide",
      [fakeRoot([hiddenParagraph], true)],
      [fakeRoot([articleParagraph])],
    );

    const result = await highlightOrResumeInEnvironment(resumeInput(), environment);

    expect(result).toMatchObject({ ok: true, data: { strategy: "TEXT_QUOTE" } });
    expect(articleParagraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(hiddenParagraph.scrollIntoView).not.toHaveBeenCalled();
  });

  it("resumes a saved quote in the second article under one main", async () => {
    const menuParagraph = fakeElement("P", "Menu prose");
    const firstParagraph = fakeElement("P", "First article prose");
    const secondParagraph = fakeElement("P", "The agent validates the tool result.");
    const firstArticle = fakeRoot([firstParagraph]);
    const secondArticle = fakeRoot([secondParagraph]);
    const main = fakeRoot(
      [menuParagraph, firstParagraph, secondParagraph],
      false,
      [firstArticle, secondArticle],
    );
    const environment = fakeEnvironment(
      [menuParagraph, firstParagraph, secondParagraph],
      "https://example.com/guide",
      [main],
      [firstArticle, secondArticle],
    );

    const result = await highlightOrResumeInEnvironment(resumeInput(), environment);

    expect(result).toMatchObject({ ok: true, data: { strategy: "TEXT_QUOTE" } });
    expect(secondParagraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(firstParagraph.scrollIntoView).not.toHaveBeenCalled();
    expect(menuParagraph.scrollIntoView).not.toHaveBeenCalled();
  });

  it("resumes a saved quote in the second standalone article", async () => {
    const firstParagraph = fakeElement("P", "First article prose");
    const secondParagraph = fakeElement("P", "The agent validates the tool result.");
    const environment = fakeEnvironment(
      [firstParagraph, secondParagraph],
      "https://example.com/guide",
      [],
      [fakeRoot([firstParagraph]), fakeRoot([secondParagraph])],
    );

    const result = await highlightOrResumeInEnvironment(resumeInput(), environment);

    expect(result).toMatchObject({ ok: true, data: { strategy: "TEXT_QUOTE" } });
    expect(secondParagraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(firstParagraph.scrollIntoView).not.toHaveBeenCalled();
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

function fakeEnvironment(
  elements: HTMLElement[],
  locationHref = "https://example.com/guide",
  primaryRoots: HTMLElement[] = [],
  articleRoots: HTMLElement[] = [],
) {
  return {
    document: {
      querySelectorAll: (selector: string) =>
        selector === "main,[role='main'],#main"
          ? primaryRoots
          : selector === "article"
            ? articleRoots
            : elements,
      documentElement: { scrollHeight: 2000 },
      body: { scrollHeight: 2000 },
    } as unknown as Document,
    locationHref,
    innerHeight: 600,
    getComputedStyle: (element: Element) => ({
      display: (element as unknown as { fakeDisplay?: string }).fakeDisplay ?? "block",
      visibility: "visible",
      opacity: "1",
    }) as CSSStyleDeclaration,
    scrollTo: vi.fn(),
    setTimeout: vi.fn(() => 1),
  };
}

function fakeRoot(children: HTMLElement[], hidden = false, nestedRoots: HTMLElement[] = []): HTMLElement {
  return {
    fakeDisplay: hidden ? "none" : "block",
    closest: () => null,
    querySelectorAll: () => children,
    contains: (node: Node) => children.includes(node as HTMLElement) ||
      nestedRoots.some((root) => root === node || root.contains(node)),
    getBoundingClientRect: () => ({ width: hidden ? 0 : 400, height: hidden ? 0 : 600 }),
  } as unknown as HTMLElement;
}

function fakeElement(tagName: string, textContent: string) {
  return {
    tagName,
    textContent,
    closest: () => null,
    style: {
      outline: "",
      outlineOffset: "",
      backgroundColor: "",
    },
    scrollIntoView: vi.fn(),
  } as unknown as HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> };
}
