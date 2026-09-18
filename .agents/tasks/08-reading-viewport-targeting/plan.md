> No open questions — debate is synthesized in `research/debate-synthesis.md`; this plan is cook-ready.

## Execution amendment after independent review

The single-nested-article helper shown below was superseded during review. It could select an offscreen first article and return no readable content while a second article in the same `main` was visible. The approved correction groups **all** usable nested `article` regions, then standalone sibling articles, then primary roots. Capture's viewport filter chooses visible candidates within the selected group; Resume searches all candidates in that group regardless of current scroll position. Generic menu prose inside a `main` containing articles is excluded. Selection is accepted only inside a chosen article region. Regression tests cover multiple nested articles, multiple standalone articles, multiple main roots, Resume into a second article, and menu selection inside `main`. This amendment overrides Step 1's single-root code example and Step 2's two-argument selection helper; the scope contract and verification commands are unchanged.

# Plan: target the reading article

Gate G2: [AUTO: DELEGATED] The user expressly requested `$prep` and `$cook` in one pass. This gate applies only to the scope below.

## Scope contract

| Allowed | Forbidden |
|---|---|
| `apps/firefox-extension/src/content/reading-scope.ts` | `.firefox-demo-profile/**`, `.env*`, `dist/**` edits |
| `apps/firefox-extension/src/content/capture-current-viewport.ts` | `package.json`, lockfile, manifest, API, memory schema |
| `apps/firefox-extension/src/content/highlight-or-resume.ts` | Unrelated source, existing task 07 artifacts |
| `apps/firefox-extension/tests/capture-current-viewport.test.ts` and `highlight-or-resume.test.ts` | User markers and browsing data |
| `.agents/tasks/08-reading-viewport-targeting/**` | External publication |

## Slice 1 — Shared reading scope and capture

**Depends on**: baseline tests. **Blocks**: Slice 2.

### Step 1: Add `reading-scope.ts`

Create this complete shared helper. Root choice is independent of viewport scroll and shared by Capture and Resume. Prefer a nested article over its enclosing main. Skip CSS-hidden or zero-sized roots in both paths.

```ts
export const READING_TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,pre,code,blockquote,td,th,figcaption";
export const NON_READING_SELECTOR = "script,style,noscript,nav,aside,footer,form,[role='navigation'],[role='complementary'],[aria-hidden='true'],[hidden]";
const PRIMARY_ROOT_SELECTOR = "main,[role='main'],#main";

export type ReadingScope = {
  root: Document | HTMLElement;
  candidates: HTMLElement[];
};

export function getReadingScope(
  document: Document,
  selector = READING_TEXT_SELECTOR,
  acceptRoot: (root: HTMLElement) => boolean = () => true,
): ReadingScope {
  const primaryRoots = Array.from(document.querySelectorAll<HTMLElement>(PRIMARY_ROOT_SELECTOR));
  const articleRoots = Array.from(document.querySelectorAll<HTMLElement>("article"));
  const nestedArticles = articleRoots.filter((article) =>
    primaryRoots.some((primary) => primary.contains(article)),
  );
  const semanticRoots = [...nestedArticles, ...primaryRoots, ...articleRoots];
  const roots = semanticRoots.filter((root) =>
    !root.closest(NON_READING_SELECTOR) && acceptRoot(root),
  );

  const scoped = roots.map((root) => ({ root, candidates: collect(root, selector) }));
  const withBody = scoped.find(({ candidates }) => candidates.some(isBodyText));
  if (withBody) return withBody;

  const withContent = scoped.find(({ candidates }) => candidates.length > 0);
  if (withContent) return withContent;

  if (semanticRoots.length > 0 && roots.length === 0) {
    return { root: document, candidates: [] };
  }
  return { root: document, candidates: collect(document, selector) };
}

export function isUsableReadingRoot(
  root: HTMLElement,
  getComputedStyle: (element: Element) => CSSStyleDeclaration,
): boolean {
  const style = getComputedStyle(root);
  const rect = root.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" &&
    Number.parseFloat(style.opacity || "1") !== 0 && rect.width > 0 && rect.height > 0;
}

function collect(root: Document | HTMLElement, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((element) => !element.closest(NON_READING_SELECTOR));
}

function isBodyText(element: HTMLElement): boolean {
  return ["P", "BLOCKQUOTE", "PRE"].includes(element.tagName);
}
```

