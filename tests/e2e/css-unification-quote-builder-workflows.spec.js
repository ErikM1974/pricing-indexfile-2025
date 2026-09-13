const {test,expect}=require('@playwright/test');
const {open}=require('./helpers/quote-builders-browser');
const {evidence}=require('./helpers/quote-builder-workflow-review');
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

for(const method of ['embroidery','screenprint','dtf'])for(const scene of ['products','decoration','customer','review','workbench','colors','invoice','extended-sizes','customer-entered','save'])test('CSS quote builders: '+method+' '+scene,async({page,context})=>{
 page.setDefaultTimeout(15000);
 // The local-only schema assertion rejects intentional null draft IDs in SCP/DTF.
 // Use a fully intercepted synthetic production origin for their original draft output.
 const origin=scene==='invoice'&&method!=='embroidery'?'https://quote-builder.example.invalid':'';
 const e=await open(page,{original,realPreview:scene==='invoice'&&!original,save:scene==='save',url:origin+'/quote-builders/'+method+'-quote-builder.html'});
 await addProduct(page,method);
 if(scene==='colors')await page.locator('tr[data-style] .color-picker-selected').first().click();
 if(scene==='extended-sizes')await page.locator('tr[data-style] .xxxl-picker-btn').first().click();
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
 } else {
  await page.locator('.guided-step[data-step="1"]').click();
  if(scene==='caps-puff')await page.locator('#cap-embellishment-type').selectOption('3d-puff');
  if(scene==='caps-patch')await page.locator('#cap-embellishment-type').selectOption('laser-patch');
  if(scene==='full-back')await page.locator('#primary-position').selectOption('Full Back');
  if(scene.startsWith('services-'))await page.locator('.service-cat-btn').filter({hasText:{'services-artwork':'Artwork','services-add-ons':'Add-Ons','services-supplied':'Customer-Supplied'}[scene]}).click();
 }
 await page.waitForLoadState('networkidle');await evidence(page,'embroidery-'+scene,e);
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
