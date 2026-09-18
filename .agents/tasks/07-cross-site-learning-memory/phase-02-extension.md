# Phase 2: select cross-site evidence only for an explicit question

**Depends on:** Phase 1 verified. **Blocks:** Phase 3. **Scope:** Phase 2 paths in `plan.md` only.

## Goal

Keep page-specific UI behavior while supplying bounded, policy-approved personal checkpoints to an Ask turn. Rebind actions to the active tab.

## Steps (future implementation; use `apply_patch`)

### 1. Create deterministic turn-local selector

Create `apps/firefox-extension/src/pipeline/select-turn-memories.ts` with this complete content:

```ts
import type { MemoryMarker, MemorySummary, ViewportContext } from "@vlc/contracts";

const MAX_TURN_MEMORIES = 5;
const CROSS_SITE_SLOTS_WHEN_PAGE_EXISTS = 2;

function termsOf(value: string): Set<string> {
  return new Set(value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
}

function crossSiteSummary(marker: MemoryMarker, score: number): MemorySummary {
  return {
    id: marker.id,
    source: marker.source,
    anchor: marker.anchor,
    status: marker.status,
    ...(marker.note === undefined ? {} : { note: marker.note }),
    ...(marker.question === undefined ? {} : { question: marker.question }),
    ...(marker.answerSummary === undefined ? {} : { answerSummary: marker.answerSummary }),
    updatedAt: marker.updatedAt,
    revision: marker.revision,
    matchScore: score,
    matchReason: "CROSS_SITE",
  };
}

export function selectTurnMemories(
  pageMemories: readonly MemorySummary[],
  allowedMarkers: readonly MemoryMarker[],
  context: ViewportContext,
  question: string,
): MemorySummary[] {
  const currentUrl = context.source.canonicalUrl;
  const pageIds = new Set(pageMemories.map(memory => memory.id));
  const queryTerms = termsOf(`${question} ${context.anchor.heading} ${context.visibleText.slice(0, 700)}`);

  const crossSite = allowedMarkers
    .filter(marker => marker.source.canonicalUrl !== currentUrl && !pageIds.has(marker.id))
    .map(marker => {
      const searchable = termsOf([
        marker.source.title,
        marker.anchor.heading,
        marker.anchor.textQuote,
        marker.note ?? "",
        marker.question ?? "",
        marker.answerSummary ?? "",
      ].join(" "));
      const overlaps = [...queryTerms].filter(term => searchable.has(term)).length;
      return { marker, overlaps };
    })
    .sort((left, right) =>
      right.overlaps - left.overlaps ||
      Date.parse(right.marker.updatedAt) - Date.parse(left.marker.updatedAt) ||
      left.marker.id.localeCompare(right.marker.id)
    );

  const crossLimit = pageMemories.length === 0
    ? MAX_TURN_MEMORIES
    : CROSS_SITE_SLOTS_WHEN_PAGE_EXISTS;
  const chosenCross = crossSite.slice(0, crossLimit).map(({ marker, overlaps }) =>
    crossSiteSummary(marker, overlaps === 0 ? 0.1 : Math.min(0.7, 0.2 + overlaps * 0.1))
  );
  const chosenPage = pageMemories.slice(0, MAX_TURN_MEMORIES - chosenCross.length);
  return [...chosenPage, ...chosenCross].slice(0, MAX_TURN_MEMORIES);
}
```

`matchScore=0.1` means fallback, not semantic similarity. `lastVisitedAt` is not used because the current repository does not update it on visits.

### 2. Build the Agent request from the selected turn list

Edit `apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts`:

```ts
// Add imports:
import type { MemoryMarker, MemorySummary } from "@vlc/contracts";
import { checkSourcePolicy } from "../policy/check-source-policy";
import { selectTurnMemories } from "./select-turn-memories";

// Replace optional dependency:
export interface AskAgentPipelineDependencies {
  capture(input: CaptureViewportInput): Promise<Result<ViewportContext>>;
  requestAgentTurn(input: AgentTurnRequest): Promise<Result<AgentTurnResponse>>;
  clock: Clock;
  idGenerator: IdGenerator;
  memoryRepository: MemoryRepository;
}

// Add to BuildAgentTurnRequestInput:
relatedMemories?: MemorySummary[];

// Replace only the relatedMemories property in buildAgentTurnRequest():
relatedMemories: (input.relatedMemories ?? input.session.relatedMemories).slice(0, 5),
```

