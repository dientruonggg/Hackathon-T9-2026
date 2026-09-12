# Three-Agent Work Plan

Ba task dưới đây là prompt độc lập để giao đồng thời. Mỗi agent có một branch và một vùng file riêng.

Có thể copy nguyên nội dung `TASK.md` tương ứng cho coding agent. Task đã chứa mission, file map, public contracts, tests, AC và handoff; không cần viết lại thành prompt ngắn hơn.

| Thứ tự merge | Folder task | Branch | Ownership |
|---:|---|---|---|
| 1 | [`03-contracts-memory/TASK.md`](03-contracts-memory/TASK.md) | `feat/contracts-memory` | root npm/config, `packages/contracts/**`, `packages/memory/**` |
| 2 | [`02-agent-api/TASK.md`](02-agent-api/TASK.md) | `feat/agent-api` | `apps/agent-api/**` |
| 3 | [`01-firefox-extension/TASK.md`](01-firefox-extension/TASK.md) | `feat/firefox-extension` | `apps/firefox-extension/**` |

## Phân công khuyến nghị

| Người | Task | Vì sao |
|---|---|---|
| Bạn + Codex | Agent 1 — Firefox Extension | Phức tạp nhất: manifest/Vite, DOM, privacy, UI và E2E hội tụ |
| Thành viên 2 | Agent 2 — Agent API | Boundary rõ: Fastify, tool loop, OpenAI-compatible API |
| Thành viên 3 | Agent 3 — Contracts + Memory | Deterministic, testable, cần giao contract commit sớm |

Agent 3 merge đầu tiên, nhưng cả ba có thể bắt đầu cùng lúc dựa trên frozen contract.

## Quy tắc chung

1. Đọc toàn bộ `.agents/architecture/README.md` và các file được task chỉ định.
2. Không sửa file ngoài ownership.
3. Không tự thay public contract.
4. Được tự do triển khai bên trong ownership miễn đạt AC.
5. Không commit secret, `.env`, raw browsing content hoặc dữ liệu cá nhân.
6. Không mở rộng sang PDF, YouTube, ChatGPT, tracking nền, vector DB hoặc cloud memory.
7. Bàn giao theo template trong `05-integration-e2e.md`.
8. Chỉ dùng npm và TypeScript; không thêm Python, pnpm hoặc yarn. JavaScript trong `dist/` là output build, không phải source viết tay.

## Dependency rule

Bootstrap dependency và root lockfile đã được chuẩn bị trước khi chia nhánh. Sau đó chỉ Agent 3 sửa `package-lock.json`. Agent 1/2 không tự chạy `npm install <new-package>` nếu việc đó sửa root lockfile; hãy ghi dependency request trong handoff.
