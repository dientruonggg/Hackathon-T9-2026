# Phase 1: preserve all confirmed markers safely

**Depends on:** none. **Blocks:** Phase 2. **Scope:** only the five Phase 1 paths in `plan.md`.

## Goal

Expose a read-only local marker catalog and serialize writes to the existing whole-record key. Do not create a v2 storage key.

## Steps (future implementation; use `apply_patch` for edits)

### 1. Extend only the summary reason contract

File: `packages/contracts/src/memory.ts`. Replace the existing `MemoryMatchReasonSchema` declaration with:

```ts
export const MemoryMatchReasonSchema = z.enum([
  "EXACT_FINGERPRINT",
  "SAME_PAGE_HEADING",
  "SAME_PAGE",
  "CROSS_SITE"
]);
```

`CROSS_SITE` is a truthful origin label, not a semantic score promise. `schemaVersion` and the storage record remain unchanged.

### 2. Extend the repository port

File: `packages/memory/src/memory-repository.ts`. Insert after `IdGenerator`, and insert the method at the top of `MemoryRepository`:

```ts
export interface ExclusiveLock {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export interface MemoryRepository {
  listMarkers(): Promise<Result<MemoryMarker[]>>;
  saveMarker(input: SaveMarkerInput): Promise<Result<MemoryMarker>>;
  // Keep the remaining existing methods unchanged.
}
```

The displayed interface fragment shows the exact insertion; do not remove existing methods.

### 3. Wrap all marker mutations under one exclusive lock

File: `packages/memory/src/browser-storage-memory-repository.ts`. Add `ExclusiveLock` to its type imports. Replace the factory/constructor signatures and add the read-only method:

```ts
export function createBrowserStorageMemoryRepository(
  storage: StorageAreaLike,
  clock: Clock,
  idGenerator: IdGenerator,
  markerLock: ExclusiveLock,
): MemoryRepository {
  return new BrowserStorageMemoryRepository(storage, clock, idGenerator, markerLock);
}

class BrowserStorageMemoryRepository implements MemoryRepository {
  constructor(
    private readonly storage: StorageAreaLike,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly markerLock: ExclusiveLock,
  ) {}

  async listMarkers(): Promise<Result<MemoryMarker[]>> {
    try {
      return { ok: true, data: await this.getAllMarkers() };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Memory read failed",
          retryable: true,
        },
      };
    }
  }

  // Keep getMarkerRecord(), getAllMarkers(), searchMemory(), readMemory(),
  // policy methods, and the helper functions with their current bodies.
}
```

The following are complete replacements for the three mutation methods inside that class. The lock covers `get → modify → set/remove`, never only the final write:

```ts
async saveMarker(input: SaveMarkerInput): Promise<Result<MemoryMarker>> {
  try {
    return await this.markerLock.run<Result<MemoryMarker>>(async () => {
      const now = this.clock.now().toISOString();
      const markerRecord = await this.getMarkerRecord();
      const existing = Object.values(markerRecord).find(marker =>
        marker.source.canonicalUrl === input.source.canonicalUrl &&
        marker.anchor.fingerprint === input.anchor.fingerprint
      );
      const marker = stripUndefined(existing
        ? {
            ...existing,
            status: input.status,
            note: input.note ?? existing.note,
            question: input.question ?? existing.question,
            answerSummary: input.answerSummary ?? existing.answerSummary,
            evidence: [input.evidence, ...existing.evidence].slice(0, 20),
            updatedAt: now,
            revision: existing.revision + 1,
          }
        : {
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
            revision: 1,
          }) as MemoryMarker;
      await this.storage.set({
        [MEMORY_STORAGE_KEYS.markers]: {
          ...markerRecord,
          [marker.id]: marker,
        },
      });
      return { ok: true, data: marker };
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "MEMORY_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Memory write failed",
        retryable: true,
      },
    };
  }
}

async updateUnderstanding(input: UpdateUnderstandingInput): Promise<Result<MemoryMarker>> {
  try {
    return await this.markerLock.run<Result<MemoryMarker>>(async () => {
      const markers = await this.getMarkerRecord();
      const existing = markers[input.memoryId];
      if (!existing) {
        return { ok: false, error: { code: "MEMORY_NOT_FOUND", message: "Not found", retryable: false } };
      }
      const updated = stripUndefined({
        ...existing,
        status: input.nextStatus,
        note: input.note ?? existing.note,
        evidence: [input.evidence, ...existing.evidence].slice(0, 20),
        updatedAt: this.clock.now().toISOString(),
        revision: existing.revision + 1,
      });
      await this.storage.set({ [MEMORY_STORAGE_KEYS.markers]: { ...markers, [input.memoryId]: updated } });
      return { ok: true, data: updated };
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "MEMORY_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Memory write failed",
        retryable: true,
      },
    };
  }
}

async forgetMemory(input: ForgetMemoryInput): Promise<Result<ForgetMemoryOutput>> {
  try {
    return await this.markerLock.run<Result<ForgetMemoryOutput>>(async () => {
      const markers = await this.getMarkerRecord();
      const ids = Object.keys(markers).filter(id => {
        if (input.scope === "ALL") return true;
        if (input.scope === "ONE") return id === input.memoryId;
        return markers[id]?.source.canonicalUrl === input.canonicalUrl;
      });
      if (ids.length === 0) return { ok: true, data: { deletedCount: 0 } };
      if (ids.length === Object.keys(markers).length) {
        await this.storage.remove(MEMORY_STORAGE_KEYS.markers);
      } else {
        const remaining = { ...markers };
        for (const id of ids) delete remaining[id];
        await this.storage.set({ [MEMORY_STORAGE_KEYS.markers]: remaining });
      }
      return { ok: true, data: { deletedCount: ids.length } };
    });
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        code: "MEMORY_WRITE_FAILED",
        message: error instanceof Error ? error.message : "Memory write failed",
        retryable: true,
      },
    };
  }
}
```

