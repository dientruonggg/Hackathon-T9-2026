# Research: [FEAT-08] Dynamic Viewport Recapture & Short/Long-Term Memory Experience

<research version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — METADATA & STATUS
     ════════════════════════════════════════════ -->
<research_metadata>
  <task_id>FEAT-08</task_id>
  <status>COMPLETED</status>
  <created>2026-09-12</created>
  <owner>@antigravity</owner>
</research_metadata>

---

## 1. Research Objectives
1. Investigate how viewport position is recaptured during ask vs. how the UI reflects changes.
2. Determine why `search_memory` in Agent API failed when asked general questions like "những gì tôi đã học trong trang này".
3. Evaluate the UX representation of Short-Term Memory vs. Long-Term Memory in the Sidebar.

---

## 2. Findings & Evidence

### Finding 1: UI and Memory Desynchronization on Ask
- **Observed:** `runAskAgentPipeline` re-executes `deps.capture({ tabId, expectedUrl })` and updates `session.context`. However:
  - `deps` lacks `memoryRepository`, so `session.relatedMemories` remains stuck on the initial anchor.
  - `sidebar/main.ts` does not update `#context-heading` or `#context-preview` when `askCurrentContext` runs, leaving the stale top-of-page text displayed.
- **Classification:** Confirmed in `apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts` lines 47-82.

### Finding 2: `search_memory` Over-Filtering on Overview Queries
- **Observed:** In `apps/agent-api/src/agent/tool-registry.ts`, `search_memory` does `mem.anchor.heading.toLowerCase().includes(lowerQuery)`.
- When an LLM executes `search_memory({ query: "học" })` or `search_memory({ query: "đã học" })`, it compares against English headings like "Promise" or "Callback Example". Since none contain the literal string "đã học", it returns an empty array `[]`.
- **Classification:** Confirmed in `apps/agent-api/src/agent/tool-registry.ts` lines 112-124.

### Finding 3: Lack of Explicit Viewport Refresh Button & Memory Visibility
- **Observed:** If the user scrolls down 3 pages and wants to verify what section the extension sees without asking a question, there was no "Cập nhật vị trí" button.
- The stored markers on the page are tucked away inside `<details class="privacy-panel">`, making long-term memory invisible unless expanding the privacy panel.
- **Classification:** Confirmed in `apps/firefox-extension/index.html`.

---

## 3. Exit Criteria Evaluation (Gate G0)
- [x] All 3 root causes identified with line numbers.
- [x] Solution does not break contracts or privacy invariants.
- [x] Safe Observability preserved.

</research>
