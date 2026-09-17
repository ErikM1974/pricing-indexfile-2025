const {test,expect}=require('@playwright/test');
const {open}=require('./helpers/quote-builders-browser');
const {evidence}=require('./helpers/quote-builder-workflow-review');
const AxeBuilder=require('@axe-core/playwright').default;
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1';
test.setTimeout(120000);
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});


async function addProduct(page,method,style='PC54'){
 if(method==='dtf')await page.waitForFunction(()=>document.getElementById('loading-overlay')?.style.display==='none');
 const search=page.locator('#product-search');await search.click();await search.pressSequentially(style,{delay:60});
 const row=page.locator('tr[data-style]').first(),suggestion=page.locator('.suggestion-item').first();
 await Promise.race([row.waitFor({state:'visible'}),suggestion.waitFor({state:'visible'})]);
 if(!await row.isVisible())await suggestion.click();await expect(row).toBeVisible();
 if(style==='C112'){await row.locator('.color-picker-selected').first().click();await row.locator('.color-picker-option').first().click();}
 const input=row.locator(style==='C112'?'.osfa-qty-input':'input[data-size="M"]');
 if(await input.isDisabled()){await row.locator('.color-picker-selected').first().click();await row.locator('.color-picker-option').first().click();}
 await input.fill('48');await input.dispatchEvent('change');
 if(method==='dtf'){await page.locator('.guided-step[data-step="1"]').click();await page.locator('input[name="front-location"][value="left-chest"]').check();await page.locator('.guided-step[data-step="0"]').click();}
 await expect.poll(()=>page.locator('#grand-total-with-tax,#grand-total').first().textContent()).not.toMatch(/^\s*\$0\.00\s*$/);
 await page.waitForLoadState('networkidle');
}

for(const method of ['embroidery','screenprint','dtf'])for(const scene of ['products','decoration','customer','review','workbench','colors','invoice','extended-sizes','customer-entered','save',...(method==='dtf'?['extended-error','extended-empty','extended-rate-limit']:[])])test('CSS quote builders: '+method+' '+scene,async({page,context})=>{
 page.setDefaultTimeout(15000);
 // The local-only schema assertion rejects intentional null draft IDs in SCP/DTF.
 // Use a fully intercepted synthetic production origin for their original draft output.
 const origin=scene==='invoice'&&method!=='embroidery'?'https://quote-builder.example.invalid':'';
 const e=await open(page,{original,realPreview:scene==='invoice'&&!original,save:scene==='save',url:origin+'/quote-builders/'+method+'-quote-builder.html'});
 if(method==='screenprint'){
  await expect(page.locator('#toast-container')).toContainText('Vellum rate is an estimate');
  await expect(page.locator('#toast-container')).toContainText('Color Chg rate is an estimate');
 }
 await addProduct(page,method);
 if(scene.startsWith('extended-')&&scene!=='extended-sizes')await page.evaluate(scene=>{
  window.ExtendedSizesConfig.getAvailableExtendedSizes=async()=>{
   if(scene==='extended-empty')return [];
   throw new Error(scene==='extended-rate-limit'?'RATE_LIMITED':'Synthetic extended-size failure');
  };
 },scene);
 if(scene==='colors')await page.locator('tr[data-style] .color-picker-selected').first().click();
 if(scene.startsWith('extended-')) {
  await page.locator('tr[data-style] .xxxl-picker-btn').first().click();
  if(scene!=='extended-sizes')await expect(page.locator(scene==='extended-empty'?'.ext-popup-empty':'.ext-popup-error')).toContainText(scene==='extended-empty'?'No extended sizes available':scene==='extended-rate-limit'?'Too many requests':'Unable to load extended sizes');
 }
 if(['decoration','customer','review'].includes(scene))await page.locator('.guided-step[data-step="'+({decoration:1,customer:2,review:3}[scene])+'"]').click();
 if(scene==='workbench')await page.locator('.guided-toggle').click();
 if(['invoice','customer-entered','save'].includes(scene)){
  await page.locator('.guided-step[data-step="2"]').click();
  if(!await page.locator('#customer-name').isVisible())await page.locator('.customer-manual summary').click();
  await page.locator('#customer-name').fill('Example Customer');await page.locator('#customer-email').fill('customer@example.invalid');
  if(scene==='customer-entered'){await page.locator('#company-name').fill('Example Company');await evidence(page,method+'-'+scene,e);return;}
  await page.locator('.guided-step[data-step="3"]').click();
  if(scene==='save'){await page.locator('.btn-share-link').click();await expect(page.locator('#quote-share-modal')).toBeVisible();await evidence(page,method+'-'+scene,e);return;}
  if(e.preparePrint)await e.preparePrint();
  const popup=context.waitForEvent('page',{timeout:15000});await page.locator('[data-call="printQuote"]').click();
  const invoice=await popup;await invoice.waitForLoadState('domcontentloaded');await invoice.waitForFunction(()=>document.body.innerText.includes('Example Customer'));
  if(!original)await expect.poll(()=>invoice.evaluate(()=>window.__printCalls)).toBe(1);
  await evidence(invoice,method+'-invoice',e);return;
 }
 await evidence(page,method+'-'+scene,e);
});

for(const scene of ['products','locations','fees','safety','recommendations','shipping-fields'])test('CSS quote builders: screenprint healthy-'+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,scpFees:true,safetyRecs:scene==='recommendations',url:'/quote-builders/screenprint-quote-builder.html'});
 await addProduct(page,'screenprint');
 if(scene==='locations'){
  await page.locator('.guided-step[data-step="1"]').click();
  await page.locator('#dark-garment-toggle').check();
  await page.locator('label.ink-btn').filter({has:page.locator('input[name="front-colors"][value="3"]')}).click();
  await page.locator('input[name="back-location"][value="FB"]').check();
  await page.locator('label.ink-btn').filter({has:page.locator('input[name="back-colors"][value="2"]')}).click();
  await page.locator('#left-sleeve-toggle').check();
  await page.locator('#right-sleeve-toggle').check();
 }
 if(scene==='fees'){
  await page.locator('.guided-step[data-step="0"]').click();
  await page.locator('[data-call="toggleFeesCharges"]').click();
  for(const [id,value] of [['graphic-design-hours','2'],['vellum-qty','3'],['color-change-qty','2'],['rush-fee','50']]){
   await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('change');
  }
 }
 if(scene==='safety'){
  await page.locator('.guided-step[data-step="1"]').click();await page.locator('#safety-stripes-toggle').check();
  await page.locator('.guided-toggle').click();
 }
 if(scene==='recommendations')await page.locator('#scp-safety-recs .ssr-head').click();
 if(scene==='shipping-fields'){
  await page.locator('.guided-step[data-step="3"]').click();
  await page.locator('[data-call="toggleOrderShippingPanel"]').click();
  await expect(page.locator('.os-po-number')).toBeVisible();
 }
 await page.waitForLoadState('networkidle');await evidence(page,'screenprint-healthy-'+scene,e);
});

for(const scene of ['locations','fees','shipping-fields'])test('CSS quote builders: dtf detailed-'+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,url:'/quote-builders/dtf-quote-builder.html'});
 await addProduct(page,'dtf');
 if(scene==='locations'){
  await page.locator('.guided-step[data-step="1"]').click();
  await page.locator('input[name="front-location"][value="full-front"]').check();
  await page.locator('input[name="back-location"][value="center-back"]').check();
  await page.locator('input[name="sleeve-location"][value="left-sleeve"]').check();
  await page.locator('input[name="sleeve-location"][value="right-sleeve"]').check();
 }
 if(scene==='fees'){
  await page.locator('[data-call="toggleFeesCharges"]').click();
  await page.locator('#art-charge-toggle').check();
  for(const [id,value] of [['graphic-design-hours','2'],['rush-fee','50']]){
   await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('change');
  }
 }
 if(scene==='shipping-fields'){
  await page.locator('.guided-step[data-step="3"]').click();
  await page.locator('[data-call="toggleOrderDetails"]').click();
  for(const [id,value] of [['po-number','SYNTHETIC-PO-17'],['ship-to-name','Example Recipient'],['ship-address','123 Example Street'],['ship-city','Example City'],['dtf-notes','Synthetic delivery instructions']])await page.locator('#'+id).fill(value);
  await page.locator('#ship-method').selectOption('Customer Pickup');
  await page.locator('#dtf-shipping-fee').fill('12.50');await page.locator('#dtf-shipping-fee').dispatchEvent('change');
 }
 await page.waitForLoadState('networkidle');await evidence(page,'dtf-detailed-'+scene,e);
});