### Step 2: Edit `capture-current-viewport.ts`

Remove the local text/exclusion selectors. Import `getReadingScope`, `isUsableReadingRoot`, and `NON_READING_SELECTOR`. Retain the `CODE`-inside-`PRE` dedupe. Replace the old document query with:

```ts
const readingScope = getReadingScope(
  environment.document,
  undefined,
  (root) => isUsableReadingRoot(root, environment.getComputedStyle),
);
const { root } = readingScope;
const candidates = readingScope.candidates.filter((element) =>
  isReadableVisibleElement(element, environment),
);
```

Replace the old `rawSelection`, `selectedText`, and `textQuote` block with:

```ts
const selectedText = selectedTextWithinScope(environment.getSelection?.() ?? null, root);
const quoteSource = candidates.find((element) =>
  ["P", "BLOCKQUOTE"].includes(element.tagName)
  && normalizeWhitespace(element.textContent ?? ""),
) ?? candidates.find((element) =>
  !/^H[1-6]$/.test(element.tagName)
  && !isCodeElement(element)
  && normalizeWhitespace(element.textContent ?? ""),
);
const textQuote = (selectedText || normalizeWhitespace(quoteSource?.textContent ?? "") || visibleText)
  .slice(0, limits.maxAnchorQuoteChars);
```

Replace `isReadableVisibleElement` with this complete function:

```ts
function isReadableVisibleElement(
  element: HTMLElement,
  environment: CaptureEnvironment,
): boolean {
  if (element.tagName === "CODE" && element.closest("pre")) return false;

  const style = environment.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  let left = Math.max(rect.left, 0);
  let right = Math.min(rect.right, environment.innerWidth);
  let top = Math.max(rect.top, 0);
  let bottom = Math.min(rect.bottom, environment.innerHeight);
  if (right <= left || bottom <= top) return false;

  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const parentStyle = environment.getComputedStyle(parent);
    if (!/(auto|scroll|hidden|clip)/.test(`${parentStyle.overflowX} ${parentStyle.overflowY}`)) continue;
    const parentRect = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowX || "")) {
      left = Math.max(left, parentRect.left);
      right = Math.min(right, parentRect.right);
    }
    if (/(auto|scroll|hidden|clip)/.test(parentStyle.overflowY || "")) {
      top = Math.max(top, parentRect.top);
      bottom = Math.min(bottom, parentRect.bottom);
    }
    if (right <= left || bottom <= top) return false;
  }
  return true;
}
```

Add this complete helper near `normalizeWhitespace`:

```ts
function selectedTextWithinScope(
  selection: Selection | null,
  root: Document | HTMLElement,
): string {
  if (!selection?.rangeCount || typeof selection.getRangeAt !== "function") return "";
  const container = selection.getRangeAt(0).commonAncestorContainer;
  const element = container.nodeType === 1 ? container as Element : container.parentElement;
  if (!element || !root.contains(container) || element.closest(NON_READING_SELECTOR)) return "";
  return normalizeWhitespace(selection.toString()).slice(0, 1000);
}
```

### Step 3: Add capture regression tests

Make the fake document selector-aware. Old `querySelectorAll: () => elements` becomes:

```ts
querySelectorAll: (selector: string) => selector === "main,[role='main'],#main"
  ? primaryRoots
  : selector === "article" ? articleRoots : elements,
```

Extend `fakeEnvironment` with optional `primaryRoots` and `articleRoots`, both defaulting to `[]`. A fake root exposes `querySelectorAll`, `closest`, and `contains`; a fake child exposes `parentElement`, `nodeType: 1`, and `closest`. Return `overflowX`/`overflowY` from `getComputedStyle`, defaulting to `visible`. Update the existing selection fixture to expose `rangeCount: 1` and `getRangeAt` with the selected paragraph as `commonAncestorContainer`.

Add this W3Schools-style assertion case after supplying sidebar H2/LI before article H1/P and `#main` as the primary root:

