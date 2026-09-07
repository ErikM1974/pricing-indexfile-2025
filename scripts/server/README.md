# scripts/server — splitting server.js into routes/ (2026-09-07)

`server.js` was one 15,947-line file with 455 Express registrations. It is being split into `routes/<domain>.js`
modules, one contiguous section at a time, with **no behaviour change by construction**: each section's code moves
byte for byte, at the same indentation, and is registered from the same position in `server.js`, so the order Express
walks its stack in is unchanged. Two tools do it and one lock proves it.

## The lock: `route-table.js`

Express matches in registration order — a middleware registered after a route never runs for it; two overlapping paths
resolve to whichever came first. `node scripts/server/route-table.js` reads `server.js` statically, follows every
`require('./routes/<name>')(app, ctx);` into that module at the point it is called, and lists every registration
(method, path, middleware chain). `tests/unit/server-route-table.test.js` compares that table to
`tests/fixtures/server-route-table.json`, registration for registration.

- A **refactor** must leave the table identical (the test fails otherwise).
- A **deliberate route change** updates the fixture: `node scripts/server/route-table.js --update`; the fixture's
  diff in the commit is the review artefact.

## The cut: `extract-section.js`

```
node scripts/server/extract-section.js --name customer-portal --from 7091 --to 10407 --title "Customer Portal" [--dry]
```

Parses `server.js` (espree + eslint-scope), takes every top-level statement inside the line range, and:

- computes the section's free names (module-scope bindings declared outside it) → `const { … } = ctx;` at the top of the
  module, and the call site passes exactly those: `{ const ctx = { … }; require('./routes/<name>')(app, ctx); }`;
- **refuses** when the move would change behaviour: a binding declared inside the section that something outside uses
  (hoist it to `lib/` or a config block first), a `let`/`var` declared outside and assigned inside (hoist that state
  into an object first), or a non-function ctx binding declared below the section (temporal dead zone at the call site);
- writes `routes/<name>.js` with a header that names the source lines and replaces the section in `server.js` with the
  registration line. Always run `--dry` first and read the ctx list: it is the section's real dependency surface.

Cut from the **bottom of the file upwards** within one release so earlier line numbers stay valid.

## After every cut

1. `node --check server.js routes/*.js`
2. `node scripts/server/route-table.js --check` → "route table unchanged"
3. `npm run test:unit` — text locks that read `server.js` for a moved route now read `routes/<name>.js`; fix the lock,
   never the route.
4. `npm run test:e2e`, and `npm run test:parity` + `npm run test:parity:surfaces` when a pricing or quote route moved.
5. `/deploy`, then hit every moved endpoint once on the live app (the direct `herokuapp.com` URL works from the office).

## Where things stand

The section map with line numbers is the ROUTE TABLE OF CONTENTS at the top of `server.js`; `memory/CSS_STANDARDIZATION_PLAN_2026-09.md`
is the CSS project, and the server split's own log is § 8 of `memory/SERVER_SPLIT_2026-09.md`.
