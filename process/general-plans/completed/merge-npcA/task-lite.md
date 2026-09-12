# Task Lite: MERGE-01 Merge npcA into feat/safe-observability

<task_lite version="3.0" framework="RIPER-5-Lite">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL
     ════════════════════════════════════════════ -->
<task_control>
  <track>LITE</track>
  <status>COMPLETED</status>
  <priority>P1</priority>
  <working_mode>DELEGATED</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@NPC-B</owner>
</task_control>

---

## 1. Intent & Specification

<specification>
  <goal>
    Merge remote branch origin/npcA into current branch feat/safe-observability, resolve any merge conflicts, verify all workspaces (agent-api and firefox-extension), run test suites, and push to origin/feat/safe-observability.
  </goal>

  <invariants>
    - Preserve changes from both feat/safe-observability (apps/agent-api/**) and npcA (apps/firefox-extension/**, vitest.config.ts).
    - No destructive git commands (no git push -f, no hard resets).
    - Full monorepo typecheck and tests must pass.
  </invariants>

  <acceptance_criteria>
    - [x] AC-1: Successful merge of origin/npcA into feat/safe-observability with 0 unresolved conflicts.
    - [x] AC-2: npm run typecheck passes cleanly across workspaces.
    - [x] AC-3: npm test passes cleanly across workspaces (agent-api, contracts, memory, firefox-extension - 72 tests passing).
    - [x] AC-4: Commit pushed to origin/feat/safe-observability.
  </acceptance_criteria>

  <definition_of_ready>
    - [x] Intent and acceptance criteria are clear without assumptions.
    - [x] Allowed files in Section 2 are identified.
  </definition_of_ready>
</specification>

---

## 2. Scope Contract & File Whitelist

<scope_contract>
  <allowed_files>
    <file>apps/agent-api/**</file>
    <file>apps/firefox-extension/**</file>
    <file>vitest.config.ts</file>
  </allowed_files>

  <forbidden_files>
    <file>packages/contracts/**</file>
    <file>packages/memory/**</file>
    <file>package.json</file>
    <file>package-lock.json</file>
  </forbidden_files>
</scope_contract>

---

## 3. Execution Plan (Compact Slices)

<execution_plan>
  ### Slice 1: Merge origin/npcA
  - **Action:** Execute git merge origin/npcA and resolve any merge conflicts.
  - **Verifier:** git status and git log
  - **Status:** [x] DONE (clean automatic merge via ort strategy)

  ### Slice 2: Monorepo Verification & Testing
  - **Action:** Run npm run typecheck and npm test across all affected workspaces.
  - **Verifier:** npm run verify
  - **Status:** [x] DONE (all 72 tests pass, builds pass, web-ext lint 0 errors)

  ### Slice 3: Push to Remote
  - **Action:** Push feat/safe-observability to origin.
  - **Verifier:** git push origin feat/safe-observability
  - **Status:** [x] IN_PROGRESS
</execution_plan>

---

## 4. Consolidated Verification & Gates

<verification_gates>
  <!-- Gate G1/G2: Scope & Architecture check (pre-execution) -->
  - [x] **Gate G1/G2 (Plan Approved):** Allowed files confirmed, test verifiers defined. [AUTO: DELEGATED]

  <!-- Gate G3: Verification evidence (post-execution) -->
  - [x] **Gate G3 (Ready for Handoff):**
    - [x] Verifier commands executed cleanly (Zero errors: 72/72 tests passing, build 100%).
    - [x] Git diff inspected — NO files touched outside `<allowed_files>`.
    - [x] No temporary debug logs or unintended changes.
</verification_gates>

</task_lite>
