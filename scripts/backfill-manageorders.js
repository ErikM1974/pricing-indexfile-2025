/**
 * backfill-manageorders.js
 * Pull ManageOrders data and write CSVs for Caspio import.
 *
 * Usage: node scripts/backfill-manageorders.js
 *
 * Creates:
 *   caspio-import/ManageOrders_Orders.csv
 *   caspio-import/ManageOrders_LineItems.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const OUTPUT_DIR = path.join(__dirname, '..', 'caspio-import');

const START_DATE = '2026-03-25';
const END_DATE = '2026-03-29';

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val)
    .replace(/[\t\r\n]/g, ' ')  // Replace tabs/newlines with spaces
    .replace(/[^\x20-\x7E]/g, '') // Strip non-ASCII chars (bullets, em dashes, etc.)
    .trim();
  // Always quote strings to be safe
  return `"${str.replace(/"/g, '""')}"`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  return isoStr.replace('T', ' ').replace('.000Z', '');
}

async function main() {
  console.log(`=== ManageOrders Backfill: ${START_DATE} to ${END_DATE} ===\n`);

  // 1. Pull orders
  console.log('Pulling orders...');
  const ordersData = await fetchJSON(
    `${PROXY_BASE}/api/manageorders/orders?date_Ordered_start=${START_DATE}&date_Ordered_end=${END_DATE}`
  );
  const orders = ordersData.result || [];
  console.log(`  Found ${orders.length} orders`);

  // 2. Write Orders CSV
  const orderFields = [
    'id_Order', 'id_Customer', 'CustomerName', 'CustomerServiceRep',
    'ContactFirstName', 'ContactLastName', 'ContactEmail', 'ContactPhone',
    'CustomerPurchaseOrder', 'DesignName', 'id_Design',
    'date_Ordered', 'date_Invoiced', 'date_RequestedToShip', 'date_Shipped', 'date_Produced',
    'TotalProductQuantity',
    'cur_SubTotal', 'cur_SalesTaxTotal', 'cur_TotalInvoice', 'cur_Shipping', 'cur_Payments', 'cur_Balance',
    'TermsName',
    'sts_Invoiced', 'sts_Paid', 'sts_Produced', 'sts_Shipped',
    'Last_Sync_Date'
  ];

  const now = new Date().toISOString();
  let ordersCsv = orderFields.join(',') + '\n';

  for (const o of orders) {
    const row = [
      o.id_Order,
      o.id_Customer,
      escapeCsv(o.CustomerName),
      escapeCsv(o.CustomerServiceRep),
      escapeCsv(o.ContactFirstName),
      escapeCsv(o.ContactLastName),
      escapeCsv(o.ContactEmail),
      escapeCsv(o.ContactPhone),
      escapeCsv(o.CustomerPurchaseOrder),
      escapeCsv(o.DesignName),
      o.id_Design || '',
      formatDate(o.date_Ordered),
      formatDate(o.date_Invoiced),
      formatDate(o.date_RequestedToShip),
      formatDate(o.date_Shippied), // Note: ManageOrders typo
      formatDate(o.date_Produced),
      o.TotalProductQuantity || 0,
      o.cur_SubTotal || 0,
      o.cur_SalesTaxTotal || 0,
      o.cur_TotalInvoice || 0,
      o.cur_Shipping || 0,
      o.cur_Payments || 0,
      o.cur_Balance || 0,
      escapeCsv(o.TermsName),
      o.sts_Invoiced || '',
      o.sts_Paid || '',
      o.sts_Produced || '',
      o.sts_Shipped || '',
      now
    ];
    ordersCsv += row.join(',') + '\n';
  }

  const ordersPath = path.join(OUTPUT_DIR, 'ManageOrders_Orders.csv');
  fs.writeFileSync(ordersPath, ordersCsv);
  console.log(`  Wrote ${ordersPath} (${orders.length} rows)`);

  // 3. Pull line items for each order
  console.log('\nPulling line items...');
  const lineItemFields = [
    'id_Order', 'PartNumber', 'PartDescription', 'PartColor',
    'LineQuantity', 'LineUnitPrice', 'SortOrder',
    'Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06'
  ];

  let lineItemsCsv = lineItemFields.join(',') + '\n';
  let totalItems = 0;
  let batchCount = 0;

  for (const o of orders) {
    try {
      const itemsData = await fetchJSON(
        `${PROXY_BASE}/api/manageorders/lineitems/${o.id_Order}`
      );
      const items = itemsData.result || [];

      for (const li of items) {
        const row = [
          li.id_order || o.id_Order,
          escapeCsv(li.PartNumber),
          escapeCsv(li.PartDescription),
          escapeCsv(li.PartColor),
          li.LineQuantity || 0,
          li.LineUnitPrice || 0,
          li.SortOrder || 0,
          li.Size01 || '',
          li.Size02 || '',
          li.Size03 || '',
          li.Size04 || '',
          li.Size05 || '',
          li.Size06 || ''
        ];
        lineItemsCsv += row.join(',') + '\n';
        totalItems++;
      }

      batchCount++;
      if (batchCount % 10 === 0) {
        console.log(`  Processed ${batchCount}/${orders.length} orders (${totalItems} items so far)`);
      }

      // Rate limiting — 200ms between calls
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      if (err.message.includes('429')) {
        console.log(`  Rate limited at order ${o.id_Order}, waiting 60s...`);
        await new Promise(r => setTimeout(r, 61000));
        // Retry
        try {
          const retry = await fetchJSON(
            `${PROXY_BASE}/api/manageorders/lineitems/${o.id_Order}`
          );
          for (const li of (retry.result || [])) {
            const row = [
              li.id_order || o.id_Order,
              escapeCsv(li.PartNumber),
              escapeCsv(li.PartDescription),
              escapeCsv(li.PartColor),
              li.LineQuantity || 0,
              li.LineUnitPrice || 0,
              li.SortOrder || 0,
              li.Size01 || '',
              li.Size02 || '',
              li.Size03 || '',
              li.Size04 || '',
              li.Size05 || '',
              li.Size06 || ''
            ];
            lineItemsCsv += row.join(',') + '\n';
            totalItems++;
          }
        } catch (retryErr) {
          console.error(`  Failed retry for order ${o.id_Order}: ${retryErr.message}`);
        }
      } else {
        console.error(`  Error for order ${o.id_Order}: ${err.message}`);
      }
    }
  }

  const lineItemsPath = path.join(OUTPUT_DIR, 'ManageOrders_LineItems.csv');
  fs.writeFileSync(lineItemsPath, lineItemsCsv);
  console.log(`\n  Wrote ${lineItemsPath} (${totalItems} rows)`);

  console.log('\n=== DONE ===');
  console.log(`Orders: ${orders.length}`);
  console.log(`Line Items: ${totalItems}`);
  console.log(`\nImport into Caspio:`);
  console.log(`  1. ${ordersPath}`);
  console.log(`  2. ${lineItemsPath}`);
}

main().catch(console.error);
