/**
 * match-marketing-pos.js
 * One-time script to match 8 unmatched marketing fund POs to their ShopWorks orders.
 *
 * Uses the deployed proxy for ManageOrders queries.
 * Outputs matches that need to be updated in the SanMar_Orders Caspio table.
 *
 * Usage: node scripts/match-marketing-pos.js
 */

const PROXY_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// The 8 unmatched marketing POs with their items (from ShopWorks PO data)
const UNMATCHED_POS = [
  {
    sanmarPO: '112051',
    sanmarSO: '158611035',
    poDate: '2026-02-26',
    items: [
      { partNumber: '112_OSFA', color: 'Blk/Char', qty: 1 },
      { partNumber: '112_OSFA', color: 'Black', qty: 1 }
    ],
    knownOrder: 140924 // Manually confirmed - JM Corp & Son Inc
  },
  {
    sanmarPO: '112067',
    sanmarSO: '158653186',
    poDate: '2026-02-27',
    items: [
      { partNumber: 'CT102208', color: 'Black', qty: 1 },
      { partNumber: 'NF0A7V63', color: 'TNFBlack', qty: 1 }
    ],
    knownOrder: 140792 // Manually confirmed
  },
  {
    sanmarPO: '112283',
    sanmarSO: '159241065',
    poDate: '2026-03-18',
    items: [
      { partNumber: 'NKBQ5234', color: 'White', qty: 1 }
    ],
    knownOrder: 141116 // Manually confirmed
  },
  {
    sanmarPO: '112292',
    sanmarSO: '159258024',
    poDate: '2026-03-18',
    items: [
      { partNumber: 'BB18212', color: 'OatHthr', qty: 1 }
    ],
    knownOrder: 141116 // Manually confirmed
  },
  {
    sanmarPO: '112308',
    sanmarSO: '159280636',
    poDate: '2026-03-19',
    items: [
      { partNumber: '578673', color: 'Mid Ny Hthr/Ny', qty: 1 }
    ],
    knownOrder: 141182 // Verified - Forma Construction
  },
  {
    sanmarPO: '112309',
    sanmarSO: '159287447',
    poDate: '2026-03-19',
    items: [
      { partNumber: 'COTOW1692', color: 'Canyon/Mr', qty: 1 }
    ],
    knownOrder: 141183 // Verified - Forma Construction
  },
  {
    sanmarPO: '112312',
    sanmarSO: '159307307',
    poDate: '2026-03-19',
    items: [
      { partNumber: 'CT100617', color: 'Black', qty: 1 }
    ],
    knownOrder: 141186 // Verified - GNW Excavation
  },
  {
    sanmarPO: '112411',
    sanmarSO: '159526156',
    poDate: '2026-03-26',
    items: [
      { partNumber: 'CTK122', color: 'Black', qty: 1 },
      { partNumber: 'CTK122_2X', color: 'Black', qty: 1 }
    ],
    knownOrder: 141125 // Verified - Rainier Richlite
  }
];

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

/**
 * Get orders from ManageOrders for a date range
 */
async function getOrders(startDate, endDate) {
  const url = `${PROXY_BASE}/api/manageorders/orders?date_Ordered_start=${startDate}&date_Ordered_end=${endDate}`;
  const data = await fetchJSON(url);
  return data.result || [];
}

/**
 * Get line items for a specific order
 */
async function getLineItems(orderId) {
  const url = `${PROXY_BASE}/api/manageorders/lineitems/${orderId}`;
  const data = await fetchJSON(url);
  return data.result || [];
}

/**
 * Normalize color strings for comparison.
 * SanMar and ManageOrders may use slightly different color names.
 */
