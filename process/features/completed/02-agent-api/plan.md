# Plan: PLAN-02-AGENT-API Fastify Agent API Execution Plan

<execution_plan task_id="TASK-02-AGENT-API" plan_id="PLAN-02-AGENT-API" version="1.0" framework="RIPER-5">

<!-- PLAN PHASE. Plan artifacts only. No source-code changes during this phase. -->
<plan_status>
  <phase>PLAN</phase>
  <mode>PLAN-ONLY</mode>
  <plan_owner>@antigravity</plan_owner>
  <last_updated>2026-09-12</last_updated>
</plan_status>

---

## 1. Input Artifacts

<input_artifacts>
  <spec>[process/features/active/02-agent-api/task.md](task.md)</spec>
  <research>[process/features/active/02-agent-api/research.md](research.md)</research>
  <decision>[process/features/active/02-agent-api/decision.md](decision.md)</decision>
</input_artifacts>

---

## 2. Scope Contract

<scope_contract>
  <allowed_files>
    apps/agent-api/src/**
    apps/agent-api/tests/**
  </allowed_files>
  <forbidden_files>
    package.json
    package-lock.json
    tsconfig.base.json
    .env.example
    .agents/**
    apps/firefox-extension/**
    packages/contracts/**
    packages/memory/**
  </forbidden_files>
</scope_contract>

---

## 3. Slice Summary

<slice_summary>

| Slice | Title | Primary Files | Verifier | Expected Evidence |
|---|---|---|---|---|
| **Slice 1** | Config & Fastify Surface | `src/config/env.ts`, `src/routes/health.ts`, `src/app.ts`, `src/server.ts` | `npm test --workspace @vlc/agent-api` | Health 200, CORS header, env validation |
| **Slice 2** | System Prompt & Pure Tool Registry | `src/agent/system-prompt.ts`, `src/agent/tool-registry.ts` | `npm test --workspace @vlc/agent-api` | 5 tools pass unit tests, memory isolation |
| **Slice 3** | Provider Abstraction & OpenAI Adapter | `src/providers/llm-provider.ts`, `src/providers/openai-compatible-provider.ts` | `npm test --workspace @vlc/agent-api` | Provider interface typed, OpenAI adapter options validated |
| **Slice 4** | ReAct Agent Loop & Turn Route | `src/agent/run-agent-turn.ts`, `src/routes/agent-turn.ts` | `npm test --workspace @vlc/agent-api` | Fake provider loop 3 steps, error mapping, turn route 200/400/422/503 |
| **Slice 5** | Full Verification, Safe Logging & Build | `tests/**` (10 scenarios) | `npm run verify` / `npm run build` | All tests pass, typecheck pass, dist/server.js built |

</slice_summary>

---

## 4. Slice Details

### Slice 1: Config & Fastify Surface
- **Mục tiêu:** Tạo `src/config/env.ts`, `src/routes/health.ts`, `src/app.ts`, `src/server.ts`.
- **Nội dung:**
  - `loadEnvConfig()` parse an toàn biến môi trường (`API_HOST`, `API_PORT`, `CORS_ORIGIN`, `OPENAI_*`).
  - `buildApp(deps)` cấu hình Fastify instance, `@fastify/cors` theo whitelist, route `GET /health` trả về `HealthResponse`.
  - Export `server.ts` có thể lắng nghe khi chạy trực tiếp.
- **Verifier:** Viết `tests/health.test.ts` dùng `app.inject()`.
- **Expected Evidence:** Test pass, status 200, schema `{ status: "ok", service: "viewport-learning-agent-api", contractVersion: "0.1" }`.

### Slice 2: System Prompt & Pure Tool Registry
- **Mục tiêu:** Cung cấp prompt cố định và 5 pure tools.
- **Nội dung:**
  - `buildSystemPrompt()`: Cố định 9 nguyên tắc (grounded, sidebar-length, không suy diễn đã hiểu, propose_marker chỉ là đề xuất).
  - `createAgentToolRegistry(context, deps)`: Cung cấp `get_viewport_context`, `search_memory`, `read_memory`, `propose_marker`, `search_web`.
  - Đảm bảo `read_memory` và `search_memory` chỉ hoạt động trên `context.relatedMemories`, từ chối ID ngoài set.
- **Verifier:** Viết `tests/tool-registry.test.ts`.
- **Expected Evidence:** Các tools thực thi trả `Result<T>` chuẩn, không side-effect.

### Slice 3: Provider Abstraction & OpenAI Adapter
- **Mục tiêu:** Định nghĩa `LlmProvider` và `createOpenAICompatibleProvider`.
- **Nội dung:**
  - Định nghĩa interface `LlmProvider` nhận `LlmGenerateInput` và trả `Result<LlmGenerateOutput>`.
  - `createOpenAICompatibleProvider(options)`: Chuyển đổi giữa interface nội bộ và OpenAI Chat Completions API.
  - Tạo fake provider test helper cho các lát cắt tiếp theo.
- **Verifier:** Viết `tests/provider.test.ts`.
- **Expected Evidence:** Fake provider phản hồi đúng kịch bản, mapping lỗi timeout/error sang `AppError`.

### Slice 4: ReAct Agent Loop & Turn Route
- **Mục tiêu:** `runAgentTurn` điều phối chu trình tối đa 3 bước và đăng ký `POST /v1/agent/turn`.
- **Nội dung:**
  - `runAgentTurn(input, deps)`:
    - Step 1 -> 3: model generate -> tool execution -> append results -> model final answer.
    - Terminate khi có final answer hoặc ngắt ở step 3 với `AGENT_MAX_STEPS`.
    - Chuẩn hóa response theo `AgentTurnResponseSchema`.
  - `src/routes/agent-turn.ts`:
    - Parse request bằng `AgentTurnRequestSchema`.
    - HTTP mapping: 200 (Success), 400 (Validation), 422 (Empty viewport), 503 (Provider down), 500 (Internal).
- **Verifier:** Viết `tests/agent-loop.test.ts` và `tests/routes.test.ts`.
- **Expected Evidence:** Vòng lặp ReAct chạy qua 100% các nhánh kịch bản thành công.

### Slice 5: Full Verification, Safe Logging & Build
- **Mục tiêu:** Đảm bảo toàn bộ 10 test cases, kiểm tra log an toàn, typecheck và build production.
- **Nội dung:**
  - Viết `tests/logging.test.ts` assert không log `visibleText`, raw questions, API keys.
  - Chạy `npm run typecheck --workspace @vlc/agent-api`.
  - Chạy `npm test --workspace @vlc/agent-api`.
  - Chạy `npm run build --workspace @vlc/agent-api` để kiểm tra `dist/server.js`.
- **Verifier:** Chạy `npm run build` và `npm test`.
- **Expected Evidence:** 100% tests pass, build thành công, không vi phạm forbidden files.

---

## Gate 2 — Plan Approved

<gate id="G2">
  - [x] Input artifacts linked.
  - [x] Scope contract explicit (Allowed: `apps/agent-api/**`).
  - [x] Every slice has verifier and expected evidence.
  - [x] No forbidden files targeted.
  <approved_by>@engineer</approved_by>
  <approved_date>2026-09-12</approved_date>
</gate>

</execution_plan>
