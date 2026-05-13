# Caspio Embed CSS Isolation — Dashboard Theme Protection

> **Critical:** Whenever a page embeds a Caspio DataPage `<script src=".../emb">`,
> that script injects 4 stylesheets into `<head>` at runtime (`semantic.css`,
> `responsive576.css`, `responsive1024.css`, and a per-DataPage CSS). Those
> stylesheets WILL override any custom theme on the host page unless explicitly
> isolated.

## The Bug (2026-05-13 — Staff Dashboard v3)

**Symptom**: Dashboard renders correctly for ~500ms after page load, then
"reverts" to dim/grey styling. Sidebar nav text fades, sales-goal pace pill
flips from light red tint to solid red, body fonts shift.

**Pixel-level evidence (DevTools Elements → `<head>`):**

```html
<!-- our 6 dashboard stylesheets at top of head -->
<link rel="stylesheet" href=".../tokens.css?v=...">
<link rel="stylesheet" href=".../base.css?v=...">
<link rel="stylesheet" href=".../components.css?v=...">
<link rel="stylesheet" href=".../utilities.css?v=...">
<link rel="stylesheet" href=".../dashboard-v3-theme.css?v=...">
<link rel="stylesheet" href=".../dashboard-v3-patch-2.css?v=...">
<script src=".../config.js"></script>

<!-- Caspio embed script ran here in body and injected THESE LATER, -->
<!-- AFTER our CSS, so they win the cascade: -->
<link rel="stylesheet" type="text/css" href="https://c3eku948.caspio.com/css/a0e1500.../ST07CACC.../...">
<link rel="stylesheet" type="text/css" href="https://c3eku948.caspio.com/semantic.css">
<link rel="stylesheet" type="text/css" media="screen and (max-width: 576px)" href="https://c3eku948.caspio.com/responsive576.css">
<link rel="stylesheet" type="text/css" media="screen and (max-width: 1024px)" href="https://c3eku948.caspio.com/responsive1024.css">
```

**Why headless preview didn't reproduce it**: Caspio's embed script aborts
silently when no live Caspio session exists. In a CDP-driven headless browser
without Caspio auth, the script never injects CSS. Only real-user sessions hit
the bug.

## The Fix

`staff-dashboard-v3/caspio-isolation.js` — a tiny non-module script that:

1. Runs in `<head>` **before** the Caspio embed `<script>` in `<body>`
2. Sets up a `MutationObserver` on `<head>` listening for `childList` mutations
3. For every new `<link rel="stylesheet">` whose `href` contains `caspio.com`,
   sets `disabled = true` and `media = "not all"` (defense in depth)
4. Auto-disconnects after 30 seconds once Caspio is done injecting

```js
// Pattern (full source in staff-dashboard-v3/caspio-isolation.js)
const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.tagName === 'LINK'
                && node.rel === 'stylesheet'
                && node.href?.includes('caspio.com')) {
                node.disabled = true;
                node.media = 'not all';
            }
        }
    }
});
observer.observe(document.head, { childList: true, subtree: true });
setTimeout(() => observer.disconnect(), 30000);
```

**Caspio's JS still runs.** The embed script still populates the hidden
`[@authfield:First_Name]`, `[@authfield:Last_Name]`, etc. divs — only the
visual side effects are blocked.

## Where to Apply This Pattern

Any future dashboard / portal page that includes a Caspio auth embed like:

```html
<div class="caspio-auth" hidden>
    <div id="auth-firstname">[@authfield:First_Name]</div>
    ...
    <script src="https://c3eku948.caspio.com/dp/{DATAPAGE_ID}/emb"></script>
</div>
```

**Always pair it with:**

```html
<head>
    ...
    <!-- Block Caspio's CSS side-effects without breaking its auth JS -->
    <script src="/staff-dashboard-v3/caspio-isolation.js"></script>
    ...
</head>
```

Or copy the script into a shared location like
`/shared_components/js/caspio-isolation.js` and reference from anywhere.

## How to Verify

After the fix is in place, hard-reload the page and open DevTools → Console.
You should see one or more lines like:

```
[caspio-isolation] Blocked Caspio stylesheet: https://c3eku948.caspio.com/semantic.css
[caspio-isolation] Blocked Caspio stylesheet: https://c3eku948.caspio.com/responsive576.css
[caspio-isolation] Blocked Caspio stylesheet: https://c3eku948.caspio.com/responsive1024.css
[caspio-isolation] Blocked Caspio stylesheet: https://c3eku948.caspio.com/css/a0e1500.../ST07....../...
```

In DevTools Elements panel, inspect `<head>` — the Caspio `<link>` tags will
still be present BUT have the `disabled` attribute set and `media="not all"`.
Their rules will not be applied.

## Why NOT just iframe the Caspio embed

You could put the Caspio auth in an iframe to fully isolate it. Pros: no JS,
guaranteed isolation. Cons:

- Need cross-frame postMessage handshake to get the user fields out
- Auth-controller.js currently reads the hidden divs directly via
  `document.getElementById('auth-firstname')`. iframing breaks that.
- More code to maintain.

The MutationObserver approach is **non-invasive**: no JS changes to
auth-controller, no markup changes, no Caspio embed changes — only a tiny
isolation script in `<head>`.

## Related Files

- `staff-dashboard-v3/caspio-isolation.js` — the fix
- `staff-dashboard-v3/index.html` — includes the script in `<head>` before
  config.js
- `shared_components/js/staff-dashboard/controllers/auth-controller.js` —
  reads the auth fields the Caspio JS populates (unaffected by this fix)
- `ACTIVE_FILES.md` — registered entry for caspio-isolation.js

## Edge Cases / Known Limits

- **Inline `<style>` blocks Caspio injects** (not `<link>` tags): the current
  observer only targets `<link>` elements. If Caspio adds inline styles via
  `<style>` tags, those would NOT be blocked. So far we haven't seen this.
  If we do, extend the observer to also catch `STYLE` tagName.
- **`document.write()`-injected CSS during page parsing**: blocked too late.
  But Caspio embeds use `appendChild`, not `document.write`.
- **Future Caspio embed updates**: if Caspio changes their CDN domain away
  from `c3eku948.caspio.com`, the URL match needs updating. Current check is
  `href.includes('caspio.com')` which covers any caspio.com subdomain.
- **30-second auto-disconnect**: chosen because Caspio always finishes
  injecting within a few seconds. If a long-tail injection happens after 30s,
  it won't be caught. Adjust if needed.

## Test Plan When Modifying Any Page With Caspio Embed

1. Add a Caspio embed script
2. Load page in real browser (NOT headless preview — Caspio won't run there)
3. Open DevTools → Network → filter `caspio.com`
4. Confirm 4 CSS files loaded
5. DevTools → Elements → find them in `<head>` → confirm `disabled` attr present
6. Visual: page styling should be stable, no flash/revert
7. Console: confirm `[caspio-isolation]` log lines

If the page-styling flash-then-revert returns, the isolation script likely
isn't loading early enough. Move its `<script>` tag higher in `<head>`.
