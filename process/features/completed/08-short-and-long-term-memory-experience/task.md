# Task: [FEAT-08] Dynamic Viewport Recapture & Short/Long-Term Memory Integration

<task_spec version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL (master state record)
     ════════════════════════════════════════════ -->
<task_control>
  <status>COMPLETED</status>
  <spec_level>S3</spec_level>
  <priority>P1</priority>
  <risk>MEDIUM</risk>
  <estimated_story_points>2</estimated_story_points>
  <working_mode>DELEGATED</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@antigravity</owner>
  <decision_owner>@antigravity</decision_owner>
  <created>2026-09-12</created>
  <last_updated>2026-09-12</last_updated>
</task_control>

---

## 1. Specification (Pillar 1: Task / Spec)

<specification>
  <goal>
    Enable dynamic viewport and memory synchronization so that:
    1. Every time the user asks a question or clicks "Cập nhật vị trí", the active viewport/selection position and its associated memories are dynamically refreshed and visible on the UI.
    2. When the user asks about what they have learned on this page (e.g. "tôi đã học những gì trong trang này?"), the Agent is aware of all saved long-term markers on this page and synthesizes them accurately.
    3. The UI explicitly separates and represents Short-Term Memory (active viewport context + recent turn dialogue) and Long-Term Memory (page learning markers + status overview).
  </goal>

  <current_behavior>
    - While `runAskAgentPipeline` recaptures the viewport text into `session.context`, it does not re-query `memoryRepository.searchMemory` for the new anchor or update the UI heading/preview immediately.
    - `search_memory` tool strictly filters `mem.anchor.heading.includes(query)`, failing on semantic or overview queries like "đã học", "toàn bộ", "những gì đã học".
    - The Sidebar UI hides the page marker list inside a collapsed privacy details tag and does not provide an explicit button to refresh position without typing a question.
  </current_behavior>

  <expected_behavior>
    - Refreshing position or asking a question immediately updates UI `#context-heading` and `#context-preview`, queries memories for the new anchor, and displays the exact section being inspected.
    - Added dedicated "Cập nhật vị trí" button in Sidebar next to "Vị trí hiện tại".
    - `search_memory` tool handles general learning summary queries (including empty, wildcard, or "đã học/học gì" queries) by returning the page's saved markers.
    - System prompt explicitly guides the Agent on how to synthesize learned items on the current page.
    - Sidebar clearly delineates Short-Term Memory (Working context & chat) and Long-Term Memory (Saved markers & learning summary).
  </expected_behavior>

  <actor_authorization>
    User interacts with Firefox Sidebar; Agent API processes turn requests.
  </actor_authorization>

  <invariants>
    - Preserve Safe Observability (no raw text, tokens, or URL query strings in server logs).
    - Maintain zero changes to `@vlc/contracts` package schema.
    - Preserves user confirmation invariant: markers only saved on explicit user action.
    - 100% passing tests (unit + integration) and zero lint issues.
  </invariants>

  <out_of_scope>
    - Modifying SQLite database format or schema.
    - External vector/cloud embedding databases.
  </out_of_scope>

  <acceptance_criteria>
    - [x] AC-1: Asking or clicking "Cập nhật vị trí" recaptures the active tab viewport/selection, updates `#context-heading` and `#context-preview`, and updates `session.relatedMemories`.
    - [x] AC-2: Dedicated "Cập nhật vị trí" button available on Sidebar.
    - [x] AC-3: `search_memory` tool and system prompt handle page history queries ("đã học những gì", "tổng hợp kiến thức đã lưu") accurately.
    - [x] AC-4: UI clearly presents Short-Term Memory and Long-Term Memory.
    - [x] AC-5: All tests in `@vlc/firefox-extension` and `@vlc/agent-api` pass cleanly (`npm run verify`).
  </acceptance_criteria>

  <definition_of_ready>
    - [x] Target outcome and acceptance criteria are verifiable without guessing.
    - [x] Invariants and <out_of_scope> boundaries are explicit.
    - [x] Open questions resolved or scheduled in decision.md.
  </definition_of_ready>
</specification>

---

## 2. Context Boundaries (Pillar 2: Context)

<context_boundaries>
  <target_files>
    - `apps/firefox-extension/src/sidebar/main.ts`
    - `apps/firefox-extension/index.html`
    - `apps/firefox-extension/src/sidebar/styles.css`
    - `apps/firefox-extension/src/pipeline/ask-agent-pipeline.ts`
    - `apps/agent-api/src/agent/tool-registry.ts`
    - `apps/agent-api/src/agent/system-prompt.ts`
  </target_files>

  <context_groups>
    - architecture
    - tests
  </context_groups>

  <source_of_truth>
    <architecture>process/context/architecture/03-memory-tools-skills.md</architecture>
    <tests>npm run verify</tests>
  </source_of_truth>
</context_boundaries>

---

## 3. Verification Strategy

<verification_strategy>
| AC / Risk | Evidence required | Verifier |
|---|---|---|
| AC-1, AC-2 | Viewport refresh and UI update on click or ask | Vitest extension tests |
| AC-3 | Agent returns learned items when asked about page history | Vitest agent-api tests |
| AC-4 | UI displays distinct short-term & long-term memory sections | HTML/CSS structure & tests |
| AC-5 | Zero type errors, 100% tests pass, zero lint warnings | `npm run verify` |
</verification_strategy>

</task_spec>
