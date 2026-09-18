# Phase 3: truthful personal-knowledge answers and verification

**Depends on:** Phase 2 verified. **Blocks:** engineer review/G3. **Scope:** Phase 3 paths in `plan.md` only.

## Goal

Let the Agent inspect the bounded mixed-site candidate list, distinguish self-reported status from measured mastery, and cite markers actually returned by memory tools.

## Steps (future implementation; use `apply_patch`)

### 1. Correct the tool description

In `apps/agent-api/src/agent/tool-registry.ts`, replace the `search_memory` description string with:

```ts
description: "Tìm trong tối đa 5 dấu mốc do người học xác nhận mà extension đã chọn cho lượt hỏi hiện tại. Dấu mốc có thể đến từ trang đang xem hoặc website khác; query='all' liệt kê toàn bộ ứng viên này.",
```

The implementation still searches only the preloaded array; do not add server access to browser storage or a new endpoint. `read_memory` stays bounded to IDs in that same array.

### 2. Calibrate the system prompt

In `apps/agent-api/src/agent/system-prompt.ts`, replace rule 10's page-only block with this actual prompt text; retain rules 1–9:

```text
10. Khi người học hỏi dựa trên kiến thức cá nhân, gọi search_memory với query "all" để xem các dấu mốc được cung cấp cho lượt hỏi; dùng read_memory cho dấu mốc cần đối chiếu. Dấu mốc có thể thuộc website khác. Phân biệt rõ trang đang đọc với nguồn của dấu mốc và nêu tên nguồn khi áp dụng kiến thức cũ.
11. UNDERSTOOD / NOT_UNDERSTOOD / REVIEW_LATER là trạng thái người học tự đánh dấu, không phải kết quả kiểm tra năng lực. Nói "bạn đã đánh dấu phần Promise là Đã hiểu" thay vì khẳng định "bạn thành thạo Promise". Không suy ra 50%/25% hay một tỷ lệ hoàn thành từ số dấu mốc.
12. Bộ nhớ gửi đến Agent chỉ là tối đa 5 ứng viên. Nếu không có dấu mốc phù hợp, hãy nói chưa đủ dữ liệu về kiến thức đã lưu, rồi giải thích đoạn hiện tại dựa trên viewport; không bịa rằng người học đã biết một chủ đề ở website khác.
```

Do not insert a second closing template literal; the three lines replace existing rule 10 inside `buildSystemPrompt()`.

### 3. Make grounding references describe actual returned memories

In `apps/agent-api/src/agent/run-agent-turn.ts`, add next to `toolTrace`:

```ts
const returnedMemoryIds = new Set<string>();
```

Within the successful `tool.execute()` branch, immediately after `toolTrace.push(...)`, insert:

```ts
if (tc.name === "search_memory" && Array.isArray(toolResult.data)) {
  for (const item of toolResult.data) {
    if (typeof item === "object" && item !== null && "id" in item && typeof item.id === "string") {
      returnedMemoryIds.add(item.id);
    }
  }
}
if (tc.name === "read_memory" &&
    typeof toolResult.data === "object" && toolResult.data !== null &&
    "id" in toolResult.data && typeof toolResult.data.id === "string") {
  returnedMemoryIds.add(toolResult.data.id);
}
```

Replace the old `hasMemoryTool` calculation and the `MEMORY` grounding-ref branch with:

```ts
const returnedMemories = input.relatedMemories.filter(memory => returnedMemoryIds.has(memory.id));
const hasMemoryTool = returnedMemories.length > 0;

// In the existing groundingRefs branch:
} else if (grounding === "MEMORY") {
  groundingRefs.push({
    kind: "VIEWPORT",
    refId: input.context.contextId,
    label: input.context.anchor.heading || input.context.source.title,
    url: input.context.source.safeUrl,
  });
  for (const memory of returnedMemories.slice(0, 3)) {
    groundingRefs.push({
      kind: "MEMORY",
      refId: memory.id,
      label: `${memory.anchor.heading || memory.source.title} — ${memory.status}`,
      url: memory.source.safeUrl,
    });
  }
```

Keep the existing `INSUFFICIENT`, `WEB`, and `VIEWPORT` branches. If `search_memory` succeeds with `[]`, `hasMemoryTool` is false. If a model answer contains explicit insufficiency language, keep `INSUFFICIENT` as the highest priority. The references show returned evidence, not a claim that the model used every returned item.

### 4. Add Agent tests

