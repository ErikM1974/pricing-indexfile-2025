/** Typed boundary for the existing browser/Node embroidery calculator.
 * Describes the calculation API used by the holiday server adapter. The JS
 * implementation remains canonical; this declaration contains no price rules. */
declare class EmbroideryPricingCalculator {
    roundingMethod: 'HalfDollarUp' | 'HalfDollarCeil_Final' | 'CeilDollar';
    getTier(quantity: number): string;
    getMarginDenominator(tier: string): number;
    getEmbroideryCost(quantity: number): number;
    fetchSizePricing(style: string): Promise<Array<{
        styleNumber: string;
        color: string;
        basePrices: Record<string, number>;
        sizeUpcharges: Record<string, number>;
    }>>;
    calculateProductPrice(product: {
        style: string;
        color: string;
        sizeBreakdown: Record<string, number>;
    }, quantity: number): Promise<{ lineItems: Array<{ unitPrice: number }> }>;
}
export = EmbroideryPricingCalculator;
