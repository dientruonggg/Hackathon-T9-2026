import type { Result } from "@vlc/contracts";
import type { 
  MemoryMarker, MemorySummary, SaveMarkerInput, SearchMemoryInput, 
  UpdateUnderstandingInput, ForgetMemoryInput, ForgetMemoryOutput, 
  SourcePolicySettings, UpdateSourcePolicyInput
} from "@vlc/contracts";
import type { StorageAreaLike, Clock, IdGenerator, MemoryRepository } from "./memory-repository.js";
import { matchMemories } from "./memory-matcher.js";

export const MEMORY_STORAGE_KEYS = {
  markers: "vlc:markers:v1",
  policy: "vlc:policy:v1",
  settings: "vlc:settings:v1"
} as const;

export function createBrowserStorageMemoryRepository(
  storage: StorageAreaLike,
  clock: Clock,
  idGenerator: IdGenerator,
): MemoryRepository {
  return new BrowserStorageMemoryRepository(storage, clock, idGenerator);
}

function stripUndefined<T extends object>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result) as (keyof T)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

class BrowserStorageMemoryRepository implements MemoryRepository {
  constructor(
    private readonly storage: StorageAreaLike,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator
  ) {}

  private async getMarkerRecord(): Promise<Record<string, MemoryMarker>> {
    const data = await this.storage.get(MEMORY_STORAGE_KEYS.markers);
    const stored = data[MEMORY_STORAGE_KEYS.markers];
    return isRecord(stored) ? stored as Record<string, MemoryMarker> : {};
  }

  private async getAllMarkers(): Promise<MemoryMarker[]> {
    return Object.values(await this.getMarkerRecord());
  }