for(const scene of ['import','shipping','design-gallery'])test('CSS quote builders: embroidery '+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,url:'/quote-builders/embroidery-quote-builder.html'});await addProduct(page,'embroidery');
 if(scene==='import')await page.locator('button[data-call="openShopWorksImportModal"]').click();
 if(scene==='shipping'){await page.locator('.guided-step[data-step="3"]').click();await page.locator('[data-call="openShippingModal"]').click();await page.locator('#ship-mode-ship').click();}
 if(scene==='design-gallery'){await page.locator('.guided-step[data-step="1"]').click();await page.locator('[data-call="openDesignSearchModal"]').first().click();}
 await evidence(page,'embroidery-'+scene,e);
});

for(const scene of ['caps','caps-puff','caps-patch','full-back','services-artwork','services-add-ons','services-supplied','assistant','save-failure'])test('CSS quote builders: embroidery '+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,assistant:scene==='assistant',save:scene==='save-failure',saveFailed:scene==='save-failure',url:'/quote-builders/embroidery-quote-builder.html'});
 await addProduct(page,'embroidery',scene.startsWith('caps')?'C112':'PC54');
 if(scene==='assistant')await page.locator('#floatingQuoteBtn').click();
 else if(scene==='save-failure'){
  await page.locator('.guided-step[data-step="2"]').click();await page.locator('.customer-manual summary').click();
  await page.locator('#customer-name').fill('Example Customer');await page.locator('#customer-email').fill('customer@example.invalid');
  await page.locator('.guided-step[data-step="3"]').click();await page.locator('.btn-share-link').click();
  await expect(page.locator('#quote-share-modal')).toBeHidden();await expect(page.locator('.btn-share-link')).toBeEnabled();
  await expect(page.locator('#toast-container')).toContainText('Error saving quote: Session save failed: {"error":"Synthetic save failure"}');
 } else {
  await page.locator('.guided-step[data-step="1"]').click();
  if(scene==='caps-puff')await page.locator('#cap-embellishment-type').selectOption('3d-puff');
  if(scene==='caps-patch')await page.locator('#cap-embellishment-type').selectOption('laser-patch');
  if(scene==='full-back'){
   await page.locator('#primary-position').selectOption('Full Back');
   await expect(page.locator('#toast-container')).toContainText('Full Back requires minimum 25,000 stitches');
  }
  if(scene.startsWith('services-'))await page.locator('.service-cat-btn').filter({hasText:{'services-artwork':'Artwork','services-add-ons':'Add-Ons','services-supplied':'Customer-Supplied'}[scene]}).click();
 }
 await page.waitForLoadState('networkidle');await evidence(page,'embroidery-'+scene,e);
});

test('CSS quote builders: dtf keyboard locations and shipping controls',async({page})=>{
 test.skip(original,'The original keyboard defects are preserved in visual/source fixtures.');
 const e=await open(page,{url:'/quote-builders/dtf-quote-builder.html'});await addProduct(page,'dtf');
 await page.locator('.guided-step[data-step="1"]').click();
 const front=page.locator('input[name="front-location"][value="left-chest"]');
 await front.focus();await page.keyboard.press('ArrowDown');
 await expect(page.locator('input[name="front-location"][value="right-chest"]')).toBeChecked();
 await page.keyboard.press('ArrowUp');await expect(front).toBeChecked();
 const sleeve=page.locator('input[name="sleeve-location"][value="left-sleeve"]');
 await sleeve.focus();await page.keyboard.press('Space');await expect(sleeve).toBeChecked();
 await page.keyboard.press('Space');await expect(sleeve).not.toBeChecked();
 await page.locator('.guided-step[data-step="0"]').click();
 const color=page.locator('tr[data-style] .color-picker-selected').first();
 await color.focus();await page.keyboard.press('Enter');await expect(color).toHaveAttribute('aria-expanded','true');
 await expect(color).toHaveAttribute('aria-controls','color-dropdown-1');
 await page.keyboard.press('Escape');await expect(color).toHaveAttribute('aria-expanded','false');
 const fees=page.locator('[data-call="toggleFeesCharges"]');await fees.focus();await page.keyboard.press('Space');
 await expect(page.locator('#graphic-design-hours')).toBeVisible();await page.keyboard.press('Space');
 await expect(page.locator('#graphic-design-hours')).toBeHidden();
 await page.locator('.guided-step[data-step="3"]').click();
 const shipping=page.locator('[data-call="toggleOrderDetails"]');await shipping.focus();await page.keyboard.press('Enter');
 await page.locator('#po-number').fill('KEYBOARD-PO-17');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  const dimensions=await page.evaluate(()=>{
   const field=document.querySelector('#dtf-shipping-fee'),currency=document.querySelector('.workspace-shipping-currency'),tax=document.querySelector('#tax-rate-input');
   return {currencyRight:currency.getBoundingClientRect().right,textLeft:field.getBoundingClientRect().left+parseFloat(getComputedStyle(field).paddingLeft),taxTextWidth:tax.clientWidth-parseFloat(getComputedStyle(tax).paddingLeft)-parseFloat(getComputedStyle(tax).paddingRight)};
  });
  expect(dimensions.currencyRight).toBeLessThan(dimensions.textLeft);expect(dimensions.taxTextWidth).toBeGreaterThanOrEqual(64);
  await expect(page.locator('#po-number')).toHaveValue('KEYBOARD-PO-17');
 }
 await expect(page.locator('#grand-total-with-tax')).toHaveText('$714.10');
 expect(e.mutations||[]).toEqual([]);
});

test('CSS quote builders: screenprint keyboard ink and shipping controls',async({page})=>{
 test.skip(original,'Native ink and expandable-panel keyboard regression.');
 const e=await open(page,{scpFees:true,url:'/quote-builders/screenprint-quote-builder.html'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  const emptyFits=await page.locator('.product-table-wrapper').evaluate(n=>{
   n.scrollLeft=n.scrollWidth;const box=n.getBoundingClientRect();
   const fits=[...n.querySelectorAll('.qb-empty-state > div')].every(d=>{const b=d.getBoundingClientRect();return b.left>=box.left&&b.right<=box.right;});n.scrollLeft=0;return fits;
  });expect(emptyFits,'empty instructions remain readable at the far edge').toBe(true);
 }
 await page.setViewportSize({width:320,height:1000});await addProduct(page,'screenprint');
 await page.locator('.guided-step[data-step="1"]').focus();await page.keyboard.press('Enter');
 const ink=page.locator('input[name="front-colors"][value="1"]');await ink.focus();await expect(ink).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.locator('input[name="front-colors"][value="2"]')).toBeChecked();
 await expect(page.locator('#setup-fee-display')).toHaveText('$60.00');
 await page.keyboard.press('ArrowLeft');await expect(ink).toBeChecked();
 await expect(page.locator('#sidebar-grand-total')).toHaveText('$667.81');
 await page.locator('.guided-step[data-step="0"]').click();
 const fees=page.locator('[data-call="toggleFeesCharges"]');await fees.focus();await fees.press('Space');await expect(page.locator('#vellum-qty')).toBeVisible();
 await page.locator('.guided-step[data-step="3"]').click();
 const shipping=page.locator('[data-call="toggleOrderShippingPanel"]');await shipping.focus();await shipping.press('Enter');await expect(page.locator('.os-po-number')).toBeVisible();
 await page.locator('.os-po-number').fill('Example PO');await shipping.press('Enter');await expect(page.locator('.os-po-number')).toBeHidden();
 await shipping.press('Space');await expect(page.locator('.os-po-number')).toHaveValue('Example PO');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  expect(await page.locator('#tax-rate-input').evaluate(n=>n.clientWidth-parseFloat(getComputedStyle(n).paddingLeft)-parseFloat(getComputedStyle(n).paddingRight)), 'tax amount has room for digits and spinner').toBeGreaterThanOrEqual(64);
  expect(await page.locator('.os-shipping-fee').evaluate(n=>{const currency=n.parentElement.querySelector('[data-order-style="currency"]').getBoundingClientRect();return n.getBoundingClientRect().left+parseFloat(getComputedStyle(n).paddingLeft)>currency.right;}),'shipping amount clears its currency prefix').toBe(true);
 }
 expect(e.errors).toEqual([]);expect(e.unknown).toEqual([]);expect(e.writes).toEqual([]);expect(e.mutations).toEqual([]);
});

