# Debate synthesis

Three independent read-only critics reviewed the draft plan: architecture, failure modes, and YAGNI. All rejected the first draft as not cook-ready. The changes below resolve their objections before G2.

| Objection | Resolution |
|---|---|
| First `main` may be empty/hidden or contain only excluded menu | Try all semantic roots; count candidates only after chrome exclusion. Prefer roots with body text; then fall back to any nonempty root and finally document. Add a multi-root test. |
| `li` from an in-article TOC may become the quote | Prefer visible `p`/`blockquote`, then other non-heading text. Add a TOC-before-paragraph test. |
| Selection in the menu overrides article scope | Accept selected text only when its Range is inside the chosen reading root and outside excluded chrome. Add an out-of-scope selection test. |
| Clipping implementation and test DOM were only sketches | Put actual axis-wise ancestor intersection code and a selector/ancestry-aware fake in the plan. |
| W3Schools-specific `#sidenav` selector is unnecessary | Exclude semantic `nav`/`aside`/roles; the `#main` scope handles the observed W3Schools menu. Do not special-case a host. |
| Existing demo command mutates `.firefox-demo-profile` | Do not run `npm run demo:firefox`. Build, then launch `web-ext` with no `--firefox-profile`, creating an isolated temporary profile. |
| Legacy menu marker has only an approximate window ratio | Keep the existing contract, avoid menu highlight, explicitly label ratio fallback approximate. Never rewrite old markers. |
| Partly visible huge block still contributes all `textContent` | Narrow the claim to viewport-intersecting elements; full text-range clipping is separate scope and a known limitation. |
| Duplicate quote inside the same article remains first-match | Defer proximity ranking: not needed to resolve menu/article targeting and would change the anchor strategy more broadly. Record as a limitation in review. |
| Stale URL test has no matching DOM target | Add a test with matching article content under wrong URL, asserting no highlight or scroll. |

Decision remains Option B. No schema, API, sidebar, manifest, or package changes are authorized.

Independent review during execution found a new divergence: Capture selected roots using viewport visibility, while Resume did not. The implementation and plan were amended to choose one stable, non-hidden semantic root in both paths. A nested article takes priority over generic content within its parent main. Selection deliberately remains an explicit article-only override; offscreen selected text is not treated as passive viewport capture.

Second review caught a distinct multi-article failure: choosing only the first nested article would miss the visible second article. The correction gathers candidates from all nested articles of the chosen main, filters by viewport only in Capture, and searches all of them in Resume. Menu selection inside the enclosing main is rejected unless its Range is inside an article region.

The same failure among standalone sibling articles and multiple main roots led to grouped regions for those layouts too. Cross-tier mixed layouts remain ambiguous: an offscreen nested article group can outrank a visible standalone article group. This is documented as a supported-layout limit in review rather than widening article selection across unrelated page regions.
