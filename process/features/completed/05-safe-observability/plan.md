# Plan: PLAN-01 Safe Agent API Observability

<execution_plan task_id="05-safe-observability" plan_id="PLAN-01" version="2.0" framework="RIPER-5">

<!-- PLAN PHASE. Plan artifacts only. No source-code changes. -->
<plan_status>
  <phase>PLAN</phase>
  <last_updated>2026-09-12</last_updated>
</plan_status>

---

## 1. Input Artifacts

<input_artifacts>
  <task_spec>process/features/active/05-safe-observability/task.md</task_spec>
  <research>process/features/active/05-safe-observability/research.md</research>
  <decision>process/features/active/05-safe-observability/decision.md — DEC-01 (Option A)</decision>
</input_artifacts>

---

## 2. Execution Constraints

<execution_constraints>
  <allowed_files>
    - `apps/agent-api/src/observability/agent-observer.ts` — [New observer contract & default stdout JSON implementation]
    - `apps/agent-api/src/agent/run-agent-turn.ts` — [Observer injection & tool.completed emission]
    - `apps/agent-api/src/routes/agent-turn.ts` — [Observer injection, turn.started, duration measurement, turn.completed/failed emission]
    - `apps/agent-api/src/app.ts` — [AppDependencies wiring for observer]
    - `apps/agent-api/tests/observability.test.ts` — [New comprehensive test suite for safe observability]
    - `apps/agent-api/tests/logging.test.ts` — [Preserve and align existing logging sanitization test]
  </allowed_files>
  <forbidden_files>
    - `packages/**` — [Contracts and memory packages are frozen]
    - `apps/firefox-extension/**` — [Owned by Agent A]
    - `package.json` — [No root dependency changes]
    - `package-lock.json` — [No lockfile modifications]
  </forbidden_files>
  <allowed_commands>
    - `npm run typecheck --workspace @vlc/agent-api`
    - `npm test --workspace @vlc/agent-api`
    - `npm run build --workspace @vlc/agent-api`
  </allowed_commands>
  <restricted_operations>
    - No new dependencies.
    - No changes to public HTTP contracts.
    - No logging of raw question, viewport text, secrets, or stack traces.
  </restricted_operations>
  <required_approvals>
    - None required (DELEGATED fast-track mode).
  </required_approvals>
</execution_constraints>

---

## 3. Slice Summary

<slice_summary>

| ID | Behavior | Boundary | Files | AC | Verifier | Risk | Mode | Rollback |
|---|---|---|---|---|---|---|---|---|
| S1 | SafeAgentEvent types & AgentObserver implementations | Observer module | `apps/agent-api/src/observability/agent-observer.ts` | AC-1, AC-5 | `npm run typecheck --workspace @vlc/agent-api` | LOW | Autonomous | `git checkout -- apps/agent-api/src/observability/agent-observer.ts` |
| S2 | Agent loop & route integration | Agent API runtime | `apps/agent-api/src/agent/run-agent-turn.ts`, `apps/agent-api/src/routes/agent-turn.ts`, `apps/agent-api/src/app.ts` | AC-2, AC-3, AC-4 | `npm test --workspace @vlc/agent-api` | LOW | Autonomous | `git checkout -- apps/agent-api/src/` |
| S3 | Test suite & verification harness | Test harness | `apps/agent-api/tests/observability.test.ts`, `apps/agent-api/tests/logging.test.ts` | AC-4, AC-5, AC-6, AC-7 | `npm run typecheck --workspace @vlc/agent-api && npm test --workspace @vlc/agent-api && npm run build --workspace @vlc/agent-api` | LOW | Autonomous | `git checkout -- apps/agent-api/tests/` |

</slice_summary>

---

## 4. Slice Details

