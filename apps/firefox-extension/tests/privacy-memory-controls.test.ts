import { describe, it, expect, vi } from "vitest";
import {
  loadPrivacyMemoryState,
  blockCurrentDomain,
  unblockDomain,
  forgetConfirmedMarker
} from "../src/pipeline/privacy-memory-controls.js";
import type { MemoryRepository } from "@vlc/memory";
import type { MemorySummary } from "@vlc/contracts";

describe("Privacy Memory Controls", () => {
  const dummyMemory: MemorySummary = {
    id: "m1",
    source: { canonicalUrl: "https://example.com", safeUrl: "https://example.com", hostname: "example.com", title: "Test" },
    anchor: { heading: "H1", scrollRatio: 0, textQuote: "Quote", fingerprint: "hash" },
    status: "UNDERSTOOD",
    revision: 1,
    updatedAt: "2026-09-12T12:00:00Z", matchScore: 1.0, matchReason: "EXACT_FINGERPRINT"
  };

  it("loadPrivacyMemoryState normalizes domain and limits markers to 5", async () => {
    const mockRepo = {
      getSourcePolicySettings: vi.fn().mockResolvedValue({
        ok: true,
        data: { allowedDomains: [], blockedDomains: ["example.com"], updatedAt: "" }
      })
    } as unknown as MemoryRepository;

    const memories = Array(10).fill(dummyMemory);
    const result = await loadPrivacyMemoryState(
      { currentDomain: "www.Example.com.", relatedMemories: memories },
      { memoryRepository: mockRepo }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currentDomain).toBe("example.com");
      expect(result.data.isCurrentDomainUserBlocked).toBe(true);
      expect(result.data.blockedDomains).toContain("example.com");
      expect(result.data.relatedMemories).toHaveLength(5);
    }
  });

  it("blockCurrentDomain calls updateSourcePolicy with BLOCK", async () => {
    const mockRepo = {
      updateSourcePolicy: vi.fn().mockResolvedValue({ ok: true, data: {} })
    } as unknown as MemoryRepository;

    const result = await blockCurrentDomain({ domain: "www.example.com", userConfirmed: true }, { memoryRepository: mockRepo });
    expect(result.ok).toBe(true);
    expect(mockRepo.updateSourcePolicy).toHaveBeenCalledWith({
      domain: "example.com",
      action: "BLOCK",
      userConfirmed: true
    });
  });

  it("unblockDomain calls updateSourcePolicy with RESET", async () => {
    const mockRepo = {
      updateSourcePolicy: vi.fn().mockResolvedValue({ ok: true, data: {} })
    } as unknown as MemoryRepository;

    const result = await unblockDomain({ domain: "example.com", userConfirmed: true }, { memoryRepository: mockRepo });
    expect(result.ok).toBe(true);
    expect(mockRepo.updateSourcePolicy).toHaveBeenCalledWith({
      domain: "example.com",
      action: "RESET",
      userConfirmed: true
    });
  });

  it("forgetConfirmedMarker calls forgetMemory with scope ONE", async () => {
    const mockRepo = {
      forgetMemory: vi.fn().mockResolvedValue({ ok: true, data: { deletedCount: 1 } })
    } as unknown as MemoryRepository;

    const result = await forgetConfirmedMarker({ memoryId: "m1", userConfirmed: true }, { memoryRepository: mockRepo });
    expect(result.ok).toBe(true);
    expect(mockRepo.forgetMemory).toHaveBeenCalledWith({
      scope: "ONE",
      memoryId: "m1",
      userConfirmed: true
    });
  });
  
  it("storage error prevents rendering success", async () => {
    const mockRepo = {
      getSourcePolicySettings: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "MEMORY_WRITE_FAILED", message: "Storage full" }
      })
    } as unknown as MemoryRepository;

    const result = await loadPrivacyMemoryState(
      { currentDomain: "example.com", relatedMemories: [] },
      { memoryRepository: mockRepo }
    );
    expect(result.ok).toBe(false);
  });

  it("handles empty blockedDomains list gracefully", async () => {
    const mockRepo = {
      getSourcePolicySettings: vi.fn().mockResolvedValue({
        ok: true,
        data: { allowedDomains: [], blockedDomains: [], updatedAt: "" }
      })
    } as unknown as MemoryRepository;

    const result = await loadPrivacyMemoryState(
      { currentDomain: "developer.mozilla.org", relatedMemories: [] },
      { memoryRepository: mockRepo }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blockedDomains).toEqual([]);
      expect(result.data.isCurrentDomainUserBlocked).toBe(false);
      expect(result.data.relatedMemories).toEqual([]);
    }
  });

  it("handles delete with deletedCount 0 when memory does not exist", async () => {
    const mockRepo = {
      forgetMemory: vi.fn().mockResolvedValue({ ok: true, data: { deletedCount: 0 } })
    } as unknown as MemoryRepository;

    const result = await forgetConfirmedMarker(
      { memoryId: "nonexistent-id", userConfirmed: true },
      { memoryRepository: mockRepo }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.deletedCount).toBe(0);
    }
  });

  it("PrivacyMemoryState does not retain raw viewport content", async () => {
    const mockRepo = {
      getSourcePolicySettings: vi.fn().mockResolvedValue({
        ok: true,
        data: { allowedDomains: [], blockedDomains: [], updatedAt: "" }
      })
    } as unknown as MemoryRepository;

    const result = await loadPrivacyMemoryState(
      { currentDomain: "example.com", relatedMemories: [dummyMemory] },
      { memoryRepository: mockRepo }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const stateStr = JSON.stringify(result.data);
      expect(stateStr).not.toContain("CONFIDENTIAL_RAW_VIEWPORT");
      expect(stateStr).not.toContain("visibleText");
    }
  });
});

