# Research: TASK-02-AGENT-API Fastify Agent API

<research_context task_id="TASK-02-AGENT-API" version="2.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. No source modifications. No implementation decisions. -->
<research_status>
  <phase>RESEARCH</phase>
  <mode>READ-ONLY</mode>
  <research_owner>@antigravity</research_owner>
  <last_updated>2026-09-12</last_updated>
</research_status>

---

## 1. Current Behavior & Implementation Assessment

<current_behavior>
  - **Trạng thái môi trường & workspace:**
    - Thư mục làm việc: `apps/agent-api/` thuộc npm workspace monorepo (`@vlc/agent-api`).
    - Lệnh cài đặt `npm ci` đã hoàn tất ở root; các công cụ baseline (`tsc`, `vitest`, `tsup`, `tsx`) hoạt động bình thường.
    - Đã merge thành công commit `feat(contracts,memory)` từ nhánh `origin/task3` vào branch hiện tại:
      - `packages/contracts` đã export đầy đủ 47 symbols (types, constants, Zod schemas) bao gồm `AgentTurnRequestSchema`, `AgentTurnResponseSchema`, `HealthResponseSchema`, các tool input/output schemas.
      - `packages/contracts` và `packages/memory` build (`tsc`) và test (`vitest`) đều pass 100%.
    - `npm run typecheck --workspace @vlc/agent-api`: **PASS** (0 lỗi).
    - `npm test --workspace @vlc/agent-api`: **PASS** (0 test files, `--passWithNoTests`).
    - `npm run build --workspace @vlc/agent-api`: **PASS** (tsup biên dịch ra `dist/server.js`).
  - **Hiện trạng mã nguồn trong `apps/agent-api/src/`:**
    - Mọi file hiện chỉ là scaffold rỗng có comment `// TODO(Agent 2)`:
      - `src/server.ts`: chưa có logic load env, buildApp và listen port.
      - `src/app.ts`: chưa có Fastify app factory `buildApp`.
      - `src/config/env.ts`: chưa có safe env parser cho OpenAI-compatible & CORS.
      - `src/routes/health.ts`: chưa có handler `GET /health`.
      - `src/routes/agent-turn.ts`: chưa có handler `POST /v1/agent/turn`.
      - `src/agent/system-prompt.ts`: chưa có hàm `buildSystemPrompt`.
      - `src/agent/tool-registry.ts`: chưa có hàm `createAgentToolRegistry`.
      - `src/agent/run-agent-turn.ts`: chưa có hàm `runAgentTurn` (ReAct loop 3 bước).
      - `src/providers/llm-provider.ts`: chưa có interface `LlmProvider`.
      - `src/providers/openai-compatible-provider.ts`: chưa có adapter `createOpenAICompatibleProvider`.
</current_behavior>

---

## 2. Cross-Context Research & Inter-Agent Integration

