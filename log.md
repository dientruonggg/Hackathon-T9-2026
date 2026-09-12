# Viewport Learning Companion - Handoff và trạng thái demo

Thời điểm tổng hợp: 2026-09-12, Asia/Saigon.

## 1. Kết luận nhanh

- `main` đã hợp nhất Firefox privacy/memory UI, Agent API, tool loop, safe observability và demo preflight.
- Commit đã push lên `origin/main`: `9e6e967`.
- Agent API gọi Qwen `qwen3:8b` qua `https://qwen.luongduytoan.io.vn/v1` đã trả HTTP 200 và gọi đúng tool `get_viewport_context`.
- Typecheck, test, build và `web-ext lint` đều pass. Tổng số test hiện tại: 75.
- Lỗi chặn demo hiện tại nằm ở Firefox: Sidebar không giao tiếp được với content script trên W3Schools, nên capture viewport thất bại.
- Vì chưa capture được nên nút Ask/marker bị disable và chưa thể xác nhận Golden E2E memory thật.

## 2. `.env` dùng cho máy quay demo qua tunnel

Đặt file `.env` tại root repository. File này bị Git ignore và phải chuyển riêng cho máy demo, không commit.

```dotenv
API_HOST=127.0.0.1
API_PORT=8787
ALLOWED_ORIGIN_PREFIXES=moz-extension://*,http://localhost:*,http://127.0.0.1:*

# Agent API local gọi Ollama Qwen trên máy chủ qua Cloudflare Tunnel.
# OPENAI_API_KEY chỉ là dummy value cho OpenAI-compatible client, không phải secret.
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=https://qwen.luongduytoan.io.vn/v1
OPENAI_MODEL=qwen3:8b
OPENAI_TIMEOUT_MS=60000

# Máy quay không cần Ollama local.
DEMO_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
DEMO_OLLAMA_MODEL=qwen3:8b
DEMO_REQUIRE_LOCAL_OLLAMA=false
DEMO_AGENT_API_BASE_URL=http://127.0.0.1:8787
TUNNEL_BASE_URL=https://qwen.luongduytoan.io.vn/v1
```

Đã kiểm tra file `.env` trên máy hiện tại:

- `OPENAI_BASE_URL` đúng tunnel;
- `OPENAI_MODEL=qwen3:8b`;
- `DEMO_REQUIRE_LOCAL_OLLAMA=false`;
- không còn biến OpenRouter;
- `.env` không được Git track.

Máy Linux chỉ cần Internet tới tunnel. Không cần cài hoặc chạy Ollama local.

## 3. Luồng runtime đã xác nhận

```text
Firefox Sidebar
  -> POST http://127.0.0.1:8787/v1/agent/turn
  -> Agent API local
  -> https://qwen.luongduytoan.io.vn/v1/chat/completions
  -> Ollama qwen3:8b trên máy chủ
  -> tool loop
  -> AgentTurnResponse về Sidebar
```

Smoke thật đã trả:

```text
tunnelHasQwen=true
agentHttp=200
answerPresent=true
grounding=VIEWPORT
tools=[get_viewport_context]
model=qwen3:8b
```

Safe observability log đã quan sát:

```json
{"event":"agent.turn.started","turnId":"turn-tunnel-final"}
{"event":"agent.tool.completed","turnId":"turn-tunnel-final","step":1,"toolName":"get_viewport_context","status":"SUCCESS"}
{"event":"agent.turn.completed","turnId":"turn-tunnel-final","grounding":"VIEWPORT","toolCount":1,"modelName":"qwen3:8b"}
```

Log chỉ chứa metadata; không ghi raw viewport hoặc memory content.

## 4. Kết quả kiểm tra đã pass

Lệnh:

```bash
npm run verify
```

Kết quả:

- Agent API: 31 test pass;
- Firefox extension: 35 test pass;
- Contracts: 3 test pass;
- Memory: 6 test pass;
- TypeScript typecheck: pass tất cả workspace;
- Build Agent API: pass;
- Build Firefox extension: pass;
- `web-ext lint`: 0 errors, 0 warnings, 0 notices;
- `npm audit --omit=dev`: 0 production vulnerabilities.

Preflight tunnel:

```text
PASS runtime.node
PASS runtime.npm
PASS project.verify
SKIPPED_OPTIONAL ollama.local
PASS agent_api.health
PASS tunnel.models
PASS tunnel.inference
Summary: 6 pass, 0 fail, 1 optional skipped
```

## 5. Lỗi Firefox đang chặn demo

### Triệu chứng quan sát thật

Trên W3Schools Sidebar hiển thị:

```text
Có lỗi
Chưa thể mở Learning Companion
Không thể đọc trang này. Hãy thử một bài viết HTML thông thường.
```

Đây không phải policy block:

- policy block sẽ hiện badge `Không đọc`;
- ảnh hiện badge `Có lỗi`;
- `runOpenSidebarPipeline` đã qua source policy và fail tại bước capture.

Luồng fail hiện tại:

