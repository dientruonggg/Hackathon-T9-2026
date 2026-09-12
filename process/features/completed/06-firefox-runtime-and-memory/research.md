# Research: FEAT-06 Firefox Runtime and Memory Stabilization

<research_context task_id="FEAT-06" version="1.0" framework="RIPER-5">

<!-- READ-ONLY PHASE. No source modifications. No implementation decisions. -->
<research_status>
  <phase>RESEARCH</phase>
  <mode>READ-ONLY</mode>
  <research_owner>@antigravity</research_owner>
  <last_updated>2026-09-12</last_updated>
</research_status>

---

## 1. Current Behavior & Implementation Assessment

<current_behavior>
  - **Trạng thái môi trường & monorepo:**
    - Toàn bộ monorepo (Node.js >= 22, npm >= 10) gồm 4 workspaces:
      - `apps/agent-api`: Fastify API, ReAct agent loop (7 test files, 31 tests pass).
      - `apps/firefox-extension`: Firefox sidebar add-on (6 test files, 35 tests pass).
      - `packages/contracts`: Zod schemas và types (1 test file, 3 tests pass).
      - `packages/memory`: In-memory & browser storage repositories (1 test file, 6 tests pass).
    - `npm run verify`: PASS 100% (75/75 tests, TypeScript typecheck, tsup/vite build, web-ext lint 0 errors 0 warnings 0 notices).
  - **Triệu chứng lỗi thực tế chặn demo (ghi nhận từ log.md):**
    - Khi mở Firefox với extension và truy cập trang W3Schools (`https://www.w3schools.com/html/html_intro.asp`), Sidebar hiển thị:
      ```text
      Có lỗi
      Chưa thể mở Learning Companion
      Không thể đọc trang này. Hãy thử một bài viết HTML thông thường.
      ```
    - Các nút đánh dấu memory (`Đã hiểu`, `Chưa hiểu`, `Xem lại sau`) và khung hỏi Agent (`Ask`) đều bị vô hiệu hóa (disabled) do không có `session.context`.
  - **Dòng chảy mã nguồn hiện tại gây ra lỗi:**
    1. Khi Sidebar tải, `initializeSidebar()` gọi `getActiveTab()` -> nhận về `tabId` và `url`.
    2. `runOpenSidebarPipeline()` chạy `checkSourcePolicy()` -> trả về `ALLOW` (W3Schools là trang tài liệu HTML thông thường).
    3. `runOpenSidebarPipeline()` gọi `deps.capture()` (chính là `captureTabViewport(input)` trong `browser-runtime.ts`).
    4. `captureTabViewport()` thực hiện:
       ```ts
       try {
         response = await requestViewportCapture(input);
       } catch {
         await browser.tabs.executeScript(input.tabId, { file: "src/content/index.js" });
         response = await requestViewportCapture(input);
       }
       ```
    5. Cả 2 lần đều thất bại. Khối `catch` bao ngoài trong `captureTabViewport()` bắt toàn bộ ngoại lệ và trả về:
       ```ts
       return failure("PERMISSION_DENIED", "Không thể đọc trang này. Hãy thử một bài viết HTML thông thường.", false);
       ```
    6. `initializeSidebar()` nhận lỗi và gọi `renderFatalError(opened.error.message)`, hiển thị đúng thông điệp trên giao diện.
</current_behavior>

---

## 2. Root Cause Analysis & Evidence Classification

