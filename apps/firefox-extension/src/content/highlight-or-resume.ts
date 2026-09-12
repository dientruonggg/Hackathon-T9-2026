import type {
  AppErrorCode,
  HighlightOrResumeInput,
  HighlightOrResumeOutput,
  Result,
} from "@vlc/contracts";

type ResumeInput = HighlightOrResumeInput;

type ResumeEnvironment = {
  document: Document;
  locationHref: string;
  innerHeight: number;
  scrollTo(options: ScrollToOptions): void;
  setTimeout(handler: () => void, timeout: number): number;
};

const RESUME_SELECTORS = "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td,th,figcaption";

export function highlightOrResume(
  input: HighlightOrResumeInput,
): Promise<Result<HighlightOrResumeOutput>>;
export function highlightOrResume(input: unknown): Promise<Result<HighlightOrResumeOutput>>;
export async function highlightOrResume(input: unknown): Promise<Result<HighlightOrResumeOutput>> {
  return highlightOrResumeInEnvironment(input, {
    document,
    locationHref: window.location.href,
    innerHeight: window.innerHeight,
    scrollTo: window.scrollTo.bind(window),
    setTimeout: window.setTimeout.bind(window),
  });
}

export async function highlightOrResumeInEnvironment(
  input: unknown,
  environment: ResumeEnvironment,
): Promise<Result<HighlightOrResumeOutput>> {
  const parsed = parseResumeInput(input);
  if (!parsed.ok) return parsed;

  const currentUrl = canonicalize(environment.locationHref);
  if (!currentUrl || currentUrl !== canonicalize(parsed.data.expectedCanonicalUrl)) {
    return failure(
      "CONTEXT_STALE",
      "Trang hiện tại không còn khớp với dấu mốc đã lưu.",
      true,
    );
  }

  const candidates = Array.from(
    environment.document.querySelectorAll<HTMLElement>(RESUME_SELECTORS),
  );
  const quote = normalize(parsed.data.anchor.textQuote);
  const quoteTarget = quote
    ? candidates.find((element) => normalize(element.textContent ?? "").includes(quote))
    : undefined;

  if (quoteTarget) {
    revealElement(quoteTarget, environment);
    return success("TEXT_QUOTE", parsed.data.anchor.scrollRatio);
  }

  const heading = normalize(parsed.data.anchor.heading);
  const headingTarget = heading
    ? candidates.find(
        (element) => /^H[1-6]$/.test(element.tagName) && normalize(element.textContent ?? "") === heading,
      )
    : undefined;

  if (headingTarget) {
    revealElement(headingTarget, environment);
    return success("HEADING", parsed.data.anchor.scrollRatio);
  }

  if (Number.isFinite(parsed.data.anchor.scrollRatio)) {
    const scrollRatio = clamp(parsed.data.anchor.scrollRatio, 0, 1);
    const documentHeight = Math.max(
      environment.document.documentElement.scrollHeight,
      environment.document.body?.scrollHeight ?? 0,
    );
    const maximumScroll = Math.max(documentHeight - environment.innerHeight, 0);
    environment.scrollTo({ top: maximumScroll * scrollRatio, behavior: "smooth" });
    return success("SCROLL_RATIO", scrollRatio);
  }

  return {
    ok: true as const,
    data: { found: false, strategy: "NONE" as const },
  };
}

function parseResumeInput(input: unknown):
  | { ok: true; data: ResumeInput }
  | ReturnType<typeof failure> {
  if (!isRecord(input) || !isRecord(input.anchor)) {
    return failure("VALIDATION_ERROR", "Dấu mốc cần mở không hợp lệ.", false);
  }

  const { anchor } = input;
  if (
    typeof input.tabId !== "number" ||
    typeof input.expectedCanonicalUrl !== "string" ||
    typeof anchor.heading !== "string" ||
    typeof anchor.textQuote !== "string" ||
    typeof anchor.scrollRatio !== "number" ||
    typeof anchor.fingerprint !== "string"
  ) {
    return failure("VALIDATION_ERROR", "Dấu mốc thiếu URL hoặc anchor.", false);
  }

  return {
    ok: true,
    data: {
      tabId: input.tabId,
      expectedCanonicalUrl: input.expectedCanonicalUrl,
      anchor: {
        heading: anchor.heading,
        textQuote: anchor.textQuote,
        scrollRatio: anchor.scrollRatio,
        fingerprint: anchor.fingerprint,
      },
    },
  };
}

function revealElement(element: HTMLElement, environment: ResumeEnvironment): void {
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  const previousOutline = element.style.outline;
  const previousOutlineOffset = element.style.outlineOffset;
  const previousBackground = element.style.backgroundColor;
  element.style.outline = "3px solid #3157d5";
  element.style.outlineOffset = "4px";
  element.style.backgroundColor = "#e5eaff";

  environment.setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOutlineOffset;
    element.style.backgroundColor = previousBackground;
  }, 2500);
}

function canonicalize(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function success(strategy: "TEXT_QUOTE" | "HEADING" | "SCROLL_RATIO", scrollRatio: number) {
  return {
    ok: true as const,
    data: {
      found: true,
      strategy,
      appliedScrollRatio: clamp(scrollRatio, 0, 1),
    },
  };
}

function failure(code: AppErrorCode, message: string, retryable: boolean): Result<never> {
  return { ok: false as const, error: { code, message, retryable } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
