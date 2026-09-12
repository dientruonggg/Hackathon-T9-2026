import { describe, it, expect } from "vitest";
import { 
  MemoryMarkerSchema, 
  SourcePolicySettingsSchema,
  AppErrorSchema
} from "./index.js";

describe("Contracts", () => {
  it("accepts valid marker fixture", () => {
    const fixture = {
      schemaVersion: 1,
      id: "mem-1",
      source: {
        canonicalUrl: "https://example.com/test",
        safeUrl: "https://example.com/test",
        hostname: "example.com",
        title: "Test Page"
      },
      anchor: {
        heading: "Test Heading",
        textQuote: "This is a quote",
        scrollRatio: 0.5,
        fingerprint: "hash123"
      },
      status: "UNDERSTOOD",
      evidence: [{
        kind: "USER_MARK",
        summary: "Marked this",
        createdAt: "2026-09-12T12:00:00Z"
      }],
      createdAt: "2026-09-12T12:00:00Z",
      updatedAt: "2026-09-12T12:00:00Z",
      lastVisitedAt: "2026-09-12T12:00:00Z",
      revision: 1
    };
    expect(MemoryMarkerSchema.parse(fixture)).toEqual(fixture);
  });

  it("rejects invalid boundary (scrollRatio > 1)", () => {
    const invalid = {
      schemaVersion: 1,
      id: "mem-1",
      source: {
        canonicalUrl: "https://example.com/test",
        safeUrl: "https://example.com/test",
        hostname: "example.com",
        title: "Test Page"
      },
      anchor: {
        heading: "Test Heading",
        textQuote: "This is a quote",
        scrollRatio: 1.5,
        fingerprint: "hash123"
      },
      status: "UNDERSTOOD",
      evidence: [],
      createdAt: "2026-09-12T12:00:00Z",
      updatedAt: "2026-09-12T12:00:00Z",
      lastVisitedAt: "2026-09-12T12:00:00Z",
      revision: 1
    };
    expect(() => MemoryMarkerSchema.parse(invalid)).toThrow();
  });

  it("SourcePolicySettings round-trip", () => {
    const settings = {
      allowedDomains: ["example.com"],
      blockedDomains: ["bad.com"],
      updatedAt: "2026-09-12T12:00:00Z"
    };
    expect(SourcePolicySettingsSchema.parse(settings)).toEqual(settings);
  });
});