test('CSS quote builders: embroidery keyboard and responsive controls',async({page})=>{
 test.skip(original,'Canonical workspace layout regression.');
 const e=await open(page,{url:'/quote-builders/embroidery-quote-builder.html'});
 await page.setViewportSize({width:320,height:1000});
 const instructions=page.locator('.qb-empty-state > div:last-child');
 const instructionsBox=await instructions.boundingBox();
 expect(instructionsBox.x).toBeGreaterThanOrEqual(0);
 expect(instructionsBox.x+instructionsBox.width).toBeLessThanOrEqual(320);
 await addProduct(page,'embroidery');
 await page.locator('.guided-step[data-step="3"]').focus();await page.keyboard.press('Enter');
 const includeTax=page.locator('#include-tax');await includeTax.focus();
 await expect(includeTax).toBeFocused();await page.keyboard.press('Space');
 await expect(includeTax).not.toBeChecked();await expect(page.locator('#tax-amount')).toHaveText('$0.00');
 await page.keyboard.press('Space');await expect(includeTax).toBeChecked();
 await expect(page.locator('#grand-total-with-tax')).toHaveText('$1056.96');
 for(const id of ['include-tax','wholesale-checkbox']){
  const box=await page.locator('#'+id).boundingBox();expect(box.width).toBe(18);expect(box.height).toBe(18);
 }
 await page.locator('.guided-step[data-step="2"]').focus();await page.keyboard.press('Enter');
 const details=page.locator('.customer-manual summary');await details.focus();await page.keyboard.press('Space');
 await expect(page.locator('#customer-name')).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});
 const sidebar=page.locator('#power-sidebar'),handle=page.locator('#sidebar-resize-handle');
 const before=(await sidebar.boundingBox()).width,grip=await handle.boundingBox();
 await page.mouse.move(grip.x+grip.width/2,grip.y+30);await page.mouse.down();
 await page.mouse.move(grip.x-80,grip.y+30);await page.mouse.up();
 expect((await sidebar.boundingBox()).width).toBeGreaterThan(before);
 expect(Number(await page.evaluate(()=>localStorage.getItem('sidebarWidth')))).toBeGreaterThan(before);
 for(const width of [768,390,320]){
  await page.setViewportSize({width,height:1000});await expect(handle).toBeHidden();
  const box=await sidebar.boundingBox();expect(box.x+box.width).toBeLessThanOrEqual(width);
 }
 expect(e.errors).toEqual([]);expect(e.unknown).toEqual([]);expect(e.writes).toEqual([]);expect(e.mutations).toEqual([]);
});

for(const failed of [false,true])test('CSS quote builders: invoice '+(failed?'blocks missing formatting':'waits for formatting'),async({page,context})=>{
 test.skip(original,'Shared external invoice formatting readiness regression.');
 let release,requested;
 const wait=new Promise(resolve=>{release=resolve;}),seen=new Promise(resolve=>{requested=resolve;});
 const state={realPreview:true,url:'/quote-builders/embroidery-quote-builder.html'};
 const e=await open(page,state);await addProduct(page,'embroidery');
 // Add the gate after the builder's own tokens have loaded.
 state.invoiceStyles={path:'/shared_components/css/'+(failed?'tokens':'quote-invoice')+'.css',wait,requested,failed};
 await e.preparePrint();
 const pending=context.waitForEvent('page');await page.locator('.guided-step[data-step="3"]').click();await page.locator('[data-call="printQuote"]').click();
 const invoice=await pending;
 try{
  await seen;
  expect(await invoice.evaluate(()=>window.__printCalls)).toBe(0);
  release();await invoice.waitForLoadState('load');
  if(failed){await expect(page.locator('.toast-container')).toContainText('Error generating PDF');expect(await invoice.evaluate(()=>window.__printCalls)).toBe(0);}
  else await expect.poll(()=>invoice.evaluate(()=>window.__printCalls)).toBe(1);
  expect(e.writes).toEqual([]);expect(e.mutations).toEqual([]);expect(e.errors).toEqual([]);expect(e.unknown).toEqual([]);
 }finally{release();}
});

// Erik 2026-09-16: the September CSS release left runtime pieces unstyled. The import summary
// and the non-SanMar $0.00 price are proven end to end here, keyboard only.
const VENDOR_ORDER=['**************','Order #: 999001','Salesperson: Example Rep','Email: rep@example.invalid','**************','Customer #: 10001','Company: Example Co','**************','Order Information','Ordered by: Example Buyer','Email: buyer@example.invalid','Date Order Placed: 09/12/2026','Terms: Prepaid','**************','Items Purchased','Item 1 of 2','','Part Number: PC54','Description: Port & Company Core Cotton Tee, Jet Black','Item Quantity: 24','Unit Price: $12.00','Adult:Quantity','S:6','M:6','L:6','XL:6','','Item 2 of 2','','Part Number: VND100','Description: Vendor Performance Tee, Black','Item Quantity: 12','Unit Price: $0.00','Adult:Quantity','M:6','L:6','**************','Shipping Information','Ship Method: Customer Pick Up','Ship Address: Customer Pick Up','**************','Order Summary','Subtotal: $288.00','Sales Tax: $0.00','Shipping: $0.00','Total: $288.00'].join('\n');

