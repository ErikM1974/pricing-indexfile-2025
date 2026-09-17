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
 if(!original&&method==='screenprint'){
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
