# Review: REV-06 Firefox Runtime Handshake and Memory Stabilization

<review_artifact task_id="FEAT-06" review_id="REV-06" version="1.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. May run verification commands. No code fixes during review. -->
<review_status>
  <phase>REVIEW</phase>
  <mode>READ-ONLY</mode>
  <reviewer>@antigravity</reviewer>
  <reviewer_harness>autonomous-delegated-audit</reviewer_harness>
  <last_updated>2026-09-12</last_updated>
</review_status>

---

## 1. Review Scope

<review_scope>
  <task_spec>[`task.md`](task.md)</task_spec>
  <plan>[`plan.md`](plan.md)</plan>
  <diff>
    - `apps/firefox-extension/manifest.json`
    - `apps/firefox-extension/src/content/index.ts`
    - `apps/firefox-extension/src/background/index.ts`
    - `apps/firefox-extension/src/services/browser-runtime.ts`
    - `apps/firefox-extension/src/sidebar/main.ts`
    - `apps/firefox-extension/src/pipeline/confirmed-memory-command.ts`
    - `apps/firefox-extension/tests/browser-runtime.test.ts`
    - `apps/firefox-extension/tests/pipelines.test.ts`
  </diff>
  <tests>
    - `apps/firefox-extension/tests/` (47 tests)
    - `apps/agent-api/tests/` (31 tests)
    - `packages/contracts/src/contracts.test.ts` (3 tests)
    - `packages/memory/src/memory.test.ts` (6 tests)
    - Total: 87 tests
  </tests>
</review_scope>

---

## 2. Behavior Review

<behavior_review>

| AC | Expected | Actual | Evidence | Result |
|---|---|---|---|---|
| AC-1 | Bắt và phân loại exception trong quá trình capture viewport | Phân loại rõ lỗi `sendMessage` ban đầu, lỗi `INJECTION_FAILED`, lỗi `CONTENT_SCRIPT_UNAVAILABLE`, retry send | 10/10 unit tests trong `browser-runtime.test.ts` pass | PASS |
| AC-2 | Thiết lập handshake `PING_CONTENT_SCRIPT` / `ENSURE_CONTENT_SCRIPT`; cấu hình `manifest.json` | `manifest.json` đã có `"<all_urls>"`; Content script có singleton guard + ping responder; Background điều phối handshake | `web-ext lint` 0 errors/warnings; tests pass | PASS |
| AC-3 | Viewport context capture thành công qua handshake | `captureTabViewport` tự động gọi handshake khi tab chưa sẵn sàng và đọc context | `tests/browser-runtime.test.ts` pass | PASS |
| AC-4 | `saveMarker` tự động recapture viewport hiện thời trước khi lưu | Hàm `executeConfirmedMemoryWithRecapture` gọi capture và cập nhật anchor mới nhất trước khi ghi | 2 unit tests mới trong `tests/pipelines.test.ts` pass | PASS |
| AC-5 | Memory được lưu xuống `browser.storage.local` và bền vững qua profile demo | `BrowserStorageMemoryRepository` ghi vào `vlc:markers:v1` trong `.firefox-demo-profile` | 6/6 memory unit tests pass; profile flags cấu hình chuẩn | PASS |
| AC-6 | Toàn bộ kiểm thử monorepo đạt 100% PASS | 87/87 tests pass, 0 lỗi typecheck, build pass, web-ext lint pass | `npm run verify` exit code 0 | PASS |

</behavior_review>

---

## 3. Architecture Review

<architecture_review>
  <dependency_direction>Tuân thủ nghiêm ngặt Clean Architecture: UI (`sidebar/main.ts`) -> Pipeline (`confirmed-memory-command.ts`) -> Service (`browser-runtime.ts`) -> Repository (`@vlc/memory`).</dependency_direction>
  <boundary_violations>Không vi phạm ranh giới module; contracts và memory core được bảo toàn tuyệt đối không bị thay đổi ngoài ý muốn.</boundary_violations>
  <unnecessary_abstraction>Không thêm abstraction dư thừa; sử dụng trực tiếp các interface contract đã có.</unnecessary_abstraction>
  <unrelated_refactor>Không có drive-by refactoring ngoài phạm vi được chỉ định.</unrelated_refactor>
</architecture_review>

---

## 4. Data Review

<data_review>
  <transaction>Thao tác ghi memory là atomic đối với từng record trong `browser.storage.local` key `vlc:markers:v1`.</transaction>
  <consistency>Dữ liệu marker được deduplicate theo `(canonicalUrl, fingerprint)`, mỗi lần cập nhật revision tăng 1 và bổ sung evidence.</consistency>
  <concurrency>Singleton guard `window.__VLC_CONTENT_SCRIPT_LOADED__` ngăn chặn triệt để race condition và duplicate message listener.</concurrency>
  <migration>Không thay đổi schemaVersion (giữ nguyên version 1 của memory marker).</migration>
  <constraints>Ràng buộc URL, anchor, scrollRatio trong khoảng [0, 1] được bảo đảm.</constraints>
</data_review>

---

## 5. Security Review

<security_review>
  <authentication>Không có authentication bypass.</authentication>
  <authorization>Quyền host permission `"<all_urls>"` được khai báo hợp lệ trong WebExtension Manifest V2, phù hợp với chính sách privacy của extension đã đăng ký.</authorization>
  <validation>Mọi input đều được kiểm tra type guards trước khi sử dụng.</validation>
  <secrets>Không có secret, API key hay auth tokens trong mã nguồn hoặc git log.</secrets>
  <injection>Không sử dụng `eval()` hay unconstrained code string trong `executeScript`; script file chỉ định qua relative path cục bộ `src/content/index.js`.</injection>
  <sensitive_logging>Safe Observability: Hàm `sanitizeText` bóc tách và loại bỏ query parameters/tokens; không bao giờ log raw viewport text hoặc memory content.</sensitive_logging>
</security_review>

---

## 6. Regression Review

<regression_review>
  <existing_behavior>Tất cả 75 tests hiện hữu tiếp tục PASS 100%. Bổ sung thêm 12 tests mới (tổng 87 tests).</existing_behavior>
  <backward_compatibility>Các public exports của `browser-runtime.ts` và `confirmed-memory-command.ts` hoàn toàn backward compatible.</backward_compatibility>
  <existing_tests>Không có test hiện hữu nào bị xóa hoặc sửa đổi làm suy giảm độ bao phủ.</existing_tests>
</regression_review>

---

## 7. Findings

<findings>
  *Không phát hiện lỗi (0 Defect, 0 Blocking finding).*
</findings>

---

## 8. Gate 3 Checklist

<gate_3_checklist>
  - [x] All AC verified with evidence
  - [x] Residual risk accepted (Low risk, isolated to extension runtime)
  - [x] Review decision: PASS
  - [x] Ready for handoff
  <approved_by>[AUTO: DELEGATED]</approved_by>
  <approved_date>2026-09-12T15:15:00+07:00</approved_date>
</gate_3_checklist>

</review_artifact>
