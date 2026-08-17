---
name: handbook-sync-workflow
description: "How the Employee Handbook stays in sync across Caspio chapter policies, the online reader (handbook.html), and the downloadable PDF. Includes the Canva-scan cadence for capturing meeting-driven updates."
metadata:
  node_type: memory
  type: howto
  originSessionId: 82538cd2-43b6-4a53-ad14-7a1609267324
---

# Employee Handbook — Living Sync Workflow

The 2026 Employee Handbook exists in **three surfaces**, all driven by one source of truth:

```
                  ┌─────────────────────────────────────────┐
                  │  CASPIO POLICIES TABLE                  │
                  │  Parent: employee-handbook              │
                  │  Children: hb-01-welcome … hb-22-ack    │
                  │  (22 chapter policies, edited via       │
                  │   TipTap in /pages/policy-detail.html)  │
                  └────────────────────┬────────────────────┘
                                       │
                  ┌────────────────────┼──────────────────────┐
                  │                    │                      │
        ┌─────────▼────────┐   ┌──────▼──────────┐   ┌──────▼────────────┐
        │  ONLINE READER   │   │  ONLINE POLICY  │   │  DOWNLOADABLE PDF │
        │  /pages/         │   │  DETAIL PAGE    │   │  /forms/Employee- │
        │  handbook.html   │   │  /pages/policy- │   │  Handbook-Latest  │
        │  (one scrolling  │   │  detail.html?id │   │  .pdf             │
        │   page, all      │   │  =hb-N-slug     │   │  (37 pages,       │
        │   chapters)      │   │  (per-chapter)  │   │   ~400 KB)        │
        │                  │   │                 │   │                   │
        │  ✅ AUTO-SYNC   │   │  ✅ AUTO-SYNC  │   │  ⚠ MANUAL REGEN  │
        │  (fetches on    │   │  (fetches on    │   │  (run script      │
        │   page load)    │   │   page load)    │   │   after edits)    │
        └──────────────────┘   └─────────────────┘   └───────────────────┘
```

## The two-finger sync rule

1. **Online reader + per-chapter detail page** stay in sync **automatically** with Caspio — they `fetch()` the policies on every page load via `caspio-pricing-proxy/api/policies-public/*` (cache-busted with `?_=Date.now()`).
2. **PDF download** needs a **manual regeneration** after any chapter edit. One command:

   ```bash
   python scripts/build-handbook-pdf.py
   ```

   Then commit + deploy the updated `forms/Employee-Handbook-Latest.pdf`. Takes ~15s end-to-end.

If you forget step 2, the PDF link still works — it just points to the previous version. The online reader (the primary surface) is already current.

## Where each surface is reached

| Surface | URL | Audience |
|---|---|---|
| Hub hero tile | `teamnwca.com/pages/policies-hub.html` (top of page) | Anyone — most visible entry point |
| Online reader | `teamnwca.com/pages/handbook.html` | Anyone — best UX for reading |
| Per-chapter detail | `teamnwca.com/pages/policy-detail.html?id=hb-NN-slug` | Anyone reading; admins edit here |
| Downloadable PDF | `teamnwca.com/forms/Employee-Handbook-Latest.pdf` | Anyone needing a hard copy |
| Caspio (source) | Policies table, `Parent_Policy_ID='employee-handbook'` | Admins via TipTap |

## Editing a chapter — happy path

1. Navigate to `policy-detail.html?id=hb-NN-slug` (or click "Open in editor" from the online reader).
2. Click **Edit** (only visible if `IS_POLICIES_ADMIN`).
3. TipTap rich-text editor opens. Make changes. Save.
4. Online reader picks up the change on next page-load. Per-chapter detail page picks it up immediately.
5. **Regenerate the PDF**: `python scripts/build-handbook-pdf.py`.
6. Commit + deploy: `git add forms/Employee-Handbook-Latest.pdf && /deploy`.

## Editing from chat (this AI workflow)

