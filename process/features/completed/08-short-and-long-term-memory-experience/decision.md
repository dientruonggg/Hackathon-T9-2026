# Decision: [DEC-08] Dynamic Viewport & Short/Long-Term Memory Synchronization Architecture

<decision version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — STATUS & METADATA
     ════════════════════════════════════════════ -->
<decision_metadata>
  <decision_id>DEC-08</decision_id>
  <task_id>FEAT-08</task_id>
  <status>APPROVED</status>
  <created>2026-09-12</created>
  <owner>@antigravity</owner>
</decision_metadata>

---

## 1. Context & Problem Statement
When a user scrolls and asks questions or inquires about what they learned on the page, the extension must dynamically refresh both the viewport anchor and memory search, the Agent API must recall saved markers even when the query is generic ("đã học gì"), and the Sidebar UI must prominently present both short-term working memory and long-term stored memory.

---

## 2. Options Considered

### Option 1: Minimal Query Regex Fix
Only relax query matching in `search_memory` without updating UI or ask pipeline dependencies.
- *Pros:* Quick.
- *Cons:* UI still displays stale heading/preview; user cannot refresh position without asking; long-term memory remains hidden.

### Option 2 (Adopted): Comprehensive Dynamic Synchronization & Dual-Memory UI
1. **Pipeline & Runtime:** Pass `memoryRepository` to `runAskAgentPipeline`; re-query memories for refreshed anchor; immediately update UI `#context-heading` and `#context-preview`.
2. **Explicit User Control:** Add `#refresh-context-button` ("Cập nhật vị trí") next to "Vị trí hiện tại" to allow manual position sync at any time.
3. **Agent Recall:** Update `search_memory` in `apps/agent-api/src/agent/tool-registry.ts` to recognize general/overview queries (`isGeneralQuery`) and return all matching page markers.
4. **Prompt Calibration:** Enhance `system-prompt.ts` so the Agent cleanly summarizes page learning history when asked.
5. **UI Enhancement:** Structure Sidebar with clear headers:
   - "Trí nhớ ngắn hạn (Đang đọc / Đoạn chọn)"
   - "Trí nhớ dài hạn (Các mốc đã lưu trên trang này)" with individual resume buttons.

---

## 3. Decision Rationale
Option 2 delivers a completely cohesive experience matching user expectations for active pair-learning and transparent memory inspection.

---

## 4. Gate G1 Sign-off
[AUTO: DELEGATED] Adopted Option 2. Proceeding to PLAN.

</decision>
