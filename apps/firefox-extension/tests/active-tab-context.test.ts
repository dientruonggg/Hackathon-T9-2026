import { describe, expect, it } from "vitest";
import { canonicalTabUrl, createContextGeneration } from "../src/sidebar/active-tab-context";

describe("active sidebar context", () => {
  it("invalidates an in-flight result when another tab or URL wins", () => {
    const state = createContextGeneration();
    const first = state.next();
    expect(state.isCurrent(first)).toBe(true);
    const second = state.next();
    expect(state.isCurrent(first)).toBe(false);
    expect(state.isCurrent(second)).toBe(true);
  });
  it("normalizes tracking parameters but preserves meaningful navigation", () => {
    expect(canonicalTabUrl("https://example.com/promise?utm_source=x#section"))
      .toBe("https://example.com/promise");
    expect(canonicalTabUrl("https://example.com/promise?chapter=2"))
      .toBe("https://example.com/promise?chapter=2");
    expect(canonicalTabUrl("about:blank")).toBeNull();
  });
});
