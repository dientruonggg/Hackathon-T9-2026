import { describe, expect, it } from "vitest";
import type { MemoryMarker, MemorySummary, ViewportContext } from "@vlc/contracts";
import { selectTurnMemories } from "../src/pipeline/select-turn-memories";

const now = "2026-09-17T00:00:00.000Z";
const context: ViewportContext = {
  contextId: "async",
  source: { canonicalUrl: "https://site2.example/async", safeUrl: "https://site2.example/async", hostname: "site2.example", title: "Async" },
  anchor: { heading: "Async and await", textQuote: "Async uses promises", scrollRatio: 0, fingerprint: "async" },
  visibleText: "Async functions use promises and await their result.",
  visibleCodeBlocks: [], capturedAt: now,
};
function marker(id: string, url: string, heading: string): MemoryMarker {
  return {
    schemaVersion: 1, id,
    source: { canonicalUrl: url, safeUrl: url, hostname: new URL(url).hostname, title: heading },
    anchor: { heading, textQuote: heading, scrollRatio: 0, fingerprint: id },
    status: "UNDERSTOOD", note: `I understand ${heading}`,
    evidence: [{ kind: "USER_MARK", summary: "confirmed", createdAt: now }],
    createdAt: now, updatedAt: now, lastVisitedAt: now, revision: 1,
  };
}
describe("selectTurnMemories", () => {
  it("selects a confirmed Promise checkpoint from another site for an async question", () => {
    const result = selectTurnMemories([], [marker("promise", "https://site1.example/promise", "Promise resolve reject")], context, "How does async use Promise?");
    expect(result).toMatchObject([{ id: "promise", matchReason: "CROSS_SITE", status: "UNDERSTOOD" }]);
  });
  it("keeps page evidence page-scoped and sends at most five unique markers", () => {
    const page: MemorySummary = { ...marker("page", context.source.canonicalUrl, "Async"), matchScore: 1, matchReason: "SAME_PAGE" };
    const old = Array.from({ length: 6 }, (_, i) => marker(`old-${i}`, `https://site${i}.example/promise`, "Promise"));
    const result = selectTurnMemories([page], [marker("page", context.source.canonicalUrl, "Async"), ...old], context, "Promise");
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe("page");
    expect(new Set(result.map(item => item.id)).size).toBe(result.length);
    expect(result.slice(1).every(item => item.source.canonicalUrl !== context.source.canonicalUrl)).toBe(true);
  });
});