test('CSS quote builders: embroidery import summary and vendor price by keyboard',async({page})=>{
 test.skip(original,'The original page never styled or exposed these controls.');
 page.setDefaultTimeout(20000);
 const e=await open(page,{vendor:['VND100'],url:'/quote-builders/embroidery-quote-builder.html'});
 await page.locator('button[data-call="openShopWorksImportModal"]').first().click();
 await page.locator('#shopworks-paste-area').fill(VENDOR_ORDER);
 await page.locator('#btn-parse-import').click();
 await page.locator('#btn-confirm-import').click();
 const review=page.locator('#service-pricing-review-modal');
 await expect(review.locator('#spr-embconfig-section')).toBeVisible();
 await review.getByRole('button',{name:/Apply & Import/}).click();
 const banner=page.locator('#import-summary-banner');
 await expect(banner).toBeVisible({timeout:30000});
 await expect(banner).toHaveClass('alert alert-warn emb-screen-notice');
 expect(await banner.evaluate(el=>el.nextElementSibling?.classList.contains('product-table-wrapper'))).toBe(true);
 expect(await banner.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
 await expect(banner.locator('[role="status"]')).toContainText('1 SanMar product priced automatically. 1 non-SanMar product — 1 still needs a price before you can save.');
 const item=banner.locator('button.import-summary-item');
 await expect(item).toHaveText(/^VND100 \(.+\) — needs a price$/);
 const row=page.locator('tr[data-style="VND100"]').first();
 await expect(row).toHaveClass(/price-warning/);
 // The vendor line came in whole (color and sizes), so it counts toward the quote once priced.
 await expect(row.locator('input[data-size="M"]')).toHaveValue('6');
 await expect(row.locator('input[data-size="L"]')).toHaveValue('6');
 expect(await row.evaluate(r=>r.dataset.color)).toBe('Black');
 await expect(page.locator('#total-qty')).toHaveText('36');
 // Waiting for a price is not an API failure: no critical banner, quote controls stay usable.
 await expect(page.locator('#pricing-api-warning')).toHaveCount(0);
 const totalBefore=await page.locator('#grand-total-with-tax').textContent();
 // Nothing leaves the builder while the line has no price.
 let popups=0;page.on('popup',()=>{popups++;});
 await page.locator('.guided-step[data-step="3"]').click();
 await page.locator('button[data-call="printQuote"]').first().click();
 await expect(page.locator('#toast-container')).toContainText('Set a price for VND100 before printing');
 expect(popups).toBe(0);
 await page.locator('.guided-step[data-step="0"]').click();
 await expect(banner).toBeVisible();
 const price=row.locator('button.ns-price-btn');
 await expect(price).toHaveAccessibleName('$0.00 needs a price — set the unit price for VND100');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await banner.screenshot({path:test.info().outputPath('import-summary-'+width+'.png')});
 }
 await page.setViewportSize({width:1440,height:900});
 expect((await new AxeBuilder({page}).include('#import-summary-banner').include('tr[data-style="VND100"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 // Keyboard: the item jumps to the price; Enter opens the labelled editor; a price clears the warning.
 await item.focus();await page.keyboard.press('Enter');
 await expect(price).toBeFocused();
 await expect(row).toHaveClass(/is-located/);
 await page.keyboard.press('Enter');
 const editor=row.getByRole('spinbutton',{name:'Unit price for VND100'});
 await expect(editor).toBeFocused();
 await editor.fill('15');await page.keyboard.press('Enter');
 await expect(row.locator('button.ns-price-btn')).toBeFocused();
 await expect(row.locator('button.ns-price-btn')).toHaveAccessibleName('$15.00 — edit the unit price for VND100');
 await expect(row).not.toHaveClass(/price-warning/);
 await expect(banner).toHaveClass('alert alert-success emb-screen-notice');
 await expect(banner.locator('[role="status"]')).toContainText('All non-SanMar products now have a price.');
 await expect(item).toHaveText(/— \$15\.00 each$/);
 await expect(page.locator('#grand-total-with-tax')).not.toHaveText(totalBefore);
 // On paper the working notice is gone and the price still shows.
 await page.emulateMedia({media:'print'});
 await expect(banner).toBeHidden();
 await expect(row.locator('button.ns-price-btn')).toBeVisible();
 await page.emulateMedia({media:'screen'});
 // Dismiss returns focus to the products.
 await banner.locator('.btn-dismiss-banner').focus();await page.keyboard.press('Enter');
 await expect(banner).toHaveCount(0);
 await expect(page.locator('.product-table-wrapper')).toBeFocused();
 expect(e.mutations.map(m=>m.path)).toEqual(['/api/non-sanmar-products']);
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);
});

// The customer goods, names and manual-item dialogs are native modal dialogs (2026-09-17): named by their
// titles, Tab stays inside, Escape and the dimmed layer close only the dialog, and focus goes back.
test('CSS quote builders: embroidery runtime dialogs keep and return focus',async({page})=>{
 test.skip(original,'Native dialogs replaced the original overlays.');
 page.setDefaultTimeout(20000);
 const e=await open(page,{assistant:true,vendor:['VND100'],url:'/quote-builders/embroidery-quote-builder.html'});
 await addProduct(page,'embroidery');
 const inside=dialog=>dialog.evaluate(d=>d.matches(':modal')&&d.contains(document.activeElement));
 const cycle=async(dialog,stops)=>{for(let i=0;i<=stops;i++){await page.keyboard.press('Tab');expect(await inside(dialog)).toBe(true);}await page.keyboard.press('Shift+Tab');expect(await inside(dialog)).toBe(true);};
 const noViolations=async sel=>expect((await new AxeBuilder({page}).include(sel).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
 // Customer goods, from the row's Describe button. Escape leaves the assistant panel open.
 await page.locator('.guided-step[data-step="1"]').click();
 await page.locator('.service-cat-btn').filter({hasText:'Customer-Supplied'}).click();await page.locator('.sci-add-config[data-code="DECG"]').click();
 await page.locator('.guided-step[data-step="0"]').click();
 const describe=page.locator('.btn-describe-cs');await expect(describe).toBeVisible();
 const panel=page.locator('#aiChatPanel');await page.locator('#floatingQuoteBtn').click();await expect(panel).toHaveClass(/open/);
 await expect(page.locator('#aiChatMessages')).toContainText('I can help with embroidery products');
 const goods=page.getByRole('dialog',{name:'What is the customer bringing?'});
 await describe.focus();await page.keyboard.press('Enter');
 await expect(goods.locator('.csg-brand')).toBeFocused();
 expect(await page.evaluate(()=>{document.getElementById('product-search').focus();return document.activeElement.id;})).not.toBe('product-search');
 await cycle(goods,5);await noViolations('#cs-goods-dialog');
 await page.keyboard.press('Escape');await expect(goods).toHaveCount(0);await expect(panel).toHaveClass(/open/);await expect(describe).toBeFocused();
 await page.keyboard.press('Escape');await expect(panel).not.toHaveClass(/open/);
 await describe.click();
 await goods.locator('.csg-brand').fill('Carhartt CTK87');await goods.locator('.csg-color').fill('Navy');await goods.locator('.csg-details').fill('S(4) M(10)');
 await goods.getByRole('button',{name:'Save'}).click();await expect(goods).toHaveCount(0);await expect(describe).toBeFocused();
 const decg=page.locator('tr[data-service-type="decg"]');
 await expect(decg.locator('.service-description')).toHaveText('Customer-Supplied Garments (8K stitches) — Carhartt CTK87 · Navy');
 expect(await decg.evaluate(r=>r.dataset.csNotes)).toBe('S(4) M(10)');
 await describe.click();await expect(goods.locator('.csg-brand')).toHaveValue('Carhartt CTK87');
 await page.mouse.click(8,8);await expect(goods).toHaveCount(0);await expect(describe).toBeFocused();
 // Manual item, from an unknown style's "Enter manually" button. Saving removes that button, so focus goes to the first size.
 const search=page.locator('#product-search');await search.click();await search.pressSequentially('VND100',{delay:40});
 await expect(search).toHaveValue('VND100');await search.press('Enter');
 await page.locator('.suggestion-add-nonsanmar').click();
 const enter=page.getByRole('button',{name:'Enter manually'});await enter.click();
 const manual=page.getByRole('dialog',{name:'Enter this item manually'});
 await expect(manual.locator('.mi-desc')).toBeFocused();await cycle(manual,7);await noViolations('#manual-item-dialog');
 await page.keyboard.press('Escape');await expect(manual).toHaveCount(0);await expect(enter).toBeFocused();
 await enter.press('Enter');
 await manual.locator('.mi-desc').fill('S&S Bella+Canvas Jersey Tee');await manual.locator('.mi-color').fill('Navy');
 // A missing cost keeps the dialog open and says why beside the field (the toast is under the modal layer).
 const addToQuote=manual.getByRole('button',{name:'Add to quote'}),cost=manual.locator('.mi-cost');
 await addToQuote.click();await expect(manual.getByRole('alert')).toHaveText('Enter what we pay per blank — the price is built from it.');
 await expect(cost).toBeFocused();await expect(cost).toHaveAttribute('aria-invalid','true');
 await expect(cost).toHaveAccessibleDescription('Enter what we pay per blank — the price is built from it.');await noViolations('#manual-item-dialog');
 await cost.fill('8.42');await addToQuote.click();await expect(manual).toHaveCount(0);
 const vendor=page.locator('tr[data-style="VND100"]');
 await expect(vendor.locator('.non-sanmar-badge')).toHaveText('Manual');await expect(vendor.locator('input[data-size="S"]')).toBeFocused();
 expect(await vendor.evaluate(r=>[r.dataset.manualItem,r.dataset.blankCost])).toEqual(['true','8.42']);
 // Names, opened by the services bar. Guided steps hide the new row, so focus returns to the menu button;
 // with every section shown it goes to the row's quantity.
 await page.locator('.guided-step[data-step="1"]').click();
 const addOns=page.locator('.service-cat-btn').filter({hasText:'Add-Ons'});
 const addMonogram=async()=>{await addOns.click();await page.locator('button.service-cat-item[data-code="Monogram"]').click();};
 const names=page.getByRole('dialog',{name:'Monogram — who gets one?'});
 await addMonogram();await expect(names.locator('textarea')).toBeFocused();await cycle(names,3);await noViolations('#monogram-names-dialog');
 await page.keyboard.press('Escape');await expect(names).toHaveCount(0);await expect(addOns).toBeFocused();
 await page.locator('.guided-toggle').click();
 await addMonogram();await names.locator('textarea').fill('Sarah M\nJohn D, XL');await names.getByRole('button',{name:'Add names'}).click();
 const quantity=page.locator('tr[data-service-type="monogram"] .service-qty').last();
 await expect(names).toHaveCount(0);await expect(quantity).toBeFocused();await expect(quantity).toHaveValue('2');
 await expect(page.locator('#notes')).toHaveValue(/--- Names\/Monograms ---\nSarah M\nJohn D, XL$/);
 await addMonogram();await page.mouse.click(8,8);await expect(names).toHaveCount(0);await expect(quantity).toBeFocused();await expect(quantity).toHaveValue('1');
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.mutations).toEqual([]);
});

// The UPS estimate notes are classes, not style="" attributes (2026-09-17), with the same colours.
test('CSS quote builders: embroidery shipping estimate notes carry no style attributes',async({page})=>{
 test.skip(original,'Runtime markup moved to classes after the reviewed migration.');
 page.setDefaultTimeout(20000);
 await page.route('**/api/shipping/box-density',route=>route.fulfill({json:{density:{}}}));
 await page.route('**/api/shipping/estimate-ups-ground',route=>route.fulfill({json:{estimate:14.37,billableWeightLb:6,boxes:1,zone:2,basis:'cost',markupPct:0.15,rough:false}}));
 const e=await open(page,{url:'/quote-builders/embroidery-quote-builder.html'});await addProduct(page,'embroidery');
 // No SanMar weights for the style, so the estimate notes that it used fallback weights.
 await page.route('**/api/inventory?**',route=>route.fulfill({json:[]}));
 await page.locator('.guided-step[data-step="3"]').click();await page.locator('[data-call="openShippingModal"]').click();await page.locator('#ship-mode-ship').click();
 await page.locator('#ship-zip').fill('98354');await page.locator('#estimate-ship-btn').click();
 const result=page.locator('#estimate-ship-result');await expect(result).toContainText('$14.37');
 await expect(result.locator('.ship-estimate-fallback')).toHaveText('(some weights estimated)');
 await expect(result.locator('.ship-estimate-fallback')).toHaveCSS('color','rgb(217, 119, 6)');
 await expect(result.locator('.ship-estimate-basis')).toHaveCSS('color','rgb(156, 163, 175)');
 await expect(result.locator('[style]')).toHaveCount(0);
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.mutations).toEqual([]);
});

// The builder pages carry no static style attributes (2026-09-17). Markup that starts hidden uses
// `hidden data-qb-hidden`, which quote-builder-utils.js hands to style.display before the builders run,
// so each page is served with style attributes blocked, as the target CSP will block them.
for(const method of ['embroidery','screenprint','dtf'])test('CSS quote builders: '+method+' page renders with style attributes blocked',async({page})=>{
 test.skip(original,'Static style attributes moved to classes after the reviewed migration.');
 const fs=require('fs'),path=require('path'),file='quote-builders/'+method+'-quote-builder.html';
 await page.route('**/'+file,route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"style-src-attr 'none'"},body:fs.readFileSync(path.join(__dirname,'../..',file))}));
 const blocked=[];page.on('console',m=>{if(/Content Security Policy/.test(m.text()))blocked.push(m.text());});
 const e=await open(page,{url:'/'+file});await page.waitForLoadState('networkidle');
 expect(blocked).toEqual([]);
 await expect(page.locator('[data-qb-hidden]')).toHaveCount(0);
 const warning=page.locator('#min-order-warning');
 await expect(warning).toBeHidden();expect(await warning.evaluate(el=>[el.hidden,el.style.display])).toEqual([false,'none']);
 const css=(selector,prop,value)=>expect(page.locator(selector).first()).toHaveCSS(prop,value);
 await page.locator('.guided-toggle').click();
 const art=page.locator('#art-charge-wrapper');
 if(method==='embroidery'){
  await css('.workspace-field-grid-customer','display','grid');await css('.workspace-fields-inline','display','flex');
  await css('label:has(> #ship-residential)','display','block');await css('label[for="graphic-design-hours"]','display','block');
  await css('select.qb-cur-not-allowed','opacity','0.6');
  // The notes toggle reads and writes style.display on markup that started hidden.
  const notes=page.locator('#notes-section .notes-body');await expect(notes).toBeHidden();
  await page.locator('#notes-section .notes-header').click();await expect(notes).toBeVisible();
  await page.locator('#notes-section .notes-header').click();await expect(notes).toBeHidden();
 }else{
  await css('.workspace-customer-grid','display','grid');await css('h4.qb-ai-center-gap-6','display','flex');
  const fees=page.locator('#fees-charges-content');await expect(fees).toBeHidden();
  await page.locator('.charges-header[data-call="toggleFeesCharges"]').click();await expect(fees).toBeVisible();
 }
 // The art charge starts dimmed by its class; the toggle still writes the opacity through CSSOM.
 // (The embroidery artwork step stays hidden since art moved to the services bar, so it calls the handler.)
 const setArt=checked=>method==='embroidery'
  ?page.evaluate(checked=>{document.getElementById('art-charge-toggle').checked=checked;toggleArtCharge();},checked)
  :page.locator('#art-charge-toggle').setChecked(checked);
 await expect(art).toHaveCSS('opacity','0.4');
 await setArt(true);await expect(art).toHaveCSS('opacity','1');
 await setArt(false);await expect(art).toHaveCSS('opacity','0.4');
 expect(blocked).toEqual([]);
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.mutations).toEqual([]);
});