Replace the block from `if (deps.memoryRepository)` through request construction in `runAskAgentPipeline()` with:

```ts
  const pageResult = await deps.memoryRepository.searchMemory({
    source: refreshed.data.source,
    anchor: refreshed.data.anchor,
    limit: 5,
  });
  if (!pageResult.ok) {
    input.session.relatedMemories = [];
    return pageResult;
  }
  input.session.relatedMemories = pageResult.data;

  const catalogResult = await deps.memoryRepository.listMarkers();
  if (!catalogResult.ok) return catalogResult;
  const settingsResult = await deps.memoryRepository.getSourcePolicySettings();
  if (!settingsResult.ok) return settingsResult;

  const inspected = await Promise.all(catalogResult.data.map(async marker => {
    const policy = await checkSourcePolicy({
      url: marker.source.canonicalUrl,
      settings: settingsResult.data,
    });
    return policy.ok && policy.data.decision === "ALLOW" ? marker : null;
  }));
  const allowedMarkers = inspected.filter((marker): marker is MemoryMarker => marker !== null);
  const turnMemories = selectTurnMemories(
    pageResult.data,
    allowedMarkers,
    refreshed.data,
    question,
  );

  let request: AgentTurnRequest;
  try {
    request = buildAgentTurnRequest({
      turnId: deps.idGenerator.createId(),
      question,
      session: input.session,
      relatedMemories: turnMemories,
      permissions: { allowWebSearch: false },
    });
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Không tạo được lượt hỏi.");
  }

  return deps.requestAgentTurn(request);
```

Remove the original duplicate request-construction/return block. `session.relatedMemories` remains only page data. A failed read aborts before HTTP.

### 3. Rebind active tab at user-action boundaries

Edit `apps/firefox-extension/src/sidebar/main.ts`. Add `noteInput` next to the other DOM refs. Add this helper below `initializeSidebar`; it is called only from an explicit user action or initial sidebar open:

```ts
const noteInput = requireElement<HTMLTextAreaElement>("#memory-note-input");

function canonicalTabUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    const remove: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) remove.push(key);
    });
    for (const key of remove) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}

async function bindActiveSession(): Promise<{ ok: true; changed: boolean } | { ok: false }> {
  const active = await getActiveTab();
  if (!active.ok) {
    renderShellStatus(active.error.message, "danger");
    return { ok: false };
  }
  const opened = await runOpenSidebarPipeline(
    {
      tabId: active.data.id,
      url: active.data.url,
      ...(active.data.title === undefined ? {} : { title: active.data.title }),
    },
    {
      getPolicySettings: () => memoryRepository.getSourcePolicySettings(),
      checkPolicy: checkSourcePolicy,
      capture: captureTabViewport,
      memoryRepository,
      clock: systemClock,
      idGenerator: browserIdGenerator,
    },
  );
  if (!opened.ok) {
    renderShellStatus(opened.error.message, "danger");
    return { ok: false };
  }

  const previous = session;
  const next = opened.data.session;
  const changed = !previous ||
    previous.tabId !== next.tabId ||
    previous.context?.source.canonicalUrl !== next.context?.source.canonicalUrl ||
    previous.policy?.safeUrl !== next.policy?.safeUrl;
  if (!changed && previous) {
    next.messages = previous.messages;
    if (previous.pendingAction) next.pendingAction = previous.pendingAction;
  } else {
    answerPanel.hidden = true;
    agentProposalPanel.hidden = true;
    memoryCard.hidden = true;
    noteInput.value = "";
  }
  session = next;
  renderSession(next);
  return { ok: true, changed };
}

async function stillOnBoundPage(bound: ShortSession): Promise<boolean> {
  const active = await getActiveTab();
  return active.ok &&
    session === bound &&
    active.data.id === bound.tabId &&
    canonicalTabUrl(active.data.url) === bound.context?.source.canonicalUrl;
}

function discardStaleResult(): void {
  session = undefined;
  sourceBadge.textContent = "Cần cập nhật";
  sourceBadge.dataset.tone = "idle";
  contextHeading.textContent = "Chưa cập nhật trang hiện tại";
  contextPreview.textContent = "Bấm Cập nhật vị trí để đọc trang đang mở.";
  answerPanel.hidden = true;
  agentProposalPanel.hidden = true;
  memoryCard.hidden = true;
  pageMarkersList.replaceChildren();
  noteInput.value = "";
  renderShellStatus("Trang đã thay đổi. Bấm Cập nhật vị trí rồi thử lại.", "danger");
  setBusy(false);
}
```

