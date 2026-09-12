# Task Lite: [BUG-08] Fix URLSearchParams Keys Iterator in Firefox Content Script

<task_lite version="3.0" framework="RIPER-5-Lite">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL
     ════════════════════════════════════════════ -->
<task_control>
  <track>LITE</track>
  <status>COMPLETED</status>
  <priority>P0</priority>
  <working_mode>DELEGATED</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@antigravity</owner>
</task_control>

---

## 1. Intent & Specification

<specification>
  <goal>
    Fix TypeError: t.searchParams.keys() is not iterable in Firefox content scripts when capturing viewport or highlighting/resuming by replacing spread operator on searchParams.keys() with searchParams.forEach.
  </goal>

  <invariants>
    - Preserve canonical URL sanitization (strip tracking parameters: utm_*, fbclid, gclid, ref, source).
    - Maintain zero regressions in test suite and clean TypeScript compilation.
    - Keep @vlc/contracts unchanged.
  </invariants>

  <acceptance_criteria>
    - [x] AC-1: Replace [...canonical.searchParams.keys()] with searchParams.forEach in capture-current-viewport.ts and highlight-or-resume.ts.
    - [x] AC-2: All unit tests in @vlc/firefox-extension pass (npm test).
    - [x] AC-3: Full verify pipeline passes (npm run verify).
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
    <file>apps/firefox-extension/src/content/capture-current-viewport.ts</file>
    <file>apps/firefox-extension/src/content/highlight-or-resume.ts</file>
    <file>apps/firefox-extension/tests/capture-current-viewport.test.ts</file>
    <file>apps/firefox-extension/tests/highlight-or-resume.test.ts</file>
  </allowed_files>

  <forbidden_files>
    <file>packages/contracts/**</file>
    <file>packages/memory/**</file>
    <file>apps/agent-api/**</file>
  </forbidden_files>
</scope_contract>

---

## 3. Execution Plan (Compact Slices)

<execution_plan>
  ### Slice 1: Safe searchParams parameter deletion via forEach
  - **Action:** Update toCanonicalUrl in capture-current-viewport.ts and canonicalize in highlight-or-resume.ts to collect keys via searchParams.forEach and delete them safely.
  - **Verifier:** npm test --workspace @vlc/firefox-extension
  - **Status:** [x] DONE (48/48 tests passed)

  ### Slice 2: Verification and Build
  - **Action:** Run npm run verify to rebuild extension and ensure 0 lint errors and 100% tests passing.
  - **Verifier:** npm run verify
  - **Status:** [x] DONE (88/88 tests passed, 0 lint errors, dist rebuilt and hot-reloaded into Firefox)
</execution_plan>

---

## 4. Consolidated Verification & Gates

<verification_gates>
  - [x] **Gate G1/G2 (Plan Approved):** [AUTO: DELEGATED] Allowed files confirmed, root cause identified (Firefox Xray wrapper iterator incompatibility with searchParams.keys()).
  - [x] **Gate G3 (Ready for Handoff):**
    - [x] Verifier commands executed cleanly (Zero errors, 88 tests pass).
    - [x] Git diff inspected — NO files touched outside `<allowed_files>`.
    - [x] No temporary debug logs or unintended changes.
</verification_gates>

</task_lite>
