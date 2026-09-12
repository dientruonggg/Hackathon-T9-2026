# Handoff: Task Agent 2 — Fastify Agent API

```text
Branch: feat/agent-api
Commit: local working tree (ready for git commit)
Owned files changed:
  - apps/agent-api/src/server.ts
  - apps/agent-api/src/app.ts
  - apps/agent-api/src/config/env.ts
  - apps/agent-api/src/routes/health.ts
  - apps/agent-api/src/routes/agent-turn.ts
  - apps/agent-api/src/agent/system-prompt.ts
  - apps/agent-api/src/agent/tool-registry.ts
  - apps/agent-api/src/agent/run-agent-turn.ts
  - apps/agent-api/src/providers/llm-provider.ts
  - apps/agent-api/src/providers/openai-compatible-provider.ts
  - apps/agent-api/tests/health.test.ts
  - apps/agent-api/tests/tool-registry.test.ts
  - apps/agent-api/tests/agent-loop.test.ts
  - apps/agent-api/tests/routes.test.ts
  - apps/agent-api/tests/provider.test.ts
  - apps/agent-api/tests/logging.test.ts
Commands run:
  - npm run typecheck --workspace @vlc/agent-api
  - npm test --workspace @vlc/agent-api
  - npm run build --workspace @vlc/agent-api
  - npm run typecheck
  - npm test
Tests passed:
  - 23/23 tests in @vlc/agent-api passed
  - 55/55 total tests across entire monorepo passed (extension, contracts, memory, agent-api)
Manual checks:
  - Health check: curl http://localhost:8000/health
  - Turn endpoint schema validation & fake provider execution verified
Known limitations:
  - search_web returns empty array by default unless webSearcher is provided; satisfies golden E2E
Dependency request (if any):
  - none
Contract change proposal (if any, do not implement):
  - none
```

---

## Sample cURL Commands

### 1. Health Check
```bash
curl -X GET http://127.0.0.1:8000/health
```

**Expected Response (200 OK):**
```json
{
  "status": "ok",
  "service": "viewport-learning-agent-api",
  "contractVersion": "0.1"
}
```

### 2. Agent Turn Request
```bash
curl -X POST http://127.0.0.1:8000/v1/agent/turn \
  -H "Content-Type: application/json" \
  -d '{
    "contractVersion": "0.1",
    "turnId": "demo-turn-001",
    "question": "Ý chính của đoạn này là gì?",
    "context": {
      "contextId": "ctx-demo",
      "source": {
        "canonicalUrl": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
        "safeUrl": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
        "hostname": "developer.mozilla.org",
        "title": "Closures - JavaScript | MDN"
      },
      "anchor": {
        "heading": "Closures",
        "textQuote": "A closure is the combination of a function bundled together...",
        "scrollRatio": 0.4,
        "fingerprint": "sha256:1234567890abcdef"
      },
      "visibleText": "A closure is the combination of a function bundled together with references to its surrounding state (the lexical environment).",
      "visibleCodeBlocks": [],
      "capturedAt": "2026-09-12T10:00:00.000Z"
    },
    "relatedMemories": [],
    "history": [],
    "permissions": {
      "allowWebSearch": false
    }
  }'
```

**Expected Response Structure (200 OK):**
```json
{
  "contractVersion": "0.1",
  "turnId": "demo-turn-001",
  "answer": "Đoạn văn này giải thích định nghĩa cốt lõi của Closure trong JavaScript...",
  "grounding": "VIEWPORT",
  "groundingRefs": [
    {
      "kind": "VIEWPORT",
      "refId": "ctx-demo",
      "label": "Closures",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures"
    }
  ],
  "suggestedActions": [],
  "toolTrace": [
    {
      "step": 1,
      "toolName": "get_viewport_context",
      "status": "SUCCESS"
    }
  ],
  "model": {
    "provider": "openai-compatible",
    "name": "openai/gpt-4o-mini"
  }
}
```
