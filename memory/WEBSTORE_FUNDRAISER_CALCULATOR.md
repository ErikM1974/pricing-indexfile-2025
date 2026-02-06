# Webstore Fundraiser/Donation Calculator

**Added:** 2026-02-06
**Location:** `/calculators/webstores.html` (Tab 2: "Donation Calculator")

## Architecture

The webstore page now has a **tab system** with two tools:
- **Tab 1: Store Setup Quote** — original webstore setup calculator (unchanged)
- **Tab 2: Donation Calculator** — fundraiser pricing calculator

### Files
| File | Purpose |
|------|---------|
| `calculators/webstores.html` | Both tabs live here |
| `calculators/webstores-calculator.js` | Tab 1 logic (WebstoreCalculator class) |
| `calculators/webstores-fundraiser.js` | Tab 2 logic (FundraiserCalculator class) + tab switching |
| `calculators/webstores-styles.css` | All styles for both tabs |
| `calculators/webstores-quote-service.js` | Quote save service (Tab 1 only) |

### Tab System
- Tab nav: `.ws-tab-nav` with `.ws-tab` buttons (`data-tab` attribute)
- Tab panels: `.ws-tab-panel` divs with matching IDs
- `initWebstoreTabs()` in `webstores-fundraiser.js` handles switching
- Active state: `.active` class on both tab button and panel

## Fundraiser Calculator Formula

```
blankWithMargin = blankCost / (1 - margin)
subtotal = blankWithMargin + embellishment + donation
withCC = subtotal / (1 - ccFee)
sellPrice = Math.ceil(withCC / 5) * 5   // Round UP to nearest $5
profit = sellPrice - blankCost - decoCost - actualCCfee - donation
```

### Default Values
- Margin on blanks: **43%**
- Credit card fee: **3.5%**
- Embellishment fee: **$15.00**
- Actual decoration cost: **$8.00**
- Donation per item: **$5.00**

### CSS Namespace
All fundraiser styles use `fr-` prefix to avoid conflicts with existing webstore/calculator-base styles.

### Key Design Choices
- Left column: white `.card` with inputs (matches Tab 1 style)
- Right column: dark navy `.fr-result-card` with gradient accents (distinctive)
- Gold (#e9c46a) for labels, green for profit, coral (#E76F51) for low-margin warnings
- JetBrains Mono font for all price/number displays
- Advanced settings hidden by default behind toggle
- 1099 tax reminder included (donations > $600/year need W-9)
