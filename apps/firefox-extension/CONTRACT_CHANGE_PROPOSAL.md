# Contract Change Proposal — `ShortSession.tabId`

## Vấn đề

`runAskAgentPipeline()` phải capture lại viewport nếu URL/heading/scroll đã đổi. `captureCurrentViewport()` yêu cầu `tabId`, nhưng frozen `ShortSession` và `AskAgentPipelineInput` hiện không mang tab ID.

`highlightOrResume()` cũng cần đúng tab để gửi content message.

## Thay đổi nhỏ nhất

Trong `@vlc/contracts`:

```ts
export interface ShortSession {
  sessionId: string;
  tabId: number;
  // giữ nguyên các field còn lại
}
```

Trong `ShortSessionSchema`, thêm:

```ts
tabId: z.number().int().nonnegative()
```

## Không thay đổi

- Không thêm `tabId` vào `AgentTurnRequest`.
- Không gửi tab ID lên Agent API/OpenRouter.
- Không thay endpoint hoặc memory schema.

## Ảnh hưởng

- Agent 1: open pipeline set `tabId`; ask/resume dùng nó.
- Agent 2: không ảnh hưởng.
- Agent 3: thêm một field/schema test.

