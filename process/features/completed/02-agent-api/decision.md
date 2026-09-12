# Decision: DEC-02-AGENT-API Architecture & Implementation Design for Agent API

<technical_decision task_id="TASK-02-AGENT-API" dec_id="DEC-02-AGENT-API" version="1.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. Present options. PAIR: engineer decides. DELEGATED: agent auto-selects optimal recommendation and advances. -->
<decision_status>
  <phase>INNOVATE</phase>
  <mode>READ-ONLY</mode>
  <decision_owner>@user</decision_owner>
  <last_updated>2026-09-12</last_updated>
</decision_status>

---

## 1. Context

<context>
  <task>[process/features/active/02-agent-api/task.md](task.md)</task>
  <research_artifact>[process/features/active/02-agent-api/research.md](research.md)</research_artifact>
  <constraints>
    - **Ranh giới sở hữu (Ownership):** CHỈ chỉnh sửa trong `apps/agent-api/**`.
    - **Tương thích Contracts:** Sử dụng 100% contracts từ `@vlc/contracts` đã tích hợp từ `origin/task3`.
    - **Agent Loop Concurrency & Step Limit:** Tối đa 3 model steps; xử lý tuần tự tool calls; ngắt với `AGENT_MAX_STEPS`.
    - **Testability:** 100% unit tests chạy độc lập với Fake `LlmProvider`, không phụ thuộc API key thật hay internet.
    - **Bảo mật & Safe Logging:** Không lưu DB server-side, không log raw viewport hay prompt, không trả stack trace.
  </constraints>
</context>

---

## 2. Decision Required

<decision_question>
  Thiết kế Dependency Injection (AppDependencies & AgentDependencies), cơ chế ReAct Loop và Provider Adapter như thế nào để đảm bảo tính module hóa cao nhất, dễ dàng test với Fake Provider mà vẫn tương thích hoàn hảo với OpenRouter / OpenAI SDK?
</decision_question>

---

## 3. Options

<options>

  <option id="A">
    <approach>Pure Dependency Injection với Functional Provider Interface (Khuyên dùng)</approach>
    <advantages>
      - `buildApp(deps: AppDependencies)` nhận `LlmProvider`, `Clock`, `Logger` tùy chọn; khi test gọi `app.inject()` mà không cần mở socket mạng hay API key.
      - `runAgentTurn(input, deps)` chỉ phụ thuộc vào interface `LlmProvider` thuần túy:
        ```ts
        interface LlmProvider {
          generate(input: LlmGenerateInput): Promise<Result<LlmGenerateOutput>>;
        }
        ```
      - Tách biệt rõ ràng: OpenAI-compatible provider (`createOpenAICompatibleProvider`) chỉ là một implementation của `LlmProvider`, đọc env từ `env.ts`.
      - Unit test có thể inject `createFakeLlmProvider(script)` mô phỏng từng lượt trả tool_calls và final text mà không cần mock thư viện `openai`.
    </advantages>
    <disadvantages>
      - Cần viết một wrapper chuyển đổi giữa format OpenAI Chat Completion và interface nội bộ `LlmGenerateInput`/`Output`.
    </disadvantages>
    <complexity>LOW</complexity>
    <compatibility>HIGH (100% tuân thủ file map và specification trong 02-agent-api.md)</compatibility>
    <concurrency_transaction_risk>LOW (Immutable turn context, thuần in-memory)</concurrency_transaction_risk>
    <testability>HIGH (Test deterministic, 0 flakiness, 0 network call)</testability>
    <maintainability>HIGH (Các module nhỏ gọn, cô lập cao)</maintainability>
  </option>

  <option id="B">
    <approach>Trực tiếp sử dụng OpenAI SDK Client trong Agent Loop kết hợp với Mocking Thư viện trong Tests</approach>
    <advantages>
      - Ít interface trung gian hơn.
    </advantages>
    <disadvantages>
      - Vi phạm quy tắc kiến trúc tại Mục 8 của `.agents/architecture/02-agent-api.md`: `runAgentTurn` không được import trực tiếp OpenAI client.
      - Unit tests phải mock sâu `openai` instance (`vi.spyOn` hoặc `vi.mock`), dễ gãy khi thư viện cập nhật và khó kiểm soát trạng thái mô phỏng tool calls tuần tự.
    </disadvantages>
    <complexity>MEDIUM</complexity>
    <compatibility>LOW</compatibility>
    <concurrency_transaction_risk>LOW</concurrency_transaction_risk>
    <testability>MEDIUM</testability>
    <maintainability>LOW</maintainability>
  </option>

