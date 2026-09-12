# Plan: PLAN-06 Firefox Runtime Handshake and Memory Stabilization

<execution_plan task_id="FEAT-06" plan_id="PLAN-06" version="2.0" framework="RIPER-5">

<plan_status>
  <phase>PLAN</phase>
  <last_updated>2026-09-12</last_updated>
</plan_status>

---

## 1. Input Artifacts

<input_artifacts>
  <task_spec>[`task.md`](task.md)</task_spec>
  <research>[`research.md`](research.md)</research>
  <decision>[`decision.md`](decision.md) — DEC-06 (Option C)</decision>
</input_artifacts>

---

## 2. Execution Constraints

<execution_constraints>
  <allowed_files>
    - `apps/firefox-extension/manifest.json` — Bổ sung permission `"<all_urls>"`
    - `apps/firefox-extension/src/content/index.ts` — Singleton guard & ping handler
    - `apps/firefox-extension/src/background/index.ts` — Handshake coordinator & script injector
    - `apps/firefox-extension/src/services/browser-runtime.ts` — Safe error capture & handshake integration
    - `apps/firefox-extension/src/sidebar/main.ts` — Recapture before saveMarker
    - `apps/firefox-extension/tests/capture-current-viewport.test.ts` — Tests bổ sung
    - `apps/firefox-extension/tests/pipelines.test.ts` — Tests bổ sung cho recapture scroll
    - `apps/firefox-extension/tests/browser-runtime.test.ts` — Test mới cho handshake & injection
  </allowed_files>
  <forbidden_files>
    - `packages/contracts/**` — Khóa hợp đồng, không thay đổi shared contracts
    - `apps/agent-api/**` — Không can thiệp API server
    - `packages/memory/**` — Memory repository cốt lõi đã hoàn thiện
  </forbidden_files>
  <allowed_commands>
    - `npm test`
    - `npm run typecheck`
    - `npm run build`
    - `npm run lint:extension`
    - `npm run verify`
    - `npm run demo:preflight`
  </allowed_commands>
  <restricted_operations>
    - Không log URL đầy đủ có query string nhạy cảm hay raw viewport text (Safe Observability).
    - Không xóa file `.firefox-demo-profile` nếu đã tồn tại.
  </restricted_operations>
</execution_constraints>

---

## 3. Slice Summary

<slice_summary>

| ID | Behavior | Boundary | Files | AC | Verifier | Risk | Mode | Rollback |
|---|---|---|---|---|---|---|---|---|
| S1 | Manifest permissions, Content Script singleton & Background Handshake | Extension core | `manifest.json`, `content/index.ts`, `background/index.ts` | AC-2 | `npm run lint:extension` & unit test | LOW | DELEGATED | `git checkout -- <files>` |
| S2 | Safe Viewport Capture with Handshake & Error Classification | Runtime service | `browser-runtime.ts`, `tests/browser-runtime.test.ts` | AC-1, AC-3 | `npm test --workspace @vlc/firefox-extension` | MEDIUM | DELEGATED | `git checkout -- <files>` |
| S3 | Recapture Viewport Before Save Marker on Scroll | Sidebar & Pipeline | `sidebar/main.ts`, `tests/pipelines.test.ts` | AC-4 | `npm test --workspace @vlc/firefox-extension` | LOW | DELEGATED | `git checkout -- <files>` |
| S4 | Full Verification, Memory Persistence & Preflight | Monorepo integration | Build outputs, `.firefox-demo-profile` | AC-5, AC-6 | `npm run verify` | LOW | DELEGATED | `git checkout -- <files>` |

</slice_summary>

---

## 4. Slice Details

