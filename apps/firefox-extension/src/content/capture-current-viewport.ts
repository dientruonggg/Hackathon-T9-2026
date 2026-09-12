import type {
  AppErrorCode,
  CaptureLimits,
  CaptureViewportInput,
  Result,
  ViewportContext,
} from "@vlc/contracts";

const DEFAULT_LIMITS = {
  maxTextChars: 4000,
  maxCodeBlocks: 3,
  maxCodeCharsPerBlock: 1000,
  maxAnchorQuoteChars: 240,
} as const;

const TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "pre",
  "code",
  "blockquote",
  "td",
  "th",
  "figcaption",
].join(",");

const EXCLUDED_CONTAINER_SELECTOR = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "form",
  "[aria-hidden='true']",
  "[hidden]",
].join(",");

type CaptureEnvironment = {
  document: Document;
  locationHref: string;
  innerWidth: number;
  innerHeight: number;
  scrollY: number;
  getComputedStyle(element: Element): CSSStyleDeclaration;
  crypto: Crypto;
};

type CaptureInput = CaptureViewportInput;

export function captureCurrentViewport(
  input: CaptureViewportInput,
): Promise<Result<ViewportContext>>;
export function captureCurrentViewport(input: unknown): Promise<Result<ViewportContext>>;
export async function captureCurrentViewport(input: unknown): Promise<Result<ViewportContext>> {
  const parsed = parseCaptureInput(input);
  if (!parsed.ok) return parsed;

  return captureViewportFromEnvironment(parsed.data, {
    document,
    locationHref: window.location.href,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    getComputedStyle: window.getComputedStyle.bind(window),
    crypto,
  });
}

export async function captureViewportFromEnvironment(
  input: CaptureViewportInput,
  environment: CaptureEnvironment,
): Promise<Result<ViewportContext>> {
  const currentUrl = parseHttpUrl(environment.locationHref);
  const expectedUrl = parseHttpUrl(input.expectedUrl);
  if (!currentUrl || !expectedUrl) {
    return failure("VALIDATION_ERROR", "Không thể xác định URL của tab hiện tại.", false);
  }

  const currentCanonicalUrl = toCanonicalUrl(currentUrl);
  if (currentCanonicalUrl !== toCanonicalUrl(expectedUrl)) {
    return failure(
      "CONTEXT_STALE",
      "Tab đã chuyển trang. Extension cần đọc lại viewport.",
      true,
    );
  }

  const limits = normalizeLimits(input.limits);
  const candidates = Array.from(
    environment.document.querySelectorAll<HTMLElement>(TEXT_SELECTOR),
  ).filter((element) => isReadableVisibleElement(element, environment));

  const visibleHeadings = candidates.filter((element) =>
    /^H[1-6]$/.test(element.tagName),
  );
  const heading =
    normalizeWhitespace(visibleHeadings[0]?.textContent ?? "") ||
    normalizeWhitespace(environment.document.title) ||
    "Đoạn đang đọc";

  const textParts: string[] = [];
  const codeBlocks: string[] = [];
  const seenText = new Set<string>();
  const seenCode = new Set<string>();
  let collectedTextLength = 0;

  for (const element of candidates) {
    const normalized = normalizeWhitespace(element.textContent ?? "");
    if (!normalized) continue;

    if (isCodeElement(element)) {
      const code = normalizeCode(element.textContent ?? "").slice(
        0,
        limits.maxCodeCharsPerBlock,
      );
      if (code && !seenCode.has(code) && codeBlocks.length < limits.maxCodeBlocks) {
        seenCode.add(code);
        codeBlocks.push(code);
      }
    }

    if (!seenText.has(normalized) && collectedTextLength < limits.maxTextChars) {
      seenText.add(normalized);
      textParts.push(normalized);
      collectedTextLength += normalized.length + (textParts.length > 1 ? 2 : 0);
    }
  }

  const visibleText = textParts.join("\n\n").slice(0, limits.maxTextChars).trim();
  if (!visibleText) {
    return failure(
      "NO_READABLE_CONTENT",
      "Không tìm thấy nội dung chữ đang hiển thị. Hãy cuộn tới đoạn cần hỏi.",
      true,
    );
  }

  const safeUrl = toSafeUrl(currentUrl);
  const textQuote = visibleText.slice(0, limits.maxAnchorQuoteChars);
  const scrollRatio = calculateScrollRatio(environment);
  const fingerprint = await hashFingerprint(
    `${currentCanonicalUrl}\n${heading}\n${textQuote}`,
    environment.crypto,
  );

  return {
    ok: true as const,
    data: {
      contextId: createId(environment.crypto),
      source: {
        canonicalUrl: currentCanonicalUrl,
        safeUrl,
        hostname: normalizeHostname(currentUrl.hostname),
        title: normalizeWhitespace(environment.document.title) || heading,
      },
      anchor: { heading, textQuote, scrollRatio, fingerprint },
      visibleText,
      visibleCodeBlocks: codeBlocks,
      capturedAt: new Date().toISOString(),
    },
  };
}