Replace the body of `initializeSidebar()` with:

```ts
async function initializeSidebar(): Promise<void> {
  setBusy(true);
  renderShellStatus("Đang kiểm tra trang hiện tại…");
  await bindActiveSession();
  setBusy(false);
}
```

At the start of `askCurrentContext()` **after validating the nonempty question and before the API call**:

```ts
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || !session?.context || session.policy?.decision !== "ALLOW") {
    setBusy(false);
    return;
  }
  const requestSession = session;
```

Call `runAskAgentPipeline({ question, session: requestSession }, ...)` with its existing dependencies. Immediately after its `await`, before any status/UI/message/proposal mutation:

```ts
  if (!(await stillOnBoundPage(requestSession))) {
    discardStaleResult();
    return;
  }
```

The existing success/error handling then runs against `requestSession`. This replaces the old `setBusy(true)` preamble; do not call `setBusy(true)` twice.

At the start of `saveMarker(status)`, after setting busy and before deriving `suggestedNote`:

```ts
  const bound = await bindActiveSession();
  if (!bound.ok || !session?.context || session.policy?.decision !== "ALLOW") {
    setBusy(false);
    return;
  }
  if (bound.changed) {
    renderShellStatus("Đã chuyển trang. Hãy kiểm tra nội dung rồi bấm lưu lại.", "danger");
    setBusy(false);
    return;
  }
  const requestSession = session;
  const typedNote = noteInput.value.trim().slice(0, 500);
```

Pass the note in the existing `executeConfirmedMemoryWithRecapture(...)` call with this exact input shape:

```ts
const note = typedNote || suggestedNote;
const saved = await executeConfirmedMemoryWithRecapture(
  {
    status,
    session: requestSession,
    userConfirmed: true,
    ...(note ? { note } : {}),
  },
  { capture: captureTabViewport, memoryRepository, clock: systemClock },
);
if (!(await stillOnBoundPage(requestSession))) {
  discardStaleResult();
  return;
}
```

This replaces the current `saved` call and is before all success/error UI changes. A save that started on site 1 may still complete for site 1, but must never paint a site 1 result on site 2. Clear `noteInput.value` only after a successful save and same-page check.

Replace `refreshViewportContext()` with:

```ts
async function refreshViewportContext(): Promise<void> {
  if (busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (bound.ok && session?.policy?.decision === "ALLOW") {
    renderShellStatus("Đã cập nhật trang và vị trí hiện tại.", "success");
  }
  setBusy(false);
}
```

Replace `resumeFirstMemory()` with this helper and wrapper. Replace each page-list Resume handler body with `void resumeMemory(mem)`:

```ts
async function resumeMemory(memory: MemorySummary | undefined): Promise<void> {
  if (!memory || busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || bound.changed || !session?.context ||
      !session.relatedMemories.some(item => item.id === memory.id)) {
    renderShellStatus("Trang đã đổi; hãy kiểm tra mốc trên trang hiện tại rồi bấm lại.", "danger");
    setBusy(false);
    return;
  }
  const requestSession = session;
  const resumed = await resumeTabAtMarker({
    tabId: requestSession.tabId,
    expectedCanonicalUrl: memory.source.canonicalUrl,
    anchor: memory.anchor,
  });
  if (!(await stillOnBoundPage(requestSession))) {
    discardStaleResult();
    return;
  }
  renderShellStatus(
    resumed.ok
      ? resumed.data.found ? "Đã quay lại mốc." : "Không tìm lại được mốc trên trang."
      : resumed.error.message,
    resumed.ok && resumed.data.found ? "success" : "danger",
  );
  setBusy(false);
}

async function resumeFirstMemory(): Promise<void> {
  await resumeMemory(session?.relatedMemories[0]);
}
```