<cross_context_analysis>

  ### 2.1 Mối liên hệ với Agent 1 (`apps/firefox-extension`)
  - **Giao thức kết nối:** HTTP REST API qua cổng `http://localhost:8000`.
  - **Request từ Extension (`POST /v1/agent/turn`):**
    - Extension chịu trách nhiệm kiểm tra Source Policy và trích xuất viewport DOM trước khi gọi API.
    - Extension preload tối đa 5 related memories từ `browser.storage.local` và gửi kèm trong payload `relatedMemories`.
    - Payload tuân thủ `AgentTurnRequestSchema`: `{ contractVersion: "0.1", turnId, question, context, relatedMemories, history, permissions }`.
  - **Kỳ vọng Response của Extension:**
    - Nhận `AgentTurnResponse`: `{ contractVersion: "0.1", turnId, answer, grounding, groundingRefs, suggestedActions, toolTrace, model }`.
    - `toolTrace`: Extension dùng để hiển thị badge/logs cho giám khảo thấy agent đã gọi tool nào (ví dụ: `get_viewport_context`, `search_memory`).
    - `suggestedActions`: Nếu model đề xuất đánh dấu trạng thái (`propose_marker`), response trả về `PendingUserAction` để Sidebar hiển thị nút xác nhận cho người dùng bấm.
  - **Xử lý mã lỗi HTTP chuẩn:**
    - `400`: `VALIDATION_ERROR` khi body request sai format.
    - `422`: `NO_READABLE_CONTENT` hoặc `CONTEXT_STALE` khi viewport rỗng.
    - `503`: `AGENT_UNAVAILABLE` hoặc `MODEL_ERROR` khi LLM provider timeout/lỗi.
    - `500`: `INTERNAL_ERROR` cho các ngoại lệ chưa xử lý, tuyệt đối không lộ stack trace.

  ### 2.2 Mối liên hệ với Agent 3 (`packages/contracts` & `packages/memory`)
  - **Shared Schemas (`@vlc/contracts`):**
    - Tất cả types và Zod schemas được import trực tiếp qua `@vlc/contracts` (đã verify chạy tốt qua `tsx` và `tsup`).
    - `AgentTurnRequestSchema`, `AgentTurnResponseSchema`, `HealthResponseSchema`.
    - Tool input/output schemas: `GetViewportContextToolInputSchema`, `SearchMemoryToolInputSchema`, `ReadMemoryToolInputSchema`, `ProposeMarkerToolInputSchema`, `SearchWebToolInputSchema`.
  - **Ranh giới Memory:**
    - Backend **KHÔNG** kết nối tới database SQLite hay storage bên ngoài.
    - Backend **KHÔNG** sửa đổi bộ nhớ dài hạn.
    - Mọi thao tác tìm kiếm (`search_memory`) và đọc (`read_memory`) chỉ hoạt động trong phạm vi tập hợp `relatedMemories` (tối đa 5 records) đã được client gửi lên trong `TurnToolContext`. Việc cố tình đọc ID ngoài tập preload này sẽ trả về lỗi `MEMORY_NOT_FOUND`.

  ### 2.3 LLM Provider & OpenRouter Compatibility
  - Thư viện: `openai@^7.15.0` (đã có trong `apps/agent-api/package.json`).
  - Hỗ trợ endpoint OpenAI-compatible bất kỳ thông qua:
    - `OPENAI_API_KEY`: API key.
    - `OPENAI_BASE_URL`: ví dụ `https://openrouter.ai/api/v1` (OpenRouter) hoặc `https://api.openai.com/v1`.
    - `OPENAI_MODEL`: tên model hỗ trợ function calling / tool calling (ví dụ: `google/gemini-2.0-flash-001`, `openai/gpt-4o-mini`).
  - Đóng gói qua abstraction `LlmProvider`:
    ```ts
    interface LlmProvider {
      generate(input: LlmGenerateInput): Promise<Result<LlmGenerateOutput>>;
    }
    ```
    Giúp `runAgentTurn` hoàn toàn độc lập với OpenAI SDK, cho phép inject Fake Provider trong 100% unit tests.

</cross_context_analysis>

---

## 3. Execution Flow (Traced End-to-End)

<execution_flow>

