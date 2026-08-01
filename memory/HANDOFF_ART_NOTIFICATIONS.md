# HANDOFF — Steve gets no notification when Ruth submits artwork

**Opened 2026-07-31. Updated 2026-08-01.**

**Status: diagnosis DONE. Code fix DONE + tested on `develop` — awaiting deploy.
The Ruth half (moving her off the legacy form) is NOT done and needs Erik.**

---

## The question Erik asked

> When Ruth (ruth@nwcustomapparel.com) fills out the AE "Submit Artwork to Steve" form,
> Steve gets no email and no Slack message, and Ruth gets no confirmation. The artwork
> still lands in Steve's queue. Works fine for Nika and Taneisha.

## Root cause — Ruth is not using that form

Her art requests are created by a **legacy Caspio DataPage**, which writes straight into
the Caspio `ArtRequests` table and never calls `POST /api/artrequests`. Both notifications
hang off that POST, so neither fires — but the row still lands in Steve's queue, which is
exactly the symptom.

- Steve's email + submitter confirmation → browser EmailJS, `shared_components/js/garment-submit-form.js` `sendNotificationEmails()`
- `#art-notifications` Slack post → server-side, `caspio-pricing-proxy/src/routes/art.js` (`notifyArtRequestSubmission`)

The Slack webhook (`SLACK_ART_NOTIFICATIONS_WEBHOOK_URL`) is set and healthy. Nothing is broken.

### Evidence (live Caspio, newest 200 ArtRequests, pulled 2026-07-31)

Ruth's 6 most recent requests (Apr–Jul 2026) vs Nika's / Taneisha's:

| Field | Ruth | Nika / Taneisha |
|---|---|---|
| `Item_Type` | empty **6/6** | "Garment" |
| `Sales_Rep` | empty | "Nika Lao" / "Taneisha Clark" |
| `Status` at creation | empty | "Submitted" |
| `Artwork_Status`, `Approval_Status`, `Color_Mode`, `Uploaded_File_Type`, `Artwork_Locations` | all empty | populated |
| `AE_Checklist_Confirmed` | false | true |

All of those are **unconditional** writes in the AE form's `buildPayload()` — no setting
could produce Ruth's rows. Clincher: her `Garment_Placement` values are
`Full Front Center chest (8-11" wide, 2-3" down from collar)` and
`Other (Specify) Custom placement`, which are **not options** in the AE form's `PLACEMENTS`
list. Rows carrying `Item_Type`: Nika 34/90, Taneisha 20/77, **Ruth 0/6**.

Likely the form is "Steve's Express Art Submission Form" — Caspio DataPage
`a0e1500073092d827fb74d968d9d`, embedded at `dashboards/art-hub-steve.html:138` — or a
DataPage Ruth has bookmarked. **Not yet confirmed with Ruth.**

Note: her accounts are all contract/trade shops (Printco, Star Sportswear, Donahue
Graphics, ETC Tacoma, Armageddon Graphics), so she may be on the old form deliberately.

---

## Decisions Erik already made (2026-07-31)

1. **Fix approach = move Ruth to the AE Dashboard form.** Zero code, zero Caspio cost;
   Steve also starts getting the structured fields that are blank on all her jobs today.
   (Rejected: source-agnostic polling watcher ~190-290 extra Caspio calls/day + a new
   marker column; Caspio Triggered Action.)
2. **Also fix the separate fake-inbox bug** found along the way (below).

---

## Second bug found — fake `ae@nwcustomapparel.com` submitter

14 recent requests saved with `User_Email: ae@nwcustomapparel.com` and
`Sales_Rep: Taneisha Clark` (and `AE_Checklist_Confirmed_By: "Ae"`). `getSubmitterEmail()`
silently fell back to that address when the staff session was missing — **nobody owns that
inbox**, so those AEs' confirmation emails went nowhere. Steve still got his (his address
is hardcoded), which is why it went unnoticed. Violates the no-silent-fallback rule.

---

## What is DONE (committed on `develop`, NOT deployed)

Fixed the fake-inbox bug in all four AE submit forms (Rule 8 — same defect in each):

- `shared_components/js/garment-submit-form.js`
- `shared_components/js/sticker-banner-submit-form.js`
- `shared_components/js/jds-submit-form.js`
- `shared_components/js/mockup-submit-form.js`

Per file: `getSubmitterEmail()` returns `''` instead of `'ae@nwcustomapparel.com'`;
`getSubmitterName()` returns `''` when there's no email; `handleSubmit()` blocks with a
visible toast ("Cannot tell who you are — sign in to the staff dashboard again, then
resubmit.") plus a `console.error`, before any upload or POST.

Locked by a new test, `tests/unit/art-submit-identity.test.js` (6 cases): the three
resolution paths, the "unidentified → `''`, never a stand-in inbox" regression, plus two
cross-file greps that fail if ANY of the four forms reintroduces the `|| 'ae@...'` fallback
or drops the `if (!getSubmitterEmail())` guard. Mutation-checked — reverting
`jds-submit-form.js` to the old shape fails both greps.

`garment-submit-form.js` gained a `_getSubmitterIdentityForTest()` export hook, mirroring
the existing `_buildPayloadForTest` idiom.

**Verified 2026-08-01:** full unit suite 99/99 suites, 1967 passed / 4 skipped.

Browser verification was NOT possible locally — `/dashboards/ae-dashboard.html` is behind
`requireStaff` (`server.js:919`) and a session comes only from a real SAML ACS round-trip,
with no dev bypass. The unit tests stand in for it.

---

## TODO when you pick this back up

1. **Deploy** via `/deploy` (it applies one `$DEPLOY_VERSION` to every `?v=` string, so the
   cache-bust on `dashboards/ae-dashboard.html:629-634` and `pages/garment-designer.html:450`
   is handled automatically — do NOT hand-bump them).
2. **Ruth's move to the AE form** — this is the people half and it is NOT done:
   - Confirm with Ruth which form she actually opens today.
   - Point her at `https://teamnwca.com/ae-dashboard.html#submit` (the page gate defaults to
     any logged-in staff — `ae-dashboard.html` is not in `ADMIN_DEFAULT_PAGES` — but confirm
     no `Staff_Page_Access` row restricts it).
   - Check the AE form actually fits contract/trade art requests; if it doesn't, that
     reopens the fix decision.
   - Decide what happens to the legacy Express Form on `art-hub-steve.html:138`. Left alone
     for now on purpose — Steve may use it himself, and ripping it out was outside what
     Erik approved. Without some guard, anyone landing on it silently produces
     un-notified requests again.
3. **After the fix ships**, append the lesson to `/memory/LESSONS_LEARNED.md`
   (Problem / Root Cause / Solution / Prevention) and add a one-line entry to `MEMORY.md`,
   then delete this handoff file. Not written yet — nothing is deployed.

## Diagnostic scripts

`scripts/art-request-source-audit.js` — read-only, ~1 Caspio call. Names anyone whose
NEWEST art request bypassed the AE form. Re-run after Ruth moves to confirm it reports
CLEAR.

```bash
node scripts/art-request-source-audit.js
```

Run 2026-08-01 — **Ruth is the only one still off-path, and has never used the AE form.**
Nika, Taneisha and Erik all migrated by mid-June 2026 (their pre-June off-path rows are
rollout-era history, not a live problem).
