# Quote Sequence API

**Status:** Endpoint ready, awaiting Heroku deploy (outage in progress)

## Endpoint

```
GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/quote-sequence/:prefix
```

## Usage

Generate sequential quote IDs like `EMB-2026-001`, `DTG-2026-001`, etc.

```javascript
// Get next sequence number
const response = await fetch('/api/quote-sequence/EMB');
const { prefix, year, sequence } = await response.json();
// Returns: { "prefix": "EMB", "year": 2026, "sequence": 1 }

// Build quote ID
const quoteId = `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
// Result: "EMB-2026-001"
```

## Behavior

1. **First call for prefix/year:** Creates record, returns `sequence: 1`
2. **Subsequent calls:** Increments and returns next sequence
3. **New year:** Automatically starts fresh at `sequence: 1`

## Supported Prefixes

- `EMB` - Embroidery quotes
- `DTG` - Direct-to-garment quotes
- `DTF` - Direct-to-film quotes
- `SPC` - Special/custom quotes
- Any alphanumeric prefix (1-10 chars)

## Response Format

```json
{
  "prefix": "EMB",
  "year": 2026,
  "sequence": 1
}
```

## Local Testing (Verified Working)

```
GET http://localhost:3002/api/quote-sequence/EMB
```

Tested 2026-01-15:
- First call: sequence 1 ✓
- Second call: sequence 2 ✓
- New prefix (DTG): sequence 1 ✓
- Increment: sequence 2 ✓

## Deploy Status

- **Code:** Committed to GitHub (main + develop)
- **Version tag:** v2026.01.15.1
- **Heroku:** PENDING - Heroku Git experiencing outage (HTTP 500)
- **ETA:** Once Heroku recovers, run `git push heroku main` from caspio-pricing-proxy

Check Heroku status: https://status.heroku.com
