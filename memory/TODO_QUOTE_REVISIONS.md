# TODO: Quote Revision System - Caspio Fields

**Created:** 2026-01-15
**Status:** Waiting for manual steps
**Priority:** Medium

---

## Summary

The Quote Revision System is now implemented in code. Sales reps can edit existing quotes and save revisions. However, to fully track revision history, Caspio needs 4 new fields.

---

## Manual Steps Required (Erik)

### Add Caspio Fields to `quote_sessions` Table

| Field Name | Type | Description |
|------------|------|-------------|
| `RevisionNumber` | Integer | Starts at 1, increments on each edit |
| `RevisedAt` | Date/Time | Timestamp when quote was last revised |
| `RevisedBy` | Text (255) | Email of person who revised |
| `RevisionNotes` | Text (500) | Optional notes about what changed |

### Default Values

- `RevisionNumber`: Default to `1` for existing quotes
- New quotes get `RevisionNumber = 1` automatically

---

## What's Already Working (Code Done)

1. **Edit Button in Dashboard**: Click the pencil icon in Quote Management to edit any quote
2. **Quote Builder Edit Mode**: Opens with `?edit=EMB-2026-001` URL parameter
3. **Load Quote**: Fetches session + items and populates the form
4. **Save Revision**: Updates existing quote instead of creating new one
5. **Quote View Display**: Shows "Rev 2" in header when revision > 1

---

## User Workflow

### Sales Rep Editing a Quote:

1. Go to Quote Management dashboard
2. Find quote (e.g., EMB-2026-004)
3. Click **Edit** button (pencil icon)
4. Quote Builder opens with all data pre-filled
5. Make changes (add sizes, change prices, add fees)
6. Click **Save Revision**
7. Quote is updated, RevisionNumber incremented
8. Customer's existing link shows updated quote

### Customer Experience:

1. Customer has link: `/quote/EMB-2026-004`
2. Always sees the **latest revision**
3. Quote header shows: "Quote #EMB-2026-004 • Rev 2"
4. Can still accept the quote

---

## Files Modified

| File | Changes |
|------|---------|
| `embroidery-quote-service.js` | Added `loadQuote()` and `updateQuote()` methods |
| `embroidery-quote-builder.html` | Added edit mode with URL parameter handling |
| `quote-management.html` | Added Edit button in actions column |
| `quote-view.js` | Display revision number in header |
| `quote-view.html` | Added "Last Revised" row in quote details |

---

## Testing

After adding Caspio fields:

1. Create a new quote EMB-2026-XXX
2. Go to Dashboard > Quote Management
3. Click Edit (pencil) on the quote
4. Verify all data loads correctly
5. Change a size quantity
6. Click "Save Revision"
7. Check Caspio: `RevisionNumber = 2`, `RevisedAt` set
8. View quote page: shows "Rev 2" in header
9. Customer link still works, shows updated data

---

## Related

- Quote acceptance emails: See `/memory/TODO_QUOTE_ACCEPTANCE_EMAILS.md`
- Quote Management dashboard: `/dashboards/quote-management.html`
- Quote View page: `/pages/quote-view.html`
