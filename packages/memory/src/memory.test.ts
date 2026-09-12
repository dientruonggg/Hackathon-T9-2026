import { describe, it, expect, beforeEach } from "vitest";
import { createBrowserStorageMemoryRepository, matchMemories } from "./index.js";
import type { StorageAreaLike, Clock, IdGenerator } from "./memory-repository.js";
import type { MemoryMarker } from "@vlc/contracts";

class MockStorage implements StorageAreaLike {
  public data: Record<string, unknown> = {};
  public shouldFail = false;

  async get(keys?: string | string[] | null) {
    if (this.shouldFail) throw new Error("Storage get failed");
    if (!keys) return { ...this.data };
    if (typeof keys === "string") return { [keys]: this.data[keys] };
    const res: Record<string, unknown> = {};
    for (const k of keys) res[k] = this.data[k];
    return res;
  }
  async set(items: Record<string, unknown>) {
    if (this.shouldFail) throw new Error("Storage set failed");
    Object.assign(this.data, items);
  }
  async remove(keys: string | string[]) {
    if (this.shouldFail) throw new Error("Storage remove failed");
    const arr = Array.isArray(keys) ? keys : [keys];
    for (const k of arr) delete this.data[k];
  }
}

class MockClock implements Clock {
  now() { return new Date("2026-09-12T12:00:00Z"); }
}

class MockIdGen implements IdGenerator {
  private id = 1;
  createId() { return `id-${this.id++}`; }
}

describe("Memory package", () => {
  let storage: MockStorage;
  let repo: ReturnType<typeof createBrowserStorageMemoryRepository>;

  beforeEach(() => {
    storage = new MockStorage();
    repo = createBrowserStorageMemoryRepository(storage, new MockClock(), new MockIdGen());
  });

  const baseInput = {
    source: { canonicalUrl: "https://ex.com", safeUrl: "https://ex.com", hostname: "ex.com", title: "Test" },
    anchor: { heading: "H", textQuote: "Q", scrollRatio: 0, fingerprint: "fp" },
    status: "UNDERSTOOD" as const,
    evidence: { kind: "USER_MARK" as const, summary: "E", createdAt: "2026-09-12T12:00:00Z" },
    userConfirmed: true as const
  };

  it("saveMarker saves new marker and updates existing without duplication", async () => {
    const res1 = await repo.saveMarker(baseInput);
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.data.revision).toBe(1);

    const res2 = await repo.saveMarker({ ...baseInput, note: "updated" });
    expect(res2.ok).toBe(true);
    if (!res2.ok) return;
    expect(res2.data.revision).toBe(2);
    expect(res2.data.note).toBe("updated");
    expect(res2.data.id).toBe(res1.data.id);

    const data = await storage.get(null);
    expect(Object.keys(data).filter(k => k.startsWith("marker:")).length).toBe(1);
  });

  it("updateUnderstanding increments revision and appends evidence", async () => {
    const res = await repo.saveMarker(baseInput);
    if (!res.ok) throw new Error("save failed");

    const upRes = await repo.updateUnderstanding({
      memoryId: res.data.id,
      nextStatus: "REVIEW_LATER",
      evidence: { kind: "USER_CHECKPOINT", summary: "ck", createdAt: "2026-09-12T12:01:00Z" },
      userConfirmed: true
    });
    
    expect(upRes.ok).toBe(true);
    if (!upRes.ok) return;
    expect(upRes.data.revision).toBe(2);
    expect(upRes.data.status).toBe("REVIEW_LATER");
    expect(upRes.data.evidence.length).toBe(2);
  });

  it("forgetMemory deletes correct scopes", async () => {
    await repo.saveMarker(baseInput);
    await repo.saveMarker({ ...baseInput, anchor: { ...baseInput.anchor, fingerprint: "fp2" } });
    
    const del1 = await repo.forgetMemory({ scope: "ONE", memoryId: "id-1", userConfirmed: true });
    expect(del1.ok).toBe(true);
    if (del1.ok) expect(del1.data.deletedCount).toBe(1);

    const del2 = await repo.forgetMemory({ scope: "SOURCE", canonicalUrl: "https://ex.com", userConfirmed: true });
    expect(del2.ok).toBe(true);
    if (del2.ok) expect(del2.data.deletedCount).toBe(1);

    await repo.saveMarker(baseInput);
    const del3 = await repo.forgetMemory({ scope: "ALL", userConfirmed: true });
    expect(del3.ok).toBe(true);
    if (del3.ok) expect(del3.data.deletedCount).toBe(1);
  });

  it("storage error mapping", async () => {
    storage.shouldFail = true;
    const res = await repo.saveMarker(baseInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("MEMORY_WRITE_FAILED");
  });

  it("matcher score and sorting", () => {
    const markers = [
      { id: "1", source: baseInput.source, anchor: baseInput.anchor, updatedAt: "2026-09-12T12:00:00Z" },
      { id: "2", source: baseInput.source, anchor: { ...baseInput.anchor, fingerprint: "other", heading: "H" }, updatedAt: "2026-09-12T12:01:00Z" },
      { id: "3", source: baseInput.source, anchor: { ...baseInput.anchor, fingerprint: "other", heading: "diff" }, updatedAt: "2026-09-12T12:02:00Z" }
    ] as any as MemoryMarker[];
    
    const matched = matchMemories(markers, { source: baseInput.source, anchor: baseInput.anchor });
    expect(matched.length).toBe(3);
    expect(matched[0]!.id).toBe("1");
    expect(matched[0]!.matchScore).toBe(1);
    expect(matched[1]!.id).toBe("2");
    expect(matched[1]!.matchScore).toBe(0.85);
    expect(matched[2]!.id).toBe("3");
    expect(matched[2]!.matchScore).toBe(0.6);
  });
});
