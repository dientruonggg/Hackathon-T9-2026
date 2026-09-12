# Handoff: [FEAT-08] Dynamic Viewport Recapture & Short/Long-Term Memory Integration

<handoff version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — METADATA
     ════════════════════════════════════════════ -->
<handoff_metadata>
  <task_id>FEAT-08</task_id>
  <status>COMPLETED</status>
  <created>2026-09-12</created>
  <owner>@antigravity</owner>
</handoff_metadata>

---

## 1. Summary of Changes
- **Dynamic Recapture on Ask & Demand:**
  - Added `#refresh-context-button` ("↻ Cập nhật vị trí") next to current viewport in Sidebar.
  - Asking a question or clicking the refresh button immediately recaptures active viewport and selection, updates `#context-heading`, `#context-preview`, and re-queries `memoryRepository.searchMemory` for the new anchor.
- **Agent Memory Recall for Page History:**
  - Enhanced `search_memory` tool in `@vlc/agent-api` to recognize general/overview queries (`isGeneralQuery`) such as "đã học", "toàn bộ", "tất cả", "lịch sử", "summary".
  - Enhanced `system-prompt.ts` with rule 10 directing the Agent to call `search_memory` and synthesize all saved markers on the page when asked.
- **Explicit Dual-Memory UI:**
  - Clearly partitioned into **Trí nhớ ngắn hạn • Đang xem** (current viewport, selection, active turn dialogue) and **Trí nhớ dài hạn • Dấu mốc đã lưu** (saved markers with resume triggers).

---

## 2. Verification Evidence
- `npm run verify`: 89/89 tests pass, TypeScript compilation clean, `web-ext lint` 0 warnings/errors.
- Live background runtime: Agent API and Firefox extension reloaded successfully with no downtime.

</handoff>
