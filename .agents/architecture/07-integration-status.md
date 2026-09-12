# 07 — Integration Status

Snapshot: 2026-09-12, sau khi hợp nhất `task3`, `agent-api` và remote `main` vào `main` local.

## Kết luận hiện tại

Ba phần đã nối với nhau bằng contract thật:

```text
Firefox sidebar
  -> source policy
  -> content-script viewport capture
  -> @vlc/memory trên browser.storage.local
  -> POST /v1/agent/turn
  -> Fastify agent loop
  -> OpenAI-compatible provider
  -> Ollama qwen3:8b hoặc OpenRouter
```

Không còn file nghiệp vụ placeholder trong ba workspace chính. Phần chưa hoàn tất không phải code scaffold mà là golden E2E với model và thao tác Firefox thật.

## Đã triển khai

### Firefox extension

- Source policy chạy trước DOM capture và HTTP.
- Capture lấy text từ DOM block giao với viewport và áp giới hạn text/code/anchor. Không tuyên bố cắt chính xác từng ký tự nếu một block dài vượt mép viewport.
- Sidebar mở không gọi model.
- Open pipeline capture và recall memory.
- Ask pipeline capture lại viewport ở mỗi thao tác hỏi, build request và gọi API local.
- Ba marker buttons chỉ ghi sau thao tác người dùng.
- Resume theo text quote, heading, rồi scroll ratio.
- Runtime boundary guards không bundle Zod vào add-on; request vẫn được kiểm bằng shared Zod schema trong tests/API.

### Agent API

- Fastify listen ở `127.0.0.1:8787`.
- Health, CORS, request validation và error mapping đã có.
- Agent loop tối đa 3 model steps với viewport/memory/propose-marker tools.
- Provider dùng OpenAI Chat Completions-compatible `tools/tool_calls`.
- Artifact `dist/server.js` bundle shared contracts và chạy được bằng Node thuần.
- Timeout/kết nối model map thành `AGENT_UNAVAILABLE`, `retryable:true`.

### Contracts và memory

- Shared TypeScript/Zod contracts dùng chung cho extension và API.
- `ShortSession.tabId` chỉ ở browser session, không gửi lên model API.
- Optional fields đã thống nhất với `exactOptionalPropertyTypes`.
- Memory upsert theo canonical URL + exact fingerprint; revision tăng khi ghi lại.
- Storage keys đúng kiến trúc:
  - `vlc:markers:v1`
  - `vlc:policy:v1`
  - `vlc:settings:v1`
- Matcher deterministic: `1.00`, `0.85`, `0.60`; không dùng vector/embedding.

## Bằng chứng kiểm tra

Lần kiểm tra gần nhất:

```text
TypeScript: pass trên 4 workspaces
Tests: 61 pass
Agent API build: pass, dist/server.js chạy bằng Node
Firefox extension build: pass
web-ext lint: 0 errors, 0 notices, 0 warnings
web-ext run: temporary add-on được cài thành công
GET /health: 200, CORS trả đúng moz-extension origin
POST /v1/agent/turn khi Ollama tắt: 503 AGENT_UNAVAILABLE, retryable=true
```

`web-ext run` chứng minh Firefox nhận manifest và cài add-on. Chưa tuyên bố golden E2E pass vì môi trường automation không nhìn/click được cửa sổ Firefox.

## Trạng thái model ngày 2026-09-12

- `http://127.0.0.1:11434/api/tags`: chưa kết nối được.
- `http://127.0.0.1:11434/v1/models`: chưa kết nối được.
- `https://qwen.luongduytoan.io.vn/`, `/api/tags`, `/v1/models`: trả 502.

Suy luận: tunnel nhận request nhưng Ollama origin chưa chạy hoặc tunnel đang trỏ sai port. Đây là blocker môi trường, không phải lỗi contract Agent API.

## Checklist kế tiếp trước demo

1. Trên Windows, mở Ollama desktop; chỉ chạy `ollama serve` ở terminal riêng nếu port 11434 chưa hoạt động.
2. Chạy `ollama pull qwen3:8b` nếu `ollama list` chưa có tag này.
3. Xác nhận `/v1/models`, sau đó POST `/v1/chat/completions` với một tool test và kiểm tra `tool_calls`.
4. Copy `.env.example` thành `.env`; ưu tiên direct localhost trong ngày demo.
5. Chạy `npm run dev:api`, sau đó kiểm `GET /health`.
6. Build/load extension và mở hoặc reload một article HTML sau khi add-on được cài.
7. Chạy toàn bộ golden E2E trong `05-integration-e2e.md`.
8. Trong Extension Debugger, inspect `browser.storage.local` để xác nhận marker tồn tại, cùng marker ID và revision tăng.
9. Quay video demo chỉ sau khi luồng hỏi model thật và reopen memory đều pass.

Giữ `API_PORT=8787`; extension hiện cố định URL và host permission cho port này.

## Fallback

- Ollama/tunnel lỗi: đổi `.env` sang OpenRouter; không sửa source.
- Model quá chậm: warm model bằng một request trước demo và giữ `OPENAI_TIMEOUT_MS=60000`.
- Agent API lỗi: marker local vẫn hoạt động; nhưng video E2E chính phải có ít nhất một lượt hỏi thành công.
- Firefox không inject content script vào tab cũ: reload article sau khi cài Temporary Add-on.