In `apps/agent-api/tests/tool-registry.test.ts`, add one case using two preloaded summaries with different `source.canonicalUrl`: `search_memory({query:'all'})` returns both, and `read_memory({memoryId: otherSiteId})` returns the other-site source. A non-preloaded ID remains `MEMORY_NOT_FOUND`.

In `apps/agent-api/tests/agent-loop.test.ts`, add these cases using the existing `dummyRequest`/fake-provider pattern:

```ts
it("does not claim MEMORY grounding when search_memory returns no marker", async () => {
  let calls = 0;
  const provider: LlmProvider = {
    async generate(): Promise<Result<LlmGenerateOutput>> {
      calls += 1;
      return calls === 1
        ? { ok: true, data: {
            toolCalls: [{ id: "empty-search", name: "search_memory", arguments: { query: "unmatched" } }],
            model: { provider: "fake", name: "test" },
          } }
        : { ok: true, data: { text: "Viewport only.", model: { provider: "fake", name: "test" } } };
    },
  };
  const result = await runAgentTurn(dummyRequest, { provider });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.data.grounding).toBe("VIEWPORT");
});

it("attributes a returned cross-site marker, not the first preloaded marker", async () => {
  const otherSite: MemorySummary = {
    ...dummyMemory,
    id: "promise-from-site-1",
    source: {
      canonicalUrl: "https://site-1.example/promise",
      safeUrl: "https://site-1.example/promise",
      hostname: "site-1.example",
      title: "Promise",
    },
    anchor: { ...dummyMemory.anchor, heading: "Promise resolve reject" },
    note: "I understand resolve and reject",
    matchReason: "CROSS_SITE",
  };
  let calls = 0;
  const provider: LlmProvider = {
    async generate(): Promise<Result<LlmGenerateOutput>> {
      calls += 1;
      return calls === 1
        ? { ok: true, data: {
            toolCalls: [{ id: "promise-search", name: "search_memory", arguments: { query: "Promise" } }],
            model: { provider: "fake", name: "test" },
          } }
        : { ok: true, data: { text: "You marked Promise as understood.", model: { provider: "fake", name: "test" } } };
    },
  };
  const result = await runAgentTurn(
    { ...dummyRequest, relatedMemories: [dummyMemory, otherSite] }, { provider });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.grounding).toBe("MEMORY");
    expect(result.data.groundingRefs.some(ref =>
      ref.kind === "MEMORY" && ref.refId === otherSite.id && ref.url === otherSite.source.safeUrl
    )).toBe(true);
    expect(result.data.groundingRefs.some(ref => ref.refId === dummyMemory.id)).toBe(false);
  }
});
```

Use a `query` that matches only the other-site marker; if the existing `dummyMemory` text contains “Promise” after test fixture changes, rename it so the assertion remains discriminating.

### 5. Execute gates and inspect scope

```powershell
npm test --workspace @vlc/agent-api
npm run verify
git status --short
git diff --check
git diff -- packages apps
```

Expected: both test commands exit 0; `web-ext lint` reports zero errors/warnings; diff check exits 0; only `plan.md`-allowed files differ from the pre-implementation baseline. Do not remove existing user-owned untracked files.

### 6. Manual Firefox golden flow (later implementation/review only)

Use two allowed HTML lessons, not Facebook (currently blocked by source policy). Run the existing API and `npm run demo:firefox` with the same demo profile; never inspect its SQLite/profile files directly.

1. On lesson 1 (Promise), ask about one section, optionally note “I understand resolve/reject, not chaining”, click `Đã hiểu`, and observe successful revision.
2. Switch to lesson 2 (async), ask/mark a distinct section, and observe that its page marker list contains only lesson 2. Ask how async builds on what was learned about Promise. Confirm an answer refers to the saved self-report from lesson 1 and names its source without inventing percentages.
3. Return to lesson 1. Confirm its marker is still present and Resume targets lesson 1. Close/reopen Firefox through the same `demo:firefox` profile and verify both markers remain via the UI/Firefox Extension Storage inspector.
4. Start a deliberately slow Ask on lesson 1 and switch to lesson 2 before it finishes. The lesson 1 answer/proposal must not appear as the lesson 2 answer; a site 1 marker must not be saved to site 2.
5. Block lesson 1 and ask again on lesson 2. Its old marker must not enter the Agent request; the UI must not claim knowledge of that blocked source. Unblock only through the existing user control, then verify it is eligible again.

Expected: each observation recorded with date, Firefox/profile mode, source URLs, screenshot or concise UI evidence, and whether API/model was actually available. Automated tests do not substitute for this run. Rollback: source edits only; preserve user markers and profile.