```ts
expect(result.data.anchor.heading).toBe("Asynchronous Functions");
expect(result.data.anchor.textQuote).toContain("async and await");
expect(result.data.visibleText).not.toContain("JS Advanced");
expect(result.data.visibleText).not.toContain("Async Promises");
```

Add a menu-only primary root plus separate article root: expect article prose. Add a CSS-hidden first root plus visible article, and a nested article after generic menu prose. Add an in-article `LI` table of contents before `P`: expect the paragraph quote. Add a fully clipped overflow ancestor: child paragraph rect intersects window but not the ancestor; expect it absent. A partly clipped paragraph remains included; assert this documented block-level limit. Add selection-in-menu test: it must not override the article quote. Preserve simple-page and stale-URL tests.

### Verify

```bash
npm test --workspace @vlc/firefox-extension
```

Expected: all extension tests pass, including new regressions. Inspect this slice's named-file diff.

### Rollback

Revert only Slice 1's named source/test edits with an inverse patch; preserve user changes and all profile data.

## Slice 2 — Resume within the same reading scope

**Depends on**: Slice 1. **Blocks**: final verification.

### Step 1: Edit `highlight-or-resume.ts`

Import `getReadingScope` and `isUsableReadingRoot`. Add `getComputedStyle` to the Resume environment using `window.getComputedStyle.bind(window)`. Replace the old document query with the exact code below. Keep URL validation, highlight, and ratio fallback unchanged. A legacy menu-only marker may use approximate document ratio but must not highlight the menu.

```ts
const candidates = getReadingScope(
  environment.document,
  RESUME_SELECTORS,
  (root) => isUsableReadingRoot(root, environment.getComputedStyle),
).candidates;
```

### Step 2: Add resume regression tests

Make the fake document selector-aware as in Slice 1. A fake root supplies `querySelectorAll`, `closest`, and `contains`. For a duplicate quote in menu and article, assert:

```ts
expect(articleParagraph.scrollIntoView).toHaveBeenCalledOnce();
expect(menuParagraph.scrollIntoView).not.toHaveBeenCalled();
expect(result).toMatchObject({ ok: true, data: { strategy: "TEXT_QUOTE" } });
```

For a menu-only old anchor, assert `SCROLL_RATIO`, no menu highlight, and expected `scrollTo`. Add a CSS-hidden first root with a duplicate quote: assert the visible article receives the highlight. For stale URL with a matching article paragraph, assert `CONTEXT_STALE`, zero `scrollIntoView`, and zero `scrollTo` calls. Keep existing simple-page quote/heading/ratio tests.

### Verify

```bash
npm test --workspace @vlc/firefox-extension
npm run typecheck --workspace @vlc/firefox-extension
npm run build --workspace @vlc/firefox-extension
```

Expected: exit 0 for each. Inspect `git diff --check` and the Slice 2 named-file diff.

### Rollback

Revert only Slice 2's named source/test edits with an inverse patch.

## Final verification matrix

| Behavior | Verifier | Expected evidence |
|---|---|---|
| Competing menu/article headings | Capture test | Article heading and paragraph quote |
| Separate scroll pane clipping | Capture test | Fully clipped element absent |
| TOC and menu selection | Capture tests | Article paragraph quote retained |
| Multiple nested articles | Capture and Resume tests | Visible second article captured; saved second-article quote resumed; menu prose excluded |
| Resume scope and stale URL | Resume tests | Article match or approximate ratio; no menu match; stale URL no action |
| Extension and cross-package regression | `npm run verify` | Test, typecheck, build, lint all exit 0 |
| Firefox UI | Isolated `web-ext` temporary profile plus BiDi if controllable | Record URL, pane/window scrolls, captured heading/quote, target article element; else mark unverified |

For live UI, do **not** run `npm run demo:firefox`: it uses the user's `.firefox-demo-profile` and keeps profile changes. The equivalent build and `web-ext run` omit `--firefox-profile` and `--keep-profile-changes`. Do not install software or touch the user's open Firefox instance.

## Acceptance criteria

- [x] Article heading and paragraph quote win over the W3Schools-style sidebar.
- [x] Fully clipped independent-scroll text is excluded.
- [x] Resume targets article text and avoids old menu-only matches.
- [x] `npm run verify` passes.
- [x] Isolated Firefox UI was tested safely.
