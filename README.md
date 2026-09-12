# Viewport Learning Companion

Firefox extension do người học chủ động mở để hỏi về đúng phần HTML đang hiện trong viewport. Người dùng có thể đánh dấu `Đã hiểu`, `Chưa hiểu`, `Xem lại sau`; dấu mốc được lưu trong `browser.storage.local` và được gợi lại khi quay về cùng section.

MVP không theo dõi nền, không gửi full-page dump, không đọc PDF/video/social/private chat/webmail và không gửi API key vào extension. Capture lấy text từ các DOM block giao với viewport, giới hạn tối đa 4.000 ký tự; một DOM block rất dài có thể đóng góp phần text nằm ngoài mép màn hình.

## Yêu cầu

- Firefox Desktop 142 trở lên.
- Node.js 22 trở lên và npm 10 trở lên.
- Ollama với `qwen3:8b`, hoặc một model OpenAI-compatible có hỗ trợ `tools/tool_calls`.

Repo dùng `web-ext` local trong lockfile; không cần `npm install -g web-ext`.

## Cài đặt

```powershell
npm install
Copy-Item .env.example .env
npm run verify
```

Không commit `.env`, API key hoặc dữ liệu duyệt web thật.

## Chọn model

### Cách ổn định nhất cho demo: Ollama cùng máy

Trên Windows, mở ứng dụng Ollama trước; bản cài desktop thường chạy service nền. Sau đó:

```powershell
ollama pull qwen3:8b
ollama list
```

Chỉ chạy `ollama serve` trong một terminal riêng nếu `127.0.0.1:11434` chưa hoạt động; không chạy thêm nếu service desktop đã giữ port.

Giữ cấu hình sau trong `.env`:

```dotenv
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
OPENAI_MODEL=qwen3:8b
OPENAI_TIMEOUT_MS=60000
```

Kiểm tra Ollama trước khi chạy hệ thống:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
Invoke-RestMethod http://127.0.0.1:11434/v1/models
```

GET model list chưa chứng minh tool calling. Chạy thêm smoke test bắt model gọi một function:

```powershell
$tool = @{
  type = 'function'
  function = @{
    name = 'get_viewport_context'
    description = 'Return current viewport context'
    parameters = @{ type = 'object'; properties = @{}; required = @() }
  }
}
$body = @{
  model = 'qwen3:8b'
  messages = @(@{ role = 'user'; content = 'Call get_viewport_context now.' })
  tools = @($tool)
} | ConvertTo-Json -Depth 10
$result = Invoke-RestMethod `
  -Uri http://127.0.0.1:11434/v1/chat/completions `
  -Method Post -ContentType 'application/json' -Body $body
$result.choices[0].message.tool_calls
```

Kết quả phải có `function.name = get_viewport_context`.

### Qua Cloudflare Tunnel

Chỉ dùng khi Agent API và Ollama không cùng máy:

```dotenv
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=https://qwen.luongduytoan.io.vn/v1
OPENAI_MODEL=qwen3:8b
```

Nếu `/api/tags` và `/v1/models` trả `502`, tunnel đã nhận request nhưng chưa kết nối được tới Ollama origin. Kiểm tra `ollama serve`, port tunnel và firewall trước khi sửa code Agent.

### OpenRouter dự phòng

```dotenv
OPENAI_API_KEY=your-local-secret
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=provider/model-name
```

Model phải hỗ trợ Chat Completions tool calling. Source code không cần đổi khi chuyển provider.

## Chạy hệ thống

Terminal 1 — Agent API:

```powershell
npm run dev:api
```

Smoke test:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Terminal 2 — build extension:

```powershell
npm run build --workspace @vlc/firefox-extension
npm run lint:extension --workspace @vlc/firefox-extension
```

Load thủ công:

1. Mở `about:debugging#/runtime/this-firefox`.
2. Chọn **Load Temporary Add-on**.
3. Chọn `apps/firefox-extension/dist/manifest.json`.
4. Mở hoặc reload một bài viết HTML.
5. Bấm icon extension để mở sidebar.

Có thể để `web-ext` mở Firefox tự động:

```powershell
npm run start:firefox --workspace @vlc/firefox-extension
```

`web-ext run` tạo một Firefox profile tạm riêng; hãy mở article trong chính cửa sổ Firefox mới đó, không chờ add-on xuất hiện ở profile Firefox đang dùng.

## Request flow

```text
người dùng mở sidebar
  -> source policy
  -> content script capture viewport đang thấy
  -> local memory matcher recall tối đa 5 dấu mốc
  -> chưa gọi model

người dùng gửi câu hỏi
  -> capture lại viewport đúng lúc bấm hỏi
  -> POST http://127.0.0.1:8787/v1/agent/turn
  -> Qwen/OpenRouter gọi tools trong agent loop tối đa 3 bước
  -> sidebar render answer + grounding

người dùng bấm trạng thái
  -> xác nhận bằng chính thao tác bấm
  -> save/upsert marker trong browser.storage.local
  -> cùng fingerprint tăng revision, không tạo bản trùng
```

## Cấu trúc code

```text
apps/
├── firefox-extension/  # manifest, content capture, sidebar, pipelines, API client
└── agent-api/          # Fastify, provider OpenAI-compatible, agent loop, tools

packages/
├── contracts/          # TypeScript types + Zod schemas dùng chung
└── memory/              # browser.storage.local repository + deterministic matcher

.agents/
├── architecture/       # thiết kế và trạng thái integration
└── tasks/              # task gốc của ba thành viên
```

Ranh giới tích hợp:

- Extension và API chỉ trao đổi qua `POST /v1/agent/turn` và `@vlc/contracts`.
- Extension chỉ lưu qua `MemoryRepository` từ `@vlc/memory`.
- API stateless; long-term memory không đi lên server.
- Storage keys: `vlc:markers:v1`, `vlc:policy:v1`, `vlc:settings:v1`.

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run build
npm run lint:extension
npm run verify
```

`npm run verify` là gate bắt buộc trước demo. Ngoài gate tự động, vẫn phải chạy Firefox golden E2E vì unit test không chứng minh sidebar/content-script render đúng trong browser thật.

`API_PORT` phải giữ là `8787` trong MVP vì extension client và manifest permission được build cố định cho `127.0.0.1:8787`.

## Golden E2E

1. Mở một article HTML và cuộn tới heading dễ nhận biết.
2. Mở sidebar; xác nhận source được phép và preview chỉ chứa viewport.
3. Hỏi “Đoạn này đang giải thích gì?”.
4. Xác nhận answer có grounding.
5. Bấm `Chưa hiểu`.
6. Đóng/mở sidebar tại cùng section; card memory phải xuất hiện.
7. Bấm `Quay lại vị trí`.
8. Bấm `Đã hiểu`; revision phải tăng.
9. Mở PDF hoặc YouTube; sidebar phải từ chối trước capture và trước HTTP Agent API.

## Trạng thái và bước kế tiếp

Xem [integration status](.agents/architecture/07-integration-status.md) để biết phần đã verify, phần chưa runtime-verify và checklist ngay trước lúc quay demo.