**Erik's chosen cadence (confirmed 2026-05-28):** Erik edits chapters in the online handbook (Caspio/TipTap) himself, then pings Claude in chat ("rebuild the handbook PDF") to regenerate + deploy the PDF. He deliberately chose this manual ping over an automated cron — **do NOT re-pitch the scheduled-rebuild option.** On that ping: run `python scripts/build-handbook-pdf.py`, then `/deploy`, then confirm the live PDF Content-Length matches the freshly built file. (Reminder to give Erik: his Caspio edits must be **saved** first — the script pulls live from source.)

For chat-driven edits to handbook chapters (or any policy), follow the existing [policies-hub-update-playbook.md](policies-hub-update-playbook.md). The chapter `Policy_ID` pattern is `hb-NN-slug` where NN is the 2-digit chapter number:

```
hb-01-welcome              hb-12-work-conditions
hb-02-history              hb-13-leave-time-off
hb-03-mission              hb-14-holiday-schedule
hb-04-core-values          hb-15-plant-office-rules
hb-05-operating-principles hb-16-dress-code
hb-06-vision               hb-17-tech-data-security
hb-07-employment-basics    hb-18-health-safety
hb-08-code-of-conduct      hb-19-payroll
hb-09-diversity-inclusion  hb-20-benefits-programs
hb-10-bullying-harassment  hb-21-performance-discipline
hb-11-social-media         hb-22-acknowledgment
```

Sort_Order on each chapter is 100, 200, …, 2200 (leave gaps for inserts).

After any chapter PUT, **regenerate the PDF** before deploying. The `build-handbook-pdf.py` script:
- Fetches parent + 22 chapters from the public proxy API
- Throttles at 0.4s between fetches to avoid 429
- Renders via **xhtml2pdf** with embedded brand fonts (**Source Serif 4** display + **Source Sans 3** body, static OFL TTFs in `scripts/fonts/` — registered with reportlab because xhtml2pdf `@font-face` is broken on Windows)
- **Full-bleed "Employee Handbook" cover with NWCA logo** — a PIL-rendered PNG (`build_title_png`): green vertical gradient, sage double keyline, NWCA logo on a white rounded plate (`scripts/assets/nwca-logo.png`), stacked "Employee"/"Handbook" in Source Serif 4 Black, "2026 Edition". **The cover is NOT rendered by xhtml2pdf** — xhtml2pdf can't full-bleed (the `<img>` flowable hard-caps at ~580.9pt wide and named-`@page` backgrounds are dropped in 0.2.17). Instead the body renders cover-less, then `prepend_cover()` inserts the PNG as a full-page image via **PyMuPDF** (`page.insert_image(page.rect, ...)`), saved with `deflate=True, garbage=4` (else the image embeds near-lossless → 25 MB). The cover is page 0 and **unnumbered**; the body is numbered 1..N starting at Contents. Chapter outline bookmarks are offset +1 to account for the inserted cover.
- **Footer page number**: `<td>Page <pdf:pagenumber/></td>` — the `Page ` literal is REQUIRED; a cell whose only content is the bare self-closing tag renders empty in xhtml2pdf 0.2.17.
- **2-pass render for real Contents page numbers**: pass 1 emits PDF bookmarks (xhtml2pdf auto-outlines `h1.chapter-title`), **PyMuPDF** (`fitz.get_toc`) reads the page numbers, pass 2 rebuilds the Contents table with them (placeholder "00" in pass 1 keeps pagination stable). Contents fits one page (22 chapters + About) via tight `table.toc td` padding.
- Numbered chapter openers (eyebrow + `clean_chapter_title()` strips the redundant "Chapter N:" prefix Caspio stores in titles) + signature block on the Acknowledgment page for bound copies
- Writes `forms/Employee-Handbook-Latest.pdf` (37 pages, ~400 KB)

**Dependencies** (no `requirements.txt` in repo — install manually): `pip install xhtml2pdf Pillow PyMuPDF`. Verified env: Python 3.11, xhtml2pdf 0.2.17, reportlab 4.5.1, Pillow 11, PyMuPDF 1.27.

