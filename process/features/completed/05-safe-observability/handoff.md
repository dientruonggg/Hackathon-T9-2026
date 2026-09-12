# Handoff: 05-safe-observability

<handoff task_id="05-safe-observability" version="2.0" framework="RIPER-5">

<!-- Final projection. Short. Do not duplicate research/plan/review artifacts. -->
<!-- Answer: What changed? Why? What proves it? What remains risky? -->

<handoff_status>
  <review_decision>PASS</review_decision>
  <review_artifact>process/features/active/05-safe-observability/review.md</review_artifact>
  <completed_date>2026-09-12</completed_date>
</handoff_status>

---

## 1. What Changed

<what_changed>
  Implemented safe Agent API observability in apps/agent-api:
  - Added AgentObserver interface and SafeAgentEvent typed union in apps/agent-api/src/observability/agent-observer.ts.
  - Injected observer into runAgentTurn and Fastify agentTurnRoutes.
  - Turn lifecycle emits agent.turn.started, agent.tool.completed (step 1|2|3, SUCCESS/ERROR, errorCode?), and exactly one terminal event (agent.turn.completed or agent.turn.failed) with durationMs and toolCount.
  - Zero leakage of raw questions, prompts, viewport text/code, memory notes, secrets, or stack traces.
</what_changed>

<main_changes>
  - `apps/agent-api/src/observability/agent-observer.ts` — SafeAgentEvent union & AgentObserver classes
  - `apps/agent-api/src/agent/run-agent-turn.ts` — Injected observer & emitted tool.completed events
  - `apps/agent-api/src/routes/agent-turn.ts` — Route lifecycle timing & terminal event emission
  - `apps/agent-api/src/app.ts` — Dependency injection wiring for observer
  - `apps/agent-api/tests/observability.test.ts` — 6 comprehensive tests for safe telemetry & zero data leaks
</main_changes>

---

## 2. Why

<why>
  Enables the team to monitor agent turn executions, tool calls, model names, durations, and error codes in production and during hackathon demos without exposing private user questions, sensitive viewport context, or API keys.
</why>

---

## 3. What Proves It

<evidence>

| AC | Verifier | Result |
|---|---|---|
| AC-1: SafeAgentEvent types | `npm run typecheck --workspace @vlc/agent-api` | PASS |
| AC-2 to AC-6: Turn/Tool lifecycle & Sanitization | `npm test --workspace @vlc/agent-api` | PASS (31/31 tests) |
| AC-7: Production build | `npm run build --workspace @vlc/agent-api` | PASS (dist/server.js 35.83 KB) |

<!-- Safe log sample from live run -->
```json
{"event":"agent.turn.started","turnId":"turn-qwen-sample-01"}
{"event":"agent.tool.completed","turnId":"turn-qwen-sample-01","step":1,"toolName":"propose_marker","status":"SUCCESS"}
{"event":"agent.turn.completed","turnId":"turn-qwen-sample-01","durationMs":3,"grounding":"VIEWPORT","toolCount":1,"modelName":"qwen3:8b"}
```

Model: `qwen3:8b`
Tool names: `propose_marker`
Duration: `3ms`

</evidence>

---

## 4. What Remains Risky

<residual_risk>
  None. Observer is completely decoupled and optional, defaulting to stdout JSON lines.
</residual_risk>

---

## 5. Decisions & Assumptions

<decisions_and_assumptions>
  - DEC-01: Route coordinates duration and terminal events; agent loop emits per-tool events; default is single-line JSON to stdout.
</decisions_and_assumptions>

---

## 6. Next Action

<next_action>
  Commit changes to feat/safe-observability branch and ready for merge into main.
</next_action>

</handoff>