</options>

---

## 4. Trade-off Matrix

<tradeoff_matrix>

| Tiêu chí | Option A (Pure DI + Provider Interface) | Option B (Direct SDK + Mock) |
|---|:---:|:---:|
| Tuân thủ kiến trúc (02-agent-api.md) | 5 / 5 | 2 / 5 |
| Độ dễ dàng & ổn định của Tests | 5 / 5 | 3 / 5 |
| Tốc độ thực thi Unit Tests | 5 / 5 | 3.5 / 5 |
| Khả năng cắm rút (OpenRouter / Local vLLM / Mock) | 5 / 5 | 3 / 5 |
| Tính rõ ràng của ranh giới code | 5 / 5 | 3 / 5 |
| **Tổng điểm** | **5.0 / 5** | **2.9 / 5** |

</tradeoff_matrix>

---

## 5. Recommendation

<recommendation>
  Lựa chọn **Option A**: Triển khai `LlmProvider` interface, `createOpenAICompatibleProvider`, `buildApp` nhận `AppDependencies`. Đây là mô hình chuẩn mực được quy định rõ trong `.agents/architecture/02-agent-api.md`, đảm bảo tính cô lập và cho phép viết trọn vẹn 10 kịch bản test bằng Fake Provider mà không gặp bất kỳ flakiness nào.
</recommendation>

---

## 6. Implementation Decision

<engineer_decision>
  <selected_option>A</selected_option>
  <rationale>
    Option A thỏa mãn 100% file map bắt buộc, tuân thủ nghiêm ngặt quy chuẩn kiến trúc của đề tài và mang lại độ ổn định tối đa cho bộ test.
  </rationale>
  <rejected_alternatives>
    - Option B: Bị loại vì vi phạm quy chuẩn kiến trúc tại Mục 8 của 02-agent-api.md và làm phức tạp việc viết fake-provider tests.
  </rejected_alternatives>
</engineer_decision>

---

## 7. Constraints Created by This Decision

<constraints_created>
  - File `src/providers/llm-provider.ts` export interface `LlmProvider`, `LlmGenerateInput`, `LlmGenerateOutput`.
  - File `src/providers/openai-compatible-provider.ts` export `createOpenAICompatibleProvider`.
  - `src/agent/run-agent-turn.ts` chỉ nhận `deps: { provider: LlmProvider, clock?: Clock }`.
  - `src/app.ts` nhận `deps: { provider: LlmProvider, config?: EnvConfig }`.
</constraints_created>

---

## 8. Evidence Still Required

<evidence_required>
  - Kiểm chứng `createOpenAICompatibleProvider` ánh xạ đúng `tools` sang cấu trúc `chat.completions.create` của OpenAI SDK.
  - Kiểm chứng `runAgentTurn` dừng đúng ở bước 3 khi model liên tục trả tool_calls.
</evidence_required>

---

## Gate 1 — Decision Approved

<gate id="G1">
  - [x] All options presented and trade-offs analyzed.
  - [x] Selected option recorded above (Option A).
  - [x] No blocking business / schema / security decision remains open.
  <approved_by>@engineer</approved_by>
  <approved_date>2026-09-12</approved_date>
</gate>

</technical_decision>
