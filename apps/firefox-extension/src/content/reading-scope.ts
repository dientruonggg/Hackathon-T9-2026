export const READING_TEXT_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,li,pre,code,blockquote,td,th,figcaption";

export const NON_READING_SELECTOR =
  "script,style,noscript,nav,aside,footer,form,[role='navigation'],[role='complementary'],[aria-hidden='true'],[hidden]";

const PRIMARY_ROOT_SELECTOR = "main,[role='main'],#main";

export type ReadingScope = {
  root: Document | HTMLElement;
  candidates: HTMLElement[];
  regions?: HTMLElement[];
};

export function getReadingScope(
  document: Document,
  selector = READING_TEXT_SELECTOR,
  acceptRoot: (root: HTMLElement) => boolean = () => true,
): ReadingScope {
  const primaryRoots = Array.from(document.querySelectorAll<HTMLElement>(PRIMARY_ROOT_SELECTOR));
  const articleRoots = Array.from(document.querySelectorAll<HTMLElement>("article"));
  const semanticRoots = [...primaryRoots, ...articleRoots];
  const roots = semanticRoots.filter((root) =>
    !root.closest(NON_READING_SELECTOR) && acceptRoot(root),
  );
  const usablePrimaries = primaryRoots.filter((root) => roots.includes(root));
  const usableArticles = articleRoots.filter((root) => roots.includes(root));
  const nestedArticles = usableArticles.filter((article) =>
    usablePrimaries.some((primary) => primary.contains(article)),
  );
  const standaloneArticles = usableArticles.filter((article) => !nestedArticles.includes(article));
  const regionScope = (regions: HTMLElement[], root: Document | HTMLElement): ReadingScope => ({
    root,
    regions,
    candidates: regions.flatMap((region) => collect(region, selector)),
  });
  const scoped: ReadingScope[] = [
    ...(nestedArticles.length > 0
      ? [regionScope(nestedArticles, usablePrimaries.length === 1 ? (usablePrimaries[0] ?? document) : document)]
      : []),
    ...(standaloneArticles.length > 0 ? [regionScope(standaloneArticles, document)] : []),
    ...(usablePrimaries.length > 0 ? [regionScope(usablePrimaries, document)] : []),
  ];
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
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.closest(NON_READING_SELECTOR),
  );
}

function isBodyText(element: HTMLElement): boolean {
  return ["P", "BLOCKQUOTE", "PRE"].includes(element.tagName);
}
