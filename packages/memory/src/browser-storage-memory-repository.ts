import type { Result } from "@vlc/contracts";
import type { 
  MemoryMarker, MemorySummary, SaveMarkerInput, SearchMemoryInput, 
  UpdateUnderstandingInput, ForgetMemoryInput, ForgetMemoryOutput, 
  SourcePolicySettings, UpdateSourcePolicyInput
} from "@vlc/contracts";
import type { StorageAreaLike, Clock, IdGenerator, MemoryRepository } from "./memory-repository.js";
import { matchMemories } from "./memory-matcher.js";

const MARKER_PREFIX = "marker:";
const POLICY_KEY = "policy:settings";

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

  private async getAllMarkers(): Promise<MemoryMarker[]> {
    const data = await this.storage.get(null);
    return Object.keys(data)
      .filter(k => k.startsWith(MARKER_PREFIX))
      .map(k => data[k] as MemoryMarker);
  }

  async saveMarker(input: SaveMarkerInput): Promise<Result<MemoryMarker>> {
    try {
      const now = this.clock.now().toISOString();
      const markers = await this.getAllMarkers();
      
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

      await this.storage.set({ [`${MARKER_PREFIX}${marker.id}`]: marker });
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
      const key = `${MARKER_PREFIX}${memoryId}`;
      const data = await this.storage.get(key);
      const marker = data[key] as MemoryMarker | undefined;
      return { ok: true, data: marker || null };
    } catch (e: any) {
      return { ok: false, error: { code: "INTERNAL_ERROR", message: e.message, retryable: false } };
    }
  }

  async updateUnderstanding(input: UpdateUnderstandingInput): Promise<Result<MemoryMarker>> {
    try {
      const key = `${MARKER_PREFIX}${input.memoryId}`;
      const data = await this.storage.get(key);
      const existing = data[key] as MemoryMarker | undefined;
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

      await this.storage.set({ [key]: updated });
      return { ok: true, data: updated };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }

  async forgetMemory(input: ForgetMemoryInput): Promise<Result<ForgetMemoryOutput>> {
    try {
      const markers = await this.getAllMarkers();
      const toDelete: string[] = [];

      if (input.scope === "ONE") {
        const key = `${MARKER_PREFIX}${input.memoryId}`;
        toDelete.push(key);
      } else if (input.scope === "SOURCE") {
        for (const m of markers) {
          if (m.source.canonicalUrl === input.canonicalUrl) {
            toDelete.push(`${MARKER_PREFIX}${m.id}`);
          }
        }
      } else if (input.scope === "ALL") {
        for (const m of markers) {
          toDelete.push(`${MARKER_PREFIX}${m.id}`);
        }
      }

      if (toDelete.length > 0) {
        await this.storage.remove(toDelete);
      }

      return { ok: true, data: { deletedCount: toDelete.length } };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }

  async getSourcePolicySettings(): Promise<Result<SourcePolicySettings>> {
    try {
      const data = await this.storage.get(POLICY_KEY);
      const settings = data[POLICY_KEY] as SourcePolicySettings | undefined;
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

      await this.storage.set({ [POLICY_KEY]: newSettings });
      return { ok: true, data: newSettings };
    } catch (e: any) {
      return { ok: false, error: { code: "MEMORY_WRITE_FAILED", message: e.message, retryable: true } };
    }
  }
}
