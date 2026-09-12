# Research: 05-safe-observability — Safe Agent API Observability

<research_context task_id="05-safe-observability" version="2.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. No source modifications. No implementation decisions. -->
<research_status>
  <phase>RESEARCH</phase>
  <mode>READ-ONLY</mode>
  <research_owner>@NPC-B</research_owner>
  <last_updated>2026-09-12</last_updated>
</research_status>

---

## 1. Current Behavior

<current_behavior>
  `apps/agent-api` currently exposes Fastify endpoints (`/health` and `/v1/agent/turn`).
  In `agentTurnRoutes` (`apps/agent-api/src/routes/agent-turn.ts`), requests are parsed with `AgentTurnRequestSchema`. If parsing fails or `opts.provider` is missing, appropriate error responses are returned.
  If valid, `runAgentTurn` is invoked. `runAgentTurn` executes up to 3 model steps, invoking tools registered in `createAgentToolRegistry`.
  However:
  - There is no telemetry or observability events emitted during the turn lifecycle.
  - Turn durations are not calculated or emitted.
  - Per-step tool execution results (success/error, duration, step index) are not emitted to any observer.
  - `logging.test.ts` exists only to check that console.log does not output raw viewport/question text, but no structured, typed observer exists.
</current_behavior>

---

## 2. Execution Flow

<execution_flow>

```text
HTTP POST /v1/agent/turn
→ Request body validation via AgentTurnRequestSchema.safeParse()
→ Validation error or NO_READABLE_CONTENT → returns 400 or 422 (no turn started event if parsing fails)
→ Provider availability check (if missing, 503 AGENT_UNAVAILABLE)
→ If turnId & request valid:
    Emit: agent.turn.started (turnId)
    Record: startTime = Date.now()
→ runAgentTurn(input, { provider, toolDeps, observer })
    → Loop step 1..3:
        → provider.generate(...)
        → For each toolCall:
            → execute tool
            → Emit: agent.tool.completed (turnId, step, toolName, status: SUCCESS | ERROR, errorCode?)
            → track toolCount++
        → If final text answer returned:
            break
    → If loop terminates:
        → Determine GroundingKind & groundingRefs
        → Return AgentTurnResponse
→ In route handler:
    → If success:
        durationMs = Date.now() - startTime
        Emit: agent.turn.completed (turnId, durationMs, grounding, toolCount, modelName)
        Return HTTP 200 with AgentTurnResponse
    → If error (from runAgentTurn or provider failure):
        durationMs = Date.now() - startTime
        Emit: agent.turn.failed (turnId, durationMs, errorCode, retryable)
        Return HTTP error status with AppError (zero stack traces)
```

</execution_flow>

---

## 3. Relevant Components

<components>

| File / Symbol | Role | Evidence | Confidence |
|---|---|---|---|
| `apps/agent-api/src/observability/agent-observer.ts` | Target new observer contract & stdout JSON implementation | Defined in `.agents/tasks/05-safe-observability/TASK.md` | CONFIRMED |
| `apps/agent-api/src/agent/run-agent-turn.ts` | Core agent loop executing model steps and tool invocations | Lines 20–222 in `run-agent-turn.ts` | CONFIRMED |
| `apps/agent-api/src/routes/agent-turn.ts` | Fastify route handler managing turn lifecycle, validation, and HTTP responses | Lines 10–74 in `routes/agent-turn.ts` | CONFIRMED |
| `apps/agent-api/src/app.ts` | App builder wiring dependencies to routes | Lines 8–53 in `app.ts` | CONFIRMED |
| `apps/agent-api/tests/observability.test.ts` | Comprehensive test suite for safe observability | Required by Task 05 AC | CONFIRMED |

</components>

---

## 4. Dependencies & Boundaries

<boundaries>
  <callers>Client callers (Firefox extension or test harnesses) calling `POST /v1/agent/turn`</callers>
  <callees>`runAgentTurn`, `LlmProvider.generate`, `AgentObserver.emit`, tool executions (`search_memory`, `read_memory`, `propose_marker`, `search_web`)</callees>
  <persistence>In-memory observer / stdout stream. No database or disk persistence needed.</persistence>
  <external_systems>LLM provider endpoint (e.g., Qwen/OpenAI compatible API)</external_systems>
  <transaction_boundary>Single HTTP request/turn boundary.</transaction_boundary>
  <security_boundary>CRITICAL: Zero leak of raw questions, visible text/code, memory note/question/answer, full URL/query, messages, system prompt, tool result, headers, API key or stack trace.</security_boundary>
</boundaries>

---

## 5. Existing Tests

<existing_tests>

