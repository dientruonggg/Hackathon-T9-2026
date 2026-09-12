# Decision: DEC-06 Firefox Runtime Handshake and Memory Stabilization

<technical_decision task_id="FEAT-06" dec_id="DEC-06" version="1.0" framework="RIPER-5">

<decision_status>
  <phase>INNOVATE</phase>
  <mode>READ-ONLY</mode>
  <decision_owner>@antigravity [AUTO: DELEGATED]</decision_owner>
  <last_updated>2026-09-12</last_updated>
</decision_status>

---

## 1. Context

<context>
  <task>[`task.md`](task.md)</task>
  <research_artifact>[`research.md`](research.md)</research_artifact>
  <constraints>
    - Extension chạy trên Firefox WebExtension Manifest V2.
    - Không làm lộ thông tin nhạy cảm (Safe Observability: không log URL query/token, không log raw viewport text hay memory).
    - Phải vượt qua 100% kiểm thử `npm run verify` và `web-ext lint` (0 errors, 0 warnings).
    - Memory phải lưu bền vững vào `.firefox-demo-profile` trên máy local.
    - Không thay đổi contracts dùng chung trong `@vlc/contracts`.
  </constraints>
</context>

---

## 2. Decision Required

<decision_question>
  Lựa chọn kiến trúc điều phối injection, handshake giữa Sidebar/Background và Content Script, phương án cấu hình permissions trong Manifest V2, và cơ chế recapture trước khi lưu marker.
</decision_question>

---

## 3. Options

<options>

  <option id="A">
    <approach>
      Chỉ thêm "<all_urls>" vào manifest permissions và giữ nguyên retry executeScript trong Sidebar (`browser-runtime.ts`), thêm try-catch chi tiết.
    </approach>
    <advantages>
      - Đơn giản, ít thay đổi file (chỉ sửa manifest và browser-runtime).
    </advantages>
    <disadvantages>
      - Sidebar tự inject có thể gây race condition khi nhiều sự kiện mở tab hoặc sidebar re-render; không có handshake kiểm tra script thực sự sẵn sàng trước khi capture.
      - Vẫn có nguy cơ inject trùng lặp (multiple listeners trong content script).
      - Chưa giải quyết triệt để lỗi mất vị trí scroll khi saveMarker.
    </disadvantages>
    <complexity>LOW</complexity>
    <compatibility>HIGH</compatibility>
    <concurrency_transaction_risk>MEDIUM</concurrency_transaction_risk>
    <testability>MEDIUM</testability>
    <maintainability>MEDIUM</maintainability>
  </option>

  <option id="B">
    <approach>
      Chuyển toàn bộ quyền inject sang Background Script thông qua message `ENSURE_CONTENT_SCRIPT`. Sidebar chỉ gửi message yêu cầu Background đảm bảo tab sẵn sàng rồi mới capture.
    </approach>
    <advantages>
      - Tách bạch rõ vai trò: Background quản lý tabs & lifecycle, Sidebar chỉ quản lý UI và logic nghiệp vụ.
      - Background có quyền tabs liên tục, dễ test độc lập qua mock `runtime.onMessage`.
    </advantages>
    <disadvantages>
      - Thêm một vòng message passing giữa Sidebar -> Background -> Content Script -> Background -> Sidebar.
      - Nếu không có singleton guard trong Content Script thì vẫn có thể bị duplicate listeners.
    </disadvantages>
    <complexity>MEDIUM</complexity>
    <compatibility>HIGH</compatibility>
    <concurrency_transaction_risk>LOW</concurrency_transaction_risk>
    <testability>HIGH</testability>
    <maintainability>HIGH</maintainability>
  </option>

  <option id="C">
    <approach>
      Giải pháp toàn diện (Recommended):
      1. Manifest V2: Thêm `"<all_urls>"` vào `"permissions"`.
      2. Content Script: Bổ sung guard singleton `window.__VLC_CONTENT_SCRIPT_LOADED__` và handler `PING_CONTENT_SCRIPT`.
      3. Background Script: Tiếp nhận `ENSURE_CONTENT_SCRIPT`, thực hiện ping -> inject nếu cần (`executeScript`) -> ping lại xác nhận -> trả Result phân loại rõ ràng (lỗi ping1, lỗi inject, lỗi ping2).
      4. Browser Runtime: `captureTabViewport` gọi `ENSURE_CONTENT_SCRIPT` qua background trước khi `CAPTURE_CURRENT_VIEWPORT`, bảo tồn chi tiết lỗi an toàn.
      5. Sidebar: `saveMarker` tự động recapture viewport mới nhất trước khi gọi `executeConfirmedMemoryCommand` để bảo toàn anchor khi cuộn trang.
    </approach>
    <advantages>
      - Giải quyết triệt để cả 3 nguyên nhân gốc rễ (permissions, missing script on startup tab, swallowed error).
      - Chống 100% race condition và multiple listener registration bằng singleton guard.
      - Lỗi được phân loại chi tiết và an toàn (không lộ URL/sensitive data).
      - Giải quyết hoàn toàn lỗi sai anchor khi scroll -> saveMarker mà không cần Ask.
      - Tuân thủ nghiêm ngặt kiến trúc tách biệt tầng (Clean Architecture & RIPER-5).
    </advantages>
    <disadvantages>
      - Cần cập nhật 4 file (`manifest.json`, `content/index.ts`, `background/index.ts`, `browser-runtime.ts`, `sidebar/main.ts`) và bổ sung test cases.
    </disadvantages>
    <complexity>MEDIUM</complexity>
    <compatibility>HIGH</compatibility>
    <concurrency_transaction_risk>LOW</concurrency_transaction_risk>
    <testability>VERY HIGH</testability>
    <maintainability>VERY HIGH</maintainability>
  </option>

</options>

---

## 4. Trade-off Matrix

<tradeoff_matrix>

| Tiêu chí | Option A | Option B | Option C (Đề xuất) |
|---|:---:|:---:|:---:|
| Độ tin cậy (Reliability & No Race) | 3 | 4 | 5 |
| Khả năng phân loại lỗi (Error Observability) | 3 | 4 | 5 |
| Tính toàn vẹn Memory (Recapture on Scroll) | 2 | 2 | 5 |
| Tính kiểm thử được (Unit & Integration Test) | 3 | 4 | 5 |
| Khả năng bảo trì lâu dài (Maintainability) | 3 | 4 | 5 |
| **Tổng điểm** | **14** | **18** | **25** |

</tradeoff_matrix>

---

## 5. Recommendation & Auto-Approval

<recommendation>
  **Lựa chọn Option C.** Đây là giải pháp triệt để, khắc phục hoàn toàn cả rào cản injection, nuốt lỗi ngoại lệ, đăng ký trùng listener và lệch anchor bộ nhớ khi người dùng cuộn trang.
</recommendation>

---

## 6. Engineer Decision (Gate 1 Sign-Off)

<engineer_decision>
  <selected_option>C</selected_option>
  <rationale>
    Áp dụng chế độ DELEGATED (fast-track) theo yêu cầu của người dùng. Option C đáp ứng 100% các tiêu chí an toàn, độ tin cậy và yêu cầu lưu trữ memory local bền vững.
  </rationale>
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12T15:11:00+07:00</approved_date>
</engineer_decision>

---

## 7. Next Steps

<next_steps>
  Chuyển ngay sang pha **PLAN** (`plan.md`), phân rã thành các vertical slices kiểm thử độc lập.
</next_steps>

</technical_decision>