  async saveMarker(input: SaveMarkerInput): Promise<Result<MemoryMarker>> {
    try {
      const now = this.clock.now().toISOString();
      const markerRecord = await this.getMarkerRecord();
      const markers = Object.values(markerRecord);
      
      const existing = markers.find(m => 
        m.source.canonicalUrl === input.source.canonicalUrl && 
        m.anchor.fingerprint === input.anchor.fingerprint
      );

      let marker: MemoryMarker;
      
      if (existing) {
        marker = stripUndefined({
          ...existing,
          status: input.status,
          note: input.note !== undefined ? input.note : existing.note,
          question: input.question !== undefined ? input.question : existing.question,
          answerSummary: input.answerSummary !== undefined ? input.answerSummary : existing.answerSummary,
          updatedAt: now,
          revision: existing.revision + 1,
        }) as any as MemoryMarker;
        const newEvidence = [input.evidence, ...existing.evidence].slice(0, 20);
        marker.evidence = newEvidence;
      } else {
        marker = stripUndefined({
          schemaVersion: 1,
          id: this.idGenerator.createId(),
          source: input.source,
          anchor: input.anchor,
          status: input.status,
          note: input.note,
          question: input.question,
          answerSummary: input.answerSummary,
          evidence: [input.evidence],
          createdAt: now,
          updatedAt: now,
          lastVisitedAt: now,
          revision: 1
        }) as any as MemoryMarker;
      }

      await this.storage.set({
        [MEMORY_STORAGE_KEYS.markers]: { ...markerRecord, [marker.id]: marker }
      });
      return { ok: true, data: marker };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }

  async searchMemory(input: SearchMemoryInput): Promise<Result<MemorySummary[]>> {
    try {
      const markers = await this.getAllMarkers();
      const matched = matchMemories(markers, input);
      return { ok: true, data: matched };
    } catch (e: any) {
      return { ok: false, error: { code: "INTERNAL_ERROR", message: e.message, retryable: false } };
    }
  }

  async readMemory(memoryId: string): Promise<Result<MemoryMarker | null>> {
    try {
      const markers = await this.getMarkerRecord();
      const marker = markers[memoryId];
      return { ok: true, data: marker || null };
    } catch (e: any) {
      return { ok: false, error: { code: "INTERNAL_ERROR", message: e.message, retryable: false } };
    }
  }

  async updateUnderstanding(input: UpdateUnderstandingInput): Promise<Result<MemoryMarker>> {
    try {
      const markers = await this.getMarkerRecord();
      const existing = markers[input.memoryId];
      if (!existing) {
        return { ok: false, error: { code: "MEMORY_NOT_FOUND", message: "Not found", retryable: false } };
      }

      const now = this.clock.now().toISOString();
      const newEvidence = [input.evidence, ...existing.evidence].slice(0, 20);

      const updated: MemoryMarker = stripUndefined({
        ...existing,
        status: input.nextStatus,
        note: input.note !== undefined ? input.note : existing.note,
        evidence: newEvidence,
        updatedAt: now,
        revision: existing.revision + 1
      }) as any as MemoryMarker;

      await this.storage.set({
        [MEMORY_STORAGE_KEYS.markers]: { ...markers, [input.memoryId]: updated }
      });
      return { ok: true, data: updated };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }

  async forgetMemory(input: ForgetMemoryInput): Promise<Result<ForgetMemoryOutput>> {
    try {
      const markers = await this.getMarkerRecord();
      const idsToDelete: string[] = [];

      if (input.scope === "ONE") {
        if (markers[input.memoryId]) idsToDelete.push(input.memoryId);
      } else if (input.scope === "SOURCE") {
        for (const m of Object.values(markers)) {
          if (m.source.canonicalUrl === input.canonicalUrl) {
            idsToDelete.push(m.id);
          }
        }
      } else if (input.scope === "ALL") {
        idsToDelete.push(...Object.keys(markers));
      }

      if (idsToDelete.length > 0) {
        if (idsToDelete.length === Object.keys(markers).length) {
          await this.storage.remove(MEMORY_STORAGE_KEYS.markers);
        } else {
          const remaining = { ...markers };
          for (const id of idsToDelete) delete remaining[id];
          await this.storage.set({ [MEMORY_STORAGE_KEYS.markers]: remaining });
        }
      }

      return { ok: true, data: { deletedCount: idsToDelete.length } };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }

  async getSourcePolicySettings(): Promise<Result<SourcePolicySettings>> {
    try {
      const data = await this.storage.get(MEMORY_STORAGE_KEYS.policy);
      const settings = data[MEMORY_STORAGE_KEYS.policy] as SourcePolicySettings | undefined;
      if (settings) {
        return { ok: true, data: settings };
      }
      return { ok: true, data: { allowedDomains: [], blockedDomains: [], updatedAt: this.clock.now().toISOString() } };
    } catch (e: any) {
      return { ok: false, error: { code: "INTERNAL_ERROR", message: e.message, retryable: false } };
    }
  }

  async updateSourcePolicy(input: UpdateSourcePolicyInput): Promise<Result<SourcePolicySettings>> {
    try {
      const res = await this.getSourcePolicySettings();
      if (!res.ok) return res;
      const settings = res.data;

      const newSettings = { ...settings, updatedAt: this.clock.now().toISOString() };
      
      if (input.action === "ALLOW") {
        if (!newSettings.allowedDomains.includes(input.domain)) newSettings.allowedDomains.push(input.domain);
        newSettings.blockedDomains = newSettings.blockedDomains.filter(d => d !== input.domain);
      } else if (input.action === "BLOCK") {
        if (!newSettings.blockedDomains.includes(input.domain)) newSettings.blockedDomains.push(input.domain);
        newSettings.allowedDomains = newSettings.allowedDomains.filter(d => d !== input.domain);
      } else if (input.action === "RESET") {
        newSettings.allowedDomains = newSettings.allowedDomains.filter(d => d !== input.domain);
        newSettings.blockedDomains = newSettings.blockedDomains.filter(d => d !== input.domain);
      }

      await this.storage.set({ [MEMORY_STORAGE_KEYS.policy]: newSettings });
      return { ok: true, data: newSettings };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