### 4. Use the Firefox-origin lock in the extension runtime

File: `apps/firefox-extension/src/services/browser-runtime.ts`. Add `ExclusiveLock` to the `@vlc/memory` type imports. Replace repository creation with:

```ts
const markerLock: ExclusiveLock = {
  async run<T>(operation: () => Promise<T>): Promise<T> {
    return navigator.locks.request("vlc:markers:v1", operation);
  },
};

export const memoryRepository: MemoryRepository =
  createBrowserStorageMemoryRepository(
    storageAdapter,
    systemClock,
    browserIdGenerator,
    markerLock,
  );
```

Firefox extension pages share an origin; the lock is held through the asynchronous storage write. If `navigator.locks` is unexpectedly unavailable, writes must fail visibly, not run unlocked. Do not modify the user's profile to test it.

### 5. Update existing tests and add a concurrent-save test

File: `packages/memory/src/memory.test.ts`. Import `ExclusiveLock`, add this reusable test lock, pass one instance to the factory in `beforeEach`, then add the test:

```ts
class TestLock implements ExclusiveLock {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

// Replace the existing factory call inside beforeEach with:
repo = createBrowserStorageMemoryRepository(
  storage, new MockClock(), new MockIdGen(), new TestLock());

it("retains two sites when independent sidebar repositories save concurrently", async () => {
  const lock = new TestLock();
  const repoA = createBrowserStorageMemoryRepository(storage, new MockClock(), new MockIdGen(), lock);
  const repoB = createBrowserStorageMemoryRepository(storage, new MockClock(),
    { createId: () => "site-b" }, lock);
  const [first, second] = await Promise.all([
    repoA.saveMarker(baseInput),
    repoB.saveMarker({
      ...baseInput,
      source: { ...baseInput.source, canonicalUrl: "https://other.example/async" },
    }),
  ]);
  expect(first.ok && second.ok).toBe(true);
  const listed = await repoA.listMarkers();
  expect(listed.ok).toBe(true);
  if (listed.ok) expect(listed.data.map(m => m.source.canonicalUrl).sort()).toEqual([
    "https://ex.com", "https://other.example/async",
  ]);
});
```

Also assert existing v1 record read, same-page search ranking unchanged, and `listMarkers()` returns both URLs without uploading them. Existing tests must use the new fourth factory argument; no test bypass lock should remain.

## Verify

```powershell
npm test --workspace @vlc/memory
npm run typecheck --workspace @vlc/memory
npm run typecheck --workspace @vlc/firefox-extension
git diff -- packages/contracts/src/memory.ts packages/memory/src apps/firefox-extension/src/services/browser-runtime.ts
```

Expected: all commands exit 0; only Phase 1 paths changed; test has both distinct URLs. Review the diff before Phase 2. Rollback: revert only this phase's scoped source edits with `apply_patch`; do not reset or delete the profile/store.