| Test | Behavior covered | Gap |
|---|---|---|
| `tests/logging.test.ts` | Checks that console.log/console.error don't contain raw question or viewport | Does not test structured SafeAgentEvent stream or observer integration |
| `tests/agent-loop.test.ts` | Checks ReAct loop step limit, tool execution, grounding calculation | Does not pass or assert on observer events |
| `tests/routes.test.ts` | Validates HTTP status codes and contract responses | Does not verify terminal observer events |

</existing_tests>

---

## 6. Runtime / Configuration

<runtime_config>
  - Node.js / TypeScript with Vitest in `@vlc/agent-api`.
  - Fastify web framework.
  - Dependencies: `@vlc/contracts` (imports `AgentToolName`, `AppErrorCode`, `GroundingKind`).
  - No new external npm packages allowed.
</runtime_config>

---

## 7. Source-of-Truth Analysis

<source_of_truth_analysis>

| Source | Says | Authority | Conflict |
|---|---|---|---|
| `.agents/tasks/05-safe-observability/TASK.md` | Exact SafeAgentEvent union, AgentObserver interface, required semantics and tests | Highest authority for Task 05 | None |
| `.agents/architecture/08-last-mile-plan.md` | Task 05 is non-overlapping in `apps/agent-api/**`, leaves `packages/**` untouched | Architectural rule | None |
| `apps/agent-api/src/routes/agent-turn.ts` | Validates request, runs turn, returns AppError on failure | Existing implementation | Must integrate observer without changing API contracts |

</source_of_truth_analysis>

---

## 8. Evidence Classification

<evidence>
  <confirmed>
    - `SafeAgentEvent` is an exact discriminated union with 4 event types: `agent.turn.started`, `agent.tool.completed` (SUCCESS/ERROR), `agent.turn.completed`, `agent.turn.failed`.
    - `step` is constrained to `1 | 2 | 3`.
    - Every started turn must finish with exactly one terminal event: `completed` or `failed`.
    - Tool count must count all tool completions (both SUCCESS and ERROR) within the turn.
    - Zero data leakage into log/events.
  </confirmed>

  <observed>
    - Fastify `app.ts` allows dependency injection via `buildApp(deps: AppDependencies)`.
    - `runAgentTurn` takes `deps: AgentDependencies` which currently only holds `provider` and `toolDeps`. Adding `observer?: AgentObserver` is cleanly backward-compatible.
  </observed>

  <hypothesized>
    - Providing a `ConsoleJsonAgentObserver` as the default fallback when no observer is injected ensures production observability while allowing clean test injection via a mock/spy observer.
  </hypothesized>
</evidence>

---

## 9. Assumptions & Uncertainty

<assumptions>
  - Default observer outputs one JSON line per event via `process.stdout.write(JSON.stringify(event) + "\n")` or `console.log(JSON.stringify(event))`. Uncertainty: LOW.
  - If `AgentTurnRequestSchema.safeParse` fails, no valid `turnId` is guaranteed, so `agent.turn.started` should only emit once a valid `turnId` exists. Uncertainty: LOW (explicitly stated in task doc).
</assumptions>

---

## 10. Impacted Files

<impacted_files>
  - `apps/agent-api/src/observability/agent-observer.ts` — [New file: SafeAgentEvent types, AgentObserver interface, ConsoleJsonAgentObserver, NoopAgentObserver]
  - `apps/agent-api/src/agent/run-agent-turn.ts` — [Integrate observer into deps, emit tool.completed events, count tools]
  - `apps/agent-api/src/routes/agent-turn.ts` — [Emit turn.started, measure durationMs, emit turn.completed or turn.failed]
  - `apps/agent-api/src/app.ts` — [Expose observer in AppDependencies, default to ConsoleJsonAgentObserver if not supplied]
  - `apps/agent-api/tests/observability.test.ts` — [New test file covering all ACs]
</impacted_files>

---

## 11. Open Decisions

<open_decisions>
  - DEC-01: Default observer implementation (stdout JSON vs custom stream).
  - DEC-02: Responsibility division between route handler and runAgentTurn for terminal events and tool count.
</open_decisions>

---

## 12. Research Exit Criteria

<research_exit_criteria>
  - [x] Current behavior understood and documented.
  - [x] Execution flow traced end-to-end.
  - [x] Relevant boundaries identified (callers, callees, persistence, security).
  - [x] Source-of-truth conflicts identified or confirmed absent.
  - [x] Impacted files identified.
  - [x] Evidence classified (Confirmed / Observed / Hypothesized).
  - [x] No unresolved research blocker.
</research_exit_criteria>

</research_context>
