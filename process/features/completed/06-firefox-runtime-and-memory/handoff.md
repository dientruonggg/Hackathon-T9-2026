# Handoff: FEAT-06 Firefox Runtime and Memory Stabilization

<handoff task_id="FEAT-06" version="2.0" framework="RIPER-5">

<handoff_status>
  <review_decision>PASS</review_decision>
  <review_artifact>[`review.md`](review.md)</review_artifact>
  <completed_date>2026-09-12T15:15:00+07:00</completed_date>
</handoff_status>

---

## 1. What Changed

<what_changed>
  Đã sửa chữa triệt để lỗi Sidebar không giao tiếp được với Content Script trên tab mở sẵn (như W3Schools), thiết lập cơ chế handshake tin cậy thông qua Background script và bảo vệ chống duplicate listeners, chuẩn hóa và bảo tồn chi tiết lỗi an toàn, bổ sung tự động recapture vị trí viewport mới nhất trước khi lưu marker (tránh lệch anchor khi user cuộn trang), và đảm bảo dữ liệu memory lưu bền vững xuống local storage của dự án.
</what_changed>

<main_changes>
  - `apps/firefox-extension/manifest.json`: Bổ sung permission `"<all_urls>"` để hỗ trợ injection qua `executeScript` trong Manifest V2.
  - `apps/firefox-extension/src/content/index.ts`: Bổ sung singleton guard `window.__VLC_CONTENT_SCRIPT_LOADED__` và responder `PING_CONTENT_SCRIPT`.
  - `apps/firefox-extension/src/background/index.ts`: Tiếp nhận `ENSURE_CONTENT_SCRIPT`, thực hiện ping -> inject fallback -> ping xác nhận, phân loại error code.
  - `apps/firefox-extension/src/services/browser-runtime.ts`: Tích hợp handshake vào `captureTabViewport`, phân loại an toàn 3 tầng lỗi (initial send, injection, retry send) với `safeErrorMessage`.
  - `apps/firefox-extension/src/pipeline/confirmed-memory-command.ts`: Bổ sung hàm `executeConfirmedMemoryWithRecapture` để recapture viewport trước khi ghi marker.
  - `apps/firefox-extension/src/sidebar/main.ts`: Cập nhật `saveMarker` sử dụng `executeConfirmedMemoryWithRecapture`.
  - `apps/firefox-extension/tests/browser-runtime.test.ts`: Thêm 10 unit tests cho handshake, fallback injection và error handling.
  - `apps/firefox-extension/tests/pipelines.test.ts`: Thêm 2 unit tests kiểm thử kịch bản scroll -> saveMarker recapture.
</main_changes>

---

## 2. Why

<why>
  Giải quyết lỗi chặn demo nghiêm trọng khi Firefox mở trang W3Schools trước khi add-on tạm thời kịp nạp, dẫn đến việc sidebar không thể capture viewport, làm tê liệt các nút Ask và Marker, đồng thời khắc phục lỗi anchor bộ nhớ không cập nhật khi người dùng cuộn trang đọc tài liệu trước khi lưu lại.
</why>

---

## 3. What Proves It

<evidence>

| AC | Verifier | Result |
|---|---|---|
| AC-1 | `npm test --workspace @vlc/firefox-extension` (browser-runtime.test.ts) | PASS (10/10 tests) |
| AC-2 | `npm run build && npm run lint:extension` | PASS (0 errors, 0 warnings) |
| AC-3 | `npm test --workspace @vlc/firefox-extension` | PASS (47/47 tests) |
| AC-4 | `npm test --workspace @vlc/firefox-extension` (pipelines.test.ts) | PASS (10/10 tests) |
| AC-5 | `npm test --workspace @vlc/memory` | PASS (6/6 tests) |
| AC-6 | `npm run verify` | PASS (87/87 tests across monorepo) |

Reproduce command:
```bash
npm run verify
```

</evidence>

---

## 4. What Remains Risky

<residual_risk>
  - Khi khởi động demo lần đầu trên máy Linux mới, cần đảm bảo Agent API đang chạy ở Terminal 1 (`npm run dev:api`) để Sidebar có thể kết nối với Agent API local (`http://127.0.0.1:8787`).
</residual_risk>

---

## 5. Decisions & Assumptions

<decisions_and_assumptions>
  - Lựa chọn DEC-06 (Option C): Điều phối handshake qua Background script kết hợp host permission `"<all_urls>"` và singleton guard là giải pháp an toàn và hoàn chỉnh nhất cho Firefox Manifest V2.
</decisions_and_assumptions>

---

## 6. Next Action

<next_action>
  Chạy demo theo thứ tự 3 terminal chuẩn hóa trong `log.md`:
  1. `npm run dev:api`
  2. `npm run demo:preflight`
  3. `npm run demo:firefox`
</next_action>

</handoff>
