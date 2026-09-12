# Task: FEAT-07 Selected Text Support, Agent Proposal UI, and Real-Page Robustness

<task_spec version="3.0" framework="RIPER-5">

<!-- ════════════════════════════════════════════
     SECTION 0 — TASK CONTROL (master state record)
     ════════════════════════════════════════════ -->
<task_control>
  <status>COMPLETED</status>
  <spec_level>S3</spec_level>
  <priority>P0</priority>
  <risk>LOW</risk>
  <estimated_story_points>3</estimated_story_points>
  <working_mode>DELEGATED</working_mode>
  <current_phase>REVIEW</current_phase>
  <owner>@antigravity</owner>
  <decision_owner>@phuqy</decision_owner>
  <created>2026-09-12</created>
  <last_updated>2026-09-12</last_updated>
</task_control>

---

## 1. Specification (Pillar 1: Task / Spec)

<specification>
  <goal>
    Bổ sung hỗ trợ bôi đen văn bản (Selection Capture qua window.getSelection()), hiển thị trực quan đề xuất đánh dấu của Agent (Agent Proposal UI với nút xác nhận người dùng), tinh chỉnh độ ổn định khi capture trên trang W3Schools thực tế, và đảm bảo mọi thông tin lỗi được báo cáo tường minh.
  </goal>

  <current_behavior>
    - `captureCurrentViewport` chỉ quét DOM nodes trong viewport, chưa gọi `window.getSelection()`. Nếu người dùng bôi đen một đoạn văn bản, ngữ cảnh hỏi vẫn là toàn bộ viewport thay vì ưu tiên đoạn được chọn.
    - Khi Agent phản hồi có `suggestedActions` (ví dụ `propose_marker` -> `CONFIRM_MARKER`), Sidebar chỉ lưu ngầm vào `session.pendingAction` mà không hiển thị khối UI đề xuất rõ ràng cho người dùng bấm xác nhận.
    - Cần xác nhận thông tin lỗi chi tiết và các tầng bảo vệ trên trang thực tế.
  </current_behavior>

  <expected_behavior>
    1. Khi người dùng bôi đen văn bản trên trang:
       - `captureCurrentViewport` trích xuất `selectedText` qua `getSelection()`, chuẩn hóa và giới hạn độ dài (tối đa 1000 ký tự).
       - Đưa `selectedText` vào `anchor.textQuote` (tối đa 240 ký tự) và ưu tiên đưa vào đầu `visibleText`.
       - Nếu không bôi đen (selection rỗng), tự động fallback về viewport text thông thường.
    2. Khi Agent trả về `suggestedActions` (ví dụ: đề xuất "Xem lại sau" kèm lý do):
       - UI hiển thị thẻ nổi bật: "Agent đề xuất: [Trạng thái] — [Lý do/Note]".
       - Hiển thị nút "Lưu theo đề xuất" để người dùng xác nhận.
       - Tuyệt đối không tự động lưu nếu người dùng chưa bấm nút xác nhận.
    3. Bộ test suite monorepo tiếp tục đạt 100% PASS, không có regression.
  </expected_behavior>

  <actor_authorization>
    Người dùng tương tác qua giao diện Sidebar và trang web; Content script đọc selection của người dùng khi được yêu cầu.
  </actor_authorization>

  <invariants>
    - Safe Observability: Không log raw viewport text hoặc selection content ra console/telemetry.
    - User Confirmation: Mọi thao tác lưu marker lâu dài bắt buộc phải có sự xác nhận của người dùng.
    - Schema Integrity: Giữ nguyên Zod schemas và types trong `@vlc/contracts`.
  </invariants>

  <out_of_scope>
    - Không tự động ghi memory ngầm khi người dùng lướt web.
    - Không thay đổi contracts `@vlc/contracts`.
  </out_of_scope>

  <acceptance_criteria>
    - [x] AC-1: `captureCurrentViewport` hỗ trợ đọc `window.getSelection()`, ưu tiên văn bản bôi đen trong `visibleText` và `anchor.textQuote`, fallback mượt mà về viewport khi selection rỗng.
    - [x] AC-2: Giao diện Sidebar hiển thị khối "Agent đề xuất: [Status] — [Lý do]" khi có `suggestedActions` từ câu trả lời của Qwen, kèm nút bấm để người dùng xác nhận lưu.
    - [x] AC-3: Bổ sung unit tests cho selection capture, fallback viewport và proposal UI interaction.
    - [x] AC-4: Toàn bộ kiểm thử monorepo (`npm run verify`) và `web-ext lint` đạt PASS 100%.
  </acceptance_criteria>

  <definition_of_ready>
    - [x] Target outcome and acceptance criteria are verifiable without guessing.
    - [x] Invariants and <out_of_scope> boundaries are explicit.
  </definition_of_ready>
</specification>

---

## 2. Context Boundaries

<context_boundaries>
  <target_files>
    - `apps/firefox-extension/src/content/capture-current-viewport.ts` — Thêm `getSelection()` và ưu tiên selected text
    - `apps/firefox-extension/index.html` — Thêm thẻ giao diện `#agent-proposal-panel`
    - `apps/firefox-extension/src/sidebar/main.ts` — Render đề xuất của agent và xử lý nút bấm xác nhận
    - `apps/firefox-extension/src/sidebar/styles.css` — Styling cho proposal panel
    - `apps/firefox-extension/tests/capture-current-viewport.test.ts` — Test cases cho text selection & fallback
  </target_files>
</context_boundaries>

---

## 3. Verification Strategy

<verification_strategy>

| AC | Evidence required | Verifier |
|---|---|---|
| AC-1 | Unit tests với fake selection & empty selection | `npm test --workspace @vlc/firefox-extension` |
| AC-2 | Proposal UI rendering & click handling | Vitest tests & build verification |
| AC-3 | Unit tests bổ sung | `tests/capture-current-viewport.test.ts` |
| AC-4 | Monorepo integrity | `npm run verify` |

</verification_strategy>

---

## 4. RIPER-5 Execution Plan

<execution_plan>
  <phase name="Research" order="1">
    - [x] Ingest task spec and constraints.
    - [x] Produce `research.md`.
    <gate id="G0" label="Research Complete">
      - [x] Requirements analyzed.
    </gate>
  </phase>

  <phase name="Innovate" order="2">
    - [x] Trade-off analysis for selection formatting & UI layout.
    - [x] Produce `decision.md`.
    <gate id="G1" label="Gate 1 — Decision Approved">
      - [x] Gate 1 approved.
      <approved_by>[AUTO: DELEGATED]</approved_by>
    </gate>
  </phase>

  <phase name="Plan" order="3">
    - [x] Produce `plan.md`.
    <gate id="G2" label="Gate 2 — Plan Approved">
      - [x] Gate 2 approved.
      <approved_by>[AUTO: DELEGATED]</approved_by>
    </gate>
  </phase>

  <phase name="Execute" order="4">
    - [x] Implement selected text in `capture-current-viewport.ts`.
    - [x] Implement proposal UI in `index.html`, `styles.css`, and `main.ts`.
    - [x] Verify tests.
  </phase>

  <phase name="Review" order="5">
    - [x] Produce `review.md`.
    <gate id="G3" label="Gate 3 — Review Passed">
      - [x] Review passed.
      <approved_by>[AUTO: DELEGATED]</approved_by>
    </gate>
  </phase>
</execution_plan>

</task_spec>
