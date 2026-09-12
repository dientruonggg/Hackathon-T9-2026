# Task: FEAT-06 Firefox Runtime and Memory Stabilization

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
    Khắc phục triệt để lỗi Firefox Sidebar không giao tiếp được với Content Script khi capture viewport trên trang (như W3Schools), đảm bảo cơ chế handshake/injection tin cậy, lưu trữ long-term memory bền vững vào browser storage local của profile demo, tự động recapture vị trí viewport mới nhất trước khi lưu marker (tránh lưu lệch khi user cuộn trang mà không hỏi Agent), và xác nhận Golden E2E demo ổn định.
  </goal>

  <current_behavior>
    - Trên trang đích (ví dụ W3Schools HTML Tutorial), khi mở Sidebar xuất hiện lỗi: "Có lỗi - Chưa thể mở Learning Companion - Không thể đọc trang này. Hãy thử một bài viết HTML thông thường."
    - Nguyên nhân: `captureTabViewport` trong `browser-runtime.ts` gửi message `CAPTURE_CURRENT_VIEWPORT` bị reject hoặc không có receiver; fallback `executeScript` từ Sidebar thiếu quyền host permissions (`<all_urls>`) hoặc gặp lỗi inject/race condition, và outer catch nuốt chi tiết lỗi gốc chuyển thành lỗi generic `PERMISSION_DENIED`.
    - Các nút đánh dấu memory (`Đã hiểu`, `Chưa hiểu`, `Xem lại sau`) bị vô hiệu hóa vì không capture được viewport context.
    - Logic `saveMarker()` chỉ lấy `session.context` cũ mà chưa recapture vị trí viewport mới nhất trước khi lưu nếu user cuộn trang.
  </current_behavior>

  <expected_behavior>
    1. Khi mở Sidebar trên trang hợp lệ (như W3Schools), content script được đảm bảo sẵn sàng thông qua cơ chế handshake/injection có kiểm soát từ Background/Runtime.
    2. Chi tiết lỗi gốc được phân loại rõ ràng (lỗi send lần 1, lỗi injection, lỗi send retry) thay vì bị nuốt âm thầm.
    3. Host permissions và manifest được cấu hình chuẩn xác để `executeScript` và message passing hoạt động tin cậy.
    4. Viewport context được capture thành công, hiển thị đúng heading, đoạn văn và kích hoạt các nút chức năng (Ask, Marker buttons).
    5. Nút Marker thực hiện recapture vị trí trước khi ghi nhận để lưu chính xác đoạn văn bản tại vị trí cuộn hiện thời.
    6. Dữ liệu memory (`vlc:markers:v1`, `vlc:policy:v1`, `vlc:settings:v1`) được lưu trữ xuống local storage trong `.firefox-demo-profile`, duy trì bền vững qua các phiên khởi chạy.
    7. Bộ test suite (unit, integration, contracts, memory, lint) duy trì pass 100% và không có regression.
  </expected_behavior>

  <actor_authorization>
    Người dùng cuối tương tác qua giao diện Firefox Sidebar và browser action; background service script điều phối quyền truy cập tab và injection; sidebar lưu trữ memory cục bộ qua `browser.storage.local`.
  </actor_authorization>

  <invariants>
    - Tuân thủ nghiêm ngặt Source Policy: không tự động capture hoặc gọi Agent API trên các domain bị chặn hoặc các URL nhạy cảm.
    - Safe Observability: Tuyệt đối không log raw viewport text, URL đầy đủ hoặc memory payload ra console/telemetry.
    - Long-term memory chỉ được ghi khi có hành động xác nhận từ người dùng (User Confirmed Action).
    - Hạn chế inject lặp lại content script nhiều lần gây trùng lặp listener `runtime.onMessage`.
  </invariants>

  <out_of_scope>
    - Không thay đổi contract `AgentTurnRequestSchema` hay `AgentTurnResponseSchema` đã thống nhất trong `@vlc/contracts`.
    - Không can thiệp sửa đổi Fastify Agent API backend trừ khi cần kiểm thử tích hợp.
    - Không lưu raw viewport context vào long-term memory.
  </out_of_scope>

  <acceptance_criteria>
    - [x] AC-1: Bắt và phân loại chính xác các exception trong quá trình capture viewport (initial send, injection, retry send) với thông điệp rõ ràng, an toàn.
    - [x] AC-2: Thiết lập cơ chế handshake `PING_CONTENT_SCRIPT` / `ENSURE_CONTENT_SCRIPT` giữa Background/Sidebar và Content Script; bổ sung quyền cần thiết trong `manifest.json`.
    - [x] AC-3: Sidebar capture viewport thành công trên trang W3Schools; heading và preview text hiển thị chuẩn xác; nút Ask và các nút Marker được kích hoạt.
    - [x] AC-4: `saveMarker` tự động recapture viewport hiện thời trước khi lưu để đảm bảo anchor khớp với vị trí cuộn mới nhất của người dùng.
    - [x] AC-5: Memory được lưu thành công vào `browser.storage.local` (`vlc:markers:v1`) và phục hồi chính xác sau khi reload hoặc restart Firefox với demo profile.
    - [x] AC-6: Toàn bộ kiểm thử unit tests (`npm run verify`) và web-ext lint đạt 100% PASS không có cảnh báo/lỗi mới.
  </acceptance_criteria>

  <definition_of_ready>
    - [x] Target outcome and acceptance criteria are verifiable without guessing.
    - [x] Invariants and <out_of_scope> boundaries are explicit.
    - [x] Open questions resolved or scheduled in decision.md (No speculative coding).
  </definition_of_ready>
