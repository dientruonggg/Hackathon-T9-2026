# Decision: DEC-01 Safe Observability Architecture

<technical_decision task_id="05-safe-observability" dec_id="DEC-01" version="1.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. Present options. PAIR: engineer decides. DELEGATED: agent auto-selects optimal recommendation and advances. -->
<decision_status>
  <phase>INNOVATE</phase>
  <mode>READ-ONLY</mode>
  <decision_owner>@NPC-B</decision_owner>
  <last_updated>2026-09-12</last_updated>
</decision_status>

---

## 1. Context

<context>
  <task>05-safe-observability</task>
  <research_artifact>process/features/active/05-safe-observability/research.md</research_artifact>
  <constraints>
    - Ownership restricted strictly to apps/agent-api/**.
    - Zero modification to @vlc/contracts or packages/**.
    - No new npm dependencies.
    - Single-line JSON emission to stdout by default.
    - Turn must emit started, per-tool completed, and exactly one terminal event (completed or failed).
    - Zero data leakage of prompt, code, question, memory, or secrets.
  </constraints>
</context>

---

## 2. Decision Required

<decision_question>
  How should the AgentObserver and event emission lifecycle be structured and injected across Fastify routes, the agent loop (runAgentTurn), and unit/integration tests?
</decision_question>

---

## 3. Options

<options>

  <option id="A">
    <approach>
      Route-Lifecycle Coordination with Dependency Injection:
      Define AgentObserver and SafeAgentEvent in apps/agent-api/src/observability/agent-observer.ts. Provide ConsoleJsonAgentObserver (writing JSON one-line to stdout) and NoopAgentObserver.
      Expose observer in AppDependencies -> AgentTurnRouteOptions -> AgentDependencies.
      Route validates request: once turnId is known valid, emit agent.turn.started and record start timestamp.
      Pass observer to runAgentTurn, which emits agent.tool.completed (with step 1|2|3, toolName, status, optional errorCode).
      Route captures result, computes durationMs, and emits exactly one terminal event: agent.turn.completed or agent.turn.failed.
    </approach>
    <advantages>
      - Clean separation of concerns: route owns request lifecycle & duration; loop owns model steps & tool calls.
      - 100% testable without monkey-patching console or globals.
      - Handles provider unavailability or early errors after valid parsing.
      - Strict guarantee of exactly one terminal event.
    </advantages>
    <disadvantages>
      - Requires threading observer through route options to runAgentTurn.
    </disadvantages>
    <complexity>LOW</complexity>
    <compatibility>Fully backward compatible with existing calls (observer is optional).</compatibility>
    <concurrency_transaction_risk>None; purely in-memory and event emission per turn.</concurrency_transaction_risk>
    <testability>HIGH: tests pass an in-memory capturing observer and inspect event array directly.</testability>
    <maintainability>HIGH: modular, type-safe, simple code.</maintainability>
  </option>

  <option id="B">
    <approach>
      Internal Loop-Only Observer:
      Handle all events (started, tool, completed, failed) strictly inside runAgentTurn. Route has no observer knowledge.
    </approach>
    <advantages>
      - Minimal route changes.
    </advantages>
    <disadvantages>
      - Cannot observe errors that happen before or after runAgentTurn (e.g. provider missing check in route).
      - Duration only measures agent loop, omitting route processing.
    </disadvantages>
    <complexity>LOW</complexity>
    <compatibility>Good, but violates task requirement that route measures total duration.</complexity>
    <concurrency_transaction_risk>None</concurrency_transaction_risk>
    <testability>MEDIUM</testability>
    <maintainability>MEDIUM</maintainability>
  </option>

  <option id="C">
    <approach>
      Global Singleton / EventEmitter Bus:
      Create a global EventEmitter singleton where routes and tools publish events and a global listener formats them to stdout.
    </approach>
    <advantages>
      - No dependency injection threading needed.
    </advantages>
    <disadvantages>
      - Global state makes concurrent tests leak events to each other.
      - Hard to isolate in unit tests.
      - Anti-pattern for modular microservices.
    </disadvantages>
    <complexity>MEDIUM</complexity>
    <compatibility>Poor test isolation</compatibility>
    <concurrency_transaction_risk>HIGH in concurrent test runs.</concurrency_transaction_risk>
    <testability>LOW</testability>
    <maintainability>LOW</maintainability>
  </option>

</options>

---

## 4. Trade-off Matrix

<tradeoff_matrix>

| Criterion | Option A (DI Coordinator) | Option B (Loop-Only) | Option C (Global EventBus) |
|---|:---:|:---:|:---:|
| Compatibility | 5 | 4 | 3 |
| Complexity | 5 | 5 | 3 |
| Risk | 5 | 3 | 2 |
| Testability | 5 | 4 | 2 |
| Maintainability | 5 | 4 | 3 |

</tradeoff_matrix>

---

## 5. Recommendation

<recommendation>
  Adopt Option A (Route-Lifecycle Coordination with Dependency Injection).
  It directly fulfills the task requirements:
  - runAgentTurn accepts optional observer in dependencies.
  - Route measures total duration and emits terminal completed/failed events.
  - Default ConsoleJsonAgentObserver outputs JSON one-line to stdout.
  - Tests cleanly inject a capturing fake observer without monkey-patching.
</recommendation>

---

## 6. Implementation Decision

<engineer_decision>
  <selected_option>Option A</selected_option>
  <rationale>
    Option A satisfies all task constraints: zero contract mutations, zero leak, full testability, precise step and tool error accounting, and accurate turn duration tracking.
  </rationale>
  <rejected_alternatives>
    - Option B: Excludes route-level lifecycle and provider errors.
    - Option C: Global state compromises test isolation.
  </rejected_alternatives>
</engineer_decision>

---

## 7. Constraints Created by This Decision

<constraints_created>
  - AgentObserver must be exported from apps/agent-api/src/observability/agent-observer.ts.
  - runAgentTurn's deps must accept observer?: AgentObserver.
  - buildApp's deps must accept observer?: AgentObserver, defaulting to ConsoleJsonAgentObserver in production/runtime.
  - Safe log events must never include raw user questions, prompts, viewport text, secrets, or stack traces.
</constraints_created>

---

## 8. Evidence Still Required

<evidence_required>
  - Verification of type safety against @vlc/contracts.
  - Verification that fake observer captures expected event sequence in unit and integration tests.
</evidence_required>

---

## Gate 1 — Decision Approved

<gate id="G1">
  - [x] All options presented and trade-offs analyzed.
  - [x] Selected option recorded above.
  - [x] No blocking business / schema / security decision remains open.
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12</approved_date>
</gate>

</technical_decision>
