import { describe, expect, it } from "vitest";
import { checkSourcePolicy } from "../src/policy/check-source-policy";

const UPDATED_AT = "2026-09-12T00:00:00.000Z";

describe("checkSourcePolicy", () => {
  it("allows a normal HTML documentation page", async () => {
    const result = await checkSourcePolicy({
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Document",
      title: "Document",
      contentType: "text/html",
      settings: { allowedDomains: [], blockedDomains: [], updatedAt: UPDATED_AT },
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        decision: "ALLOW",
        sourceType: "DOCUMENTATION",
        reasonCode: "SUPPORTED_HTML",
      },
    });
  });

  it.each([
    ["https://example.com/guide.pdf", "PDF_NOT_SUPPORTED"],
    ["https://www.youtube.com/watch?v=123", "VIDEO_NOT_SUPPORTED"],
    ["https://www.facebook.com/feed", "SOCIAL_NOT_SUPPORTED"],
    ["https://chatgpt.com/c/example", "PRIVATE_CONTENT_BLOCKED"],
    ["https://mail.google.com/mail/u/0/", "PRIVATE_CONTENT_BLOCKED"],
    ["https://secure.example-bank.com/account", "SENSITIVE_CONTENT_BLOCKED"],
  ])("blocks %s", async (url, reasonCode) => {
    const result = await checkSourcePolicy({
      url,
      settings: {
        allowedDomains: [new URL(url).hostname],
        blockedDomains: [],
        updatedAt: UPDATED_AT,
      },
    });

    expect(result).toMatchObject({ ok: true, data: { decision: "BLOCK", reasonCode } });
  });

  it("lets a user block a domain and strips query data from safeUrl", async () => {
    const result = await checkSourcePolicy({
      url: "https://notes.example.com/article?token=secret#private",
      settings: {
        allowedDomains: [],
        blockedDomains: ["example.com"],
        updatedAt: UPDATED_AT,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        decision: "BLOCK",
        reasonCode: "USER_BLOCKED_DOMAIN",
        safeUrl: "https://notes.example.com/article",
      },
    });
  });

  it("rejects non-web protocols before capture", async () => {
    const result = await checkSourcePolicy({
      url: "about:config",
      settings: { allowedDomains: [], blockedDomains: [], updatedAt: UPDATED_AT },
    });
    expect(result).toMatchObject({
      ok: true,
      data: { decision: "BLOCK", reasonCode: "NON_HTTP_PROTOCOL" },
    });
  });
});