```text
GET_ACTIVE_TAB thành công
  -> checkSourcePolicy trả ALLOW
  -> captureTabViewport()
  -> browser.tabs.sendMessage() reject hoặc không có receiver
  -> retry executeScript() cũng không tạo được kênh hoạt động
  -> outer catch đổi toàn bộ lỗi thành PERMISSION_DENIED generic
```

File cần điều tra:

```text
apps/firefox-extension/src/services/browser-runtime.ts
apps/firefox-extension/src/content/index.ts
apps/firefox-extension/src/background/index.ts
apps/firefox-extension/manifest.json
```

### Fix thử nghiệm hiện có nhưng chưa giải quyết được

Working tree có thay đổi chưa commit tại `browser-runtime.ts`:

```text
send CAPTURE_CURRENT_VIEWPORT
  -> nếu reject: browser.tabs.executeScript("src/content/index.js")
  -> gửi CAPTURE_CURRENT_VIEWPORT lần hai
```

`dist/index.js` đã chứa retry này và build/lint pass, nhưng chạy thật vẫn hiện lỗi. Không được tuyên bố race condition đã được sửa.

### Vì sao chưa có exact exception

Hai `catch` trong `captureTabViewport()` đang nuốt object lỗi:

```ts
try {
  response = await requestViewportCapture(input);
} catch {
  await browser.tabs.executeScript(...);
  response = await requestViewportCapture(input);
}

// Sau đó outer catch trả một message cố định.
```

Vì vậy UI và log không cho biết lỗi thực là:

- `Could not establish connection. Receiving end does not exist`;
- thiếu host/activeTab permission;
- `executeScript` không khả dụng từ Sidebar;
- sai tab ID;
- hay content script khởi tạo lỗi.

Việc đầu tiên agent tiếp theo phải làm là giữ riêng ba lỗi đã được sanitize:

1. lỗi `sendMessage` lần đầu;
2. lỗi `executeScript`;
3. lỗi `sendMessage` retry.

Không log URL đầy đủ, raw viewport hoặc memory.

### Hướng sửa nên kiểm chứng

1. Thêm handshake `PING_CONTENT_SCRIPT` trong `content/index.ts`.
2. Sidebar gửi message `ENSURE_CONTENT_SCRIPT` cho background.
3. Background, nơi nhận trực tiếp browser-action/tab, thực hiện:
   - ping tab;
   - chỉ `executeScript` khi không có receiver;
   - ping lại;
   - trả Result có error code cụ thể.
4. Chỉ mở/capture Sidebar sau khi handshake thành công.
5. Kiểm tra có cần thêm host permission `"<all_urls>"` vào `permissions` hay không dựa trên lỗi thật; không thêm mù.
6. Tránh inject lặp vì sẽ đăng ký nhiều `runtime.onMessage` listener.
7. Thêm unit test:
   - send thành công, không inject;
   - send reject, inject thành công, retry thành công;
   - inject reject;
   - retry reject;
   - restricted URL không inject.

## 6. Log Firefox đã đọc được

Firefox Remote Debugging Protocol chỉ trả các cảnh báo của W3Schools/ads:

- third-party cookie sắp bị từ chối;
- dynamic state partitioning/storage access;
- một số iframe quảng cáo ở Quirks Mode.

Không thu được exception của extension. Các cảnh báo cookie/quảng cáo này không phải nguyên nhân đã được chứng minh của lỗi capture.

Một lỗi debugger phụ từng gặp:

```text
connect ECONNREFUSED 127.0.0.1:65118
```

Nguyên nhân là cửa sổ Firefox cũ đã đóng nên debugger port cũ biến mất; không phải lỗi sản phẩm.

Một smoke PowerShell Unicode từng trả:

```text
400 FST_ERR_CTP_INVALID_CONTENT_LENGTH
```

Node `fetch` với cùng API contract trả HTTP 200. Đây là lỗi cách PowerShell 5.1 tính Content-Length cho request Unicode trong lệnh kiểm tra, không phải lỗi Agent API/extension.

## 7. Memory: code đã nối nhưng runtime E2E chưa pass

Luồng code:

```text
Sidebar main.ts
  -> services/browser-runtime.ts memoryRepository
  -> createBrowserStorageMemoryRepository(...)
  -> browser.storage.local
```

Keys:

```text
vlc:markers:v1
vlc:policy:v1
vlc:settings:v1
```

Long-term marker chỉ được ghi khi user bấm một trong ba nút:

- `Đã hiểu`;
- `Chưa hiểu`;
- `Xem lại sau`.

Mở Sidebar hoặc hỏi Agent không tự ghi long-term memory.

Do capture đang fail, các nút marker bị disable và chưa có bằng chứng marker W3Schools được lưu/recall/resume thật.

### Một lỗi logic khác cần sửa sau khi capture hoạt động

`saveMarker()` dùng `session.context` hiện có nhưng không recapture ngay trước khi lưu. Tình huống:

```text
mở Sidebar ở vị trí A
  -> cuộn xuống vị trí B
  -> bấm Xem lại sau mà không Ask/không mở lại Sidebar
  -> marker có thể lưu vị trí A
```