<slices>

  <slice id="S1">
    <objective>Define SafeAgentEvent union, AgentObserver interface, ConsoleJsonAgentObserver, and NoopAgentObserver</objective>
    <change>Create apps/agent-api/src/observability/agent-observer.ts</change>
    <allowed_files>
      - `apps/agent-api/src/observability/agent-observer.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-1: SafeAgentEvent discriminated union matching spec exactly.
      - [ ] AC-5: ConsoleJsonAgentObserver writes one JSON line per event to stdout.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm run typecheck --workspace @vlc/agent-api
      ```
    </verifier>
    <expected_evidence>tsc exits with code 0</expected_evidence>
    <rollback_point>Remove apps/agent-api/src/observability/agent-observer.ts</rollback_point>
    <stop_conditions>
      - Compilation failure with @vlc/contracts types
    </stop_conditions>
  </slice>

  <slice id="S2">
    <objective>Wire AgentObserver into runAgentTurn, route handler, and buildApp</objective>
    <change>
      Update apps/agent-api/src/agent/run-agent-turn.ts to accept observer in deps and emit agent.tool.completed events with step and error code.
      Update apps/agent-api/src/routes/agent-turn.ts to emit agent.turn.started, measure duration, and emit terminal agent.turn.completed or agent.turn.failed.
      Update apps/agent-api/src/app.ts to accept observer in AppDependencies and forward to agentTurnRoutes.
    </change>
    <allowed_files>
      - `apps/agent-api/src/agent/run-agent-turn.ts`
      - `apps/agent-api/src/routes/agent-turn.ts`
      - `apps/agent-api/src/app.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-2: Route and agent loop emit started, tool.completed, completed/failed events.
      - [ ] AC-3: Tool execution emits agent.tool.completed with exact step (1|2|3) and status.
      - [ ] AC-4: Terminal events record non-negative durationMs and correct toolCount.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm run typecheck --workspace @vlc/agent-api && npm test --workspace @vlc/agent-api
      ```
    </verifier>
    <expected_evidence>All existing tests pass and typecheck clean</expected_evidence>
    <rollback_point>git checkout -- apps/agent-api/src/</rollback_point>
    <stop_conditions>
      - Breaking existing tests or contract schemas
    </stop_conditions>
  </slice>

  <slice id="S3">
    <objective>Add comprehensive unit and integration tests verifying all events, timing, sanitization, and build</objective>
    <change>
      Create apps/agent-api/tests/observability.test.ts covering:
      1. Successful turn with tools emits started -> tool.completed (SUCCESS) -> completed.
      2. Provider error emits started -> failed with correct errorCode and retryable flag.
      3. Tool failure emits tool.completed with ERROR and errorCode, and turn still completes.
      4. Duration is >= 0 and toolCount equals count of tool events.
      5. Sanitization assertion: serialized events contain NO secret/viewport/question/prompt.
      6. Error response contains NO stack traces.
      Update apps/agent-api/tests/logging.test.ts if necessary to ensure compatibility.
    </change>
    <allowed_files>
      - `apps/agent-api/tests/observability.test.ts`
      - `apps/agent-api/tests/logging.test.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-6: All tests pass with full assertions.
      - [ ] AC-7: Typecheck, test, and build pass cleanly.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm run typecheck --workspace @vlc/agent-api && npm test --workspace @vlc/agent-api && npm run build --workspace @vlc/agent-api
      ```
    </verifier>
    <expected_evidence>Test suite passes 100%, build succeeds with output in dist/</expected_evidence>
    <rollback_point>git checkout -- apps/agent-api/tests/</rollback_point>
    <stop_conditions>
      - Test failure or leak detection
    </stop_conditions>
  </slice>

</slices>

---

## 5. Scope Contract

<scope_contract>
  <allowed>
    - `apps/agent-api/src/observability/agent-observer.ts`
    - `apps/agent-api/src/agent/run-agent-turn.ts`
    - `apps/agent-api/src/routes/agent-turn.ts`
    - `apps/agent-api/src/app.ts`
    - `apps/agent-api/tests/observability.test.ts`
    - `apps/agent-api/tests/logging.test.ts`
  </allowed>
  <forbidden>
    - `packages/**`
    - `apps/firefox-extension/**`
    - `package.json`
    - `package-lock.json`
  </forbidden>
</scope_contract>

---

## 6. Verification Matrix

<verification_matrix>

| AC / Risk | Test / Command | Expected Evidence | Strictness | Actual Result |
|---|---|---|---|---|
| AC-1: SafeAgentEvent types | `npm run typecheck --workspace @vlc/agent-api` | Exit code 0 | hard-mandatory | Pending |
| AC-2: Lifecycle event emission | `npm test --workspace @vlc/agent-api` | started, tool, completed captured | hard-mandatory | Pending |
| AC-3: Tool completed metadata | `npm test --workspace @vlc/agent-api` | step 1-3, status, errorCode matching | hard-mandatory | Pending |
| AC-4: Duration & toolCount | `npm test --workspace @vlc/agent-api` | durationMs >= 0, toolCount exact | hard-mandatory | Pending |
| AC-5: Stdout JSON line observer | `npm test --workspace @vlc/agent-api` | Valid JSON line per event | hard-mandatory | Pending |
| AC-6: Sanitization & zero leak | `npm test --workspace @vlc/agent-api` | No raw question, viewport, prompt, secret | hard-mandatory | Pending |
| AC-7: Full build verification | `npm run build --workspace @vlc/agent-api` | Clean compilation into dist/ | hard-mandatory | Pending |

</verification_matrix>

---

## Gate 2 — Plan Approved

<gate id="G2">
  - [x] Every slice has a defined verifier.
  - [x] Scope contract (allowed / forbidden) approved.
  - [x] Enforcement strictness assigned per AC/verification item.
  - [x] Stop conditions defined per slice.
  - [x] Rollback point defined per slice.
  - [x] Allowed commands listed.
  - [x] Plan approved.
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12</approved_date>
</gate>

</execution_plan>