## Canva-scan cadence — capturing meeting-driven updates

Erik runs Tuesday All-Hands meetings and other huddles in Canva. Cultural decisions, operating-principle clarifications, and policy refinements often land there *before* anyone updates the handbook. The handbook drifts unless someone bridges that gap.

**Cadence**: After every Tuesday All-Hands (or other policy-shaping meeting), scan Canva for the meeting deck and identify:

1. **New principles / values** → likely belongs in Chapter 4 (Core Values), 5 (Operating Principles), or 6 (Vision).
2. **New rules / policy clarifications** → identify the target chapter (use the table above) and PATCH that chapter's `Body_HTML`.
3. **New process/workflow** → may warrant a new hub policy (not necessarily a handbook chapter — only put it in the handbook if it's a baseline employee expectation, not a per-team SOP).

The Canva MCP plugin gives chat access to recent designs — search by meeting date or by keywords like "All-Hands", "values", "principles", "Vision 2026".

**After capturing Canva content into a chapter**:
1. PUT the chapter via the proxy (per playbook).
2. Re-run `python scripts/build-handbook-pdf.py`.
3. Deploy.
4. Mention in the next All-Hands what changed and where.

## When to mint a new chapter (vs editing existing)

| Scenario | Action |
|---|---|
| Refining wording of an existing topic | Edit existing chapter |
| New 1-paragraph fact (e.g., new holiday) | Add to existing chapter |
| Entirely new theme (e.g., "Hybrid Work Policy") | Mint a new `hb-NN-slug` chapter. Sort_Order = 2300 (after 22). Insert link in parent's TOC. |
| Detailed SOP not really "handbook material" | Make it a standalone hub policy with category `Operations`. Do NOT add to handbook. |

If you mint a new chapter, update:
- The parent `employee-handbook` policy's TOC (`<ol>...<li>...</li></ol>`) — add the new entry
- `scripts/build-handbook-pdf.py` automatically picks it up via the tree endpoint (no script edit needed)
- `handbook-reader.js` automatically picks it up (no JS edit needed)
- `handbook-sync-workflow.md` (this file) — update the chapter ID list

## Cross-references to keep aligned

- **Parent policy (`employee-handbook`) Body_HTML** contains the canonical TOC + intro. The online reader strips the TOC (it has its own) but renders the rest.
- **`scripts/build-handbook-pdf.py`** strips the "Read or download the handbook" links from the parent intro (the PDF already IS the download).
- **`handbook-reader.js`** also strips that section (it has buttons in the topbar).
- All three surfaces strip the per-chapter "Return to TOC" web footer (the `<hr>` block at the bottom of chapter Body_HTML).

## Files

- `pages/handbook.html` + `pages/css/handbook.css` + `shared_components/js/policies/handbook-reader.js` — online reader (uses Fraunces; the PDF uses Source Serif 4 — different display fonts, same content)
- `scripts/build-handbook-pdf.py` — PDF generator (permanent — not a temp script)
- `scripts/fonts/` — 7 embedded OFL TTFs (Source Serif 4 Regular/Bold/Black + Source Sans 3 Regular/Bold/It/BoldIt). Required by the PDF build.
- `scripts/assets/nwca-logo.png` — NWCA logo (437×238 RGBA) composited onto the cover by `build_title_png`. Required by the PDF build.
- `forms/Employee-Handbook-Latest.pdf` — deployable PDF (auto-generated, 37 pages)
- `pages/policies-hub.html` + `pages/css/policies-hub-v2.css` — hub with hero tile
- Caspio Policies table — source of truth (parent + 22 chapter rows)

## Related memory

- [policies-hub-update-playbook.md](policies-hub-update-playbook.md) — how to insert/update/delete any policy from chat
- [policies-hub-details.md](policies-hub-details.md) — architecture (auth, schema, TipTap setup)
- [feedback_use_proxy_for_caspio_writes.md](feedback_use_proxy_for_caspio_writes.md) — always use proxy, never direct Caspio
