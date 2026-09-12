# Review: TASK-02-AGENT-API Fastify Agent API

<review_report task_id="TASK-02-AGENT-API" version="1.0" framework="RIPER-5">

<!-- REVIEW PHASE. Independent verification. READ-ONLY on source code. -->
<review_status>
  <phase>REVIEW</phase>
  <mode>READ-ONLY</mode>
  <review_owner>@antigravity</review_owner>
  <review_decision>APPROVED</review_decision>
  <last_updated>2026-09-12</last_updated>
</review_status>

---

## 1. Review Scope & Ownership Integrity

<scope_audit>
  - **Mục tiêu sở hữu:** Chỉ sửa đổi trong `apps/agent-api/**`.
  - **Kiểm tra Git Diff:**
    - 10 file nguồn trong `apps/agent-api/src/` được hoàn thiện thay thế toàn bộ TODO.
    - 6 file test trong `apps/agent-api/tests/` với 23 unit test cases toàn diện.
    - **Không có bất kỳ file nào** ngoài `apps/agent-api/**` bị sửa đổi trái phép.
</scope_audit>

---

## 2. Functional & Architecture Review

<behavior_audit>
  - **Health Endpoint:** `GET /health` trả về 200 OK và validate đúng schema `HealthResponseSchema` `{ status: "ok", service: "viewport-learning-agent-api", contractVersion: "0.1" }`.
  - **Turn Endpoint:** `POST /v1/agent/turn` parse và validate request body qua `AgentTurnRequestSchema`.
  - **Error Mapping:**
    - Request thiếu/sai schema -> HTTP 400 + `VALIDATION_ERROR`.
    - Viewport rỗng -> HTTP 422 + `NO_READABLE_CONTENT`.
    - LLM provider timeout/unavailable -> HTTP 503 + `AGENT_UNAVAILABLE`.
    - Lỗi khác -> HTTP 500 + `INTERNAL_ERROR`.
    - Che giấu hoàn toàn stack trace ra bên ngoài client.
  - **Agent ReAct Loop:**
    - Tối đa 3 model steps. Nếu vượt quá 3 bước gọi tool liên tục mà không có kết luận, ngắt với `AGENT_MAX_STEPS`.
    - Tự động normalize response: gán `contractVersion: "0.1"`, `turnId`, `model`, `toolTrace` và tính toán `grounding` (`VIEWPORT` | `MEMORY` | `WEB` | `INSUFFICIENT`).
  - **Pure Tool Registry:**
    - Cung cấp đủ 5 tools: `get_viewport_context`, `search_memory`, `read_memory`, `propose_marker`, `search_web`.
    - `search_memory` và `read_memory` hoạt động cách ly hoàn toàn trên tập 5 memories preload, chặn scan ID ngoài tập.
    - `propose_marker` chỉ trả về `PendingUserAction`, không tự động ghi dữ liệu dài hạn.
    - `search_web` tôn trọng flag `permissions.allowWebSearch`.
  - **OpenAI-Compatible Adapter:**
    - Tương thích OpenRouter (`OPENAI_BASE_URL=https://openrouter.ai/api/v1`).
    - Hỗ trợ map format Chat Completion tool calling chuẩn.
</behavior_audit>

---

## 3. Security, Privacy & Logging Review

<security_audit>
  - **Safe Logging:** Test `tests/logging.test.ts` kiểm chứng console output không chứa bất kỳ chuỗi nhạy cảm nào từ `visibleText`, prompt thô, hay API key.
  - **CORS Whitelist:** Chỉ cho phép extension (`moz-extension://*`) và local dev origins.
  - **In-memory Statelessness:** Backend không mở DB, không giữ persistent state, không kết nối storage ngoài.
</security_audit>

---

## 4. Verification Matrix

<verification_matrix>

| Test File | Test Cases | Result |
|---|:---:|:---:|
| `tests/health.test.ts` | 4 tests (health 200, CORS allow, CORS reject, env defaults) | PASS |
| `tests/tool-registry.test.ts` | 7 tests (system prompt, 5 tools execution, validation error) | PASS |
| `tests/agent-loop.test.ts` | 5 tests (viewport loop, memory loop, max steps, unknown tool, empty text) | PASS |
| `tests/routes.test.ts` | 4 tests (200 OK, 400 validation, 422 empty viewport, 503 no provider) | PASS |
| `tests/provider.test.ts` | 2 tests (timeout mapping to 503, API failure to MODEL_ERROR) | PASS |
| `tests/logging.test.ts` | 1 test (assert no raw viewport/secret logged) | PASS |
| **Tổng cộng** | **23 tests** | **100% PASS** |

</verification_matrix>

---

## Gate 3 — Review Approved

<gate id="G3">
  - [x] All 10 required test scenarios covered and passing.
  - [x] TypeScript strict mode typecheck passing with 0 errors across workspace.
  - [x] Build output `dist/server.js` generated cleanly.
  - [x] No modifications outside `apps/agent-api/**`.
  - [x] No raw data or secrets logged.
  <approved_by>@engineer</approved_by>
  <approved_date>2026-09-12</approved_date>
</gate>

</review_report>
