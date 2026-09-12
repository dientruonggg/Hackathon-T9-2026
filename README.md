# Viewport Learning Companion

Firefox extension được người học chủ động mở để hỏi về đúng phần HTML đang hiện trong viewport, đánh dấu `Đã hiểu`, `Chưa hiểu`, `Xem lại sau` và được gợi lại khi quay lại section đó.

Repo hiện ở trạng thái **architecture + runnable TypeScript scaffold** để ba người bắt đầu code song song. Nghiệp vụ chính vẫn được đánh dấu `TODO` theo từng task.

## 1. Yêu cầu môi trường

- Firefox Desktop `>= 142` (để manifest data-collection declaration được hỗ trợ/lint sạch).
- Node.js `>= 22`.
- npm `>= 10`.
- Một OpenAI-compatible API key. OpenRouter dùng được.
- Git.

Kiểm tra:

```powershell
node --version
npm --version
git --version
```

Không bắt buộc `npm install -g web-ext`. Repo đã khóa `web-ext` local trong `package-lock.json`; chạy qua npm script để mọi máy dùng cùng version.

## 2. Cài project

Tại root repo:

```powershell
npm install
Copy-Item .env.example .env
```

Mở `.env` và điền key cục bộ. Ví dụ OpenRouter:

```dotenv
OPENAI_API_KEY=your-real-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=provider/model-name
OPENAI_TIMEOUT_MS=30000
```

Chọn model đang khả dụng trong tài khoản OpenRouter của team. Không commit `.env` hoặc gửi key vào chat/log.

Model phải hỗ trợ OpenAI-compatible Chat Completions `tools/tool_calls`; đây là điều kiện để agent loop chạy. Nếu dùng OpenAI trực tiếp, đổi `OPENAI_BASE_URL=https://api.openai.com/v1` và đặt model tương ứng, không cần đổi source.

## 3. Kiến trúc code

```text
apps/
├── firefox-extension/  # Agent 1: manifest, Vite, DOM, sidebar, pipelines
└── agent-api/           # Agent 2: Fastify, agent loop, OpenAI-compatible provider

packages/
├── contracts/           # Agent 3: shared TypeScript types + Zod schemas
└── memory/              # Agent 3: browser.storage.local + deterministic matcher

.agents/
├── architecture/        # Kiến trúc tổng/con, contracts, E2E
└── tasks/               # Ba prompt code độc lập
```

Code cũ `firefox_extension/` không thuộc kiến trúc mới và không được ba agent sửa. Thư mục Python `src/` cũ đã được loại khỏi scaffold.

Điểm nối duy nhất giữa các phần:

- Extension/API dùng type từ `@vlc/contracts`.
- Extension lưu cục bộ qua `MemoryRepository` từ `@vlc/memory`.
- Extension gọi API qua `POST /v1/agent/turn`.
- Không import source xuyên app.

Đọc kiến trúc từ [`.agents/architecture/README.md`](.agents/architecture/README.md).

## 4. Chia việc ba người

| Người | Branch | Task | Code được sửa |
|---|---|---|---|
| Bạn + Codex | `feat/firefox-extension` | [Agent 1](.agents/tasks/01-firefox-extension/TASK.md) | `apps/firefox-extension/**` |
| Thành viên 2 | `feat/agent-api` | [Agent 2](.agents/tasks/02-agent-api/TASK.md) | `apps/agent-api/**` |
| Thành viên 3 | `feat/contracts-memory` | [Agent 3](.agents/tasks/03-contracts-memory/TASK.md) | root npm/config + `packages/**` |

Agent 1 khó nhất vì phải nối Firefox permission, Vite, viewport DOM, privacy, UI và E2E. Agent 3 merge trước để Agent 1/2 dùng shared contracts thật.

Mỗi người tạo branch từ cùng commit bootstrap này:

```powershell
git switch -c feat/firefox-extension
# hoặc feat/agent-api
# hoặc feat/contracts-memory
```

Nếu mỗi người có clone riêng, chỉ cần checkout đúng branch. Nếu chạy nhiều agent trên cùng máy, dùng Git worktree riêng; không để ba agent đổi branch trong cùng một working tree.

## 5. Quy tắc để không conflict

