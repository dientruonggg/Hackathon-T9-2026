# State: FEAT-06 Firefox Runtime and Memory Stabilization

<loop_state task_id="FEAT-06" version="2.0" framework="RIPER-5">

<state_header>
  <current_phase>EXECUTE</current_phase>
  <current_gate>G2</current_gate>
  <last_updated>2026-09-12</last_updated>
</state_header>

---

## 1. Task

<task_ref>
  <task_spec>[`task.md`](task.md)</task_spec>
  <plan>[`plan.md`](plan.md)</plan>
</task_ref>

---

## 2. Goal & Invariants

<goal_and_invariants>
  <goal>Khắc phục triệt để lỗi kết nối content script/sidebar, đảm bảo handshake tin cậy, phân loại exception an toàn, lưu memory xuống local storage bền vững và recapture khi cuộn trang.</goal>
  <invariants>
    - Safe Observability: Không log sensitive information (query, auth token, raw viewport, memory contents).
    - Source Policy: Tuân thủ đầy đủ việc chặn các trang nhạy cảm và không capture trái phép.
    - Chống inject trùng lặp listeners.
  </invariants>
</goal_and_invariants>

---

## 3. Approved Decisions

<approved_decisions>
  - DEC-06 (Option C): Bổ sung `"<all_urls>"` vào manifest; bảo vệ content script bằng singleton guard; điều phối handshake qua Background script `ENSURE_CONTENT_SCRIPT`; phân loại 3 tầng exception; và recapture viewport trước khi lưu marker.
</approved_decisions>

---

## 4. Completed Slices

<completed_slices>
  | Slice | Status | Verifier Result | Evidence |
  |---|---|---|---|
  | S1 | DONE | PASS | web-ext lint: 0 errors, 0 warnings. Build successful. |
  | S2 | DONE | PASS | Vitest 45/45 tests pass (+10 tests for handshake & safe error). |
  | S3 | DONE | PASS | Vitest 47/47 tests pass (+2 tests for scroll -> saveMarker recapture). |
  | S4 | DONE | PASS | npm run verify: 87/87 tests pass, typecheck pass, build pass, lint pass. |
</completed_slices>

---

## 5. Current Slice

<current_slice>
  <id>ALL_COMPLETED</id>
  <objective>Tất cả các slice đã hoàn thành</objective>
  <status>DONE</status>
</current_slice>

---

## 6. Current Diff

<current_diff>
  ```diff
  ```
</current_diff>

---

## 7. Verification Evidence

<verification_evidence>
</verification_evidence>

---

## 8. Failure Memory

<failure_memory>
</failure_memory>

---

## 9. Next Steps

<next_steps>
  Bắt đầu triển khai Slice S1.
</next_steps>

</loop_state>