function normalizeColor(color) {
  if (!color) return '';
  return color.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Score how well a set of PO items matches an order's line items.
 * Matches on part number + color. Each PO item can only match one order line item.
 * Returns { matched, details } where matched is the count of PO items found.
 */
function scoreMatch(poItems, orderLineItems) {
  // Build a list of available order line items (track which are "used")
  const available = orderLineItems.map(li => ({
    partNumber: li.PartNumber,
    color: normalizeColor(li.PartColor),
    used: false
  }));

  let matched = 0;
  const details = [];

  for (const poItem of poItems) {
    const poColor = normalizeColor(poItem.color);
    // Find an unused order line item with matching part number AND color
    const idx = available.findIndex(a =>
      !a.used && a.partNumber === poItem.partNumber && a.color === poColor
    );

    if (idx >= 0) {
      available[idx].used = true;
      matched++;
      details.push(`${poItem.partNumber}/${poItem.color} -> MATCH`);
    } else {
      // Fallback: match on part number only (color might differ slightly)
      const idxPartOnly = available.findIndex(a =>
        !a.used && a.partNumber === poItem.partNumber
      );
      if (idxPartOnly >= 0) {
        available[idxPartOnly].used = true;
        matched += 0.5; // Partial credit for part-number-only match
        details.push(`${poItem.partNumber}/${poItem.color} -> PART ONLY (order has ${orderLineItems[idxPartOnly]?.PartColor})`);
      } else {
        details.push(`${poItem.partNumber}/${poItem.color} -> NO MATCH`);
      }
    }
  }

  return { matched, details };
}

/**
 * Find the best matching order for a marketing PO
 */
async function findMatchForPO(po) {
  console.log(`\n--- Matching PO ${po.sanmarPO} ---`);
  console.log(`  Items: ${po.items.map(i => i.partNumber).join(', ')}`);

  if (po.knownOrder) {
    // Fetch order details to get customer info
    try {
      const url = `${PROXY_BASE}/api/manageorders/orders/${po.knownOrder}`;
      const data = await fetchJSON(url);
      const order = (data.result || [])[0] || {};
      console.log(`  Known match: Order ${po.knownOrder} - ${order.CustomerName || '(unknown)'} (manually confirmed)`);
      await new Promise(r => setTimeout(r, 500));
      return {
        orderId: po.knownOrder,
        customerName: order.CustomerName || '',
        customerId: order.id_Customer || '',
        salesRep: order.CustomerServiceRep || '',
        score: po.items.length,
        total: po.items.length,
        method: 'manual-verified'
      };
    } catch {
      console.log(`  Known match: Order ${po.knownOrder} (manually confirmed, details fetch failed)`);
      return { orderId: po.knownOrder, score: po.items.length, total: po.items.length, method: 'manual' };
    }
  }

  // Search orders in a window: 14 days before PO date to PO date
  const poDate = new Date(po.poDate);
  const startDate = new Date(poDate);
  startDate.setDate(startDate.getDate() - 21);
  const endDate = new Date(poDate);
  endDate.setDate(endDate.getDate() + 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`  Searching orders from ${startStr} to ${endStr}...`);
  const orders = await getOrders(startStr, endStr);
  console.log(`  Found ${orders.length} orders in range`);

  let bestMatch = null;
  let bestScore = 0;
  const poPartNumbers = po.items.map(i => i.partNumber);

  // Check each order's line items
  for (const order of orders) {
    // Skip orders with 0 subtotal (likely internal/marketing orders themselves)
    // But don't skip if qty is small (marketing POs are often 1-2 items)

    let lineItems;
    try {
      lineItems = await getLineItems(order.id_Order);
    } catch (err) {
      continue;
    }

    const { matched: score, details } = scoreMatch(po.items, lineItems);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        orderId: order.id_Order,
        customerName: order.CustomerName,
        customerId: order.id_Customer,
        salesRep: order.CustomerServiceRep,
        score,
        total: po.items.length,
        lineItems: lineItems.map(li => `${li.PartNumber}/${li.PartColor}`),
        details
      };

      // Perfect match — all PO items found with matching part number + color
      if (score === po.items.length) {
        console.log(`  MATCH: Order ${order.id_Order} (${order.CustomerName}) - score ${score}/${po.items.length}`);
        details.forEach(d => console.log(`    ${d}`));
        return { ...bestMatch, method: 'auto-style-color-match' };
      }
    }

    // Rate limiting — small delay between ManageOrders calls
    await new Promise(r => setTimeout(r, 100));
  }

  if (bestMatch) {
    console.log(`  BEST PARTIAL: Order ${bestMatch.orderId} (${bestMatch.customerName}) - score ${bestScore}/${po.items.length}`);
    bestMatch.details.forEach(d => console.log(`    ${d}`));
    return { ...bestMatch, method: bestScore >= po.items.length * 0.5 ? 'partial-match' : 'weak-match' };
  }

  console.log(`  NO MATCH FOUND`);
  return null;
}

async function main() {
  console.log('=== Marketing PO Matching Script ===');
  console.log(`Processing ${UNMATCHED_POS.length} unmatched POs...\n`);

  const results = [];

  for (const po of UNMATCHED_POS) {
    try {
      const match = await findMatchForPO(po);
      results.push({
        sanmarPO: po.sanmarPO,
        sanmarSO: po.sanmarSO,
        match
      });
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({
        sanmarPO: po.sanmarPO,
        sanmarSO: po.sanmarSO,
        match: null,
        error: err.message
      });
    }
  }

  // Summary
  console.log('\n\n=== RESULTS SUMMARY ===');
  console.log('PO        | Order ID | Customer                    | Score | Method');
  console.log('----------|----------|-----------------------------+-------+------------------');

  for (const r of results) {
    if (r.match) {
      const cust = (r.match.customerName || '').padEnd(28).substring(0, 28);
      console.log(`${r.sanmarPO}    | ${String(r.match.orderId).padEnd(8)} | ${cust} | ${r.match.score}/${r.match.total}   | ${r.match.method}`);
    } else {
      console.log(`${r.sanmarPO}    | NO MATCH | ${r.error || 'No matching order found'}`.padEnd(80));
    }
  }

  // Output Caspio update commands
  console.log('\n\n=== CASPIO UPDATES NEEDED ===');
  console.log('Update SanMar_Orders table for each matched PO:\n');
  for (const r of results) {
    if (r.match && r.match.score === r.match.total) {
      console.log(`PO ${r.sanmarPO}: SET id_Order = '${r.match.orderId}', Company_Name = '${r.match.customerName || ''}', Sales_Rep = '${r.match.salesRep || ''}', id_Customer = '${r.match.customerId || ''}', Notes = 'Marketing Fund Order', Matched_By = '${r.match.method}'`);
    }
  }
}

main().catch(console.error);
