# Research: FEAT-07 Selected Text Support and Agent Proposal UI

<research_context task_id="FEAT-07" version="1.0" framework="RIPER-5">

<research_status>
  <phase>RESEARCH</phase>
  <mode>READ-ONLY</mode>
  <research_owner>@antigravity</research_owner>
  <last_updated>2026-09-12</last_updated>
</research_context>

---

## 1. Selection Capture Assessment

<current_behavior>
  - Hiện tại hàm `captureCurrentViewport` chỉ duyệt các element hiển thị trong viewport (`isReadableVisibleElement`).
  - Khi người dùng bôi đen (highlight) một đoạn văn bản trên trang, `window.getSelection()` không được kiểm tra.
  - Hậu quả: Nếu người dùng muốn hỏi sâu về một khái niệm cụ thể ("Creating a Promise") bằng cách bôi đen câu/đoạn đó, Agent vẫn nhận toàn bộ 4000 ký tự text của viewport và có thể trả lời dàn trải.
</current_behavior>

---

## 2. Agent Proposal UI Assessment

<current_behavior>
  - Fastify Agent API có tool `propose_marker` để Qwen chủ động đề xuất trạng thái học tập (ví dụ: người dùng hỏi câu hỏi chứng tỏ chưa nắm vững khái niệm -> Agent gọi `propose_marker({ status: "REVIEW_LATER", note: "..." })`).
  - Phản hồi trả về `suggestedActions` tuân thủ `PendingUserActionSchema`: `{ id, type: "CONFIRM_MARKER", payload: { status, note }, confirmationText }`.
  - Trong `apps/firefox-extension/src/sidebar/main.ts`:
    ```ts
    const suggestedAction = response.data.suggestedActions[0];
    if (suggestedAction) session.pendingAction = suggestedAction;
    else delete session.pendingAction;
    ```
  - Giá trị này chỉ được lưu trong bộ nhớ tạm `session.pendingAction` và chỉ được dùng làm note nếu người dùng tình cờ bấm đúng nút đó trong `marker-panel`. Người dùng hoàn toàn không nhìn thấy đề xuất của Agent trên UI!
</current_behavior>

---

## 3. Architecture & Integration Plan

<integration_plan>
  1. **Selection Capture:**
     - Trong `capture-current-viewport.ts`: mở rộng `CaptureEnvironment` với `getSelection?(): Selection | null`.
     - Trích xuất `rawSelection = environment.getSelection?.()?.toString()`.
     - Nếu có text: chuẩn hóa khoảng trắng, cắt tối đa 1000 ký tự.
     - Đặt `anchor.textQuote` bằng `selectedText.slice(0, 240)`.
     - Định dạng `visibleText` bắt đầu bằng `[Văn bản được bôi đen]: ...` rồi đến nội dung viewport, tổng không vượt quá 4000 ký tự.
     - Nếu selection rỗng: fallback 100% về luồng viewport hiện tại mà không làm thay đổi hành vi cũ.
  2. **Proposal UI:**
     - Bổ sung section `#agent-proposal-panel` trong `apps/firefox-extension/index.html`.
     - Thêm style đẹp mắt, nổi bật trong `apps/firefox-extension/src/sidebar/styles.css`.
     - Trong `sidebar/main.ts`: cập nhật hàm `renderAnswer()` để hiển thị đề xuất và gắn sự kiện click cho `#accept-proposal-button`. Khi bấm, gọi `saveMarker(suggestedAction.payload.status)` và ghi nhận note của Agent.
</integration_plan>

---

## 4. Gate G0 Checklist

<gate_g0_checklist>
  - [x] Đã phân tích chi tiết cơ chế `window.getSelection()` và tích hợp vào `ViewportContext`.
  - [x] Đã thiết kế giao diện hiển thị `suggestedActions` cho Agent.
  - [x] Đảm bảo tuân thủ nguyên tắc người dùng click xác nhận trước khi lưu.
</gate_g0_checklist>

</research_context>