// Runtime markup from the builder scripts carries no style attributes either (2026-09-17): static styles are classes,
// swatch colours and other data go through CSSOM. Each page is served with style attributes blocked while the
// templates render; every request is synthetic (the push below is a routed fake, never a real order).
async function blockStyleAttributes(page,method,state={}){
 const fs=require('fs'),path=require('path'),file='quote-builders/'+method+'-quote-builder.html';
 await page.route('**/'+file,route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"style-src-attr 'none'"},body:fs.readFileSync(path.join(__dirname,'../..',file))}));
 const blocked=[];page.on('console',m=>{if(/Content Security Policy/.test(m.text()))blocked.push(m.text());});
 const e=await open(page,{url:'/'+file,...state});await page.waitForLoadState('networkidle');
 return {e,blocked};
}
const FIXTURE_IMAGE='/__core-fixture/garment.svg';

test('CSS quote builders: embroidery runtime markup keeps its look with style attributes blocked',async({page})=>{
 test.skip(original,'Runtime markup moved to classes after the reviewed migration.');
 page.setDefaultTimeout(20000);
 const {e,blocked}=await blockStyleAttributes(page,'embroidery',{save:true});
 const empty=u=>/^ZZZ/.test(new URL(u).searchParams.get('term')||new URL(u).searchParams.get('q')||'');
 await page.route('**/api/stylesearch**',r=>empty(r.request().url())?r.fulfill({json:[]}):r.fallback());
 await page.route('**/api/products/search**',r=>empty(r.request().url())?r.fulfill({json:{success:true,data:{products:[]}}}):r.fallback());
 await page.route('**/api/digitized-designs/lookup**',r=>r.fulfill({json:{success:true,designs:{4321:{company:'Example Co',designName:'Front Logo',maxStitchCount:9000,maxStitchTier:'Standard',extraColors:2,extraColorSurcharge:1.5,dstFilenames:['a.dst'],variants:[{stitchCount:9000}]}}}}));
 await page.route('**/api/digitized-designs/by-customer**',r=>r.fulfill({json:{success:true,designs:[]}}));
 await page.route('**/api/thumbnails/**',r=>r.fulfill({json:/by-designs/.test(r.request().url())?{thumbnails:{}}:{found:false}}));
 await page.route('**/api/embroidery-push/preview/**',r=>r.fulfill({json:{extOrderId:'NWCA-EMB-2026-777',designCount:1,orderJson:{id_Customer:10001,ExtCustomerID:'X-1',LinesOE:[{PartNumber:'PC54',Description:'Tee',Qty:48,Price:20}],Designs:[{DesignName:'Front Logo',Locations:[{ImageURL:FIXTURE_IMAGE}]}],Notes:[]}}}));
 await page.route('**/api/embroidery-push/push-quote',r=>r.fulfill({json:{success:true,extOrderId:'NWCA-EMB-2026-777',lineItemCount:1,designCount:1}}));
 await page.route('**/api/manageorders/getorderno/**',r=>r.fulfill({json:{result:[{id_Order:145001}]}}));
 const search=page.locator('#product-search');await search.click();await search.pressSequentially('ZZZ9',{delay:60});
 await expect(page.locator('.suggestion-add-nonsanmar')).toHaveCSS('color','rgb(22, 163, 74)');
 await search.fill('');await page.keyboard.press('Escape');
 // Product row: the cap badge starts hidden and the colour swatches are painted.
 await addProduct(page,'embroidery');
 const row=page.locator('tr[data-style]').first();
 await expect(row.locator('.cap-badge')).toBeHidden();
 await expect(row.locator('.color-picker-option .color-swatch').first()).toHaveCSS('background-color','rgb(38, 59, 70)');
 // Push preview, the "Sent to ManageOrders" status and the confirmed check.
 await page.evaluate(()=>{document.getElementById('customer-number').value='10001';document.getElementById('customer-name').value='Example Customer';document.getElementById('customer-email').value='customer@example.invalid';});
 await page.evaluate(()=>pushToShopWorks());
 await expect(page.locator('#emb-sw-push-preview .push-design-thumb')).toHaveCSS('width','40px');
 await expect(page.locator('#emb-sw-push-preview .push-ext-id')).toHaveCSS('color','rgb(156, 163, 175)');
 await page.evaluate(()=>confirmPushToShopWorks());
 await expect(page.locator('#emb-sw-import-result .push-confirmed')).toHaveCSS('color','rgb(21, 128, 61)');
 const verify=page.locator('#emb-sw-verify-btn');
 await expect(verify).toHaveCSS('color','rgb(255, 255, 255)');await expect(verify).toHaveCSS('border-top-style','none');await expect(verify).toHaveCSS('padding-left','12px');
 await expect(page.locator('#emb-sw-push-status .push-sent')).toHaveCSS('background-color','rgb(239, 246, 255)');
 await page.evaluate(()=>closePushPreview());
 // Service rows: garment and cap badges, icons, the no-size note and the quantity box.
 await page.evaluate(async()=>{addManualServiceRow('Monogram');await addDECGLineItem('cap',5000);document.querySelectorAll('dialog[open]').forEach(d=>d.close());});
 const capBadge=page.locator('.service-product-row .service-style-badge.is-cap');
 await expect(capBadge).toHaveCSS('display','inline-flex');await expect(capBadge).toHaveCSS('color','rgb(30, 64, 175)');
 await expect(page.locator('.service-product-row .service-style-badge:not(.is-cap)').first()).toHaveCSS('background-color','rgb(254, 243, 199)');
 await expect(page.locator('.service-product-row .service-icon.is-cap i')).toHaveCSS('color','rgb(59, 130, 246)');
 await expect(page.locator('.service-product-row .service-icon').first()).toHaveCSS('width','50px');
 await expect(page.locator('.service-product-row .cap-badge')).toHaveCSS('display','flex'); // inline-flex inside the flex row
 await expect(page.locator('.service-product-row .service-size-note').first()).toHaveCSS('font-style','italic');
 await expect(page.locator('.service-product-row .service-qty').first()).toHaveCSS('width','60px');
 // Design badge and the empty customer gallery.
 await page.evaluate(async()=>{document.getElementById('garment-design-number').value='4321';await lookupDesignNumber('garment');});
 await expect(page.locator('#garment-design-info .design-extra-colors')).toHaveCSS('color','rgb(217, 119, 6)');
 await expect(page.locator('#garment-design-info .design-dst-icon')).toHaveCSS('margin-right','2px');
 await page.evaluate(()=>openDesignSearchModal('garment'));
 await expect(page.locator('#design-search-results .is-gallery-empty')).toHaveCSS('display','flex');
 await page.evaluate(()=>closeDesignSearchModal());
 // Import preview: every section the parser can report.
 await page.locator('button[data-call="openShopWorksImportModal"]').first().click();
 await page.evaluate(()=>{
  const parse=ShopWorksImportParser.prototype.parse;
  ShopWorksImportParser.prototype.parse=function(text){
   const r=parse.call(this,text);
   Object.assign(r,{pricingSource:'fallback',decgApiFailed:true,notes:['Example note'],customProducts:[{partNumber:'VND100',description:'Vendor tee',sizes:{M:6}}],reviewItems:[{partNumber:'ODD1',description:'Odd item',quantity:2,unitPrice:4}],
    decgItems:[{serviceType:'decg',description:'Customer jackets',quantity:12,stitchCount:9000,calculatedUnitPrice:18,ltmFee:0},{serviceType:'decc',description:'Customer caps',quantity:6,stitchCount:5000,calculatedUnitPrice:15,ltmFee:50}]});
   return r;
  };
 });
 await page.locator('#shopworks-paste-area').fill(VENDOR_ORDER);
 await page.locator('#btn-parse-import').click();
 const preview=page.locator('#shopworks-import-modal');
 await expect(preview.locator('.preview-product-style.is-decc')).toHaveCSS('color','rgb(30, 64, 175)');
 await expect(preview.locator('.preview-product-style.is-decg')).toHaveCSS('background-color','rgb(254, 243, 199)');
 await expect(preview.locator('.preview-product-item.is-custom')).toHaveCSS('border-left-color','rgb(194, 65, 12)');
 await expect(preview.locator('.preview-pricing-source.is-fallback')).toHaveCSS('color','rgb(251, 191, 36)');
 await expect(preview.locator('input.product-include-check').first()).toHaveCSS('width','16px');
 await expect(preview.locator('.preview-decg-error')).toHaveCSS('border-top-color','rgb(239, 68, 68)');
 await expect(preview.locator('.preview-review-list')).toHaveCSS('max-height','150px');
 await expect(preview.locator('label.preview-review-item')).toHaveCSS('font-size','13px');
 await page.evaluate(()=>closeShopWorksImportModal());
 // Service pricing review with a found, a fallback and an unknown design.
 await page.evaluate(()=>{showServicePricingReview([{type:'monogram',quantity:6,shopWorksPrice:0,apiPrice:null},{type:'DECG',quantity:12,stitchCount:9000,shopWorksPrice:20,apiPrice:18,_sourceItems:[{unitPrice:19,quantity:6},{unitPrice:21,quantity:6}]}],[],
  {hasGarments:true,hasCaps:true,totalQty:24,designNumbersRaw:['111','222','333'],designNumbers:['Design #111 — Back','Design #222 — Cap','Design #333 — Missing'],
   designLookup:{designs:{111:{company:'ACME',designName:'Back',maxStitchCount:30000,maxStitchTier:'Full Back',maxAsSurcharge:0,thumbnailUrl:'/__core-fixture/garment.svg',variants:[{stitchCount:30000}]}},fallbackDesigns:{222:{companyName:'ACME',designName:'Cap',colorCount:2}}}});});
 const review=page.locator('#service-pricing-review-modal');
 await expect(review.locator('.spr-design-row').first()).toHaveCSS('display','flex');
 await expect(review.locator('.spr-design-row-thumb')).toHaveCSS('width','40px');
 await expect(review.locator('.spr-thumb-slot').first()).toBeHidden();
 await expect(review.locator('.spr-design-flag:not(.is-missing)')).toHaveCSS('background-color','rgb(217, 119, 6)');
 await expect(review.locator('.spr-design-flag.is-missing')).toHaveCSS('background-color','rgb(156, 163, 175)');
 await expect(review.locator('select.spr-design-assign').first()).toHaveCSS('font-size','11px');
 await expect(review.locator('.spr-banner-title')).toHaveCSS('color','rgb(30, 64, 175)');
 await expect(review.locator('td.spr-na-cell')).toHaveCSS('text-align','center');
 await expect(review.locator('summary.spr-detail-summary')).toHaveCSS('font-size','11px');
 await page.evaluate(()=>cancelServicePricingReview());
 // Pricing API warning: its parts are styled through CSSOM, like the banner itself.
 await page.evaluate(()=>window.__embState.pricingCalculator.showAPIWarning('Synthetic pricing failure','general'));
 await expect(page.locator('#pricing-api-warning .api-warning-title')).toHaveCSS('font-size','24px');
 await expect(page.locator('#pricing-api-warning button').first()).toHaveCSS('color','rgb(239, 68, 68)');
 expect(blocked).toEqual([]);
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);
});

