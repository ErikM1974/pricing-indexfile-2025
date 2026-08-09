# 253gear store metrics — Shopify traffic + sales on Steve's Design Queue

Live 2026-08-09 (proxy `v2026.08.09.2` → app `v2026.08.09.2`). Panel: **253gear.com right
now** at the top of `/dashboards/design-queue.html`. Route `/api/shopify/store-metrics`,
forwarded at `/api/gear/store-metrics`, gated on **`design-queue.html`** (not
`gear-publisher.html` — that one is an emails-only allowlist and would blank the panel for
everyone else who can legitimately read the queue). Jest-locked both ways.

## 🔑 Releasing a Shopify app version does NOT grant the scopes

Cost a full debugging cycle. In the Dev Dashboard, editing scopes and clicking **Release**
creates an active version — and `currentAppInstallation { accessScopes }` **keeps reporting
the OLD set**. The grant lives on the *installation*, not the version.

The fix is the **Install app** button on the app Overview → an *"Update data access"* consent
screen in the store admin → **Update**. Only then do the scopes appear.

⚠️ That consent screen is broader than the scope names suggest — `read_orders` pulls in
**customer PII** (name, email, phone, physical address) plus device/activity data
(geolocation, IP, browser). Our code reads line-item titles and quantities only, but the
*grant* covers all of it. Erik clicked it knowingly.

🎉 It also resolves the protected-customer-data requirement inline — the screen states
*"Shopify has confirmed this app meets data handling and privacy requirements."* No separate
review, contrary to what the `read_reports` denial implied.

## 🔴 Two bugs found the first time ShopifyQL ever executed

Both invisible in a response that looks fine.

**1. `parseErrors` is `[String!]!` and returns `[]` on success — and `[]` is TRUTHY in JS.**
So the obvious guard `if (r.parseErrors) throw` fires on **every successful query**. Traffic
would have reported itself permanently broken, with a fabricated error message, the moment
the scope landed. Exact mirror of the `Number(null) === 0` trap: there "no data" became the
fact "0"; here "no errors" reads as "error".
⚠️ Neither signal identifies the type alone — introspection says `LIST`, while a
`{ code message }` selection is rejected with *"returns String"*. You need both.

**2. `rows` are OBJECTS keyed by column name** — `{"sessions":"1332"}` — not positional
arrays. Rendering them as arrays gives empty cells, not an error. Project via the declared
column order.

## ShopifyQL grammar (established by probing, not docs)

- **No `sum()`** — *"Could not find valid function sum()"*. The measure is the bare column:
  `SHOW sessions`.
- **No bare `BY`** — the parser wants `GROUP BY` (its error names the `GROUP_BY` token).
- **No `FROM products`** — *"Invalid dataset"*. Top sellers come from the **orders API**,
  not ShopifyQL.
- Working shape: `FROM sessions SHOW sessions GROUP BY <dim> SINCE -30d UNTIL today ORDER BY
  sessions DESC LIMIT n`. Dimensions confirmed live: `referrer_source`, `referrer_name`,
  `landing_page_path`, `day`.

## What the first real read said (30 days to 2026-08-09)

| | |
|---|---|
| Sessions | **1,332** — but see the spike below |
| Sources | direct 1,032 · search 291 · unknown 7 · invalid 1 · social 1 |
| Named referrers | google 283 · bing 4 · amazon 3 · mobile 3 |
| Orders | **2 orders, 3 units** |
| Sold | Spanaway Speedway #34084 ×2 · Retro Washington State Hoodie #34188 ×1 · $1 Chinese Food Tee ×1 |
| Designs with no sales | **45 of 47** |

🔴 **8 Aug alone = 711 sessions, 53% of the whole window**, against 5–38 on every other day.
That shape is a crawler far more often than an audience. The panel flags any day ≥25% of the
window next to the headline rather than in a footnote — an unflagged spike is how "traffic
tripled" survives into a meeting.

🔑 **The top landing page is the BLOG POST** —
`/blogs/area-code-253-t-shirts/…` at 229 sessions, more than the homepage (126). The store
has **2 blog articles, newest 2023**. The largest content gap is also the best-performing
page type. Product pages trail: pc54 49, pc147 44, Calico Cat 33, Fife Alumni 31,
Spanaway 30.

## Design rule the module enforces

A block we lack the scope to read renders as **prose naming the scope and the fix**, never a
number. `available:false` and a measured `0` are different objects with different treatments,
and a real zero says so out loud: *"That is a measured zero, not a missing reading."* A
"Visitors: 0" tile is indistinguishable from a measurement and somebody will plan around it.

## Still open

- `write_themes`, `write_content`, `write_online_store_navigation` remain granted. Erik chose
  the additive scope string; nothing in any repo uses them, and the one job `write_themes`
  existed for (the `itemprop` design-number leak) **is already fixed on the live theme**.
- **Claude Store Ops** app still exists at 0 installs. Meant to be deleted.
- Google Search Console and GA4 remain unreachable — see [[253gear-analytics-access]]. Shopify
  sessions are not a substitute: only Search Console reports the *queries*.