`Ask` có recapture, nhưng nút marker không có. Cần recapture và kiểm tra canonical URL ngay trước `executeConfirmedMemoryCommand`, kèm test `scroll -> save without Ask`.

## 8. Profile và vị trí storage local

Đường profile demo dự kiến:

```text
D:\DuyToan\Project\Hackathon-T9-2026\.firefox-demo-profile
```

SQLite vật lý hiện tại:

```text
.firefox-demo-profile\storage\default\
moz-extension+++6ff480c0-2d66-4c1d-84fe-35be87b07f6d^userContextId=4294967295\
idb\3647222921wleabcEoxlt-eengsairo.sqlite
```

UUID thay đổi theo profile/máy, không hard-code đường này. Không mở hoặc sửa SQLite khi Firefox đang chạy.

Cách kiểm tra an toàn:

```text
about:debugging
  -> This Firefox
  -> Viewport Learning Companion
  -> Inspect
  -> Storage
  -> Extension Storage
```

Sau khi capture/marker hoạt động, kiểm tra `vlc:markers:v1`. Hiện Extension Storage resource được quan sát là chưa có marker.

## 9. Profile bền qua các lần demo

Lệnh thử nghiệm chưa commit đã đổi `demo:firefox` thành:

```text
web-ext run
  --source-dir dist
  --firefox-profile ../../.firefox-demo-profile
  --profile-create-if-missing
  --keep-profile-changes
```

Lệnh đã tạo được profile và cài Temporary Add-on. Mục đích là giữ `browser.storage.local` qua các lần chạy trên cùng máy.

Lỗi cũ đã gặp với `.demo/firefox-profile`:

```text
ENOENT: no such file or directory, mkdir '.demo/firefox-profile'
```

Nguyên nhân: `web-ext` không tạo recursive parent `.demo`. Đã đổi sang `.firefox-demo-profile` nằm trực tiếp dưới root và lệnh chạy thành công.

Các thay đổi profile vẫn chưa commit/push.

## 10. Git hiện tại

Remote đã push:

```text
branch: main
commit: 9e6e967
status: origin/main đồng bộ tại commit này
```

Working tree đang có thay đổi chưa commit:

```text
M .gitignore
M README.md
M apps/firefox-extension/src/services/browser-runtime.ts
M package.json
?? log.md
```

Ý nghĩa:

- `.gitignore`, `README.md`, `package.json`: persistent demo profile;
- `browser-runtime.ts`: retry inject thử nghiệm nhưng runtime vẫn fail;
- `log.md`: tài liệu handoff này.

Agent tiếp theo phải xem `git diff` trước khi sửa, không reset hoặc ghi đè các thay đổi trên.

## 11. Cách chạy trên máy Linux sau khi nhận code

```bash
git pull origin main
npm ci
```

Tạo root `.env` theo mục 2, sau đó:

```bash
# Terminal 1
npm run dev:api

# Terminal 2: kiểm tra tunnel, tests và build
npm run demo:preflight

# Terminal 3: mở Firefox demo
npm run demo:firefox
```

Lưu ý: commit `9e6e967` trên remote chưa chứa persistent-profile changes và chưa chứa retry content-script chưa commit. Nếu chỉ `git pull origin main`, máy khác nhận bản merge ổn định nhưng vẫn có thể gặp lỗi capture đang mô tả. Chỉ push thêm sau khi agent tiếp theo sửa và quan sát E2E thật.

## 12. Golden E2E bắt buộc trước khi quay

Không đánh PASS nếu chưa quan sát thật:

```text
1. Mở W3Schools -> Sidebar hiện đúng heading và đoạn đang thấy.
2. Cuộn -> hỏi Agent -> Qwen trả lời theo viewport mới.
3. Log có get_viewport_context nhưng không chứa raw content.
4. Bấm Xem lại sau -> hiện "Đã lưu trên Firefox • revision 1".
5. Inspect vlc:markers:v1 thấy đúng URL/anchor/status.
6. Đóng/mở Sidebar hoặc chuyển trang rồi quay lại -> marker được recall.
7. Bấm Quay lại vị trí/Resume -> tab cuộn về marker.
8. Lưu cùng marker lần nữa -> revision tăng.
9. Block domain -> mở lại không capture/không gọi API.
10. Unblock -> capture lại được.
11. Xóa marker -> marker biến mất sau reload.
12. Tắt/mở lại npm run demo:firefox -> profile vẫn thấy marker.
```

## 13. Thứ tự ưu tiên cho agent tiếp theo

1. P0: lấy exact exception và sửa content-script handshake/capture.
2. P0: chạy lại W3Schools E2E tới bước Ask bằng tunnel Qwen.
3. P0: save/inspect/recall/resume một marker thật.
4. P1: recapture ngay trước nút marker để lưu đúng vị trí sau scroll.
5. P1: test persistent profile qua browser restart.
6. Sau khi tất cả pass: commit các file đang dở, chạy `npm run verify`, rồi push `main`.