// Push opens its preview even when the quote has nothing to save (just saved, or reopened for editing).
// It used to disable the button before calling openPushPreview(), which bails on a disabled button, so
// that click did nothing at all (2026-09-17). Every request here is synthetic — no order is created.
test('CSS quote builders: embroidery push reopens the preview for a saved, unchanged quote',async({page})=>{
 test.skip(original,'The push preview postdates the reviewed migration.');
 page.setDefaultTimeout(20000);
 const e=await open(page,{save:true,url:'/quote-builders/embroidery-quote-builder.html'});
 let previews=0;
 await page.route('**/api/embroidery-push/preview/**',r=>{previews++;return r.fulfill({json:{extOrderId:'NWCA-EMB-2026-777',designCount:1,orderJson:{id_Customer:10001,LinesOE:[{PartNumber:'PC54',Description:'Tee',Qty:48,Price:20}],Designs:[{id_Design:4321}],Notes:[]}}});});
 await addProduct(page,'embroidery');
 await page.evaluate(()=>{document.getElementById('customer-number').value='10001';document.getElementById('customer-name').value='Example Customer';document.getElementById('customer-email').value='customer@example.invalid';});
 const modal=page.locator('#emb-sw-push-modal'),pushBtn=page.locator('#emb-push-shopworks-btn');
 await page.evaluate(()=>pushToShopWorks());
 await expect(modal).toHaveClass(/active/);
 await expect(page.locator('#emb-sw-push-preview')).toContainText('NWCA-EMB-2026-777');
 await page.evaluate(()=>closePushPreview());
 await expect(pushBtn).toBeEnabled();
 // Saved and unchanged: the preview opens again, and the redundant save is still skipped.
 const saves=e.mutations.length;
 await page.evaluate(()=>{markAsSaved();pushToShopWorks();});
 await expect(modal).toHaveClass(/active/);
 expect(previews).toBe(2);
 expect(e.mutations.length).toBe(saves);
 await page.evaluate(()=>closePushPreview());
 await expect(pushBtn).toBeEnabled();
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);
});