1. Chỉ sửa folder được task giao.
2. Chỉ Agent 3 sửa root `package.json`, `package-lock.json`, `tsconfig.base.json`, `.env.example`.
3. Agent 1/2 không tự cài dependency mới làm đổi lockfile; ghi dependency request trong handoff.
4. Không copy shared interfaces vào app. Import từ `@vlc/contracts`.
5. Không tự đổi public function/HTTP/schema trong [`04-shared-contracts.md`](.agents/architecture/04-shared-contracts.md).
6. Nếu contract thiếu, ghi proposal; integrator xử lý bằng commit riêng.
7. Không mở rộng sang PDF, YouTube, ChatGPT, tracking nền, vector DB hoặc cloud memory.

Thứ tự merge: `contracts-memory -> agent-api -> firefox-extension -> integration fix`.

## 6. Build TypeScript thành JavaScript

```powershell
npm run typecheck
npm test
npm run build
```

Artifact:

| Workspace | Compiler/bundler | Output chạy thật |
|---|---|---|
| `@vlc/firefox-extension` | Vite + web-extension plugin | `apps/firefox-extension/dist/manifest.json` và JS bundles |
| `@vlc/agent-api` | tsup | `apps/agent-api/dist/server.js` |
| `@vlc/contracts` | TypeScript compiler | `packages/contracts/dist/*.js` + `.d.ts` |
| `@vlc/memory` | TypeScript compiler | `packages/memory/dist/*.js` + `.d.ts` |

Chạy toàn bộ gate:

```powershell
npm run verify
```

## 7. Chạy Agent API

Trong lúc code:

```powershell
npm run dev:api
```

Sau build:

```powershell
npm run build --workspace @vlc/agent-api
npm run start --workspace @vlc/agent-api
```

API dự kiến:

- `GET http://127.0.0.1:8787/health`
- `POST http://127.0.0.1:8787/v1/agent/turn`

Scaffold hiện chưa listen server; đó là TODO của Agent 2.

## 8. Build và load Firefox extension

Build/lint:

```powershell
npm run build --workspace @vlc/firefox-extension
npm run lint:extension --workspace @vlc/firefox-extension
```

Load tự động bằng local `web-ext`:

```powershell
npm run start:firefox --workspace @vlc/firefox-extension
```

Hoặc load thủ công:

1. Mở `about:debugging#/runtime/this-firefox`.
2. Chọn **Load Temporary Add-on**.
3. Chọn `apps/firefox-extension/dist/manifest.json`.
4. Mở sidebar `Learning Companion`.

Development mode:

```powershell
npm run dev:extension
```

Vite plugin sẽ build các TypeScript entry từ manifest và nhắm Firefox. Scaffold hiện load sidebar placeholder; policy/capture/UI thật là TODO Agent 1.

## 9. Npm scripts

| Lệnh | Ý nghĩa |
|---|---|
| `npm run typecheck` | Check TypeScript tất cả workspaces |
| `npm test` | Chạy Vitest |
| `npm run build` | Sinh toàn bộ JavaScript artifacts |
| `npm run lint:extension` | Mozilla `web-ext lint` trên `dist` |
| `npm run verify` | Typecheck + tests + build + extension lint |
| `npm run dev:api` | Watch Agent API |
| `npm run dev:extension` | Watch/build extension và mở Firefox nếu môi trường hỗ trợ |

## 10. Demo E2E phải đạt

```text
article HTML
  -> mở sidebar
  -> policy allow
  -> capture viewport
  -> hỏi Agent
  -> trả lời có grounding
  -> user đánh dấu Chưa hiểu
  -> đóng/mở sidebar
  -> memory được gợi lại
  -> đổi thành Đã hiểu, revision tăng
```

Nhánh chặn: mở PDF/private source -> hiện lý do -> không capture DOM -> không gọi API.

Chi tiết integration và handoff: [`.agents/architecture/05-integration-e2e.md`](.agents/architecture/05-integration-e2e.md).

## 11. Trạng thái scaffold

- Dependencies đã cài bằng npm và khóa trong `package-lock.json`.
- OpenAI-compatible/OpenRouter env đã soạn, không có key thật.
- Firefox Vite manifest pipeline đã scaffold.
- Mọi file nghiệp vụ có `TODO(Agent N)` và task trỏ đúng đường dẫn.
- Chưa coi `--passWithNoTests` là hoàn thành; mỗi agent phải thêm tests được yêu cầu trước handoff.