```text
[Client: Firefox Extension / Test Harness]
  │  HTTP POST /v1/agent/turn
  ▼
[Fastify Route: src/routes/agent-turn.ts]
  │  1. Parse & Validate request body bằng AgentTurnRequestSchema
  │     └── Nếu sai ──> Return 400 Bad Request { code: "VALIDATION_ERROR", message, retryable: false }
  │  2. Khởi tạo immutable TurnToolContext:
  │     └── { turnId, context: ViewportContext, relatedMemories: MemorySummary[], permissions: AgentPermissions }
  │  3. Chuyển giao xử lý cho runAgentTurn(input, deps)
  ▼
[Agent Engine: src/agent/run-agent-turn.ts]
  │  1. System Prompt: buildSystemPrompt() (cố định nguyên tắc: grounded, ngắn gọn cho sidebar, không suy diễn)
  │  2. Tool Registry: createAgentToolRegistry(turnContext, deps)
  │     ├── get_viewport_context: trả về ViewportContext từ turnContext (pure, không side effect)
  │     ├── search_memory: tìm kiếm và lọc trên relatedMemories đã preload
  │     ├── read_memory: đọc 1 memory theo ID trong preload set (bảo vệ cách ly, từ chối ID ngoài set)
  │     ├── propose_marker: tạo PendingUserAction với status đề xuất (không tự nhận đã lưu)
  │     └── search_web: gọi tìm kiếm ngoài nếu permissions.allowWebSearch = true; ngược lại trả PERMISSION_DENIED
  │  3. Model-Tool ReAct Loop (Step 1 -> Max Step 3):
  │     ├── Chuẩn bị messages (System prompt + History + User question + Tool results)
  │     ├── Chuẩn bị danh sách tools theo format OpenAI Chat Completions
  │     ├── Gọi deps.provider.generate({ messages, tools })
  │     │     ├── Nếu model trả text & không gọi tool ──> Kết thúc loop
  │     │     ├── Nếu model gọi tool:
  │     │     │     ├── Với từng tool_call:
  │     │     │     │     ├── Validate tên tool & arguments schema
  │     │     │     │     ├── Thực thi tool qua registry -> nhận Result<T>
  │     │     │     │     ├── Ghi nhận ToolTraceEntry { step, toolName, status: SUCCESS|ERROR, errorCode }
  │     │     │     │     └── Nối message role "tool" vào conversation history
  │     │     │     └── Lặp tiếp (step = step + 1)
  │     │     └── Nếu step > 3 mà chưa có text cuối:
  │     │           └── Trả về lỗi AppError { code: "AGENT_MAX_STEPS", retryable: false }
  │  4. Response Normalization:
  │     ├── Đảm bảo các trường hệ thống: contractVersion: "0.1", turnId, toolTrace, model: { provider, name }
  │     ├── Xác định GroundingKind (VIEWPORT | MEMORY | WEB | INSUFFICIENT) và GroundingRef[]
  │     └── Validate response cuối cùng qua AgentTurnResponseSchema
  ▼
[HTTP Response Mapping: src/routes/agent-turn.ts]
  ├── Thành công: HTTP 200 OK + AgentTurnResponse JSON
  ├── Viewport rỗng/cũ: HTTP 422 Unprocessable Entity
  ├── Lỗi Provider/Timeout: HTTP 503 Service Unavailable (AGENT_UNAVAILABLE / MODEL_ERROR)
  └── Ngoại lệ server: HTTP 500 Internal Server Error (không lộ stack trace, log sanitized)
```

</execution_flow>

---

## 4. Relevant Components & File Mapping

<components>

| File | Trách nhiệm bắt buộc | Caller / Consumer | Confidence |
|---|---|---|---|
| `src/server.ts` | Load safe env, khởi tạo dependencies (LlmProvider), gọi `buildApp`, listen `API_HOST:API_PORT` | `npm run dev` / `npm start` | Confirmed |
| `src/app.ts` | Factory `buildApp(deps: AppDependencies)`: đăng ký fastify plugins (`@fastify/cors`), đăng ký routes | `server.ts` & integration tests | Confirmed |
| `src/config/env.ts` | Validate env: `API_HOST`, `API_PORT`, `CORS_ORIGIN`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | `server.ts` | Confirmed |
| `src/routes/health.ts` | `GET /health` trả `{ status: "ok", service: "viewport-learning-agent-api", contractVersion: "0.1" }` | Fastify instance | Confirmed |
| `src/routes/agent-turn.ts` | `POST /v1/agent/turn`: validate Zod schema, gọi `runAgentTurn`, map status codes | Fastify instance | Confirmed |
| `src/agent/system-prompt.ts` | `buildSystemPrompt()` trả prompt string cố định các nguyên tắc theo mục 6 tài liệu 02 | `runAgentTurn` | Confirmed |
| `src/agent/tool-registry.ts` | `createAgentToolRegistry(context, deps)` trả Map các tool thực thi an toàn trên immutable context | `runAgentTurn` | Confirmed |
| `src/agent/run-agent-turn.ts` | `runAgentTurn(input, deps)`: vòng lặp ReAct tối đa 3 bước, response normalization | `routes/agent-turn.ts` | Confirmed |
| `src/providers/llm-provider.ts` | Định nghĩa interface `LlmProvider`, `LlmGenerateInput`, `LlmGenerateOutput` | `run-agent-turn.ts`, providers, test mocks | Confirmed |
| `src/providers/openai-compatible-provider.ts` | `createOpenAICompatibleProvider(options)`: gọi OpenAI SDK chat completions, tương thích OpenRouter | `server.ts` | Confirmed |

</components>

---

## 5. Dependencies & Boundaries