for(const method of ['screenprint','dtf'])test('CSS quote builders: '+method+' runtime markup keeps its look with style attributes blocked',async({page})=>{
 test.skip(original,'Runtime markup moved to classes after the reviewed migration.');
 page.setDefaultTimeout(20000);
 const {e,blocked}=await blockStyleAttributes(page,method,{safetyRecs:true});
 await page.route('**/api/designs/by-customer/**',r=>r.fulfill({json:{designs:[{idDesign:5001,designName:'Front Logo',thumbnailUrl:FIXTURE_IMAGE,designComplete:true,dateCreated:'2026-08-01T10:00:00'},{idDesign:5002,designName:'Back',thumbnailUrl:'',locationCount:2,designComplete:true}]}}));
 await addProduct(page,method);
 const row=page.locator('tr[data-style]:not(.child-row)').first();
 await expect(row.locator('.color-picker-option .color-swatch').first()).toHaveCSS('background-color','rgb(38, 59, 70)');
 // Safety-stripe recommendation dots take their colour through CSSOM.
 if(method==='screenprint'){
  await page.locator('#scp-safety-recs .ssr-head').click();
  await expect(page.locator('#scp-safety-recs .ssr-swatch').first()).toHaveCSS('background-color','rgb(244, 229, 0)');
  // Shared extended-size popup: the empty note spans the grid; collapsed waist groups start hidden.
  const rowId=await row.getAttribute('data-row-id');
  await page.evaluate(async rowId=>{const get=window.getAvailableExtendedSizes;window.getAvailableExtendedSizes=async()=>[];await openExtendedSizePopup(rowId);window.getAvailableExtendedSizes=get;},rowId);
  await expect(page.locator('#size-popup-grid .size-popup-empty')).toHaveCSS('grid-column-end','-1');
  await page.evaluate(async rowId=>{closeExtendedSizePopup();const r=document.getElementById('row-'+rowId);r.dataset.sizeCategory='pants';r.dataset.pantsSizes=JSON.stringify(['3030','4030']);await openExtendedSizePopup(rowId);r.dataset.sizeCategory='';delete r.dataset.pantsSizes;},rowId);
  await expect(page.locator('.pants-waist-group.expanded .waist-sizes')).toBeVisible();await expect(page.locator('.pants-waist-group.collapsed .waist-sizes')).toBeHidden();
  await page.locator('.pants-waist-group.collapsed .waist-header').click();await expect(page.locator('.waist-sizes').nth(1)).toBeVisible();
  await page.evaluate(()=>closeExtendedSizePopup());
 }
 // Extended-size child row: painted swatch and the greyed column that is not its size.
 await row.locator('.xxxl-picker-btn').click();
 await page.locator('.size-popup-input, .ext-size-input').first().fill('3');
 await page.locator('#extended-size-popup .size-popup-apply, #extended-size-popup [data-call="applyExtendedSizes"]').first().click();
 const child=page.locator('tr.child-row').first();
 // SCP keeps only http(s) swatch images (the fixture is local, so its colour shows); DTF shows the parent's image.
 if(method==='screenprint')await expect(child.locator('.color-picker-selected .color-swatch')).toHaveCSS('background-color','rgb(38, 59, 70)');
 else await expect(child.locator('.color-picker-selected .color-swatch')).toHaveCSS('background-image',/garment\.svg/);
 if(method==='screenprint')await expect(child.locator('input.size-input-off')).toHaveCSS('background-color','rgb(243, 244, 246)');
 else await expect(child.locator('img.qb-thumb-box-img')).toHaveCSS('object-fit','contain');
 // Customer design combobox rows.
 await page.locator('.guided-toggle').click();
 await page.evaluate(()=>{const c=document.getElementById('customer-number');c.value='10001';c.dispatchEvent(new Event('change'));});
 const design=page.locator('#design-number');
 if(!await design.isVisible())await page.locator('.customer-manual summary').first().click();
 await design.click();
 const first=page.locator('.cdcb-row').first();
 await expect(first).toHaveCSS('display','flex');
 await expect(page.locator('.cdcb-thumb-empty')).toHaveCSS('font-size','10px');
 await expect(page.locator('.cdcb-row-sub').first()).toHaveCSS('font-size','11px');
 await design.press('ArrowDown');await expect(page.locator('.cdcb-row-active')).toHaveCSS('background-color','rgb(227, 241, 228)');
 await design.fill('zzz');await expect(page.locator('.cdcb-empty')).toHaveCSS('padding-top','12px');
 await design.press('Escape');
 // Thumbnail modal: meta lines and download start hidden and show for a generic preview.
 await page.evaluate(img=>productThumbnailModal.open(img,'Example','PC54','Jet Black'),FIXTURE_IMAGE);
 await expect(page.locator('#modal-product-meta')).toBeHidden();await expect(page.locator('#modal-product-actions')).toBeHidden();
 await page.evaluate(img=>{productThumbnailModal.close();productThumbnailModal.openGeneric({imageUrl:img,title:'Example',metaLines:[{label:'Style',value:'PC54'}],downloadUrl:img});},FIXTURE_IMAGE);
 await expect(page.locator('#modal-product-meta')).toBeVisible();await expect(page.locator('#modal-product-actions')).toBeVisible();
 await page.evaluate(()=>productThumbnailModal.close());
 if(method==='dtf'){
  await page.evaluate(()=>window.dtfQuoteBuilder.updateEditModeUI('DTF-2026-777',2));
  await expect(page.locator('.power-header-subtitle .qb-edit-mode-label')).toHaveCSS('color','rgb(251, 191, 36)');
  await page.evaluate(()=>window.dtfQuoteBuilder.resetQuote());
  await expect(page.locator('#empty-state-row .dtf-reset-steps')).toHaveCSS('color','rgb(156, 163, 175)');
 }
 expect(blocked).toEqual([]);
 expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);
});