</specification>

---

## 2. Context Boundaries (Pillar 2: Context)

<context_boundaries>
  <target_files>
    - `apps/firefox-extension/manifest.json` — Cấu hình permissions và content script matches
    - `apps/firefox-extension/src/background/index.ts` — Xử lý message `ENSURE_CONTENT_SCRIPT` và điều phối tab injection
    - `apps/firefox-extension/src/content/index.ts` — Thêm listener handshake `PING_CONTENT_SCRIPT` và chống inject trùng lặp
    - `apps/firefox-extension/src/services/browser-runtime.ts` — Quy trình capture với handshake, injection qua background và bảo tồn thông tin lỗi
    - `apps/firefox-extension/src/sidebar/main.ts` — Cập nhật `saveMarker` để recapture vị trí trước khi commit memory
    - `apps/firefox-extension/tests/capture-current-viewport.test.ts` — Bổ sung test cho quy trình handshake và fallback injection
    - `apps/firefox-extension/tests/pipelines.test.ts` — Bổ sung test cho kịch bản scroll -> save marker
  </target_files>

  <context_groups>
    - `arhitecture specs` (`process/context/architecture/01-firefox-extension.md`, `03-memory-tools-skills.md`)
    - `tests` (`process/context/tests/all-tests.md`)
    - `log.md` (Handoff và trạng thái runtime demo)
  </context_groups>

  <source_of_truth>
    <requirement>`log.md` Section 5 & Section 13</requirement>
    <architecture>`process/context/architecture/01-firefox-extension.md`</architecture>
    <existing_behavior>`apps/firefox-extension/src/services/browser-runtime.ts`</existing_behavior>
    <tests>`apps/firefox-extension/tests/`</tests>
  </source_of_truth>
</context_boundaries>

---

## 3. Verification Strategy

<verification_strategy>

| AC / Risk | Evidence required | Verifier |
|---|---|---|
| AC-1 | Error classification & message preservation | Unit test trong `tests/` mô phỏng initial send failure, injection failure, retry failure |
| AC-2 | Handshake & injection message routing | Background & content script message handlers verified |
| AC-3 | Viewport capture on HTML pages | `runOpenSidebarPipeline` test suite & live web-ext verification |
| AC-4 | Scroll & recapture before saveMarker | Unit test trong `tests/pipelines.test.ts` kiểm tra anchor được cập nhật theo viewport mới nhất |
| AC-5 | Local storage persistence | Kiểm tra `vlc:markers:v1` trong storage adapter & demo profile test |
| AC-6 | Full monorepo verification | `npm run verify` pass 100% (typecheck, tests, build, web-ext lint) |

</verification_strategy>

---

## 4. Decisions

<decisions>
  <approved_decisions>
    - Giữ trọn vẹn Safe Observability: không bao giờ log URL nhạy cảm, raw viewport hay nội dung memory cá nhân.
    - Sử dụng background script làm trung tâm điều phối injection do background có quyền truy cập tab và API đặc quyền ổn định hơn sidebar action.
  </approved_decisions>

  <open_decisions>
    <!-- Sẽ chốt trong INNOVATE phase qua decision.md -->
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
      <!-- In DELEGATED / Fast-Track mode: Agent auto-certifies and advances to Innovate immediately -->
    </gate>
  </phase>

  <phase name="Innovate" order="2">
    <!-- READ-ONLY. Present 2-3 viable options. PAIR: engineer selects. DELEGATED: agent auto-selects optimal option. -->
    - [x] Generate 2–3 alternative approaches with trade-off matrix.
    - [x] Produce `decision.md` artifact.
    <gate id="G1" label="Gate 1 — Decision Approved">
      - [x] Options reviewed and trade-offs analyzed.
      - [x] Selected option recorded in `decision.md`.
      - [x] No blocking business/schema/security decision remains open.
      <approved_by>[AUTO: DELEGATED]</approved_by>
      <approved_date>2026-09-12</approved_date>
    </gate>
  </phase>

  <phase name="Plan" order="3">
    <!-- Plan artifacts only. No source-code changes. -->
    - [x] Decompose into vertical slices with verifiers and rollback points.
    - [x] Populate `plan.md` with scope contract and verification matrix.
    <gate id="G2" label="Gate 2 — Plan Approved">
      - [x] Every slice has a verifier.
      - [x] Allowed/forbidden file scope is defined.
      - [x] Rollback point defined per slice.
      - [x] Stop conditions defined.
      - [x] Plan approved.
      <approved_by>[AUTO: DELEGATED]</approved_by>
      <approved_date>2026-09-12</approved_date>
    </gate>
  </phase>

  <phase name="Execute" order="4">
    <!-- Read/write only within approved scope. One slice at a time. -->
    - [x] Implement each slice atomically.
    - [x] Run verifier after each slice.
    - [x] Inspect diff after each slice.
    - [x] Update `state.md` after each slice.
  </phase>

  <phase name="Review" order="5">
    <!-- READ-ONLY. May run verification commands. No code fixes during review. -->
    - [x] Review full diff, behavior, architecture, data, security, regression.
    - [x] Produce `review.md` with findings and verification matrix.
    <gate id="G3" label="Gate 3 — Review Passed">
      - [x] All AC verified with evidence.
      - [x] Residual risk accepted.
      - [x] Review decision: PASS.
      - [x] Ready for handoff.
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
    Never suppress errors with flags.
  </retry_budget>
</guardrails>

</task_spec>
