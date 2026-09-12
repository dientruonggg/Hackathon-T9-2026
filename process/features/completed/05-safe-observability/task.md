# Task: 05-safe-observability — Safe Agent API Observability

<task_spec version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL (master state record)
     ════════════════════════════════════════════ -->
<task_control>
  <status>COMPLETED</status>
  <spec_level>S3</spec_level>
  <priority>P1</priority>
  <risk>LOW</risk>
  <estimated_story_points>2</estimated_story_points>
  <working_mode>DELEGATED</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@NPC-B</owner>
  <decision_owner>@NPC-B</decision_owner>
  <created>2026-09-12</created>
  <last_updated>2026-09-12</last_updated>
</task_control>

---

## 1. Specification (Pillar 1: Task / Spec)

<specification>
  <goal>
    Enable the team to observe agent turn executions, tool invocations, durations, and outcomes in apps/agent-api without leaking learning data, user questions, secrets, or sensitive viewport content.
  </goal>

  <current_behavior>
    apps/agent-api executes runAgentTurn without structured telemetry or event emissions. Only basic Fastify request handling exists with no per-step timing, tool execution telemetry, or structured safe JSON events.
  </current_behavior>

  <expected_behavior>
    A standalone, injectable AgentObserver system emits typed, structured SafeAgentEvent JSON lines to stdout by default:
    - agent.turn.started (turnId)
    - agent.tool.completed (turnId, step, toolName, status: SUCCESS | ERROR, errorCode?)
    - agent.turn.completed (turnId, durationMs, grounding, toolCount, modelName)
    - agent.turn.failed (turnId, durationMs, errorCode, retryable)
    Zero leak of raw questions, visible text/code blocks, memory entries, full URLs/queries, prompt messages, tool results, auth headers, API keys, or stack traces.
  </expected_behavior>

  <actor_authorization>
    Internal backend runtime within apps/agent-api service boundary.
  </actor_authorization>

  <invariants>
    - No changes outside apps/agent-api/** (no changes to packages/**, root package.json, or apps/firefox-extension/**).
    - No new external dependencies added.
    - Zero data leakage of sensitive content or credentials.
    - Each started turn terminates with exactly one terminal event (completed OR failed).
    - Strict adherence to SafeAgentEvent shape and AppErrorCode typing.
  </invariants>

  <out_of_scope>
    - Modifying shared packages (@vlc/contracts, @vlc/memory).
    - Modifying browser extension or UI.
    - Adding external telemetry systems (OTel, Datadog, Sentry, Prometheus).
  </out_of_scope>

  <acceptance_criteria>
    - [x] AC-1: AgentObserver and SafeAgentEvent defined in apps/agent-api/src/observability/agent-observer.ts.
    - [x] AC-2: runAgentTurn and Fastify route /v1/agent/turn inject and emit events accurately throughout the lifecycle.
    - [x] AC-3: Tool execution emits agent.tool.completed with exact step (1|2|3), status, and required errorCode on failure.
    - [x] AC-4: Terminal events (agent.turn.completed or agent.turn.failed) emitted with valid non-negative durationMs and accurate toolCount.
    - [x] AC-5: Default stdout observer outputs single-line structured JSON without leaking raw content/secrets/stack traces.
    - [x] AC-6: Automated unit and integration tests verify all scenarios and confirm zero data leaks.
    - [x] AC-7: npm run typecheck, test, and build pass cleanly in @vlc/agent-api workspace.
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
    - `apps/agent-api/src/observability/agent-observer.ts` — [SafeAgentEvent contract and default/stdout observer]
    - `apps/agent-api/src/agent/run-agent-turn.ts` — [Accept optional observer, emit tool events, track tool counts]
    - `apps/agent-api/src/routes/agent-turn.ts` — [Accept observer, emit started, measure duration, emit completed/failed]
    - `apps/agent-api/src/app.ts` — [Wire observer into AppDependencies and route registration]
    - `apps/agent-api/tests/observability.test.ts` — [Comprehensive test suite for observer events, sanitization, and timing]
  </target_files>

  <context_groups>
    - apps/agent-api/**
  </context_groups>

  <source_of_truth>
    <requirement>.agents/tasks/05-safe-observability/TASK.md</requirement>
    <architecture>.agents/architecture/08-last-mile-plan.md</architecture>
    <existing_behavior>apps/agent-api/tests/logging.test.ts, apps/agent-api/src/agent/run-agent-turn.ts</existing_behavior>
    <tests>apps/agent-api/tests/</tests>
  </source_of_truth>
</context_boundaries>

---

## 3. Verification Strategy

<verification_strategy>

| AC / Risk | Evidence required | Verifier |
|---|---|---|
| AC-1: SafeAgentEvent types | TypeScript compiles cleanly with exact types | `npm run typecheck --workspace @vlc/agent-api` |
| AC-2 & AC-3: Tool & Turn lifecycle | Captured events match expected sequence and fields | `npm test --workspace @vlc/agent-api` |
| AC-4: Timing & ToolCount | durationMs >= 0, toolCount matches count of tool events | `npm test --workspace @vlc/agent-api` |
| AC-5 & AC-6: Zero leak & sanitization | Test assertions verify no prompt/viewport/secret in serialized events | `npm test --workspace @vlc/agent-api` |
| AC-7: Build & Suite Clean | All checks pass with 0 errors | `npm run typecheck --workspace @vlc/agent-api && npm test --workspace @vlc/agent-api && npm run build --workspace @vlc/agent-api` |

</verification_strategy>

---

## 4. Decisions

<decisions>
  <approved_decisions>
    | ID | Decision | Rationale | Owner |
    |---|---|---|---|
    | DEC-01 | Implement standalone AgentObserver in apps/agent-api/src/observability/agent-observer.ts | Satisfies task ownership rule: do not touch packages/contracts | @NPC-B |
    | DEC-02 | Route level manages turn duration and terminal turn events; loop manages tool events | Route has the full request lifecycle context and turnId validation | @NPC-B |
    | DEC-03 | Injectable observer with default stdout JSON line implementation | Allows easy test isolation via fake observer without console mocking | @NPC-B |
  </approved_decisions>

  <open_decisions>
  </open_decisions>
</decisions>

---

## 5. RIPER-5 Execution Plan (Pillar 4: Loop)

<execution_plan>
  <phase name="Research" order="1">
    - [x] Ingest task spec, domain invariants, and out-of-scope boundaries.
    - [x] Read corresponding tests and port interfaces.
    - [x] Establish execution flow, boundaries, and source-of-truth conflicts.
    - [x] Produce/update `research.md` artifact.
    <gate id="G0" label="Research Complete">
      - [x] Current behavior understood and documented.
      - [x] Execution flow traced.
      - [x] No unresolved research blocker.
    </gate>
  </phase>

  <phase name="Innovate" order="2">
    - [ ] Generate 2–3 alternative approaches with trade-off matrix.
    - [ ] Produce `decision.md` artifact.
    <gate id="G1" label="Gate 1 — Decision Approved">
      - [ ] Options reviewed and trade-offs analyzed.
      - [ ] Selected option recorded in `decision.md`.
      - [ ] No blocking business/schema/security decision remains open.
      <approved_by>[AUTO: DELEGATED]</approved_by>
      <approved_date>2026-09-12</approved_date>
    </gate>
  </phase>

  <phase name="Plan" order="3">
    - [ ] Decompose into vertical slices with verifiers and rollback points.
    - [ ] Populate `plan.md` with scope contract and verification matrix.
    <gate id="G2" label="Gate 2 — Plan Approved">
      - [ ] Every slice has a verifier.
      - [ ] Allowed/forbidden file scope is defined.
      - [ ] Rollback point defined per slice.
      - [ ] Stop conditions defined.
      - [ ] Plan approved.
      <approved_by>[AUTO: DELEGATED]</approved_by>
      <approved_date>2026-09-12</approved_date>
    </gate>
  </phase>

  <phase name="Execute" order="4">
    - [ ] Implement each slice atomically.
    - [ ] Run verifier after each slice.
    - [ ] Inspect diff after each slice.
    - [ ] Update `state.md` after each slice.
  </phase>

  <phase name="Review" order="5">
    - [ ] Review full diff, behavior, architecture, data, security, regression.
    - [ ] Produce `review.md` with findings and verification matrix.
    <gate id="G3" label="Gate 3 — Review Passed">
      - [ ] All AC verified with evidence.
      - [ ] Residual risk accepted.
      - [ ] Review decision: PASS.
      - [ ] Ready for handoff.
      <approved_by>[AUTO: DELEGATED]</approved_by>
      <approved_date>2026-09-12</approved_date>
    </gate>
  </phase>
</execution_plan>

---

## 6. Guardrails & Escalation (Pillar 3 & 4: Harness)

<guardrails>
  <stop_conditions>
    - Missing business or policy decision.
    - Public API / DB schema change not declared in this spec.
    - New external dependency not declared in this spec.
    - Security policy change required.
    - Scope expansion beyond `<out_of_scope>`.
    - Retry budget exhausted on a recurring failure.
  </stop_conditions>

  <retry_budget max_attempts="3">
    Maximum 3 consecutive attempts per distinct failure symptom before halting.
  </retry_budget>
</guardrails>

</task_spec>
