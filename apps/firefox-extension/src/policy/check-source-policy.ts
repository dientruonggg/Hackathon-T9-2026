type PolicySettings = {
  allowedDomains?: readonly string[];
  blockedDomains?: readonly string[];
};

type PolicyInput = {
  url: string;
  title?: string;
  contentType?: string;
  settings?: PolicySettings;
};

type SourceType =
  | "HTML_ARTICLE"
  | "DOCUMENTATION"
  | "BLOG"
  | "SEARCH_RESULTS"
  | "PDF"
  | "VIDEO_PLATFORM"
  | "SOCIAL_FEED"
  | "PRIVATE_CHAT"
  | "WEBMAIL"
  | "SENSITIVE_PORTAL"
  | "UNKNOWN";

type PolicyDecision = "ALLOW" | "BLOCK" | "ASK";

type PolicyReason =
  | "SUPPORTED_HTML"
  | "USER_ALLOWED_DOMAIN"
  | "USER_BLOCKED_DOMAIN"
  | "NON_HTTP_PROTOCOL"
  | "PDF_NOT_SUPPORTED"
  | "VIDEO_NOT_SUPPORTED"
  | "SOCIAL_NOT_SUPPORTED"
  | "PRIVATE_CONTENT_BLOCKED"
  | "SENSITIVE_CONTENT_BLOCKED"
  | "UNKNOWN_SOURCE";

type PolicyResult = {
  decision: PolicyDecision;
  sourceType: SourceType;
  reasonCode: PolicyReason;
  safeUrl: string;
  hostname?: string;
  userMessage: string;
};

const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com"] as const;
const SOCIAL_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
] as const;
const PRIVATE_CHAT_DOMAINS = [
  "chatgpt.com",
  "claude.ai",
  "discord.com",
  "slack.com",
  "messenger.com",
  "web.whatsapp.com",
] as const;
const WEBMAIL_DOMAINS = [
  "mail.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "proton.me",
] as const;
const SENSITIVE_DOMAIN_HINTS = [
  "bank",
  "banking",
  "paypal.com",
  "stripe.com",
  "health",
  "hospital",
  "patient",
  "medical",
  "insurance",
] as const;

export async function checkSourcePolicy(input: PolicyInput): Promise<
  | { ok: true; data: PolicyResult }
  | {
      ok: false;
      error: {
        code: "VALIDATION_ERROR";
        message: string;
        retryable: false;
      };
    }
> {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "URL của tab hiện tại không hợp lệ.",
        retryable: false,
      },
    };
  }

  const hostname = normalizeDomain(parsed.hostname);
  const safeUrl = toSafeUrl(parsed);
  const settings = input.settings ?? {};

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return allowedResult(
      "BLOCK",
      "UNKNOWN",
      "NON_HTTP_PROTOCOL",
      safeUrl,
      hostname,
      "Extension chỉ đọc trang web dùng HTTP hoặc HTTPS.",
    );
  }

  if (domainListContains(settings.blockedDomains, hostname)) {
    return allowedResult(
      "BLOCK",
      "UNKNOWN",
      "USER_BLOCKED_DOMAIN",
      safeUrl,
      hostname,
      "Bạn đã chặn extension đọc domain này.",
    );
  }

  const hardBlock = classifyHardBlock(parsed, input.contentType);
  if (hardBlock) {
    return allowedResult(
      "BLOCK",
      hardBlock.sourceType,
      hardBlock.reasonCode,
      safeUrl,
      hostname,
      hardBlock.userMessage,
    );
  }

  if (domainListContains(settings.allowedDomains, hostname)) {
    return allowedResult(
      "ALLOW",
      classifyAllowedSource(parsed),
      "USER_ALLOWED_DOMAIN",
      safeUrl,
      hostname,
      "Domain này được phép đọc khi bạn mở extension.",
    );
  }

  return allowedResult(
    "ALLOW",
    classifyAllowedSource(parsed),
    "SUPPORTED_HTML",
    safeUrl,
    hostname,
    "Sẵn sàng đọc phần HTML đang hiện trên màn hình.",
  );
}

function classifyHardBlock(
  url: URL,
  contentType?: string,
):
  | {
      sourceType: SourceType;
      reasonCode: PolicyReason;
      userMessage: string;
    }
  | undefined {
  const hostname = normalizeDomain(url.hostname);
  const path = url.pathname.toLowerCase();
  const normalizedContentType = contentType?.toLowerCase() ?? "";

  if (path.endsWith(".pdf") || normalizedContentType.includes("application/pdf")) {
    return {
      sourceType: "PDF",
      reasonCode: "PDF_NOT_SUPPORTED",
      userMessage: "Bản demo chưa đọc PDF. Hãy mở một bài viết HTML.",
    };
  }

  if (domainListContains(VIDEO_DOMAINS, hostname)) {
    return {
      sourceType: "VIDEO_PLATFORM",
      reasonCode: "VIDEO_NOT_SUPPORTED",
      userMessage: "Bản demo chưa đọc nội dung video hoặc transcript.",
    };
  }

  if (domainListContains(SOCIAL_DOMAINS, hostname)) {
    return {
      sourceType: "SOCIAL_FEED",
      reasonCode: "SOCIAL_NOT_SUPPORTED",
      userMessage: "Extension bỏ qua mạng xã hội trong bản demo.",
    };
  }

  if (domainListContains(PRIVATE_CHAT_DOMAINS, hostname)) {
    return {
      sourceType: "PRIVATE_CHAT",
      reasonCode: "PRIVATE_CONTENT_BLOCKED",
      userMessage: "Extension không đọc hội thoại hoặc trang chat riêng tư.",
    };
  }

  if (domainListContains(WEBMAIL_DOMAINS, hostname)) {
    return {
      sourceType: "WEBMAIL",
      reasonCode: "PRIVATE_CONTENT_BLOCKED",
      userMessage: "Extension không đọc nội dung email.",
    };
  }

  if (SENSITIVE_DOMAIN_HINTS.some((hint) => hostname.includes(hint))) {
    return {
      sourceType: "SENSITIVE_PORTAL",
      reasonCode: "SENSITIVE_CONTENT_BLOCKED",
      userMessage: "Extension bỏ qua cổng tài chính hoặc sức khỏe nhạy cảm.",
    };
  }

  return undefined;
}

function classifyAllowedSource(url: URL): SourceType {
  const value = `${url.hostname}${url.pathname}`.toLowerCase();
  if (/docs?|developer|reference|manual|guide/.test(value)) return "DOCUMENTATION";
  if (/blog|article|post|news/.test(value)) return "BLOG";
  if (/search|results/.test(value)) return "SEARCH_RESULTS";
  return "HTML_ARTICLE";
}

function allowedResult(
  decision: PolicyDecision,
  sourceType: SourceType,
  reasonCode: PolicyReason,
  safeUrl: string,
  hostname: string,
  userMessage: string,
): { ok: true; data: PolicyResult } {
  return {
    ok: true,
    data: { decision, sourceType, reasonCode, safeUrl, hostname, userMessage },
  };
}

function domainListContains(domains: readonly string[] | undefined, hostname: string): boolean {
  return (domains ?? []).some((domain) => {
    const normalized = normalizeDomain(domain);
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function toSafeUrl(url: URL): string {
  const safe = new URL(url.toString());
  safe.hash = "";
  safe.search = "";
  return safe.toString();
}
