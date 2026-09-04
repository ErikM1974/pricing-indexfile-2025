# Design colour code — who / what each colour means (Erik's rule, 2026-09-04)

**The rule: colour = the PERSON or DEPARTMENT the page belongs to, not the page type.**
A rep should know at a glance who a request goes to, and a tile on the staff dashboard
should look like the page it opens. Shipped across `v2026.09.04.2 → .6`.

## The key

| Colour | Hex family | Who / what | Where it is defined |
|---|---|---|---|
| **Steve green** | `#0a8a1f` · dark `#006600` · light `#33bb33` · tint `#ecfdf0` | Steve (graphic arts): Art Queue, Design Queue, AE Art Request, his Art Hub, Art Request Detail, every Steve pane on the AE dashboard (all 4 intake forms, Steve Mockups, Review) | `workspaces.css` `--f-steve` / `.f-steve` · `ae-dashboard.css` `#submit-tab,#view-tab,#review-tab` · `ae-nav-v2.css` `--ae-green*` · `art-hub-steve.html` `:root` · `art-request-detail.css` (page default `#009900→#006600` header) · the 3 form sheets' `--fx-*` |
| **Ruth purple** | `#6b46c1` · dark `#4c3391` · light `#8b5cf6` · tint `#f5f3ff` | Ruth (digitizing): Mockup Queue, her intake form, Ruth Mockups, mockup detail page (AE view too) | `workspaces.css` `--f-mock` · `ae-dashboard.css` `#mockup-ruth-tab,#digitizing-tab` · `ae-nav-v2.css` `--ae-purple*` · `mockup-submit-form.css` `.msf-container` · `mockup-detail.css` `:root` |
| **Bradley slate blue** | `#4a6fa5` · dark `#33537d` · tint `#f4f7fb` | Bradley (purchasing + transfers): Transfer Queue, Supacolor jobs/orders, Purchase Request/Tracking, SanMar purchasing guide, the AE dashboard Transfers section | `workspaces.css` `--f-purch` · `bradley-transfers.css` `--bt-theme` · `ae-dashboard.css` `#transfers-tab` · `ae-nav-v2.css` `--ae-blue*` |
| **Shop-floor blue** | `#2563eb` · dark `#1d4ed8` · light `#3b82f6` · tint `#eff6ff` | Personalization / shop floor: Names & Numbers, Monogram dashboard, box labels, the AE dashboard Personalization section | `workspaces.css` `--f-floor` · `names-numbers.css` `--nn-primary` · `monogram-dashboard.css` `--mono-theme` · `ae-dashboard.css` `#personalization-tab` · `ae-nav-v2.css` `--ae-floor*` |
| **AE maroon** | `#981e32` · dark `#7a1828` · light `#b92c43` | ONLY the AE dashboard's own chrome (header band, page intro, launcher-card fallbacks). It is the reps' container and carries every other colour inside it | `ae-dashboard.css` `:root` · `workspaces.css` `--f-artreq` (now unused by any tile) |

Other job-family colours already on the staff dashboard (`workspaces.css` header comment is
the source of truth): money/quoting = NW green `--accent`; CRM = navy `#1a2332` + gold
`#f59e0b`; photos = deep green `#14351c`; archive = amber `#d97706`; drinkware/tumbler =
oxblood `#7f1d1d`; Design Vault = forest `#2e5827`; storefront = cream + `#2f7d3b`; Shop
Menu = wine `#7a1f2b` on paper; reference/training = neutral `--f-ref`.

⚠️ Two greens and two blues coexist on purpose. Steve `#0a8a1f` ≠ NW brand green
`--accent`/`#22c55e` ≠ photo deep green. Bradley slate `#4a6fa5` ≠ shop-floor `#2563eb`.
Never "tidy" them into one — each pairing was chosen so the tile matches its page.

## How to colour-code a NEW page (checklist)

1. **Decide whose it is.** Person (Steve / Ruth / Bradley) beats department; department
   (personalization, purchasing, money, CRM…) beats page type. If it belongs to nobody in
   the key, it is neutral (`--f-ref`) — do NOT invent a colour without adding it to the key.
2. **Page theme.** Set the page's `:root` theme family to the key hex (`--art-theme*` for
   art-hub-based pages, or the page's own `--xx-primary` vars). Never hardcode the hex in
   rules — the whole point is that one edit re-themes the page.
3. **Staff-dashboard tile.** Give the tile/row the matching family class in
   `staff-dashboard-v3/index.html`: `f-steve` · `f-mock` · `f-purch` · `f-floor` · … If a new
   family is genuinely needed, add `--f-xxx`/`.f-xxx` in `workspaces.css` AND a row in its
   header comment AND a row in the table above.
4. **AE dashboard.** If the page gets a section there, scope the `--art-theme*` family on
   the pane (`#xxx-tab { … }` in `ae-dashboard.css`) and add the nav accent + active
   gradient in `ae-nav-v2.css` (`.ae-nav[data-section="xxx"]`, `.ae-nav__section[data-section="xxx"].is-active`).
5. **Detail pages the person owns follow the person**, in every view. The old "AE view =
   maroon" overrides on art-request-detail and mockup-detail were retired for this reason.
6. Verify with computed styles (nav tab gradient, title accent, card headers, buttons), not
   by eye — the browser pane's screenshots of scrolled pages are unreliable on these pages.

## Proposed (NOT adopted — Erik to decide)

Page types with no colour today that could take one:
- **Office / accounting** (payroll, credit app, SanMar payables, commission) — reuse
  money/NW green `--f-money` rather than a new colour.
- **Company / policies / handbook / training** — keep neutral `--f-ref`; reference material
  should not compete with work queues.
- **Admin** (access admin, API usage, bandit integration) — a graphite/charcoal family would
  mark "not for everyday use", but only worth adding if admin tiles start to look like tools.
