# Execution state

Current phase: HANDOFF. Slices 1 and 2, review feedback fixes, final verification, and isolated Firefox check complete.

## Slice 1 — Shared reading scope and Capture

- Added `reading-scope.ts` and changed Capture to select semantic reading roots. Sidebar/menu text no longer wins when a readable `main`/`article` exists.
- Added ancestor scroll clipping, article-paragraph quote preference, and scope-bound text selection.
- Added six regression cases for competing panes, alternate article root, TOC, clipping, partial clipping, and out-of-scope selection.
- Verification: `npm test --workspace @vlc/firefox-extension` → 9 files, 61 tests passed. `npm run typecheck --workspace @vlc/firefox-extension` → exit 0. `git diff --check` for named files → exit 0 (line-ending warnings only).
- A TypeScript inference error in the new test fake appeared on first check. It was fixed in the same slice; the second check passed.
- Reviewed only Slice 1 named-file diff. No API, profile, storage, manifest, or package edits.

## Slice 2 — Resume within reading scope

- Reused the same semantic reading scope for quote and heading matching on Resume.
- Added article-vs-menu duplicate-quote coverage, legacy menu-only fallback coverage, and a stronger stale-URL test with matching DOM content.
- Verification: extension test suite → 9 files, 63 tests passed. Extension typecheck and build → exit 0. Named-file `git diff --check` → exit 0 (line-ending warnings only).
- Existing bad markers are not migrated. Their menu text is no longer highlighted; ratio fallback may only approximate article position.

## Independent-review fix

- Review found a Capture/Resume root-choice divergence on pages with multiple semantic roots. Both now choose the same non-hidden root independently of viewport scroll; Capture filters visible elements only afterward.
- A nested `article` now wins over a generic menu inside its enclosing `main`. Added hidden-root, nested-article, and Resume duplicate-quote regressions.
- A first test run caught a missing `contains` method in the Resume fake root. Fixed the fixture; 9 files, 66 extension tests then passed. Full verification and Firefox rebuild are pending.

## Second independent-review fix

- Review found that a `main` containing multiple `article` regions could still fail capture after scrolling past the first article. Changed the shared scope to gather candidates from all nested articles, leaving Capture to filter viewport-visible elements and Resume able to search the saved quote in any article. Menu prose and menu-only text selection inside `main` remain excluded.
- Added three regression tests. Extension test suite: 9 files, 69 tests passed.

## Final scope hardening and verification

- A second review pass caught the same offscreen-first issue among standalone sibling articles. Shared scope now groups standalone articles and multiple main roots as well. Added three more regression tests.
- `npm run verify` passed: typecheck/build for all workspaces; agent-api 34 tests, Firefox extension 72 tests, contracts 3 tests, memory 7 tests; `web-ext lint` 0 errors, warnings, notices.
- Rebuilt the final extension and loaded it as a temporary add-on in a new isolated Firefox profile. With W3Schools menu `JS Advanced` visibly scrolled to y307 and article H1 `Asynchronous Functions` at y366, extension context showed the article heading and async/await prose. A marker saved as UNDERSTOOD in `browser.storage.local` had the article URL, heading, and quote. Scrolling article to y1200 left menu scroll at 831; Resume returned the article window to about y206 and outlined the quoted paragraph in `#main`, with no menu highlight. Navigation to Promises captured `Asynchronous Promises` while retaining the old marker; return to async/await restored the page marker.
- Browser testing used an extension page in a background tab to exercise the same UI code because BiDi could not address the remote sidebar browser directly. The actual sidebar was opened, and the actual W3Schools tab/content script/WebExtension storage were used. Automatic on-tab-update behavior in that background tab was not directly assessed; Refresh was clicked after navigation.
- The isolated Firefox process and localhost debugging port were closed. Its temporary profile was removed by `web-ext`; `.firefox-demo-profile` was not used or changed. An ad-hoc browser probe script was removed after testing.

## Firefox E2E before second review fix

- Built extension loaded as a temporary add-on in an isolated Firefox profile; the user's `.firefox-demo-profile` was not used. W3Schools async/await article and independently scrolling left menu were both visible at 1500x900.
- Sidebar-equivalent extension UI in a background extension tab captured heading `Asynchronous Functions`, not menu heading `JS Advanced`; article preview began with async/await text. Saved `UNDERSTOOD` marker had article URL, heading and quote in `browser.storage.local`.
- At article scrollY=1200, menu scroll remained unchanged. Resume scrolled the article to its saved quote and outlined its paragraph; no menu element was outlined.
- Navigating to the Promises page captured `Asynchronous Promises` and kept the earlier async/await marker in storage. Returning to async/await restored the page marker. This is navigation persistence, not a browser-restart test.
