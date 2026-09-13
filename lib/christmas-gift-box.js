'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateCampaign, inventorySizes } = require('../calculators/js/christmas-campaign');
const { priceColor } = require('./christmas-pricing');
const TYPES = { jacket: 'jackets', hoodie: 'hoodies', beanie: 'beanies', gloves: 'gloves' };
const cents = (amount) => Math.round(amount * 100);
const escape = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
function problem(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

module.exports = function createHolidayService(ctx) {
    const { makeApiRequest, mintShareToken, quoteShareUrl, sendEmailJSTemplate } = ctx;
    const readCampaign =
        ctx.readCampaign ||
        (() =>
            validateCampaign(
                JSON.parse(
                    fs.readFileSync(
                        path.join(__dirname, '../config/christmas-campaign.json'),
                        'utf8'
                    )
                )
            ));
    const now = ctx.now || Date.now;
    const secret = () => ctx.signingSecret || process.env.SESSION_SECRET;
    const giftHash = () => ctx.giftCodeHash || process.env.CHRISTMAS_GIFT_CODE_SHA256 || '';
    const active = () => {
        const campaign = readCampaign();
        if (now() >= Date.parse(campaign.closesAt))
            throw problem(
                'This holiday offer has ended. Contact our team for current options.',
                410
            );
        return campaign;
    };
    const catalogCache = new Map();
    const running = new Map();
    async function fees() {
        const campaign = readCampaign();
        const result = await makeApiRequest('/service-codes?refresh=true');
        if (!Array.isArray(result?.data))
            throw problem('Current gift-box charges are unavailable.', 503);
        const charge = (code) => {
            const rows = result.data.filter(
                (row) =>
                    row.ServiceCode === code &&
                    row.IsActive === true &&
                    row.PricingMethod === 'FLAT'
            );
            if (
                rows.length !== 1 ||
                typeof rows[0].SellPrice !== 'number' ||
                !Number.isFinite(rows[0].SellPrice) ||
                rows[0].SellPrice < 0
            )
                throw problem('Current gift-box charges are unavailable.', 503);
            return rows[0].SellPrice;
        };
        return {
            box: charge(campaign.boxServiceCode),
            shipping: charge(campaign.shippingServiceCode),
        };
    }
    function sign(payload, purpose) {
        if (!secret()) throw problem('Gift-box requests are temporarily unavailable.', 503);
        const body = Buffer.from(JSON.stringify({ ...payload, purpose })).toString('base64url');
        const key = purpose === 'gift' ? secret() + ':' + giftHash() : secret();
        return (
            body +
            '.' +
            crypto
                .createHmac('sha256', key)
                .update('holiday:' + body)
                .digest('base64url')
        );
    }
    function verify(token, purpose) {
        if (typeof token !== 'string' || token.length > 12000)
            throw problem('Please refresh your gift-box estimate.');
        const [body, supplied, extra] = token.split('.');
        if (!body || !supplied || extra || !secret())
            throw problem('Please refresh your gift-box estimate.');
        const key = purpose === 'gift' ? secret() + ':' + giftHash() : secret();
        const expected = crypto
            .createHmac('sha256', key)
            .update('holiday:' + body)
            .digest('base64url');
        if (
            supplied.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
        )
            throw problem('Please refresh your gift-box estimate.');
        let data;
        try {
            data = JSON.parse(Buffer.from(body, 'base64url').toString());
        } catch {
            throw problem('Please refresh your gift-box estimate.');
        }
        if (
            data.purpose !== purpose ||
            !Number.isFinite(data.expiresAt) ||
            now() >= data.expiresAt ||
            data.campaignId !== active().id
        )
            throw problem('Your estimate or gift code needs to be refreshed.');
        return data;
    }
    function validateCode(code) {
        const campaign = active();
        if (!/^[a-f0-9]{64}$/i.test(giftHash()))
            throw problem(
                'Gift-code redemption is temporarily unavailable. Please contact our team.',
                503
            );
        if (typeof code !== 'string' || !code.trim() || code.length > 80)
            throw problem('Enter your invitation code.');
        const actual = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(giftHash().toLowerCase())))
            throw problem('That gift code was not recognized. Check it and try again.');
        return {
            applied: true,
            promotionToken: sign(
                {
                    campaignId: campaign.id,
                    expiresAt: Math.min(now() + 30 * 60 * 1000, Date.parse(campaign.closesAt)),
                },
                'gift'
            ),
        };
    }
    function featured(style) {
        const campaign = readCampaign();
        for (const [type, category] of Object.entries(TYPES)) {
            const item = campaign.products[category].find((row) => row.style === style);
            if (item) return { ...item, type };
        }
        throw problem('That product is not part of the current holiday collection.');
    }
    async function product(style, fresh = false) {
        const item = featured(style);
        const cached = catalogCache.get(style);
        if (!fresh && cached && now() - cached.at < 60000) return { ...cached.value, ...item };
        const [data, bundle, sizes] = await Promise.all([
            makeApiRequest('/product-colors?styleNumber=' + encodeURIComponent(style)),
            makeApiRequest('/pricing-bundle?method=EMB&styleNumber=' + encodeURIComponent(style)),
            makeApiRequest('/size-pricing?styleNumber=' + encodeURIComponent(style)),
        ]);
        const colors = data?.colors?.filter(
            (color) =>
                !item.excludedColors.some((excluded) =>
                    [color.COLOR_NAME, color.CATALOG_COLOR].some(
                        (name) => String(name || '').toLowerCase() === excluded.toLowerCase()
                    )
                )
        );
        if (!colors?.length || !Array.isArray(sizes))
            throw problem('Current product options are unavailable.', 503);
        const priced = [];
        for (const color of colors) {
            try {
                const pricing = await priceColor({
                    bundle,
                    sizePricing: sizes,
                    color,
                    decorated: item.type !== 'gloves',
                });
                priced.push({ ...color, pricing });
            } catch {
                /* An unpriceable color remains visible but cannot be ordered. */
                priced.push({ ...color, pricing: null });
            }
        }
        if (!priced.some((color) => color.pricing))
            throw problem('Current 8-piece pricing is unavailable for this product.', 503);
        const value = {
            ...item,
            colors: priced,
            description: data.PRODUCT_DESCRIPTION || data.description || '',
            minimum: Math.min(
                ...priced.filter((color) => color.pricing).map((color) => color.pricing.minimum)
            ),
        };
        catalogCache.set(style, { at: now(), value });
        return value;
    }
    function selections(body) {
        if (
            !body ||
            !Array.isArray(body.items) ||
            body.items.length !== 4 ||
            !['Ship', 'Pickup'].includes(body.deliveryMethod)
        )
            throw problem('Choose all four products and a delivery method.');
        return Object.keys(TYPES).map((type) => {
            const matches = body.items.filter((item) => item?.type === type);
            if (matches.length !== 1) throw problem('Choose one product from each category.');
            const item = matches[0];
            if (
                typeof item.style !== 'string' ||
                featured(item.style).type !== type ||
                typeof item.color !== 'string' ||
                item.color.length > 100 ||
                typeof item.size !== 'string' ||
                item.size.length > 30
            )
                throw problem('A product selection is invalid.');
            return { type, style: item.style, color: item.color, size: item.size };
        });
    }
    async function estimate(body, fresh = false) {
        const campaign = active(),
            selected = selections(body);
        const complimentary = Boolean(body.promotionToken && verify(body.promotionToken, 'gift'));
        const items = [];
        for (const selectedItem of selected) {
            const item = await product(selectedItem.style, fresh);
            const color = item.colors.find(
                (color) => (color.CATALOG_COLOR || color.COLOR_NAME) === selectedItem.color
            );
            const priceSize =
                selectedItem.size === 'XXL' && !color?.pricing?.bySize.XXL
                    ? '2XL'
                    : selectedItem.size;
            const unitPrice = color?.pricing?.bySize[priceSize];
            if (typeof unitPrice !== 'number' || unitPrice <= 0)
                throw problem(
                    'Current pricing could not be verified for a selected color or size.',
                    503
                );
            items.push({
                ...selectedItem,
                name: item.brand + ' ' + item.name,
                colorName: color.COLOR_NAME || color.CATALOG_COLOR,
                unitPrice,
                tier: color.pricing.tier,
                stitchCount: color.pricing.stitchCount,
                image: color.MAIN_IMAGE_URL || color.FRONT_MODEL || color.FRONT_FLAT || '',
            });
        }
        const charges = await fees();
        const merchandise =
            items.reduce((sum, item) => sum + cents(item.unitPrice), 0) + cents(charges.box);
        const shipping = body.deliveryMethod === 'Ship' ? cents(charges.shipping) : 0;
        const result = {
            items,
            box: charges.box,
            shipping: shipping / 100,
            subtotal: merchandise / 100,
            referenceTotal: (merchandise + shipping) / 100,
            discount: complimentary ? (merchandise + shipping) / 100 : 0,
            total: complimentary ? 0 : (merchandise + shipping) / 100,
            complimentary,
            taxPending: !complimentary,
        };
        const signature = {
            campaignId: campaign.id,
            expiresAt: Math.min(now() + 10 * 60 * 1000, Date.parse(campaign.closesAt)),
            selections: selected,
            deliveryMethod: body.deliveryMethod,
            complimentary,
            total: result.total,
        };
        return { ...result, estimateToken: sign(signature, 'estimate') };
    }
    function contact(data, enforceLeadTime = true) {
        const result = {};
        const required = ['firstName', 'lastName', 'company', 'email', 'phone', 'dueDate'];
        for (const key of [
            ...required,
            'shippingAddress',
            'shippingAddress2',
            'shippingCity',
            'shippingState',
            'shippingZip',
            'jacketEmbLocation',
            'hoodieEmbLocation',
            'threadColors',
            'specialInstructions',
            'holidayTeamSize',
            'holidayGiftDate',
            'imageUpload',
        ]) {
            const value = data?.[key] ?? '';
            // Combined name/address fields in Quote_Sessions are TEXT255.
            const limit = key === 'specialInstructions' ? 2000 :
                ['firstName', 'lastName'].includes(key) ? 100 :
                ['shippingAddress', 'shippingAddress2'].includes(key) ? 120 : 200;
            if (
                typeof value !== 'string' ||
                value.length > limit ||
                (required.includes(key) && !value.trim())
            )
                throw problem('Complete your contact and delivery details.');
            result[key] = value.trim();
        }
        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) ||
            result.phone.replace(/\D/g, '').length !== 10
        )
            throw problem('Enter a valid email and 10-digit phone number.');
        if (
            !['left-chest', 'right-chest'].includes(result.jacketEmbLocation) ||
            !['left-chest', 'right-chest'].includes(result.hoodieEmbLocation)
        )
            throw problem('Choose a supported embroidery location.');
        if (
            result.holidayTeamSize &&
            (!/^\d{1,6}$/.test(result.holidayTeamSize) ||
                Number(result.holidayTeamSize) < 1 ||
                Number(result.holidayTeamSize) > 100000)
        )
            throw problem('Enter a valid team size.');
        const validDate = (value) =>
            /^\d{4}-\d{2}-\d{2}$/.test(value) &&
            Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
            new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
        if (
            !validDate(result.dueDate) ||
            (result.holidayGiftDate && !validDate(result.holidayGiftDate))
        )
            throw problem('Choose a valid requested delivery date.');
        const requested = Date.parse(result.dueDate + 'T00:00:00Z');
        const pacificToday = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(now());
        const minimumDate = Date.parse(pacificToday + 'T00:00:00Z') + 14 * 86400000;
        const day = new Date(requested).getUTCDay();
        if ([0, 6].includes(day) || (enforceLeadTime && requested < minimumDate))
            throw problem('Choose a weekday at least two weeks away.');
        return result;
    }
    async function rows(endpoint) {
        const result = await makeApiRequest(endpoint);
        if (!Array.isArray(result))
            throw problem('The request store could not be verified. Please retry.', 503);
        return result;
    }
    async function submit(body) {
        if (
            !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
                body?.requestKey || ''
            ) ||
            body.website
        )
            throw problem('Refresh the page before sending your request.');
        const quoteID =
            'XMAS-' +
            crypto
                .createHash('sha256')
                .update(body.requestKey)
                .digest('hex')
                .slice(0, 28)
                .toUpperCase();
        const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
        if (running.has(quoteID)) {
            const pending = running.get(quoteID);
            if (pending.bodyHash !== bodyHash)
                throw problem(
                    'A request with this reference is already saving. Resume its original details.',
                    409
                );
            return pending.work;
        }
        const work = save(body, quoteID).finally(() => running.delete(quoteID));
        running.set(quoteID, { bodyHash, work });
        return work;
    }
    async function save(body, quoteID) {
        const existing = await rows('/quote_sessions?quoteID=' + quoteID);
        if (existing.length > 1)
            throw problem(
                'This request needs staff review. Please contact us with reference ' +
                    quoteID +
                    '.',
                409
            );
        let selected, customer;
        try {
            selected = selections(body);
            customer = contact(body.customer, !existing.length);
            if (
                body.deliveryMethod === 'Ship' &&
                (!customer.shippingAddress ||
                    !customer.shippingCity ||
                    !/^[A-Z]{2}$/.test(customer.shippingState) ||
                    !/^\d{5}(-\d{4})?$/.test(customer.shippingZip))
            )
                throw problem('Complete your shipping address.');
        } catch (error) {
            if (!existing.length) error.canRevise = true;
            throw error;
        }
        const fingerprint = crypto
            .createHash('sha256')
            .update(JSON.stringify({ selected, customer, deliveryMethod: body.deliveryMethod }))
            .digest('hex');
        let session = existing[0],
            state;
        if (session) {
            try {
                state = JSON.parse(session.OrderSettingsJSON);
            } catch {
                throw problem('This request needs staff review.', 409);
            }
            if (state.source !== 'holiday-gift-box' || state.fingerprint !== fingerprint)
                throw problem(
                    'Your selections changed after a save began. Contact us with reference ' +
                        quoteID +
                        ' to amend that request.',
                    409
                );
        } else {
            let current, campaign;
            try {
                const accepted = verify(body.estimateToken, 'estimate');
                current = await estimate(body, true);
                if (
                    JSON.stringify(accepted.selections) !== JSON.stringify(selected) ||
                    accepted.deliveryMethod !== body.deliveryMethod ||
                    accepted.complimentary !== current.complimentary ||
                    cents(accepted.total) !== cents(current.total)
                )
                    throw problem(
                        'Pricing changed. Review your refreshed estimate before sending the request.',
                        409
                    );
                for (const item of current.items) {
                    const stock = await makeApiRequest(
                        '/sanmar/inventory/' +
                            item.style +
                            '?color=' +
                            encodeURIComponent(item.color)
                    );
                    const sizes = inventorySizes(stock, item.style, {
                        CATALOG_COLOR: item.color,
                        COLOR_NAME: item.colorName,
                    });
                    if (!sizes.some((size) => size.size === item.size && size.quantity > 0))
                        throw problem(
                            item.name +
                                ' is no longer available in that color and size. Please choose another option.',
                            409
                        );
                }
                campaign = active();
            } catch (error) {
                error.canRevise = true;
                throw error;
            }
            state = {
                source: 'holiday-gift-box',
                campaignId: campaign.id,
                campaignYear: campaign.year,
                fingerprint,
                customer,
                deliveryMethod: body.deliveryMethod,
                requestType: current.complimentary ? 'complimentary-sample' : 'public-priced',
                pricing: current,
                customerEmailSent: false,
                salesEmailSent: false,
            };
            delete state.pricing.estimateToken;
            session = {
                QuoteID: quoteID,
                SessionID: quoteID,
                Status: 'Draft',
                ProjectName: 'Holiday Gift Box ' + campaign.year,
                CustomerName: customer.firstName + ' ' + customer.lastName,
                CustomerEmail: customer.email,
                CompanyName: customer.company,
                SalesRepEmail: 'sales@nwcustomapparel.com',
                SalesRepName: 'NWCA Sales',
                TotalQuantity: 4,
                Phone: customer.phone,
                PaymentTerms:
                    'Request summary only. No payment is due. Staff will confirm artwork, availability, delivery, sales tax and any additional artwork charges before issuing a final quote or invoice.',
                SubtotalAmount: current.subtotal,
                TotalAmount: current.complimentary ? 0 : current.subtotal,
                ShippingFee: current.complimentary ? 0 : current.shipping,
                TaxRate: 0,
                TaxAmount: 0,
                PaidToDate: 0,
                Discount: current.complimentary ? current.subtotal : 0,
                DiscountReason: current.complimentary
                    ? 'Verified holiday sample invitation; shipping also waived'
                    : '',
                ShipToAddress: [customer.shippingAddress, customer.shippingAddress2]
                    .filter(Boolean)
                    .join('\n'),
                ShipToCity: customer.shippingCity,
                ShipToState: customer.shippingState,
                ShipToZip: customer.shippingZip,
                DropDeadDate: customer.dueDate,
                Notes: JSON.stringify({
                    source: state.source,
                    campaignYear: campaign.year,
                    requestType: state.requestType,
                    share_token: mintShareToken(),
                    taxPending: !current.complimentary,
                }),
                CustomerDataJSON: JSON.stringify(customer),
                OrderSettingsJSON: JSON.stringify(state),
                PriceAuditJSON: JSON.stringify(current),
                OrderTotalsJSON: JSON.stringify({
                    subtotal: current.subtotal,
                    shipping: current.shipping,
                    discount: current.discount,
                    total: current.total,
                    taxPending: !current.complimentary,
                }),
            };
            await makeApiRequest('/quote_sessions', 'POST', session);
            const saved = await rows('/quote_sessions?quoteID=' + quoteID);
            if (saved.length !== 1 || !Number.isInteger(Number(saved[0].PK_ID)))
                throw problem(
                    'The request save could not be confirmed. Retry with the same reference.',
                    503
                );
            session = saved[0];
        }
        const savedItems = await rows('/quote_items?quoteID=' + quoteID);
        const pricing = state.pricing;
        const expectedItems = pricing.items.map((item, index) => ({
            QuoteID: quoteID,
            LineNumber: index + 1,
            StyleNumber: item.style,
            ProductName: item.name,
            Color: item.colorName,
            ColorCode: item.color,
            Quantity: 1,
            SizeBreakdown: JSON.stringify({ [item.size]: 1 }),
            BaseUnitPrice: item.unitPrice,
            FinalUnitPrice: item.unitPrice,
            LineTotal: item.unitPrice,
            PricingTier: item.tier,
            EmbellishmentType: item.type === 'gloves' ? 'blank' : 'embroidery',
            ImageURL: item.image,
            EmbroideryLocation:
                item.type === 'jacket'
                    ? customer.jacketEmbLocation
                    : item.type === 'hoodie'
                      ? customer.hoodieEmbLocation
                      : item.type === 'beanie'
                        ? 'front-center'
                        : '',
            Image_Upload: customer.imageUpload,
            Thread_Colors: customer.threadColors,
            LogoSpecs: JSON.stringify({
                location:
                    item.type === 'jacket'
                        ? customer.jacketEmbLocation
                        : item.type === 'hoodie'
                          ? customer.hoodieEmbLocation
                          : item.type === 'beanie'
                            ? 'front-center'
                            : '',
                stitchCount: item.stitchCount,
                notes: customer.specialInstructions,
            }),
            Notes: 'Holiday box: one sample item. Final artwork and availability need staff confirmation.',
        }));
        expectedItems.push({
            QuoteID: quoteID,
            LineNumber: 5,
            StyleNumber: 'XMAS-BOX',
            ProductName: 'Holiday gift box',
            Quantity: 1,
            FinalUnitPrice: pricing.box,
            LineTotal: pricing.box,
            EmbellishmentType: 'fee',
        });
        expectedItems.push({
            QuoteID: quoteID,
            LineNumber: 6,
            StyleNumber: 'SHIP',
            ProductName: state.deliveryMethod === 'Ship' ? 'Shipping' : 'Factory pickup',
            Quantity: 1,
            FinalUnitPrice: pricing.complimentary ? 0 : pricing.shipping,
            LineTotal: pricing.complimentary ? 0 : pricing.shipping,
            EmbellishmentType: 'fee',
        });
        const itemMatches = (row, item) =>
            Object.entries(item).every(([key, value]) =>
                typeof value === 'number'
                    ? Number(row[key]) === value
                    : String(row[key] ?? '') === value
            );
        for (const item of expectedItems) {
            const matches = savedItems.filter((row) => Number(row.LineNumber) === item.LineNumber);
            if (matches.length > 1 || (matches.length === 1 && !itemMatches(matches[0], item)))
                throw problem(
                    'Saved item details need staff review. Reference ' + quoteID + '.',
                    409
                );
            if (!matches.length) await makeApiRequest('/quote_items', 'POST', item);
        }
        const completeItems = await rows('/quote_items?quoteID=' + quoteID);
        if (
            completeItems.length !== expectedItems.length ||
            expectedItems.some(
                (item) => completeItems.filter((row) => itemMatches(row, item)).length !== 1
            )
        )
            throw problem('Some items could not be confirmed. Retry this request.', 503);
        const update = (changes) =>
            makeApiRequest('/quote_sessions/' + session.PK_ID, 'PUT', changes);
        if (session.Status === 'Draft') {
            await update({ Status: 'Open' });
            session.Status = 'Open';
        }
        const url = quoteShareUrl(quoteID, session);
        const params = {
            customer_name: session.CustomerName,
            company_name: session.CompanyName,
            request_id: quoteID,
            request_url: url,
            request_type:
                state.requestType === 'complimentary-sample'
                    ? 'Complimentary sample — invitation verified'
                    : 'Holiday box — staff review and invoice',
            amount_label: pricing.complimentary
                ? 'Complimentary — $0.00'
                : '$' + pricing.total.toFixed(2) + ' estimated, before applicable sales tax',
            items_html:
                '<table role="presentation" width="100%">' +
                pricing.items
                    .map(
                        (item) =>
                            '<tr><td style="padding:8px 0">' +
                            escape(item.name) +
                            '<br>' +
                            escape(item.colorName) +
                            ' · ' +
                            escape(item.size) +
                            '</td></tr>'
                    )
                    .join('') +
                '</table>',
            delivery_details: state.deliveryMethod + '; requested date ' + customer.dueDate,
            customer_email: customer.email,
            customer_phone: customer.phone,
            planning_details:
                'Team size: ' +
                (customer.holidayTeamSize || 'Not specified') +
                '. Holiday date: ' +
                (customer.holidayGiftDate || 'Not specified'),
        };
        for (const [flag, template, destination] of [
            ['customerEmailSent', 'holiday_box_customer', customer.email],
            ['salesEmailSent', 'holiday_box_sales', 'sales@nwcustomapparel.com'],
        ]) {
            if (state[flag]) continue;
            state.emailDelivery ||= {};
            // A timeout can mean the provider accepted a message. Persist intent first;
            // never resend an uncertain delivery automatically on a customer retry.
            if (['sending', 'unknown'].includes(state.emailDelivery[flag])) continue;
            try {
                state.emailDelivery[flag] = 'sending';
                await update({ OrderSettingsJSON: JSON.stringify(state) });
                await sendEmailJSTemplate(template, { ...params, to_email: destination });
                const acknowledged = {
                    ...state,
                    [flag]: true,
                    emailDelivery: { ...state.emailDelivery, [flag]: 'sent' },
                };
                await update({ OrderSettingsJSON: JSON.stringify(acknowledged) });
                Object.assign(state, acknowledged);
            } catch (error) {
                state.emailDelivery[flag] = /^EmailJS HTTP 4\d\d:/.test(error.message || '')
                    ? 'failed'
                    : 'unknown';
                try {
                    await update({ OrderSettingsJSON: JSON.stringify(state) });
                } catch {
                    /* The previously saved sending marker still prevents automatic duplicates. */
                }
            }
        }
        return {
            saved: true,
            complete: state.customerEmailSent && state.salesEmailSent,
            quoteID,
            quoteUrl: url,
            pricing,
            customerEmailSent: state.customerEmailSent,
            salesEmailSent: state.salesEmailSent,
            emailRetryable: Object.values(state.emailDelivery || {}).includes('failed'),
            emailUncertain: Object.values(state.emailDelivery || {}).some((value) =>
                ['sending', 'unknown'].includes(value)
            ),
        };
    }
    return { readCampaign, product, validateCode, estimate, submit };
};