<slices>

  <slice id="S1">
    <objective>Khai báo host permission, chống inject trùng lặp và xây dựng handshake ENSURE_CONTENT_SCRIPT</objective>
    <change>
      1. Thêm `"<all_urls>"` vào `"permissions"` trong `manifest.json`.
      2. Trong `content/index.ts`: Bọc `browser.runtime.onMessage.addListener` với kiểm tra `window.__VLC_CONTENT_SCRIPT_LOADED__` và phản hồi `PING_CONTENT_SCRIPT`.
      3. Trong `background/index.ts`: Lắng nghe message `ENSURE_CONTENT_SCRIPT` -> ping tab -> nếu fail thì gọi `browser.tabs.executeScript` -> ping lại -> trả kết quả Result.
    </change>
    <allowed_files>
      - `apps/firefox-extension/manifest.json`
      - `apps/firefox-extension/src/content/index.ts`
      - `apps/firefox-extension/src/background/index.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-2: Handshake `PING_CONTENT_SCRIPT` và `ENSURE_CONTENT_SCRIPT` hoạt động; `manifest.json` có `"<all_urls>"`.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm run build --workspace @vlc/firefox-extension && npm run lint:extension --workspace @vlc/firefox-extension
      ```
    </verifier>
    <expected_evidence>Build thành công; web-ext lint: 0 errors, 0 warnings, 0 notices.</expected_evidence>
    <rollback_point>git checkout apps/firefox-extension/manifest.json apps/firefox-extension/src/content/index.ts apps/firefox-extension/src/background/index.ts</rollback_point>
  </slice>

  <slice id="S2">
    <objective>Tích hợp Handshake vào `captureTabViewport` và phân loại exception an toàn</objective>
    <change>
      1. Trong `browser-runtime.ts`: Trước khi gửi `CAPTURE_CURRENT_VIEWPORT`, đảm bảo content script đã sẵn sàng bằng cách gọi `ensureContentScript(tabId)`.
      2. Lưu giữ và phân loại 3 tầng lỗi: Initial ping/send, Injection error, Retry ping/send với thông báo chuẩn hóa.
      3. Bổ sung `tests/browser-runtime.test.ts` kiểm thử kịch bản tab đã có script, tab cần inject và tab không thể inject (restricted page).
    </change>
    <allowed_files>
      - `apps/firefox-extension/src/services/browser-runtime.ts`
      - `apps/firefox-extension/tests/browser-runtime.test.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-1: Bắt và phân loại chính xác các exception.
      - [ ] AC-3: Sidebar capture viewport thành công qua handshake.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm test --workspace @vlc/firefox-extension
      ```
    </verifier>
    <expected_evidence>Tất cả tests pass bao gồm test mới cho browser-runtime.</expected_evidence>
    <rollback_point>git checkout apps/firefox-extension/src/services/browser-runtime.ts apps/firefox-extension/tests/browser-runtime.test.ts</rollback_point>
  </slice>

  <slice id="S3">
    <objective>Recapture viewport mới nhất trước khi commit Save Marker khi người dùng cuộn trang</objective>
    <change>
      1. Trong `apps/firefox-extension/src/sidebar/main.ts`: Trong `saveMarker()`, gọi `captureTabViewport()` để lấy viewport context mới nhất của tab hiện tại.
      2. Kiểm tra canonical URL khớp; nếu hợp lệ thì cập nhật `session.context` và anchor trước khi gọi `executeConfirmedMemoryCommand()`.
      3. Trong `tests/pipelines.test.ts`: Bổ sung test kiểm tra khi user cuộn trang, marker được lưu với anchor tại vị trí cuộn mới.
    </change>
    <allowed_files>
      - `apps/firefox-extension/src/sidebar/main.ts`
      - `apps/firefox-extension/tests/pipelines.test.ts`
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-4: `saveMarker` tự động recapture viewport hiện thời trước khi lưu.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm test --workspace @vlc/firefox-extension
      ```
    </verifier>
    <expected_evidence>Test pipelines pass 100% bao gồm kịch bản scroll -> saveMarker.</expected_evidence>
    <rollback_point>git checkout apps/firefox-extension/src/sidebar/main.ts apps/firefox-extension/tests/pipelines.test.ts</rollback_point>
  </slice>

  <slice id="S4">
    <objective>Toàn bộ kiểm thử monorepo và kiểm tra lưu memory local bền vững</objective>
    <change>
      1. Chạy `npm run verify` kiểm chứng toàn diện typecheck, unit tests, build và lint.
      2. Kiểm tra tính toàn vẹn của memory repository adapter với `browser.storage.local`.
    </change>
    <allowed_files>
      - Không sửa đổi mã nguồn.
    </allowed_files>
    <acceptance_criteria>
      - [ ] AC-5: Memory được lưu vào `browser.storage.local`.
      - [ ] AC-6: `npm run verify` pass 100%.
    </acceptance_criteria>
    <verifier>
      ```bash
      npm run verify
      ```
    </verifier>
    <expected_evidence>Verify pass 100% (typecheck, 75+ tests, builds, lint: 0 errors/warnings).</expected_evidence>
    <rollback_point>N/A</rollback_point>
  </slice>

</slices>

---

## 5. Scope Contract

<scope_contract>
  <allowed>
    - Chỉnh sửa `apps/firefox-extension/manifest.json`
    - Chỉnh sửa `apps/firefox-extension/src/content/index.ts`
    - Chỉnh sửa `apps/firefox-extension/src/background/index.ts`
    - Chỉnh sửa `apps/firefox-extension/src/services/browser-runtime.ts`
    - Chỉnh sửa `apps/firefox-extension/src/sidebar/main.ts`
    - Bổ sung / cập nhật test trong `apps/firefox-extension/tests/`
  </allowed>
  <forbidden>
    - Thay đổi API endpoints hoặc schemas trong `packages/contracts/`
    - Thay đổi Fastify routes trong `apps/agent-api/`
    - Phá vỡ Safe Observability
  </forbidden>
</scope_contract>

---

## 6. Gate 2 Sign-Off

<gate_2_signoff>
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12T15:12:00+07:00</approved_date>
  <rationale>
    Kế hoạch phân rã 4 vertical slices độc lập, có đầy đủ verifier, rollback point và scope contract chặt chẽ.
  </rationale>
</gate_2_signoff>

</execution_plan>
