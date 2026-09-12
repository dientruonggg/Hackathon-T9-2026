# Decision: DEC-07 Selected Text Support and Agent Proposal UI

<technical_decision task_id="FEAT-07" dec_id="DEC-07" version="1.0" framework="RIPER-5">

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
</context>

---

## 2. Decision Required

<decision_question>
  Phương án cấu trúc dữ liệu cho Selected Text trong ViewportContext và thiết kế UI component cho Agent Proposal.
</decision_question>

---

## 3. Options

<options>

  <option id="A">
    <approach>
      Chỉ thay thế toàn bộ `visibleText` bằng selection text khi có bôi đen.
    </approach>
    <advantages>Đơn giản.</advantages>
    <disadvantages>Làm mất ngữ cảnh xung quanh nếu đoạn bôi đen quá ngắn, model có thể thiếu thông tin heading/section.</disadvantages>
  </option>

  <option id="B">
    <approach>
      Kết hợp cả hai: Đặt selection text vào `anchor.textQuote` (ưu tiên tuyệt đối) và định dạng `visibleText` dạng:
      `[Đoạn được bôi đen]\n<selectedText>\n\n[Toàn bộ viewport]\n<viewportText>`
      Đồng thời thêm thẻ Proposal UI nổi bật ngay bên dưới câu trả lời của Agent kèm nút xác nhận.
    </approach>
    <advantages>
      - Vừa cung cấp trọng tâm đoạn người dùng muốn hỏi, vừa giữ được ngữ cảnh trang cho model hiểu trọn vẹn.
      - Tuân thủ nghiêm ngặt contract `ViewportContextSchema` mà không làm vỡ schema.
      - Hiển thị trực quan và minh bạch lý do đề xuất của Agent.
    </advantages>
  </option>

</options>

---

## 4. Recommendation & Gate 1 Sign-Off

<recommendation>
  Lựa chọn Option B.
</recommendation>

<engineer_decision>
  <selected_option>B</selected_option>
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12T15:16:00+07:00</approved_date>
</engineer_decision>

</technical_decision>