Add `MemorySummary` to `main.ts`'s existing type imports. Before the current-domain Block action calls `blockCurrentDomain(...)`, run:

```ts
const bound = await bindActiveSession();
if (!bound.ok || bound.changed || !session?.context) {
  renderShellStatus("Trang đã đổi; hãy kiểm tra domain rồi bấm chặn lại.", "danger");
  setBusy(false);
  return;
}
```

Replace the page-list Delete handler with:

```ts
delBtn.onclick = async () => {
  if (busy) return;
  setBusy(true);
  const bound = await bindActiveSession();
  if (!bound.ok || bound.changed || !session?.relatedMemories.some(item => item.id === mem.id)) {
    renderShellStatus("Trang đã đổi; hãy kiểm tra mốc rồi bấm xóa lại.", "danger");
    setBusy(false);
    return;
  }
  if (!confirm("Bạn có chắc muốn xóa dấu mốc này?")) {
    setBusy(false);
    return;
  }
  const current = session;
  const result = await forgetConfirmedMarker({ memoryId: mem.id, userConfirmed: true }, { memoryRepository });
  if (!(await stillOnBoundPage(current))) {
    discardStaleResult();
    return;
  }
  if (result.ok && result.data.deletedCount === 1) {
    current.relatedMemories = current.relatedMemories.filter(item => item.id !== mem.id);
    renderMemory(current);
    await refreshPrivacyMemoryState();
  }
  setBusy(false);
};
```

This ensures a stale page-list button cannot delete a marker from the previous website. Set `refreshContextButton.disabled = busy` in `updateControls()` so recovery remains possible when `session` is undefined.

In `renderSession(value)`, before the blocked branch, hide old `memoryCard`, `answerPanel`, and `agentProposalPanel` on a changed source. Do not let `renderSession()` change `busy`; action callers own that flag. No `tabs.onActivated` or `tabs.onUpdated` listener is added.

In `refreshPrivacyMemoryState()`, capture the session before the asynchronous read and refuse a stale render:

```ts
async function refreshPrivacyMemoryState(): Promise<void> {
  const current = session;
  if (!current?.context) return;
  const result = await loadPrivacyMemoryState({
    currentDomain: current.context.source.hostname || current.context.source.canonicalUrl,
    relatedMemories: current.relatedMemories,
  }, { memoryRepository });
  if (session === current && result.ok) renderPrivacyState(result.data);
}
```

### 4. Add an optional self-report note

File: `apps/firefox-extension/index.html`. Insert immediately before `.marker-actions` inside `.marker-panel`:

```html
<label for="memory-note-input">Ghi chú mức hiểu (không bắt buộc)</label>
<textarea id="memory-note-input" rows="2" maxlength="500"
  placeholder="Ví dụ: Tôi hiểu resolve/reject, chưa rõ Promise chaining."></textarea>
```

The saved note is learner-authored. An Agent proposal note is used only if the learner leaves this field blank and clicks to confirm. No numeric percentage field is added.

Also insert this notice immediately after `#question-form` inside its `.thread-content`:

```html
<p class="privacy-hint">Khi bấm Hỏi, tối đa 5 mốc đã lưu từ website được phép có thể được gửi cho model.</p>
```

Show the actual retrieved source without implying that every retrieved marker was used in the answer. In `apps/firefox-extension/index.html`, insert immediately after `#answer-content`:

```html
<p id="grounding-sources" class="grounding-sources"></p>
```

In `apps/firefox-extension/src/sidebar/main.ts`, add a DOM ref near `groundingLabel` and append this exact block to `renderAnswer(response)`:

```ts
const groundingSources = requireElement<HTMLElement>("#grounding-sources");

// Inside renderAnswer(response), after groundingLabel.textContent:
const labels = response.groundingRefs.map(ref => {
  let site = "";
  if (ref.url) {
    try { site = new URL(ref.url).hostname; } catch { site = ""; }
  }
  const kind = ref.kind === "MEMORY" ? "Mốc đã lưu" : ref.kind === "WEB" ? "Web" : "Trang hiện tại";
  return `${kind}: ${ref.label}${site ? ` (${site})` : ""}`;
});
groundingSources.textContent = labels.length > 0
  ? `Nguồn được truy hồi: ${labels.join(" • ")}`
  : "Không có nguồn được truy hồi.";
```

`textContent` must be used; do not inject marker text as HTML. Invalid URL labels are handled without crashing the sidebar; the manual Firefox gate checks distinct site names.

### 5. Add concrete tests

Create `apps/firefox-extension/tests/select-turn-memories.test.ts` with this complete content:

```ts
import { describe, expect, it } from "vitest";
import { selectTurnMemories } from "../src/pipeline/select-turn-memories";
import type { MemoryMarker, MemorySummary, ViewportContext } from "@vlc/contracts";

const NOW = "2026-09-17T00:00:00.000Z";

function makeContext(url: string, text: string): ViewportContext {
  return {
    contextId: "async-context",
    source: { canonicalUrl: url, safeUrl: url, hostname: new URL(url).hostname, title: "Async lesson" },
    anchor: { heading: "Async and await", textQuote: text.slice(0, 240), scrollRatio: 0, fingerprint: "async-fp" },
    visibleText: text,
    visibleCodeBlocks: [],
    capturedAt: NOW,
  };
}

function makeMarker(id: string, url: string, heading: string): MemoryMarker {
  return {
    schemaVersion: 1,
    id,
    source: { canonicalUrl: url, safeUrl: url, hostname: new URL(url).hostname, title: heading },
    anchor: { heading, textQuote: heading, scrollRatio: 0, fingerprint: `${id}-fp` },
    status: "UNDERSTOOD",
    evidence: [{ kind: "USER_MARK", summary: "User confirmed", createdAt: NOW }],
    createdAt: NOW,
    updatedAt: NOW,
    lastVisitedAt: NOW,
    revision: 1,
  };
}

function makePageSummary(id: string, context: ViewportContext): MemorySummary {
  return {
    id,
    source: context.source,
    anchor: context.anchor,
    status: "REVIEW_LATER",
    updatedAt: NOW,
    revision: 1,
    matchScore: 1,
    matchReason: "EXACT_FINGERPRINT",
  };
}

describe("selectTurnMemories", () => {
  it("includes a confirmed Promise checkpoint from site 1 for an async question on site 2", () => {
    const context = makeContext("https://site-2.example/async", "async and await return promises");
    const promise = makeMarker("promise", "https://site-1.example/promise", "Promise resolve reject");
    const selected = selectTurnMemories([], [promise], context, "Explain async from what I know");
    expect(selected.map(item => item.id)).toEqual(["promise"]);
    expect(selected[0]?.matchReason).toBe("CROSS_SITE");
    expect(selected[0]?.status).toBe("UNDERSTOOD");
  });

  it("keeps page and cross-site evidence within five with no repeated ID", () => {
    const context = makeContext("https://site-2.example/async", "async promises");
    const page = Array.from({ length: 5 }, (_, index) => makePageSummary(`page-${index}`, context));
    const other = Array.from({ length: 4 }, (_, index) =>
      makeMarker(`other-${index}`, `https://site-${index}.example/promise`, "Promise"));
    const selected = selectTurnMemories(page, other, context, "Promise and async");
    expect(selected).toHaveLength(5);
    expect(selected.filter(item => item.matchReason === "CROSS_SITE")).toHaveLength(2);
    expect(new Set(selected.map(item => item.id)).size).toBe(5);
  });
});
```

In `apps/firefox-extension/tests/pipelines.test.ts`, extend `fakeRepository()` with `listMarkers: overrides.listMarkers ?? (async () => ({ ok: true, data: [] }))`. Pass a fake repository in every Ask test. Add tests with two source fixtures asserting: blocked-source marker absent from `requestAgentTurn` input; `searchMemory` failure makes `requestAgentTurn` uncalled and clears the old page array; catalog/policy failures make no HTTP call. The DOM-entrypoint navigation check stays in the Phase 3 manual Firefox flow; do not add a new browser harness for this task.

Use these exact additional test bodies with the existing `makeContext`, `makeMarker`, `makeMemorySummary`, `makeSession`, `fakeRepository`, `clock`, `idGenerator`, and `makeAgentResponse` fixtures. Add `type AgentTurnRequest` to the existing `@vlc/contracts` import:

```ts
it("excludes a user-blocked prior site from the Agent request", async () => {
  const context = makeContext();
  const old = makeMarker(context);
  old.source = {
    canonicalUrl: "https://blocked.example/promise",
    safeUrl: "https://blocked.example/promise",
    hostname: "blocked.example",
    title: "Promise",
  };
  const requestAgentTurn = vi.fn(async (_request: AgentTurnRequest) =>
    ({ ok: true as const, data: makeAgentResponse() }));
  const repo = fakeRepository({
    listMarkers: async () => ({ ok: true, data: [old] }),
    getSourcePolicySettings: async () => ({
      ok: true,
      data: { ...settings, blockedDomains: ["blocked.example"] },
    }),
  });
  await runAskAgentPipeline(
    { question: "Explain using what I know", session: makeSession(context) },
    { capture: async () => ({ ok: true, data: context }), requestAgentTurn, clock, idGenerator, memoryRepository: repo },
  );
  expect(requestAgentTurn).toHaveBeenCalledOnce();
  expect(requestAgentTurn.mock.calls[0]?.[0].relatedMemories).toEqual([]);
});

