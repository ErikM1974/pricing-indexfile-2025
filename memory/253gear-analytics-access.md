# 253gear analytics — why nothing is connected (checked 8 Aug 2026)

Erik asked me to set up Google Analytics through his Chrome and feed keyword data into
Steve's dashboard. **Neither half is reachable**, and the reason is the same in three places.

## The finding: the Google account on this machine owns none of it

Signed in as **`nwemb77@gmail.com`**. Checked all three properties directly:

| Property | What the account shows |
|---|---|
| **Search Console** | `sc-domain:253gear.com` → *"Oops, you don't have access to this property."* `/search-console/welcome` shows the **"Add a website" onboarding screen** — this account has **ZERO properties** |
| **GA4** | One property (`G-RCJVJD3C6B`, account `a331804085`). Its only data stream is **`art-approval-web`** — nothing to do with 253gear — and it reads *"No data received in past 48 hours."* There is **no GA4 property for 253gear** |
| **Google Ads** | `/aw/keywordplanner` bounces to **"Select a Google Ads account"** with an **empty list** and only "New Google Ads Account" |

Meanwhile the live site carries a **Search Console verification meta tag** and the
**`AW-1023408328`** Ads tag. Both are real. So the properties exist — under a **different
Google account**, not this one.

🔴 **Do not "fix" this by adding the property here.** Verifying `253gear.com` on a fresh
account creates a *second* property whose history starts at zero, and abandons however many
months of query data the real one has been collecting. The fix is to find which account owns
it and grant access, which is an account-settings change and Erik's click, not mine.

## This settles an earlier hedge

I previously told Erik the absent `gtag` in the homepage HTML was **not** proof GA4 was
missing, because Shopify commonly loads it through Customer Events / Web Pixels, which never
appears in page source. That reasoning was right, and the account side is the authoritative
check it pointed to: **the tag has never fired, and the only stream on the property is
`art-approval-web`.** GA4 is genuinely absent from 253gear, not merely invisible.

## Why the dashboard is finished anyway

The two things are not the same job:

- **Search Console / GA4 measure pages after they ship.** What already ranks, what earns
  clicks. Valuable — and worth nothing for deciding what Steve draws next week.
- **Choosing the subject** needs to know whether the seat is empty, and no analytics
  property can answer that. Only searching the subject can.

So `/dashboards/design-queue.html` shipped complete on vacancy scoring, with a card on the
page stating plainly that Search Console and GA4 are not connected — so nobody reads the
blank as a scoring input.

## And why there is no search-volume column, permanently

Not a gap waiting on access. **Every tool that reports volume would print zero for every
subject on that page.** SEMrush builds its database at national level and omits terms below
a threshold; Keyword Planner buckets small numbers into ranges wide enough to hide a
six-fold difference.

🔑 **"Clyde Rushton Puyallup water slide" returns no row in either tool — and 253gear holds
#1 for it.** A zero from a keyword tool means *below threshold*, never *no demand*. Printing
it next to a subject would be worse than printing nothing, because Steve would read it as a
verdict.

What replaced it in the brief: the phrase the page has to own, and the proper nouns the
research turned up. Those nouns are the ranking material — "Chicken Man" and "Beak Patrol"
are why a KTAC page could win; without them it is a generic radio-station shirt.

## What Erik needs to do

1. **Find which Google account owns `sc-domain:253gear.com`** and add `nwemb77@gmail.com`
   as a user (Search Console → Settings → Users and permissions). Do not re-verify.
2. **Install GA4 on the Shopify store** — the Google & YouTube app, or a Customer Events
   pixel. Store settings change, so his click under the Phase 1 read-only rule.
3. Neither is blocking. The queue works without them.