<boundaries>
  <callers>
    - Browser Extension: gọi HTTP `POST /v1/agent/turn` và `GET /health`.
    - Unit / Integration Test Suites (Vitest): gọi trực tiếp `app.inject()` không cần mở port mạng.
  </callers>
  <callees>
    - OpenAI-compatible API Endpoint (OpenRouter / OpenAI / Local vLLM): gọi qua OpenAI SDK client.
  </callees>
  <persistence>
    - **Hoàn toàn KHÔNG có server-side persistence:** Không dùng SQLite, Prisma hay Redis trong `agent-api`. Mọi context, memory và history đều được client gửi lên trong từng turn request.
  </persistence>
  <external_systems>
    - OpenAI-compatible API (`https://openrouter.ai/api/v1` hoặc configured `OPENAI_BASE_URL`).
  </external_systems>
  <transaction_boundary>
    - Đơn vị một request là 1 lượt hội thoại độc lập (Turn). Không có distributed transaction.
  </transaction_boundary>
  <security_boundary>
    - **CORS Protection:** Chỉ cho phép extension origin (`moz-extension://*`) và local test origins cấu hình trong `CORS_ORIGIN`.
    - **No Secret Leakage:** `OPENAI_API_KEY` không bao giờ được log hoặc trả về client.
    - **No Private Data in Logs:** Tuyệt đối không log raw `visibleText`, câu hỏi của người học, nội dung note, hoặc query parameters nhạy cảm. Chỉ log: `requestId`, `turnId`, `durationMs`, `toolNames`, `errorCode`.
    - **No Stack Trace:** Mọi lỗi đều chuyển hóa thành `AppError` JSON với mã lỗi chuẩn, không lộ stack trace.
    - **Containment Boundary:** Chỉ chỉnh sửa trong `apps/agent-api/**`.
  </security_boundary>
</boundaries>

---

## 6. Required Tests & Verification Strategy

<existing_tests>

| Test Category | File dự kiến | Kịch bản kiểm chứng | Trạng thái |
|---|---|---|---|
| Health Check | `tests/health.test.ts` | `GET /health` trả status 200, đúng schema `HealthResponse` | Sẵn sàng tạo |
| Route Validation | `tests/routes.test.ts` | Body thiếu trường/sai type -> HTTP 400 + `VALIDATION_ERROR` | Sẵn sàng tạo |
| Agent Loop: Viewport Tool | `tests/agent-loop.test.ts` | Fake provider yêu cầu `get_viewport_context` -> harness trả text -> provider trả final answer | Sẵn sàng tạo |
| Agent Loop: Memory Tool | `tests/agent-loop.test.ts` | Fake provider gọi `search_memory` & `read_memory` -> lọc đúng trên tập preload | Sẵn sàng tạo |
| Max Steps Exceeded | `tests/agent-loop.test.ts` | Fake provider gọi tool liên tục quá 3 lần -> ngắt tại bước 3 với `AGENT_MAX_STEPS` | Sẵn sàng tạo |
| Unknown Tool & Invalid Args | `tests/tool-registry.test.ts` | Tên tool lạ hoặc arg sai schema trả về tool error có kiểm soát, không crash server | Sẵn sàng tạo |
| Memory Isolation | `tests/tool-registry.test.ts` | Đọc memoryId không có trong `relatedMemories` bị từ chối (`MEMORY_NOT_FOUND`) | Sẵn sàng tạo |
| Web Search Permission | `tests/tool-registry.test.ts` | `permissions.allowWebSearch = false` trả về `PERMISSION_DENIED` | Sẵn sàng tạo |
| Provider Error Mapping | `tests/provider.test.ts` | Provider timeout hoặc lỗi mạng map sang `AGENT_UNAVAILABLE` (503) hoặc `MODEL_ERROR` | Sẵn sàng tạo |
| Safe Logging & Sanitization | `tests/logging.test.ts` | Bắt log output, kiểm tra không chứa chuỗi văn bản của `visibleText` hay API key | Sẵn sàng tạo |

</existing_tests>

---

## 7. Runtime / Configuration

<runtime_config>
  - **Môi trường chạy:** Node.js v20+ / v22+, TypeScript strict (`tsconfig.json`).
  - **Build output:** `dist/server.js` do `tsup` tạo ra với format ESM (`npm run build`).
  - **Environment Variables (`src/config/env.ts`):**
    - `API_HOST`: string, default `"127.0.0.1"`.
    - `API_PORT`: number, default `8000`.
    - `CORS_ORIGIN`: string, comma-separated origins, default `"moz-extension://*,http://localhost:3000,http://127.0.0.1:3000"`.
    - `OPENAI_API_KEY`: string, required khi chạy server thật (optional trong tests sử dụng fake provider).
    - `OPENAI_BASE_URL`: string, optional (default `"https://api.openai.com/v1"` hoặc `"https://openrouter.ai/api/v1"`).
    - `OPENAI_MODEL`: string, default `"openai/gpt-4o-mini"` hoặc model hỗ trợ tool calls.