it("fails closed and clears old page memories when recall fails", async () => {
  const context = makeContext();
  const session = makeSession(context);
  session.relatedMemories = [makeMemorySummary(context)];
  const requestAgentTurn = vi.fn();
  const repo = fakeRepository({
    searchMemory: async () => ({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "storage read failed", retryable: true },
    }),
  });
  const result = await runAskAgentPipeline(
    { question: "Explain async", session },
    { capture: async () => ({ ok: true, data: context }), requestAgentTurn, clock, idGenerator, memoryRepository: repo },
  );
  expect(result.ok).toBe(false);
  expect(session.relatedMemories).toEqual([]);
  expect(requestAgentTurn).not.toHaveBeenCalled();
});
```

Add this table-driven case for catalog and policy read errors; the expected result is no HTTP call in both cases:

```ts
it.each(["catalog", "policy"] as const)("does not call Agent when %s read fails", async failedRead => {
  const context = makeContext();
  const error = { code: "INTERNAL_ERROR" as const, message: "read failed", retryable: true };
  const repo = fakeRepository({
    listMarkers: async () => failedRead === "catalog"
      ? { ok: false, error }
      : { ok: true, data: [] },
    getSourcePolicySettings: async () => failedRead === "policy"
      ? { ok: false, error }
      : { ok: true, data: settings },
  });
  const requestAgentTurn = vi.fn();
  const result = await runAskAgentPipeline(
    { question: "Explain async", session: makeSession(context) },
    { capture: async () => ({ ok: true, data: context }), requestAgentTurn, clock, idGenerator, memoryRepository: repo },
  );
  expect(result.ok).toBe(false);
  expect(requestAgentTurn).not.toHaveBeenCalled();
});
```

## Verify

```powershell
npm test --workspace @vlc/firefox-extension
npm run typecheck --workspace @vlc/firefox-extension
git diff -- apps/firefox-extension
```

Expected: all commands exit 0; no site 1 marker in current-page list/Resume; cross-site marker appears only in the Ask request. Inspect the diff before Phase 3. Rollback: revert Phase 2 scoped source edits using `apply_patch`; no stored marker is touched.
