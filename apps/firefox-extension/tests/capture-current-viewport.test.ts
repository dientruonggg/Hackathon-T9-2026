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
  parent?: HTMLElement;
  overflowX?: string;
  overflowY?: string;
};

type FakeDocumentOptions = {
  primaryRoots?: HTMLElement[];
  articleRoots?: HTMLElement[];
  selectedElement?: HTMLElement;
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

  it("prioritizes selected text in anchor.textQuote and visibleText when user highlights text", async () => {
    const heading = fakeElement({ tagName: "H2", text: "Creating a Promise", top: 20 });
    const paragraph = fakeElement({ text: "A JavaScript Promise object contains both the producing code and calls to the consuming code.", top: 70 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment(
        [heading, paragraph],
        "https://example.com/guide",
        "both the producing code and calls",
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.anchor.textQuote).toBe("both the producing code and calls");
    expect(result.data.visibleText).toContain("[Đoạn được bôi đen]\nboth the producing code and calls");
    expect(result.data.visibleText).toContain("[Toàn bộ viewport]");
  });

  it("reads the article instead of an independently scrolling left menu", async () => {
    const menuHeading = fakeElement({ tagName: "H2", text: "JS Advanced", top: 20 });
    const menuItem = fakeElement({ tagName: "LI", text: "Async Promises", top: 60 });
    const articleHeading = fakeElement({ tagName: "H1", text: "Asynchronous Functions", top: 40 });
    const articleParagraph = fakeElement({ text: "JavaScript async and await make promises easier.", top: 100 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment(
        [menuHeading, menuItem, articleHeading, articleParagraph],
        "https://example.com/guide",
        "",
        { primaryRoots: [fakeRoot([articleHeading, articleParagraph])] },
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("Asynchronous Functions");
    expect(result.data.anchor.textQuote).toContain("async and await");
    expect(result.data.visibleText).not.toContain("JS Advanced");
    expect(result.data.visibleText).not.toContain("Async Promises");
  });

  it("skips a menu-only main root in favor of a separate article with prose", async () => {
    const menuItem = fakeElement({ tagName: "LI", text: "Menu topic", top: 30 });
    const heading = fakeElement({ tagName: "H1", text: "Article topic", top: 40 });
    const paragraph = fakeElement({ text: "Article explanation", top: 90 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([menuItem, heading, paragraph], "https://example.com/guide", "", {
        primaryRoots: [fakeRoot([menuItem])],
        articleRoots: [fakeRoot([heading, paragraph], "ARTICLE")],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("Article topic");
    expect(result.data.visibleText).not.toContain("Menu topic");
  });

  it("skips a CSS-hidden main root and captures the visible article", async () => {
    const hiddenParagraph = fakeElement({ text: "Hidden article", top: 40 });
    const heading = fakeElement({ tagName: "H1", text: "Visible article", top: 50 });
    const paragraph = fakeElement({ text: "Visible article explanation", top: 100 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([hiddenParagraph, heading, paragraph], "https://example.com/guide", "", {
        primaryRoots: [fakeRoot([hiddenParagraph], "MAIN", true)],
        articleRoots: [fakeRoot([heading, paragraph], "ARTICLE")],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("Visible article");
    expect(result.data.visibleText).not.toContain("Hidden article");
  });

  it("prefers a nested article over a generic menu within main", async () => {
    const menuHeading = fakeElement({ tagName: "H2", text: "Course menu", top: 20 });
    const menuParagraph = fakeElement({ text: "Menu prose", top: 60 });
    const articleHeading = fakeElement({ tagName: "H1", text: "Actual lesson", top: 30 });
    const articleParagraph = fakeElement({ text: "Lesson prose", top: 100 });
    const articleRoot = fakeRoot([articleHeading, articleParagraph], "ARTICLE");

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment(
        [menuHeading, menuParagraph, articleHeading, articleParagraph],
        "https://example.com/guide",
        "",
        {
          primaryRoots: [fakeRoot([menuHeading, menuParagraph, articleHeading, articleParagraph], "MAIN", false, [articleRoot])],
          articleRoots: [articleRoot],
        },
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("Actual lesson");
    expect(result.data.visibleText).not.toContain("Course menu");
    expect(result.data.visibleText).not.toContain("Menu prose");
  });

  it("reads the visible second article when the first article is above the viewport", async () => {
    const menu = fakeElement({ text: "Menu prose", top: 20 });
    const firstHeading = fakeElement({ tagName: "H1", text: "First lesson", top: -800, bottom: -770 });
    const firstParagraph = fakeElement({ text: "First article prose", top: -740, bottom: -700 });
    const secondHeading = fakeElement({ tagName: "H1", text: "Second lesson", top: 40 });
    const secondParagraph = fakeElement({ text: "Second article prose", top: 90 });
    const firstArticle = fakeRoot([firstHeading, firstParagraph], "ARTICLE");
    const secondArticle = fakeRoot([secondHeading, secondParagraph], "ARTICLE");
    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment(
        [menu, firstHeading, firstParagraph, secondHeading, secondParagraph],
        "https://example.com/guide",
        "",
        {
          primaryRoots: [fakeRoot([menu, firstHeading, firstParagraph, secondHeading, secondParagraph], "MAIN", false, [firstArticle, secondArticle])],
          articleRoots: [firstArticle, secondArticle],
        },
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.heading).toBe("Second lesson");
    expect(result.data.anchor.textQuote).toBe("Second article prose");
    expect(result.data.visibleText).not.toMatch(/Menu prose|First article prose/);
  });

  it("reads the visible second standalone article when there is no main", async () => {
    const first = fakeElement({ text: "First article prose", top: -200, bottom: -170 });
    const second = fakeElement({ text: "Second article prose", top: 80 });
    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([first, second], "https://example.com/guide", "", {
        articleRoots: [fakeRoot([first], "ARTICLE"), fakeRoot([second], "ARTICLE")],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visibleText).toContain("Second article prose");
    expect(result.data.visibleText).not.toContain("First article prose");
  });

  it("reads the visible second main when a page has two main regions", async () => {
    const first = fakeElement({ text: "First main prose", top: -200, bottom: -170 });
    const second = fakeElement({ text: "Second main prose", top: 80 });
    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([first, second], "https://example.com/guide", "", {
        primaryRoots: [fakeRoot([first]), fakeRoot([second])],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visibleText).toContain("Second main prose");
    expect(result.data.visibleText).not.toContain("First main prose");
  });

  it("ignores a selected menu phrase inside main but outside its articles", async () => {
    const menu = fakeElement({ text: "Menu prose", top: 20 });
    const heading = fakeElement({ tagName: "H1", text: "Actual lesson", top: 40 });
    const paragraph = fakeElement({ text: "Article prose", top: 90 });
    const article = fakeRoot([heading, paragraph], "ARTICLE");
    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([menu, heading, paragraph], "https://example.com/guide", "Menu prose", {
        primaryRoots: [fakeRoot([menu, heading, paragraph], "MAIN", false, [article])],
        articleRoots: [article],
        selectedElement: menu,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.textQuote).toBe("Article prose");
    expect(result.data.visibleText).not.toContain("Menu prose");
  });

  it("uses article prose for the quote when an in-article TOC appears first", async () => {
    const heading = fakeElement({ tagName: "H1", text: "Async Await", top: 20 });
    const tocItem = fakeElement({ tagName: "LI", text: "TOC: Async Promises", top: 60 });
    const paragraph = fakeElement({ text: "Await pauses inside an async function.", top: 100 });
    const elements = [heading, tocItem, paragraph];

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment(elements, "https://example.com/guide", "", {
        primaryRoots: [fakeRoot(elements)],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.textQuote).toBe("Await pauses inside an async function.");
  });

  it("excludes blocks fully clipped by an independent scroll container", async () => {
    const heading = fakeElement({ tagName: "H2", text: "Visible section", top: 20 });
    const visible = fakeElement({ text: "Visible explanation", top: 70 });
    const scrollPane = fakeElement({ tagName: "DIV", top: 200, bottom: 300, overflowY: "scroll" });
    const clipped = fakeElement({ text: "Clipped menu secret", top: 100, parent: scrollPane });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([heading, visible, clipped]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visibleText).toContain("Visible explanation");
    expect(result.data.visibleText).not.toContain("Clipped menu secret");
  });

  it("keeps a partly clipped block under the documented element-level visibility rule", async () => {
    const scrollPane = fakeElement({ tagName: "DIV", top: 100, bottom: 160, overflowY: "auto" });
    const paragraph = fakeElement({ text: "Partly visible paragraph", top: 90, bottom: 210, parent: scrollPane });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([paragraph]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.visibleText).toContain("Partly visible paragraph");
  });

  it("ignores a selected menu phrase outside the article root", async () => {
    const menuItem = fakeElement({ tagName: "LI", text: "JS Advanced", top: 20 });
    const heading = fakeElement({ tagName: "H1", text: "Asynchronous Functions", top: 30 });
    const paragraph = fakeElement({ text: "Article async explanation", top: 80 });

    const result = await captureViewportFromEnvironment(
      { tabId: 1, expectedUrl: "https://example.com/guide" },
      fakeEnvironment([menuItem, heading, paragraph], "https://example.com/guide", "JS Advanced", {
        primaryRoots: [fakeRoot([heading, paragraph])],
        selectedElement: menuItem,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.anchor.textQuote).toBe("Article async explanation");
    expect(result.data.visibleText).not.toContain("JS Advanced");
  });
});

function fakeEnvironment(
  elements: HTMLElement[],
  locationHref = "https://example.com/guide",
  selectedText = "",
  options: FakeDocumentOptions = {},
) {
  const primaryRoots = options.primaryRoots ?? [];
  const articleRoots = options.articleRoots ?? [];
  const documentLike = {
    title: "Example guide",
    querySelectorAll: (selector: string) =>
      selector === "main,[role='main'],#main"
        ? primaryRoots
        : selector === "article"
          ? articleRoots
          : elements,
    contains: (node: Node) => elements.includes(node as HTMLElement),
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
        overflowX: (element as unknown as { fakeOverflowX?: string }).fakeOverflowX ?? "visible",
        overflowY: (element as unknown as { fakeOverflowY?: string }).fakeOverflowY ?? "visible",
      }) as CSSStyleDeclaration,
    crypto,
    getSelection: () =>
      selectedText
        ? ({
            toString: () => selectedText,
            rangeCount: 1,
            getRangeAt: () => ({
              commonAncestorContainer: options.selectedElement ?? elements.find((element) => element.tagName === "P") ?? elements[0],
            }),
          } as unknown as Selection)
        : null,
  };
}

function fakeRoot(
  children: HTMLElement[],
  tagName = "MAIN",
  hidden = false,
  nestedRoots: HTMLElement[] = [],
): HTMLElement {
  return {
    tagName,
    fakeDisplay: hidden ? "none" : "block",
    closest: () => null,
    querySelectorAll: () => children,
    contains: (node: Node) =>
      [...children, ...nestedRoots].some((child) => child === node || child.contains(node)),
    getBoundingClientRect: () => ({ width: hidden ? 0 : 400, height: hidden ? 0 : 600 }),
  } as unknown as HTMLElement;
}

function fakeElement(options: FakeElementOptions): HTMLElement {
  const top = options.top ?? 20;
  const bottom = options.bottom ?? top + (options.height ?? 30);
  const element = {
    tagName: options.tagName ?? "P",
    nodeType: 1,
    textContent: options.text ?? "Visible paragraph",
    fakeDisplay: options.display ?? "block",
    fakeOverflowX: options.overflowX ?? "visible",
    fakeOverflowY: options.overflowY ?? "visible",
    parentElement: options.parent ?? null,
    contains: (node: Node): boolean => node === (element as unknown as Node),
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
