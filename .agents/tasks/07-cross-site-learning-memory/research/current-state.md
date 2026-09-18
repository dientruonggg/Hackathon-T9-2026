# Current state — confirmed from checkout on 2026-09-17

1. `packages/memory/src/browser-storage-memory-repository.ts` stores all confirmed markers in one `browser.storage.local` record, `vlc:markers:v1`; upsert identity is `(canonicalUrl, fingerprint)`. Saving site 2 sequentially does **not** intentionally erase site 1.
2. `packages/memory/src/memory-matcher.ts` rejects every marker whose canonical URL differs from the current page. `runOpenSidebarPipeline` and `runAskAgentPipeline` preload only that page's top five summaries.
3. `apps/firefox-extension/src/sidebar/main.ts` initializes a RAM `ShortSession` for the active tab once. Ask recaptures the bound tab; it does not rebind to the newly active tab. No tab activation/update listener exists. `CONTEXT_STALE` protects same-tab URL changes from an incorrect capture, but does not automatically establish a new session.
4. `AgentTurnRequest.relatedMemories` and `ShortSession.relatedMemories` are capped at five. The Agent API's `search_memory` and `read_memory` tools see only that preloaded array, not Firefox storage.
5. FEAT-08 explicitly targeted “what have I learned on this page”, not cross-site history. Status is `UNDERSTOOD`, `NOT_UNDERSTOOD`, or `REVIEW_LATER`, optionally with a note; no progress percentage or comprehension test exists.

## Surprises

- “Single web” is a retrieval/session-boundary limitation, not a one-website storage format.
- `runAgentTurn` currently cites `relatedMemories[0]` after any successful memory-tool call, including an empty search, so cross-site attribution would be unsafe without a fix.
- Marker writes read and replace the whole `vlc:markers:v1` record. Simultaneous writes from separate sidebar contexts can race despite sequential switching being safe.

## Confirmations

- Source policy blocks social feeds, private chat, webmail, video, PDF and sensitive domains before capture; `facebook.com` is currently hard-blocked. The “fanpage” description is historical/product context, not the current allowed source behavior.
- Only explicit marker/status clicks save long-term data; the API is stateless with respect to local memory.
- `npm run demo:firefox` targets `.firefox-demo-profile` with `--keep-profile-changes`; that directory exists and is Git-ignored. It is a Firefox-managed demo profile, not a repository database or the only possible profile.

## Evidence boundary

This was static code/document inspection plus `Test-Path .firefox-demo-profile` (true). No profile database was opened, no browser E2E was performed, and no source/test command was run in this planning turn.
