'use strict';
const EmbroideryPricingCalculator = require('../shared_components/js/embroidery-quote-pricing');

const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const normalize = (value) =>
    String(value || '')
        .trim()
        .toLowerCase();

// Reuse the quote builder's calculation rather than maintain another price formula.
// Quantity remains ONE; the campaign deliberately grants the tier containing EIGHT.
async function priceColor({ bundle, sizePricing, color, decorated = true }) {
    const tiers = bundle?.tiersR?.filter(
        (row) => Number(row.MinQuantity) <= 8 && Number(row.MaxQuantity) >= 8
    );
    if (
        tiers?.length !== 1 ||
        !positive(tiers[0].MarginDenominator) ||
        tiers[0].MarginDenominator > 1
    )
        throw new Error('The current 8-piece pricing tier is unavailable.');
    const tier = tiers[0];
    const costs = bundle.allEmbroideryCostsR?.filter(
        (row) =>
            row.ItemType === 'Shirt' &&
            Number(row.StitchCount) === 8000 &&
            row.TierLabel === tier.TierLabel
    );
    if (decorated && (costs?.length !== 1 || !nonnegative(costs[0].EmbroideryCost)))
        throw new Error('The current embroidery cost is unavailable.');
    const rounding = bundle.rulesR?.RoundingMethod;
    if (!['HalfDollarUp', 'HalfDollarCeil_Final', 'CeilDollar'].includes(rounding))
        throw new Error('The current rounding rule is unavailable.');
    const row = sizePricing?.find(
        (item) =>
            normalize(item.color) === normalize(color.CATALOG_COLOR) ||
            normalize(item.color) === normalize(color.COLOR_NAME)
    );
    if (
        !row?.basePrices ||
        !row.sizeUpcharges ||
        !Object.keys(row.basePrices).length ||
        Object.values(row.basePrices).some((value) => !positive(value)) ||
        Object.values(row.sizeUpcharges).some((value) => !nonnegative(value))
    )
        throw new Error('Current color and size pricing is unavailable.');
    /** @type {InstanceType<typeof EmbroideryPricingCalculator>} */
    const calculator = Object.create(EmbroideryPricingCalculator.prototype);
    calculator.roundingMethod = rounding;
    calculator.getTier = () => tier.TierLabel;
    calculator.getMarginDenominator = () => tier.MarginDenominator;
    calculator.getEmbroideryCost = () => (decorated ? costs[0].EmbroideryCost : 0);
    calculator.fetchSizePricing = async () => [row];
    const bySize = {};
    for (const size of Object.keys(row.basePrices)) {
        const result = await calculator.calculateProductPrice(
            { style: row.styleNumber, color: row.color, sizeBreakdown: { [size]: 1 } },
            8
        );
        const amount = result?.lineItems?.[0]?.unitPrice;
        if (!positive(amount)) throw new Error('An item price could not be verified.');
        bySize[size] = amount;
    }
    return {
        bySize,
        tier: tier.TierLabel,
        stitchCount: decorated ? 8000 : 0,
        decorated,
        minimum: Math.min(...Object.values(bySize)),
    };
}
module.exports = { priceColor };
