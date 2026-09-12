# Agent 1 Implementation Checkpoint

Task chuẩn: [`../../.agents/tasks/01-firefox-extension/TASK.md`](../../.agents/tasks/01-firefox-extension/TASK.md).

## Đã triển khai

- Manifest/Vite build thành Firefox extension JavaScript.
- Toolbar action mở sidebar.
- Content message router không đọc DOM khi khởi tạo.
- Source policy với hard-block và user block/allow priority.
- Viewport capture có visible filtering, size limits, safe URL và fingerprint.
- Resume theo text quote -> heading -> scroll ratio.
- Sidebar HTML/CSS accessible theo concept “learning margin”.
- Unit tests cho policy, capture và resume.

## Đang chờ contract từ Agent 3

`ShortSession` cần thêm `tabId: number`. Ask pipeline cần field này để capture lại đúng tab khi context stale; resume cũng cần nó. Field không được gửi trong `AgentTurnRequest`.

Sau khi Agent 3 giao `@vlc/contracts` và `@vlc/memory`:

1. import shared types/schemas; không tạo local copy;
2. implement open/ask/confirmed-memory pipelines;
3. compose `MemoryRepository` từ `browser.storage.local`;
4. bind sidebar UI với pipeline;
5. thêm pipeline/API/memory integration tests;
6. load Firefox thật và chạy golden E2E.

## Verification hiện tại

```text
typecheck: pass
tests: 16 pass
Vite build: pass
web-ext lint: pass (0 errors, 0 warnings tại lần kiểm gần nhất)
visual browser QA: chưa chạy vì môi trường Codex hiện không có browser surface
```
