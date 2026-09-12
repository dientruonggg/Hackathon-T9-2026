# Plan: [FEAT-08] Dynamic Viewport Recapture & Short/Long-Term Memory Integration

<plan version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — METADATA & CONTROL
     ════════════════════════════════════════════ -->
<plan_metadata>
  <task_id>FEAT-08</task_id>
  <status>APPROVED</status>
  <created>2026-09-12</created>
  <owner>@antigravity</owner>
</plan_metadata>

---

## 1. Scope Contract

<scope_contract>
  <allowed_files>
    <file>apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts</file>
    <file>apps/firefox-extension/src/sidebar/main.ts</file>
    <file>apps/firefox-extension/index.html</file>
    <file>apps/firefox-extension/src/sidebar/styles.css</file>
    <file>apps/firefox-extension/tests/pipelines.test.ts</file>
    <file>apps/agent-api/src/agent/tool-registry.ts</file>
    <file>apps/agent-api/src/agent/system-prompt.ts</file>
    <file>apps/agent-api/tests/tool-registry.test.ts</file>
    <file>apps/agent-api/tests/agent-loop.test.ts</file>
  </allowed_files>

  <forbidden_files>
    <file>packages/contracts/**</file>
    <file>packages/memory/**</file>
  </forbidden_files>
</scope_contract>

---

## 2. Work Breakdown (Slices)

<slices>

### Slice 1: Dynamic Recapture & Memory Sync in Pipeline
- **File:** `apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts`
- **Action:** Add `memoryRepository?: MemoryRepository` to dependencies. When refreshed, re-query `searchMemory` with new anchor and update `session.relatedMemories`.
- **Verifier:** `npm test --workspace @vlc/firefox-extension`

### Slice 2: Agent API Overview Query Handling & System Prompt
- **Files:** `apps/agent-api/src/agent/tool-registry.ts`, `apps/agent-api/src/agent/system-prompt.ts`
- **Action:** Support `isGeneralQuery` in `search_memory` tool to return all memories on the page when asked about learned topics. Add prompt guidance for synthesizing page memory.
- **Verifier:** `npm test --workspace @vlc/agent-api`

### Slice 3: Sidebar UI & Dual-Memory Experience
- **Files:** `apps/firefox-extension/index.html`, `apps/firefox-extension/src/sidebar/styles.css`, `apps/firefox-extension/src/sidebar/main.ts`
- **Action:** Add `#refresh-context-button`, update context heading and preview dynamically on ask/refresh, and explicitly display Short-Term Memory and Long-Term Memory sections.
- **Verifier:** Visual check & extension build.

### Slice 4: Full Verification & E2E Validation
- **Action:** Run `npm run verify` to test all 88+ tests, check types, build all packages, lint extension.
- **Verifier:** `npm run verify`

</slices>

---

## 3. Gate G2 Sign-off
[AUTO: DELEGATED] Approved. Advancing to EXECUTE.

</plan>
