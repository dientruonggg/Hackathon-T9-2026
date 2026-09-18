# Review — reading viewport targeting

Gate G3: PASS [AUTO: DELEGATED]. Independent reviewer recommended PASS for the stated W3Schools/single-`#main` behavior after 72/72 extension tests. Final Firefox and full-workspace verification were completed afterward by the implementer; the reviewer did not certify these browser steps.

## Verification evidence

- Behavior: W3Schools async/await page showed menu heading `JS Advanced` and article heading `Asynchronous Functions` simultaneously. Extension captured article heading, prose, and quote. Independent menu scroll did not affect the chosen article. Resume outlined the saved paragraph in `#main`; no `#sidenav` element was outlined. Navigating to Promises and back retained the old marker.
- Architecture: Capture and Resume use the same semantic reading-scope helper. The helper groups nested articles, standalone articles, and main roots; Capture filters viewport visibility afterward. No host-specific W3Schools selector was added.
- Data: Marker schema and existing storage were untouched. A marker written in the isolated profile contained the article URL, heading, quote, and UNDERSTOOD status. No migration or deletion was performed.
- Security/privacy: Captured content remains subject to existing limits and explicit marker-write action. No API, permission, manifest, or profile change was made. Localhost Firefox debugging was shut down after testing.
- Regression: `npm run verify` exited 0 (72 extension, 34 API, 3 contracts, 7 memory tests; all typechecks/builds; extension lint 0/0/0). Diff hygiene check is recorded in `handoff.md`.

## Findings and limits

| Category | Severity/type | Finding | Disposition |
|---|---|---|---|
| Behavior | Low / confirmed by code | On mixed layouts, an offscreen nested-article group can outrank a visible standalone-article group. Capture may report no readable content. | Documented limit; ambiguous cross-region ranking is outside the observed single-`#main` W3Schools case. |
| Behavior | Advisory / intentional | A user-selected article phrase may be retained after scrolling even if offscreen. | Explicit selection is a deliberate override; menu selection is rejected. |
| Behavior | Low / known | An old menu-only marker cannot be relocated precisely because its stored ratio is approximate; duplicate quotes inside the same article remain first-match. | Keep existing anchor contract and no automatic marker migration. |
| Test coverage | Limit | Browser automation exercised a background extension page with the same UI code, actual W3Schools tab/content script/storage, and an opened real sidebar. It could not directly address the remote sidebar browser; Refresh was clicked after navigation. Browser-restart persistence was not tested. | Do not claim those untested behaviors as verified. |

No critical or high finding remains for the requested W3Schools reading-target fix.