test('CSS quote builders: dtf configuration error keeps its look with style attributes blocked',async({page})=>{
 test.skip(original,'Runtime markup moved to classes after the reviewed migration.');
 await page.route('**/shared_components/js/extended-sizes-config.js**',r=>r.fulfill({contentType:'application/javascript',body:''}));
 const {blocked}=await blockStyleAttributes(page,'dtf');
 const screen=page.locator('.dtf-config-error');
 await expect(screen).toContainText('Configuration Error');
 await expect(screen).toHaveCSS('padding-top','40px');await expect(screen).toHaveCSS('color','rgb(204, 0, 0)');
 await expect(page.locator('.dtf-config-error-note')).toHaveCSS('font-size','12px');
 expect(blocked).toEqual([]);
});

// Every runtime overlay, notice and warning state the retired sheets styled has a real style again.
for(const method of ['embroidery','screenprint','dtf','dtg'])test('CSS quote builders: '+method+' runtime overlays and warning states are styled',async({page})=>{
 test.skip(original,'The original page loaded the retired sheets.');
 await open(page,{url:'/quote-builders/'+method+'-quote-builder.html'});
 const styles=await page.evaluate(()=>{
  const probe=(cls,tag='div')=>{const el=document.createElement(tag);el.className=cls;el.textContent='x';document.body.appendChild(el);const c=getComputedStyle(el);const r={position:c.position,display:c.display,bg:c.backgroundColor,width:c.width};el.remove();return r;};
  const out={error:probe('qb-error-banner'),fallback:probe('qb-fallback-badge'),repricing:probe('repricing-indicator'),accepted:probe('accepted-quote-banner'),prWarn:probe('pr-item pr-warn')};
  for(const id of ['scp-push-modal','dtf-push-modal']){const m=document.getElementById(id);if(m){m.classList.add('show');out.push=getComputedStyle(m).display;m.classList.remove('show');}}
  out.monogram=probe('monogram-names-dialog');out.estimator=probe('stitch-estimator-pop');out.thumb=probe('thumb-modal-overlay');out.toast=probe('dtf-toast dtf-toast-warning');out.oosDot=probe('dtg-size-oos-dot','span');
  return out;
 });
 expect(styles.error.position).toBe('sticky');expect(styles.error.bg).not.toBe('rgba(0, 0, 0, 0)');
 expect(styles.fallback.position).toBe('fixed');expect(styles.repricing.position).toBe('fixed');
 expect(styles.accepted.display).toBe('flex');expect(styles.accepted.bg).not.toBe('rgba(0, 0, 0, 0)');
 expect(styles.prWarn.bg).not.toBe('rgba(0, 0, 0, 0)');
 if(method==='screenprint'||method==='dtf')expect(styles.push).toBe('flex');
 if(method==='embroidery'){expect(styles.monogram.position).toBe('fixed');expect(styles.estimator.position).toBe('absolute');expect(styles.thumb.position).toBe('fixed');}
 if(method==='dtf')expect(styles.toast.position).toBe('fixed');
 if(method==='dtg')expect(styles.oosDot.width).toBe('6px');
});

// The cosmetic runtime states (2026-09-17): buttons, row states, fee/tier hints, previews, badges and assistant cards
// keep a real style instead of falling back to plain text.
for(const method of ['embroidery','screenprint','dtf','dtg'])test('CSS quote builders: '+method+' cosmetic runtime states are styled',async({page})=>{
 test.skip(original,'The original page loaded the retired sheets.');
 await open(page,{url:'/quote-builders/'+method+'-quote-builder.html'});
 const s=await page.evaluate(()=>{
  const box=document.createElement('div');document.body.appendChild(box);
  box.innerHTML=`<div class="toast toast-success">x</div><div class="toast toast-info">x</div>
   <div class="ltm-control-panel"><div class="ltm-control-header">x</div><div class="ltm-control-body"><label class="ltm-checkbox-label"><input type="checkbox">x<span class="ltm-status-badge">Applied</span></label></div></div>
   <div class="quantity-nudge quantity-nudge-clickable" role="button">x <span class="nudge-apply-hint">x</span></div>
   <div class="action-panel"><button class="btn-action btn-push-shopworks">x</button><button class="btn-action btn-secondary-action btn-email-quote">x</button></div>
   <div class="ship-to-card"><div class="st-title">Ship To</div><div class="st-actions"><button class="st-btn st-btn-reest">x</button></div></div>
   <div class="customer-lookup-item"><div class="customer-lookup-company">x</div><div class="customer-lookup-details">x</div></div>
   <table class="qb-table-13"><tr class="qb-th"><th class="qb-td--r">x</th></tr></table><div class="qb-warn-box">x</div>
   <table class="product-table"><tr class="child-row different-color"><td><span class="style-display">x</span></td></tr><tr class="new-row"><td><input class="cell-input desc-input" readonly></td></tr></table>
   <div class="import-progress-bar-container"><div class="import-progress-bar"></div></div><div class="preview-item-label">x</div>
   <div class="chat-message assistant"><div class="chat-bubble">x</div></div><span class="spr-type-badge spr-type-fb">FB</span><button class="btn-add-nonsanmar">x</button><div class="pricing-breakdown">x</div>
   <div class="keyboard-hint">x</div><span class="step-badge step-3">3</span>
   <div class="dtg-fullcat-results"></div><button class="dscm-btn dscm-btn-proceed">x</button>`;
  const c=(sel,prop)=>getComputedStyle(box.querySelector(sel))[prop];
  const out={
   success:c('.toast-success','backgroundColor'),info:c('.toast-info','backgroundColor'),plain:getComputedStyle(document.body).backgroundColor,
   ltmBorder:c('.ltm-control-panel','borderTopStyle'),ltmBadge:c('.ltm-status-badge','float'),nudge:c('.quantity-nudge','borderTopStyle'),
   push:c('.btn-push-shopworks','backgroundColor'),pushColor:c('.btn-push-shopworks','color'),email:c('.btn-email-quote','backgroundColor'),action:c('.btn-action','display'),
   stTitle:c('.st-title','textTransform'),stActions:c('.st-actions','display'),lookup:c('.customer-lookup-item','flexDirection'),
   previewTable:c('.qb-table-13','borderCollapse'),warnBox:c('.qb-warn-box','borderTopStyle'),
   differentColor:c('.different-color > td','backgroundColor'),newRow:c('.new-row > td','backgroundColor'),readonlyDesc:c('.desc-input','borderTopColor'),
   progress:c('.import-progress-bar-container','height'),previewLabel:c('.preview-item-label','textTransform'),bubble:c('.chat-bubble','whiteSpace'),
   fb:c('.spr-type-badge','backgroundColor'),manual:c('.btn-add-nonsanmar','backgroundColor'),breakdown:c('.pricing-breakdown','fontFamily'),
   hint:c('.keyboard-hint','fontSize'),step:c('.step-badge','borderRadius'),fullcat:c('.dtg-fullcat-results','gridColumnEnd'),proceed:c('.dscm-btn-proceed','backgroundColor'),
  };
  box.remove();return out;
 });
 const clear='rgba(0, 0, 0, 0)',white='rgb(255, 255, 255)';
 for(const key of ['success','info'])expect(s[key],key).not.toBe(white);
 expect(s.success).not.toBe(s.info);
 if(method==='dtg'){
  expect(s.fullcat).toBe('-1');
  expect(s.proceed).not.toBe(white);
  return;
 }
 expect(s.ltmBorder).toBe('solid');expect(s.ltmBadge).toBe('right');expect(s.nudge).toBe('solid');
 expect(s.push).not.toBe(white);expect(s.pushColor).toBe(white);expect(s.email).not.toBe(white);expect(s.action).toBe('flex');
 expect(s.stTitle).toBe('uppercase');expect(s.stActions).toBe('flex');expect(s.lookup).toBe('column');
 expect(s.previewTable).toBe('collapse');expect(s.warnBox).toBe('solid');
 expect(s.differentColor).not.toBe(clear);expect(s.newRow).not.toBe(clear);expect(s.readonlyDesc).toBe(clear);
 if(method==='embroidery'){
  expect(s.progress).toBe('8px');expect(s.previewLabel).toBe('uppercase');expect(s.bubble).toBe('normal');
  expect(s.fb).not.toBe(clear);expect(s.manual).not.toBe(white);expect(s.breakdown).toMatch(/mono/i);
 }else{
  expect(s.hint).toBe('12px');expect(s.step).toBe('50%');
 }
});
