# Embroidery Mockup Generator — retired 2026-08-05

Status: **LIVE** — app `v2026.08.05.10` (Heroku release v1809, sha `e4db63b`), 2026-08-05.
Erik approved "full retire" after the investigation below.

Verified in production after deploy: `/pages/mockup-generator.html` → 302 → DST Studio (both on
the Heroku domain and `www.teamnwca.com`), the served `dst-viewer.html` contains **0** occurrences
of `mockup-generator`, and `mockup-detail.html`, `thread-color-picker.js`, `thread-color-picker.css`
and the Flask `/api/embroidery/palette` endpoint all still return 200.

⏭️ **Flip the 302 → 301 after ~a week** (server.js, the block above the `/pages` static mount).

## 🔑 Deploy note — this release needed a worktree

The shared checkout went dirty **mid-deploy** (another session was actively editing contract
embroidery files), so Step 6's `git checkout main` aborted. Released from
`git worktree add C:/Temp/nwca-rel main` instead — short path, because the scratchpad path
blows Windows MAX_PATH. The other session's uncommitted work was never touched.

⚠️ **Piping `git checkout main` into `tail` swallows its exit code**, so the skill's Step 6
guard (`if ! git checkout main`) silently passes and the rest of the deploy runs against the
wrong branch — exactly the failure that step exists to catch. Check the *output*, not just `$?`,
or don't pipe it.

## What changed

| File | Change |
|---|---|
| `staff-dashboard-v3/index.html` (~L720) | Art & Design card removed (replaced by an HTML comment explaining the rollback) |
| `pages/dst-viewer.html` (~L40) | DST Studio toolbar link "Mockup Generator →" removed |
| `server.js` (~L4258, + TOC ~L282) | `GET /pages/mockup-generator.html` → **302** `/pages/dst-viewer.html` |
| `ACTIVE_FILES.md` L274-278 | 3 generator files marked 🚫 Retired; thread-color-picker rows carry a do-not-delete warning |

🔴 **The redirect MUST stay above `app.use('/pages', express.static(...))`** or express.static
serves the file and the route never fires. Same rule as the Design Vault cutover directly above it.

**302, not 301** — browsers cache 301s hard and a rollback would stick in reps' browsers.
Flip to 301 after it soaks (~a week), same as Design Vault.

## Rollback = restore the card + drop the route

Nothing was deleted. `pages/mockup-generator.{html,js,css}` are all still on disk and the
Flask backend is untouched.

## 🔴 Do NOT delete these alongside it

- **`pages/js/thread-color-picker.{js,css}`** — `pages/mockup-detail.html` loads both.
  Note `init()` (which fetches the palette) is **lazy** in mockup-detail but was **eager**
  in the generator — that difference is what made the log analysis below possible.
- **The Flask `/api/embroidery/*` routes and `web/embroidery_mockup.py`** in
  `../Python Inksoft` — `mockup-detail.js` calls `parse-emb-full` (L2878),
  `parse-dst-elements` (L3163, L3388), and `palette` via the picker.

## Why it was retired — usage, NOT feature parity

⚠️ **DST Studio is not a superset.** A `.DST` file carries **zero color data** — only
color-change stops. DST Studio's 225-color RA palette is *manual assignment*. The generator
did four things DST Studio cannot:

1. Parse a Wilcom **.EMB** for the digitizer's real thread colors (OLE compound file)
2. Parse a **ShopWorks Art Setup PDF** thread sheet, with an AI-vision fallback
3. **Compare EMB vs PDF** — catches a digitized file disagreeing with ShopWorks
4. **Recolor and re-emit a corrected .EMB** for download

The decision rested on usage instead. Across the full retained `inksoft-transform` Heroku log
window (2026-06-30 → 2026-08-05, ~5 weeks at `--num 1500`):

| Endpoint | Hits |
|---|---|
| `/api/embroidery/palette` | 11 |
| `generate-mockup`, `compare`, `recolor-emb`, `identify-elements` | **0** |
| `parse-emb-full`, `parse-dst-elements` | **0** |

**Accepted gap:** EMB↔PDF comparison and the recolored-EMB download now exist nowhere.
Items 1-2 survive in `mockup-detail.html`, wired into the art workflow where a mockup record
already exists. If EMB↔PDF compare is ever wanted back, porting it into DST Studio (making it
a true superset) was the option Erik declined for now.

## 🔑 Reusable technique — the eager-fetch page-open counter

`mockup-generator.js:40` calls `ThreadColorPicker.init()` **on page load**, which fetches
`/api/embroidery/palette`. That makes palette hits a proxy for *page opens*, while
`generate-mockup` counts *actual use*. 11 opens / 0 generations = people landed and left.

Without that asymmetry the 11 palette hits would have looked like real usage. **When judging
whether a tool is dead, find an endpoint that fires on load and one that fires on use, and
compare them** — a single aggregate hit count can't tell "opened" from "used".

⚠️ Discount your own traffic and bots first: 2 of the 11 were my own `curl` probes and 2 were
crawlers (bingbot, meta-externalagent). Those crawlers also prove **`/pages/*` has no staff
gate** — it is publicly crawlable, unlike `/dashboards/*`.

⚠️ `heroku logs --num 1500` is the max retained; on a low-traffic app that happened to be
~5 weeks, but always print the oldest line to confirm the window before concluding "never used".

## Related

- [[contract-embroidery-dst]] — the other DST-consuming surface
- Dead CSS left behind: `.tb-link` in `pages/css/dst-viewer.css:122-128` is now unreferenced
  (flagged, not deleted, per the dead-code rule).
