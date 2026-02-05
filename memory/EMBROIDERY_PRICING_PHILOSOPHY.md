# Embroidery Pricing Philosophy

> **Last Updated:** February 2026
> **Related Files:** [`EMBROIDERY_PRICING_2026.md`](./EMBROIDERY_PRICING_2026.md), [`EMBROIDERY_PRICING_RULES.md`](./EMBROIDERY_PRICING_RULES.md)

## Three-Tier Pricing System

NWCA uses three distinct embroidery pricing tiers based on **who supplies the garments**:

| Tab Name | Customer Type | Scenario | Philosophy |
|----------|--------------|----------|------------|
| **Wholesale** | Wholesale/Ad Specialty | Customer buys blanks from SanMar, brings to NWCA | Lowest price - wholesale partner relationship |
| **Add Logo** | Retail buying from NWCA | Customer buys Carhartts from NWCA, wants 2nd logo | Lower retail - we have garment margin |
| **Customer-Supplied** | Retail with own garments | School brings 50 t-shirts for embroidery | Highest price - labor only, no garment cushion |

## Pricing Decision Flowchart

```
Is customer buying garments FROM NWCA in this order?
├─ YES → Add Logo pricing
└─ NO → Is customer bringing their own items?
    ├─ YES → Customer-Supplied pricing (DECG/DECC)
    └─ NO → Is this a wholesale/ad-specialty partner?
        └─ YES → Wholesale (Contract) pricing
```

## Critical Eligibility Rules

### Add Logo (AL) Pricing
- **Eligible:** Customer purchases garments from NWCA **in this same transaction**
- **NOT Eligible:**
  - "Repeat customers" who bought before but not in this order
  - Mixed orders where customer brings some items
  - Items customer already owns

### Customer-Supplied (DECG/DECC) Pricing
- **Use for:** Any items the customer brings that they own
- **Includes:** Schools, sports teams, corporate with own uniforms
- **Heavyweight surcharge:** +$10/piece for Carhartt, canvas, leather, bags

### Wholesale/Contract Pricing
- **Use for:** Production partners, ad-specialty distributors
- **Requirements:** Established wholesale relationship, bulk volumes
- **NOT for:** Regular retail customers regardless of order size

## Known Loopholes & Risks

### Loophole #1: No "Who Supplies?" Toggle
**Risk:** Rep accidentally uses AL for customer-supplied items
**Impact:** $400-500+ lost per order
**Prevention:** Decision flowchart added to pricing page

### Loophole #2: Mixed Order Gaming
**Scenario:** Customer buys 1 shirt from NWCA, brings 49 of their own
**Wrong:** All 50 at AL pricing
**Correct:** 1 at AL, 49 at Customer-Supplied
**Impact:** $500+ lost per occurrence

### Loophole #3: Heavyweight Avoidance
**Scenario:** Carhartt jackets quoted without $10 surcharge
**Risk:** Using AL to avoid explaining surcharge
**Impact:** $100+ lost per 10-piece order

### Loophole #4: "Repeat Customer" Claim
**Scenario:** "I bought jackets in June, now I want another logo"
**Wrong:** AL pricing because they're "our customer"
**Correct:** Customer-Supplied - no garment purchase in THIS order

## Estimated Financial Impact

Using wrong pricing tier costs approximately:

| Issue | Estimated Loss/Order | Monthly Orders | Annual Impact |
|-------|---------------------|----------------|---------------|
| AL instead of DECG | $400-500 | 5-10 | $24,000-60,000 |
| Mixed order gaming | $300-500 | 2-5 | $7,200-30,000 |
| Heavyweight avoided | $100-200 | 3-8 | $3,600-19,200 |
| **Total** | | | **$35,000-110,000** |

## Price Comparison (8K Stitches, Garments)

| Qty Tier | Wholesale | Add Logo | Customer-Supplied | DECG vs Wholesale |
|----------|-----------|----------|-------------------|-------------------|
| 1-7 | ~$6 +LTM | ~$13.50 +LTM | ~$28 +LTM | +367% |
| 8-23 | ~$5.50 | ~$13.50 | ~$28 | +409% |
| 24-47 | ~$5 | ~$12.50 | ~$24 | +380% |
| 48-71 | ~$4.50 | ~$10.50 | ~$22 | +389% |
| 72+ | ~$4 | ~$9.50 | ~$20 | +400% |

## Why DECG is 4x Contract Pricing

**This is intentional business strategy:**
1. Customer-supplied items have **no garment margin cushion**
2. Higher defect risk - can't replace customer's items
3. Inspection overhead - customer blanks vary in quality
4. **We don't actively seek this work** - price discourages but profits when we do it

## Full Back Pricing Note

Full Back uses the same pricing (DECG-FB) across all three tabs because:
- It's pure labor-intensive work
- No garment margin consideration
- Same effort regardless of who supplies garment

## Enforcement Recommendations

1. **Quote Builder UI:** Add "Garment Source" toggle (NWCA/Customer-Supplied)
2. **Training:** Sales reps must understand decision flowchart
3. **Audit Reports:** Flag orders using AL with no NWCA product sales
4. **Documentation:** This file serves as the single source of truth

---

## See Also
- [`/calculators/embroidery-pricing-all/`](../calculators/embroidery-pricing-all/) - Staff pricing reference page
- [`EMBROIDERY_PRICING_2026.md`](./EMBROIDERY_PRICING_2026.md) - Technical pricing details
- [`EMBROIDERY_QUOTE_BUILDER.md`](./EMBROIDERY_QUOTE_BUILDER.md) - Quote builder implementation