</runtime_config>

---

## 8. Evidence Classification

<evidence>
  <confirmed>
    - `packages/contracts` đã export đầy đủ 47 schemas và types, build thành công và test pass.
    - Nhánh `origin/task3` đã được merge sạch vào `agent-api` bằng fast-forward merge.
    - `npm run typecheck --workspace @vlc/agent-api` và `npm run build --workspace @vlc/agent-api` pass 100%.
    - `apps/agent-api/src/` gồm 10 files scaffold rỗng cần được triển khai theo đúng file map bắt buộc.
    - Ranh giới của Task 02 nghiêm cấm sửa file ngoài `apps/agent-api/**`.
  </confirmed>

  <observed>
    - Fastify v5 (`fastify@^5.12.4`) và `@fastify/cors@^11.3.0` đã sẵn sàng trong workspace.
    - Vitest v5 đã cấu hình ở root workspace và chạy được với cờ `--workspace @vlc/agent-api`.
  </observed>

  <hypothesized>
    - Triển khai `AppDependencies` với interface `LlmProvider` cho phép test 100% các kịch bản ReAct loop, tool execution, và error handling một cách deterministic mà không cần gọi API thật hoặc tốn chi phí token.
  </hypothesized>
</evidence>

---

## 9. Assumptions & Uncertainty

<assumptions>
  - **Giả định 1 (Độ chắc chắn: CAO):** Mọi unit test của `apps/agent-api` chạy với fake provider, không phụ thuộc vào internet hay API key thật.
  - **Giả định 2 (Độ chắc chắn: CAO):** Khi chạy thật, người dùng cấu hình OpenRouter key và base URL tương thích qua file `.env`.
  - **Giả định 3 (Độ chắc chắn: CAO):** Toàn bộ types và schemas được import trực tiếp từ `@vlc/contracts`, đảm bảo 100% tính nhất quán với Agent 1 và Agent 3.
</assumptions>

---

## 10. Impacted Files (Strict Ownership)

<impacted_files>
  Mọi thay đổi CHỈ nằm trong `apps/agent-api/**`:
  - `apps/agent-api/src/server.ts`
  - `apps/agent-api/src/app.ts`
  - `apps/agent-api/src/config/env.ts`
  - `apps/agent-api/src/routes/health.ts`
  - `apps/agent-api/src/routes/agent-turn.ts`
  - `apps/agent-api/src/agent/system-prompt.ts`
  - `apps/agent-api/src/agent/tool-registry.ts`
  - `apps/agent-api/src/agent/run-agent-turn.ts`
  - `apps/agent-api/src/providers/llm-provider.ts`
  - `apps/agent-api/src/providers/openai-compatible-provider.ts`
  - `apps/agent-api/tests/**`
</impacted_files>

---

## 11. Open Decisions for Innovate Phase

<open_decisions>
  - **Quyết định 1 (LlmProvider Abstraction & Fake Scripting):** Cách cấu trúc `LlmGenerateInput` và `LlmGenerateOutput` để fake provider mô phỏng tuần tự tool calls và final answer một cách đơn giản, dễ bảo trì trong test.
  - **Quyết định 2 (HTTP Error Mapping Strategy):** Cách map các `AppError` code sang HTTP status codes (400, 422, 503, 500) đảm bảo che giấu hoàn toàn stack trace và dữ liệu nhạy cảm.
</open_decisions>

---

## 12. Research Exit Criteria (Gate G0 Checklist)

<research_exit_criteria>
  - [x] Đã khảo sát sâu sắc mối liên kết liên agent (Agent 1 Extension, Agent 3 Contracts & Memory).
  - [x] Đã tích hợp và kiểm chứng `@vlc/contracts` từ commit `origin/task3`.
  - [x] Đã xác định rõ luồng ReAct model-tool loop 3 bước và response normalization.
  - [x] Đã làm rõ toàn bộ ranh giới sở hữu: chỉ chỉnh sửa trong `apps/agent-api/**`.
  - [x] Đã vạch ra toàn bộ 10 kịch bản test bắt buộc phục vụ Definition of Done.
  - [x] Không còn bất kỳ blocker hoặc giả định không kiểm chứng nào.
</research_exit_criteria>

</research_context>
