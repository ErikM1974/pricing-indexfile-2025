const {test,expect}=require('@playwright/test');
const {open,check}=require('./helpers/contract-calculators-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
const original=process.env.CHECK_CONTRACT_ORIGINAL==='1';
for(const failed of [false,true])test('CSS contract controls: DTG policy labels '+(failed?'unavailable':'follow API'),async({page})=>{
 const e=await open(page,{original,failed,url:'/calculators/dtg-contract/index.html?qty=12&locs=LC&hw=1'});
 if(failed){await expect(page.locator('#pricingError')).toBeVisible();await expect(page.locator('#tableLtmNote')).toHaveText('Small-order fee unavailable until pricing loads.');}
 else {await expect(page.locator('#unitSub')).toContainText('+ HW $1.75');await expect(page.locator('#tableLtmNote')).toHaveText('LTM fee $37.00 ÷ 12 pcs = adds +$3.08/pc on this order');await expect(page.locator('[data-contract-hw]').first()).toHaveText('$1.75');await expect(page.locator('[data-contract-ltm]')).toHaveText('$37.00');await expect(page.locator('#ppBreakdownList li').filter({hasText:'Heavyweight upcharge'}).locator('.pp-val')).toHaveText('$1.75');}
 check(expect,e);
});
for(const kind of ['dtg','embroidery'])test('CSS contract controls: '+kind+' assistant confines and restores focus',async({page})=>{
 const e=await open(page,{original,chat:true,url:'/calculators/'+kind+'-contract/index.html?qty=24&locs=LC'});
 await expect(page.locator('#priceTable tbody tr').first()).toContainText('$');
 const trigger=page.locator('#aiDraftBtn');await trigger.focus();await page.keyboard.press('Enter');
 await expect(page.locator('#aiChatMessages')).toContainText('Synthetic quote assistant.');await expect(page.locator('#aiChatSend')).toBeEnabled();
 await page.locator('#aiChatSend').focus();await page.keyboard.press('Tab');await expect(page.locator('#aiChatClose')).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#aiChatSend')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#aiChatPanel')).toBeHidden();await expect(trigger).toBeFocused();await expect(page.locator('main')).not.toHaveAttribute('inert');
 check(expect,e);
});
test('CSS contract controls: embroidery product and table keyboard selection',async({page})=>{
 const e=await open(page,{original,url:'/calculators/embroidery-contract/index.html'});await expect(page.locator('#priceTable tbody tr').first()).toContainText('$');
 const garment=page.locator('#segItemType button').first(),cap=page.locator('#segItemType button').nth(1);
 await garment.focus();await page.keyboard.press('ArrowRight');await expect(cap).toBeFocused();await expect(cap).toHaveAttribute('aria-pressed','true');await expect(page.locator('#resProductLabel')).toHaveText('Cap');
 const table=page.locator('#tableTabs button').first();await table.focus();await page.keyboard.press('End');await expect(page.locator('#cardTitle')).toHaveText('Full Back Embroidery');
 await page.setViewportSize({width:320,height:900});const region=page.locator('.contract-table-scroll').first();await region.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);check(expect,e);
});

for(const minimum of [250,333.33,null])test('CSS contract controls: price-list footer minimum '+minimum,async({page})=>{
 const e=await open(page,{minimum,failedMin:minimum===null,url:'/pages/embroidery-contract-pricing.html'});await expect(page.locator('#garmentsTableBody tr')).toHaveCount(14);
 await expect(page.locator('.page-footer p')).toHaveText('Pricing effective September 2, 2026 — '+(minimum===null?'order minimum not loaded — confirm before quoting.':'$'+minimum.toFixed(2)+' order minimum on every contract order'));check(expect,e);
});
