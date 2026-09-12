# Task: TASK-02-AGENT-API Fastify Agent API Implementation

<task_spec version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL (master state record)
     ════════════════════════════════════════════ -->
<task_control>
  <status>COMPLETED</status>
  <spec_level>S3</spec_level>
  <priority>P1</priority>
  <risk>MEDIUM</risk>
  <estimated_story_points>3</estimated_story_points>
  <working_mode>PAIR</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@antigravity</owner>
  <decision_owner>@user</decision_owner>
  <created>2026-09-12</created>
  <last_updated>2026-09-12</last_updated>
</task_control>

---

## 1. Specification (Pillar 1: Task / Spec)

<specification>
  <goal>
    Xây dựng hoàn chỉnh Fastify Agent API trong phạm vi sở hữu `apps/agent-api/**`, bao gồm HTTP validation, system prompt grounded, pure tool registry, agent loop tối đa 3 bước, OpenAI-compatible provider adapter (hỗ trợ OpenRouter / local LLMs) và bộ test suite toàn diện với fake-provider tests.
  </goal>

  <current_behavior>
    - `apps/agent-api/src/` hiện tại chỉ chứa các file khung (scaffolding stubs) rỗng với chú thích `// TODO(Agent 2)`:
      - `src/server.ts`, `src/app.ts`, `src/config/env.ts`
      - `src/routes/health.ts`, `src/routes/agent-turn.ts`
      - `src/agent/system-prompt.ts`, `src/agent/tool-registry.ts`, `src/agent/run-agent-turn.ts`
      - `src/providers/llm-provider.ts`, `src/providers/openai-compatible-provider.ts`
    - Chưa có route nào được đăng ký; chưa có validation schema hay app factory; chưa có agent loop.
    - Chưa có file test nào trong `apps/agent-api` (`vitest run --passWithNoTests` trả về 0 test).
    - Package `@vlc/contracts` hiện tại cũng đang là stub rỗng (thuộc quyền sở hữu của Agent 3).
  </current_behavior>

  <expected_behavior>
    - `buildApp(deps)` tạo Fastify instance hoàn chỉnh, đăng ký 2 routes:
      - `GET /health` trả về `{ status: "ok", service: "viewport-learning-agent-api", contractVersion: "0.1" }`.
      - `POST /v1/agent/turn` validate request schema, gọi `runAgentTurn`, map HTTP status code chuẩn xác.
    - CORS chỉ cho phép extension và local demo origins được cấu hình trong env.
    - System prompt cố định các nguyên tắc grounded, không bịa lịch sử, không suy diễn "đã hiểu", ngắn gọn cho sidebar.
    - Pure tool registry gồm 5 tools (`get_viewport_context`, `search_memory`, `read_memory`, `propose_marker`, `search_web`), chỉ đọc immutable turn context hoặc tạo proposal, không có server-side memory DB.
    - `runAgentTurn` điều phối vòng lặp tối đa 3 bước model -> tool -> model, append tool results, xử lý lỗi có kiểm soát, dừng khi đạt câu trả lời cuối cùng hoặc `AGENT_MAX_STEPS`.
    - `createOpenAICompatibleProvider` bọc OpenAI SDK gọi Chat Completions với `tools`/`tool_calls`, đọc config từ env (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`), tương thích OpenRouter.
    - Safe logging: không log raw viewport, prompt, question, note, API key hay query nhạy cảm; không trả stack trace ra client.
    - Đầy đủ unit tests với Fake LlmProvider mô phỏng các kịch bản tool use, max-step termination, error mapping và schema validation.
    - `dist/server.js` được build qua tsup và chạy trơn tru.
  </expected_behavior>

  <actor_authorization>
    Client là Firefox Extension (Sidebar UI) hoặc local test harness gọi qua HTTP POST `http://localhost:8000/v1/agent/turn` hoặc `GET /health`.
  </actor_authorization>

  <invariants>
    - **Ranh giới sở hữu (Ownership Boundary):** CHỈ được sửa `apps/agent-api/**`. Tuyệt đối không sửa root package manifests, lockfile, `.agents/**`, `apps/firefox-extension/**`, `packages/**`.
    - **Không stateful server-side memory:** Không lưu trữ DB, SQLite hay cache session trên server; memory thuộc về browser extension.
    - **Grounded reasoning:** Model chỉ trả lời từ viewport, memory được preload hoặc web result thật; thiếu dữ kiện thì trả lời `INSUFFICIENT`.
    - **Tối đa 3 model steps:** Bắt buộc terminate nếu vượt quá 3 bước lặp với error code `AGENT_MAX_STEPS`.
    - **Safe logging & privacy:** Không bao giờ log nội dung thô (raw viewport, question, note, API key).
  </invariants>

  <out_of_scope>
    - Sửa đổi shared contracts trong `packages/contracts/**` hoặc logic trong `packages/memory/**`.
    - Sửa đổi Firefox Extension trong `apps/firefox-extension/**`.
    - Thêm persistent database (SQLite/Postgres) hoặc caching server (Redis).
    - Thêm Cloudflare Durable Objects, scheduler, background workers hoặc multi-agent orchestration.
    - Mở rộng crawler hoặc browser automation từ backend.
  </out_of_scope>

  <acceptance_criteria>
    - [x] AC-1: `npm run typecheck --workspace @vlc/agent-api` vượt qua với TypeScript strict mode.
    - [x] AC-2: `npm test --workspace @vlc/agent-api` vượt qua 100% các unit tests bắt buộc.
    - [x] AC-3: `npm run build --workspace @vlc/agent-api` tạo thành công `dist/server.js` chạy bằng Node.
    - [x] AC-4: `GET /health` trả về status 200 và schema đúng đặc tả `04-shared-contracts.md`.
    - [x] AC-5: `POST /v1/agent/turn` validate input schema và trả về 400 `VALIDATION_ERROR` nếu request sai.
    - [x] AC-6: Fake provider test chứng minh chu trình model -> tool (`get_viewport_context` / `search_memory`) -> model final answer hoạt động đúng.
    - [x] AC-7: Giới hạn 3 bước (Max-step termination) được kích hoạt chính xác khi model gọi tool liên tục không dừng.
    - [x] AC-8: Provider error / timeout mapping trả về mã lỗi 503 `AGENT_UNAVAILABLE` hoặc `MODEL_ERROR` không lộ stack trace.
    - [x] AC-9: Đảm bảo không có bất kỳ file nào ngoài `apps/agent-api/**` bị chỉnh sửa.
  </acceptance_criteria>

  <definition_of_ready>
    - [x] Mục tiêu, phạm vi và tiêu chí nghiệm thu được định nghĩa minh bạch không phỏng đoán.
    - [x] Ranh giới sở hữu (`apps/agent-api/**`) và danh sách file cấm sửa được xác định rõ ràng.
    - [x] Các tài liệu kiến trúc tham chiếu (`00-system-overview.md`, `02-agent-api.md`, `04-shared-contracts.md`, `TASK.md`) đã được phân tích.
  </definition_of_ready>
</specification>

---

## 2. Context Boundaries

<context_boundaries>
  <spec_doc>.agents/tasks/02-agent-api/TASK.md</spec_doc>
  <architecture_docs>
    - .agents/architecture/00-system-overview.md
    - .agents/architecture/02-agent-api.md
    - .agents/architecture/03-memory-tools-skills.md
    - .agents/architecture/04-shared-contracts.md
    - .agents/architecture/05-integration-e2e.md
  </architecture_docs>
  <allowed_files>
    apps/agent-api/**
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
</context_boundaries>

---

## 3. RIPER-5 Execution Plan

<riper5_plan>
  <phase name="RESEARCH" status="IN_PROGRESS">
    - Khảo sát mã nguồn hiện tại trong `apps/agent-api`.
    - Xác minh baseline tooling (`npm run typecheck`, `npm test`, `npm run build`).
    - Phân tích hợp đồng giao tiếp (Shared Contracts) và xử lý phụ thuộc với `@vlc/contracts`.
    - Hoàn thành `research.md` và kiểm tra Gate G0.
  </phase>
  <phase name="INNOVATE" status="PENDING">
    - Lập `decision.md` đánh giá phương án xử lý phụ thuộc contracts (Local internal contract definitions vs direct `@vlc/contracts` import) và Provider composition.
    - Ký Gate G1.
  </phase>
  <phase name="PLAN" status="PENDING">
    - Lập `plan.md` chia nhỏ các lát cắt phát triển (Slices A -> E).
    - Ký Gate G2.
  </phase>
  <phase name="EXECUTE" status="PENDING">
    - Triển khai code và unit tests theo từng lát cắt trong `apps/agent-api/**`.
    - Cập nhật `state.md`.
  </phase>
  <phase name="REVIEW" status="PENDING">
    - Chạy toàn bộ test, typecheck, build, audit bảo mật/log, ký Gate G3 và bàn giao `handoff.md`.
  </phase>
</riper5_plan>

</task_spec>
