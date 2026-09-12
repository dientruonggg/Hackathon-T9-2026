# Handoff: FEAT-07 Selected Text Support and Agent Proposal UI

<handoff task_id="FEAT-07" version="2.0" framework="RIPER-5">

<handoff_status>
  <review_decision>PASS</review_decision>
  <review_artifact>[`review.md`](review.md)</review_artifact>
  <completed_date>2026-09-12T15:18:00+07:00</completed_date>
</handoff_status>

---

## 1. What Changed

<what_changed>
  - Thêm tính năng đọc văn bản bôi đen (`window.getSelection()`) trong `captureCurrentViewport`: khi người dùng bôi đen một câu/đoạn trên trang, đoạn đó được ưu tiên đưa vào `anchor.textQuote` và làm tiêu điểm trong `visibleText`. Nếu không bôi đen, hệ thống tự động fallback về toàn bộ viewport như bình thường.
  - Thêm giao diện Agent Proposal UI: Khi Qwen gọi `propose_marker` và trả về `suggestedActions`, Sidebar sẽ hiển thị khối nổi bật "Agent đề xuất: [Đã hiểu / Chưa hiểu / Xem lại sau] — [Lý do]" và nút "Lưu theo đề xuất" để người dùng bấm xác nhận.
</what_changed>

<main_changes>
  - `apps/firefox-extension/src/content/capture-current-viewport.ts`: Hỗ trợ `getSelection()` và ưu tiên selected text.
  - `apps/firefox-extension/index.html`: Thêm section `#agent-proposal-panel` với nút `#accept-proposal-button`.
  - `apps/firefox-extension/src/sidebar/styles.css`: Styling thẻ đề xuất nổi bật.
  - `apps/firefox-extension/src/sidebar/main.ts`: Xử lý hiển thị đề xuất và click lưu xác nhận.
  - `apps/firefox-extension/tests/capture-current-viewport.test.ts`: Bổ sung test case selection capture.
</main_changes>

---

## 2. What Proves It

<evidence>

| AC | Verifier | Result |
|---|---|---|
| AC-1, AC-3 | `npm test --workspace @vlc/firefox-extension` | PASS (48/48 tests) |
| AC-2 | `npm run build && npm run lint:extension` | PASS (0 errors, 0 warnings) |
| AC-4 | `npm run verify` | PASS (88/88 tests across monorepo) |

</evidence>

</handoff>