function parseCaptureInput(input: unknown):
  | { ok: true; data: CaptureInput }
  | ReturnType<typeof failure> {
  if (!isRecord(input)) {
    return failure("VALIDATION_ERROR", "Capture input không hợp lệ.", false);
  }

  if (
    typeof input.tabId !== "number" ||
    !Number.isInteger(input.tabId) ||
    typeof input.expectedUrl !== "string" ||
    !input.expectedUrl
  ) {
    return failure("VALIDATION_ERROR", "Capture input thiếu tabId hoặc URL.", false);
  }

  const limits = isRecord(input.limits) ? input.limits : undefined;
  return {
    ok: true,
    data: {
      tabId: input.tabId,
      expectedUrl: input.expectedUrl,
      ...(limits
        ? {
            limits: {
              maxTextChars: asPositiveInteger(limits.maxTextChars),
              maxCodeBlocks: asPositiveInteger(limits.maxCodeBlocks),
              maxCodeCharsPerBlock: asPositiveInteger(limits.maxCodeCharsPerBlock),
              maxAnchorQuoteChars: asPositiveInteger(limits.maxAnchorQuoteChars),
            },
          }
        : {}),
    } as unknown as CaptureViewportInput,
  };
}

function normalizeLimits(input: CaptureLimits | undefined) {
  return {
    maxTextChars: Math.min(input?.maxTextChars ?? DEFAULT_LIMITS.maxTextChars, 4000),
    maxCodeBlocks: Math.min(input?.maxCodeBlocks ?? DEFAULT_LIMITS.maxCodeBlocks, 3),
    maxCodeCharsPerBlock: Math.min(
      input?.maxCodeCharsPerBlock ?? DEFAULT_LIMITS.maxCodeCharsPerBlock,
      1000,
    ),
    maxAnchorQuoteChars: Math.min(
      input?.maxAnchorQuoteChars ?? DEFAULT_LIMITS.maxAnchorQuoteChars,
      240,
    ),
  };
}

function isReadableVisibleElement(
  element: HTMLElement,
  environment: CaptureEnvironment,
): boolean {
  if (element.closest(EXCLUDED_CONTAINER_SELECTOR)) return false;
  if (element.tagName === "CODE" && element.closest("pre")) return false;

  const style = environment.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity || "1") === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < environment.innerHeight &&
    rect.left < environment.innerWidth
  );
}

function isCodeElement(element: HTMLElement): boolean {
  return element.tagName === "PRE" || element.tagName === "CODE";
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCode(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function toCanonicalUrl(url: URL): string {
  const canonical = new URL(url.toString());
  canonical.hash = "";
  for (const key of [...canonical.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) {
      canonical.searchParams.delete(key);
    }
  }
  return canonical.toString();
}

function toSafeUrl(url: URL): string {
  const safe = new URL(url.toString());
  safe.hash = "";
  safe.search = "";
  return safe.toString();
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function calculateScrollRatio(environment: CaptureEnvironment): number {
  const documentHeight = Math.max(
    environment.document.documentElement.scrollHeight,
    environment.document.body?.scrollHeight ?? 0,
  );
  const maximumScroll = Math.max(documentHeight - environment.innerHeight, 0);
  if (maximumScroll === 0) return 0;
  return clamp(environment.scrollY / maximumScroll, 0, 1);
}

async function hashFingerprint(value: string, cryptoApi: Crypto): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await cryptoApi.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256:${hex}`;
}

function createId(cryptoApi: Crypto): string {
  return typeof cryptoApi.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : `ctx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function failure(code: AppErrorCode, message: string, retryable: boolean): Result<never> {
  return { ok: false as const, error: { code, message, retryable } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
