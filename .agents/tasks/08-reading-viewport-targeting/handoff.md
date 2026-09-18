# Handoff — reading viewport targeting

Status: complete for the observed W3Schools sidebar/article detection bug. Gate G3 PASS [AUTO: DELEGATED].

## Changed files

- `apps/firefox-extension/src/content/reading-scope.ts`: shared article/main region selection.
- `apps/firefox-extension/src/content/capture-current-viewport.ts`: viewport and ancestor clipping, article-scoped heading/quote/text selection.
- `apps/firefox-extension/src/content/highlight-or-resume.ts`: article-scoped Resume.
- The corresponding two content test files: multi-pane, clipping, selection, multi-article, stale URL, and legacy-marker regressions.
- Task artifacts in this folder. No profile, storage schema, API, manifest, package, or lockfile edits for this task.

## Verification

- `npm run verify`: exit 0; 72 extension tests, 34 API, 3 contracts, 7 memory; typecheck/build all pass; extension lint 0 errors, 0 warnings, 0 notices.
- `git diff --check` on this task's tracked source/test files: exit 0; Git reported only Windows LF-to-CRLF conversion notices. The new helper and task artifacts contain no scratch browser probe.
- Isolated Firefox temporary add-on: article heading/quote captured instead of menu; marker saved to temporary `browser.storage.local`; independent menu/article scrolling; Resume highlighted article paragraph only; navigation to Promises and back kept prior marker.
- Temporary Firefox process/debug port closed; temporary profile removed automatically. `.firefox-demo-profile` preserved.

## Caveats

The test used the same extension UI in a background tab because BiDi could not address the sidebar's remote browser directly; automatic context refresh in that background tab and browser-restart persistence were not asserted. Mixed pages with an offscreen nested article plus a separate visible standalone article remain a documented lower-priority layout limit. See `review.md`.