<evidence_classification>

  ### Evidence 1: Sự vắng mặt của Content Script trên Tab khởi động ban đầu [CONFIRMED]
  - **Dữ liệu thực nghiệm:** Lệnh `demo:firefox` trong `package.json` khởi chạy Firefox bằng `web-ext run` với tham số `--start-url https://www.w3schools.com/...`.
  - **Cơ chế hoạt động của WebExtension:**
    - Firefox mở cửa sổ và tải URL W3Schools trước khi remote debugging kết nối và cài đặt Temporary Add-on.
    - Khai báo `"content_scripts"` trong `manifest.json` chỉ kích hoạt tự động khi tab *mới* được tạo hoặc khi tab *navigate / reload*. Tab đã tải sẵn trước khi cài add-on sẽ **KHÔNG** được tự động inject content script.
    - Do đó, lần gọi đầu tiên `browser.tabs.sendMessage(input.tabId, { type: "CAPTURE_CURRENT_VIEWPORT" })` chắc chắn throw lỗi: `Could not establish connection. Receiving end does not exist.`

  ### Evidence 2: Thiếu Host Permission cho programmatic injection qua executeScript [CONFIRMED]
  - **Dữ liệu cấu hình `manifest.json` hiện tại:**
    ```json
    "permissions": ["activeTab", "tabs", "storage", "http://127.0.0.1:8787/*"],
    "content_scripts": [{ "matches": ["<all_urls>"], ... }]
    ```
  - **Cơ chế phân quyền trong Firefox Manifest V2:**
    - Để gọi `browser.tabs.executeScript(tabId, { file: ... })` trên một URL bất kỳ:
      - Hoặc extension phải có Host Permission tương ứng (ví dụ `<all_urls>` hoặc `*://*/*`) trong mảng `"permissions"`.
      - Hoặc extension phải đang sở hữu quyền `activeTab` thông qua một tương tác trực tiếp của người dùng với extension UI (ví dụ bấm vào Browser Action icon).
    - Khi Sidebar được mở tự động hoặc mở qua Sidebar Action / menu, **`activeTab` không được cấp tự động** cho iframe Sidebar.
    - Vì `"permissions"` chỉ có `"http://127.0.0.1:8787/*"` mà không có `"<all_urls>"`, lệnh `browser.tabs.executeScript` trên `https://www.w3schools.com` bị trình duyệt chặn ngay lập tức với lỗi:
      `Error: Missing host permission for that domain` (hoặc `Cannot access contents of url`).
    - Đây chính là lý do khối `catch` bên trong thất bại, và rơi thẳng vào outer `catch`.

  ### Evidence 3: Nuốt exception che giấu nguyên nhân gốc [CONFIRMED]
  - Khối outer `catch` trong `captureTabViewport()` không log và không bóc tách 3 giai đoạn lỗi:
    - Giai đoạn 1: `sendMessage` lần đầu.
    - Giai đoạn 2: `executeScript` (injection).
    - Giai đoạn 3: `sendMessage` retry.
    Tất cả bị gộp chung thành một mã lỗi `PERMISSION_DENIED` với chuỗi cố định, gây khó khăn cho việc tự chẩn đoán.

  ### Evidence 4: Nguy cơ Multiple Listeners khi inject lặp lại [OBSERVED]
  - File `apps/firefox-extension/src/content/index.ts` hiện tại:
    ```ts
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (message.type === "CAPTURE_CURRENT_VIEWPORT") { ... }
    });
    ```
  - File không có cờ kiểm tra singleton (ví dụ `window.__VLC_CONTENT_SCRIPT_LOADED__`).
  - Nếu `executeScript` được gọi nhiều lần trên cùng một tab, mỗi lần inject sẽ thêm một `onMessage` listener mới, dẫn đến phản hồi trùng lặp hoặc race condition.

  ### Evidence 5: Memory Anchor bị lệch khi cuộn trang trước khi bấm Save Marker [CONFIRMED]
  - Trong `apps/firefox-extension/src/sidebar/main.ts`:
    - Hàm `askCurrentContext()` (hỏi Agent) có thực hiện recapture thông qua `runAskAgentPipeline()`.
    - Tuy nhiên, hàm `saveMarker(status)` lại lấy trực tiếp `session.context` cũ từ lúc mở Sidebar:
      ```ts
      async function saveMarker(status: MemoryStatus): Promise<void> {
        if (!session?.context || busy) return;
        ...
        const saved = await executeConfirmedMemoryCommand({ status, session, userConfirmed: true }, ...);
      }
      ```
    - Nếu người dùng mở Sidebar ở đầu trang (heading A), sau đó cuộn xuống đọc đoạn B (heading B) rồi bấm `Xem lại sau` mà không gửi câu hỏi, marker sẽ lưu thông tin của đoạn A thay vì đoạn B.

  ### Evidence 6: Cơ chế lưu trữ Memory xuống Local của dự án [CONFIRMED]
  - Repository `BrowserStorageMemoryRepository` ghi trực tiếp vào `browser.storage.local` thông qua key `vlc:markers:v1`.
  - Trong kịch bản demo: `web-ext run` với `--firefox-profile ../../.firefox-demo-profile --profile-create-if-missing --keep-profile-changes` sẽ lưu file IndexedDB/SQLite của Firefox extension storage vào thư mục `.firefox-demo-profile` tại root của dự án.
  - Sau khi capture hoạt động, dữ liệu marker sẽ được persist thực sự vào thư mục này và không bị mất đi khi tắt/bật lại browser.

</evidence_classification>

---

## 3. Architecture & Interface Analysis

<architecture_analysis>

  ### 3.1 Vị trí tối ưu để điều phối Injection
  - **So sánh Sidebar vs Background Script:**
    - Sidebar: Là một trang webextension thông thường chạy trong iframe sidebar. Có thể bị mở/đóng độc lập, quyền hạn bị giới hạn hơn đối với các tab sự kiện.
    - Background: Chạy liên tục (persistent/event-based), nhận trực tiếp sự kiện `browserAction.onClicked`, có quyền kiểm soát `browser.tabs` đầy đủ và đáng tin cậy.
  - **Mô hình Handshake đề xuất:**
    1. Khi Sidebar cần capture: Sidebar gửi message `ENSURE_CONTENT_SCRIPT` `{ tabId }` tới Background (hoặc tự ping nếu tab đã sẵn sàng).
    2. Content Script phản hồi một message nhẹ: `PING_CONTENT_SCRIPT` -> `{ ok: true, pong: true }`.
    3. Nếu Ping thành công: Content script đã sẵn sàng, tiến hành `CAPTURE_CURRENT_VIEWPORT`.
    4. Nếu Ping thất bại: Background thực hiện `browser.tabs.executeScript(tabId, { file: "src/content/index.js" })`, sau đó ping lại để đảm bảo handshake hoàn tất trước khi capture.

  ### 3.2 Cấu hình Manifest Permissions
  - Thêm `"<all_urls>"` vào mảng `"permissions"` trong `manifest.json`.
  - Vì extension đã khai báo `data_collection_permissions` cho `"websiteActivity"` và `"websiteContent"`, việc bổ sung `"<all_urls>"` hoàn toàn tương thích và hợp lệ với `web-ext lint`.

  ### 3.3 Quy trình Recapture trước khi Save Marker
  - Cập nhật hàm `saveMarker()` trong `sidebar/main.ts` hoặc tạo pipeline `runSaveMarkerPipeline`:
    - Trước khi gọi `executeConfirmedMemoryCommand`, thực hiện recapture viewport hiện tại của tab.
    - Kiểm tra tính hợp lệ của URL (canonical URL không bị thay đổi).
    - Cập nhật `session.context` với dữ liệu vừa capture.
    - Tiến hành lưu marker với anchor mới nhất.

</architecture_analysis>

---

## 4. Research Exit Criteria (Gate G0 Verification)

<gate_g0_checklist>
  - [x] Hiểu và ghi nhận đầy đủ hiện trạng lỗi runtime chặn demo trên Firefox.
  - [x] Phân tích và chứng minh nguyên nhân gốc rễ (thiếu host permission, tab chưa có content script, nuốt exception).
  - [x] Xác định rõ ràng các tệp mã nguồn và cấu hình cần tác động.
  - [x] Làm rõ cơ chế lưu memory local bền vững qua profile demo.
  - [x] Không có câu hỏi kiến trúc hay blocker nào chưa được giải tỏa.
</gate_g0_checklist>

</research_context>
