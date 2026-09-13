const {test,expect}=require('@playwright/test');
const {open,check}=require('./helpers/quote-builders-browser');
const {evidence}=require('./helpers/quote-builder-workflow-review');
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1';
test.setTimeout(120000);
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
for(const scene of ['catalog','catalog-detail','product','colors','customer','shipping','invoice','pricing-failure'])test('CSS quote builders: dtg '+scene,async({page,context})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,realPreview:scene==='invoice'&&!original,richCatalog:true,pricingFailed:scene==='pricing-failure',url:'/quote-builders/dtg-quote-builder.html'});
 await page.waitForLoadState('networkidle');
 if(scene==='catalog-detail')await page.locator('.dtg-cc-view-all').first().click();
 else if(scene!=='catalog'){
  await page.locator('.dtg-cc-add-default').first().click();
  const qty=page.locator('.dtg-line-card input[data-size="M"]').first();await expect(qty).toBeEnabled();await qty.fill('24');await qty.dispatchEvent('change');
  await page.waitForLoadState('networkidle');
  if(scene!=='pricing-failure')await expect(page.locator('#dtgPriceSummary')).toContainText('$');
  if(scene==='colors')await page.locator('.dtg-line-card [data-combo-kind="color"] input').first().click();
  if(['customer','shipping','invoice'].includes(scene)){
   await page.locator('#dtgFirstName').fill('Example');await page.locator('#dtgLastName').fill('Customer');await page.locator('#dtgEmail').fill('customer@example.invalid');
  }
  if(scene==='shipping')await page.locator('.dcp-pickup-toggle label').click();
  if(scene==='invoice'){
   if(e.preparePrint)await e.preparePrint();
   const popup=context.waitForEvent('page',{timeout:15000});await page.locator('#dtgPrintBtn').click();
   const invoice=await popup;await invoice.waitForLoadState('domcontentloaded');await invoice.waitForFunction(()=>document.body.innerText.includes('Example Customer'));
   if(!original)await expect.poll(()=>invoice.evaluate(()=>window.__printCalls)).toBe(1);
   await evidence(invoice,'dtg-invoice',e);return;
  }
 }
 await evidence(page,'dtg-'+scene,e);
});

for(const scene of ['fees','locations','shipping-fields','save','save-failure','assistant'])test('CSS quote builders: dtg detailed '+scene,async({page})=>{
 const state={original,save:scene.startsWith('save'),saveFailed:scene==='save-failure',assistant:scene==='assistant',richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'};
 const e=await open(page,state);await page.waitForLoadState('networkidle');
 await page.locator('.dtg-cc-add-default').first().click();
 const qty=page.locator('.dtg-line-card input[data-size="M"]').first();await qty.fill('24');await qty.dispatchEvent('change');
 await expect(page.locator('#dtgPriceSummary')).toContainText('$396.72');
 await page.locator('#dtgFirstName').fill('Example');await page.locator('#dtgLastName').fill('Customer');await page.locator('#dtgEmail').fill('customer@example.invalid');
 if(scene==='fees'){
  await page.locator('#dtgArtSetupToggle').check();await page.locator('#dtgDesignHours').fill('2');await page.locator('#dtgDesignHours').dispatchEvent('change');
  await expect(page.locator('#dtgPriceSummary')).toContainText('$617.12');
 }
 if(scene==='locations'){
  await page.locator('[data-loc-group="front"][data-loc-code="FF"]').click();await page.locator('[data-loc-group="back"][data-loc-code="FB"]').click();
  await expect(page.locator('#dtgLocationSummary')).toContainText('FF_FB');
 }
 if(scene==='shipping-fields'){
  await page.locator('#dtgPoNumber').fill('SYNTHETIC-PO-17');await page.locator('.dcp-pickup-toggle label').click();
  for(const [id,value] of Object.entries({dtgShipAddress1:'123 Example Street',dtgShipCity:'Example City',dtgShipState:'WA',dtgShipZip:'98354',dtgShipFee:'12.50'})){await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('change');}
  await page.locator('#dtgDueDate').fill('2026-09-25');await page.locator('#dtgDueDate').dispatchEvent('change');
  await page.locator('#dtgDropDeadDate').fill('2026-09-30');await page.locator('#dtgDropDeadDate').dispatchEvent('change');
  await page.waitForLoadState('networkidle');
 }
 if(scene.startsWith('save')){
  await page.locator('[data-call="dtgSaveQuote"]').click();
  await expect(page.locator('#shareToastText')).toContainText(scene==='save-failure'?'Save failed':'Saved DTG');
  expect(e.mutations.filter(m=>m.path==='/api/quote_sessions')).toHaveLength(1);
  expect(e.mutations.filter(m=>m.path==='/api/quote_items').length).toBe(scene==='save-failure'?0:1);
  await expect(page.locator('#shareToast')).not.toHaveClass(/show/);
 }
 if(scene==='assistant'){await page.locator('#floatingQuoteBtn').click();await expect(page.locator('#aiChatPanel')).toHaveClass(/open/);await expect(page.locator('#aiChatMessages')).toContainText('Synthetic research reply.');}
 await evidence(page,'dtg-detailed-'+scene,e);
});

test('CSS quote builders: dtg keyboard and date controls',async({page})=>{
 test.skip(original,'Native control and visibility checks for the canonical workspace.');
 const e=await open(page,{richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'});await page.waitForLoadState('networkidle');
 await expect(page.locator('#shareToast')).toBeHidden();
 const opener=page.locator('.dtg-cc-view-all').first();await opener.focus();await opener.press('Enter');await expect(page.locator('#dtgCatalogModal')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#dtgCatalogModal')).toBeHidden();await expect(opener).toBeFocused();
 const front=page.locator('[data-loc-group="front"][data-loc-code="FF"]');await front.focus();await front.press('Space');await expect(front).toHaveClass(/selected/);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  const pickup=page.locator('#dtgPickupToggle');await pickup.focus();await pickup.press('Space');await expect(page.locator('#dtgShipToBlock')).toBeVisible();await pickup.press('Space');await expect(page.locator('#dtgShipToBlock')).toBeHidden();
  for(const id of ['dtgDueDate','dtgDropDeadDate']){const field=page.locator('#'+id);await expect(field).toBeVisible();const box=await field.boundingBox();expect(box.width).toBeGreaterThanOrEqual(185);expect(box.x+box.width).toBeLessThanOrEqual(width);}
 }
 check(expect,e);
});

test('CSS quote builders: screenprint-fast keyboard and duplicate protection',async({page})=>{
 test.skip(original,'Behavior introduced by the reviewed migration.');
 const e=await open(page,{save:true,url:'/quote-builders/screenprint-fast-quote.html'});
 await page.locator('#quantity').selectOption('48-71');
 for(const value of ['2','3-4']){const choice=page.locator('.option-card[data-value="'+value+'"]');await choice.focus();await choice.press('Space');await expect(choice).toHaveAttribute('aria-pressed','true');}
 await expect(page.locator('#locations')).toHaveValue('2');await expect(page.locator('#colors')).toHaveValue('3-4');
 await page.locator('[data-call="nextStep"]').press('Enter');await expect(page.locator('#step-2 h2')).toBeFocused();
 await page.locator('#customerName').fill('Example Customer');await page.locator('#customerEmail').fill('invalid');await page.locator('#customerPhone').fill('2535550100');
 await page.locator('[data-call="submitQuote"] i').click();await expect(page.locator('#fast-quote-error')).toContainText('valid email');await expect(page.locator('#customerEmail')).toBeFocused();expect(e.mutations).toHaveLength(0);
 await page.locator('#customerEmail').fill('customer@example.invalid');
 await page.evaluate(()=>{document.querySelector('[data-call="submitQuote"] i').click();window.submitQuote();});
 await expect(page.locator('#step-3')).toHaveClass(/active/);expect(e.mutations.filter(m=>m.path==='/api/quote_sessions')).toHaveLength(1);expect(e.mutations.filter(m=>m.path==='emailjs')).toHaveLength(2);check(expect,e);
});

test('CSS quote builders: screenprint-fast retains input and retries failed save',async({page})=>{
 test.skip(original,'Regression for false success after a database failure.');
 const state={save:true,saveFailed:true,url:'/quote-builders/screenprint-fast-quote.html'},e=await open(page,state);
 await page.locator('#quantity').selectOption('48-71');await page.locator('.option-card[data-value="2"]').click();await page.locator('.option-card[data-value="3-4"]').click();await page.locator('[data-call="nextStep"]').click();
 for(const [id,value]of Object.entries({customerName:'Example Customer',customerEmail:'customer@example.invalid',customerPhone:'2535550100',notes:'Keep these instructions.'}))await page.locator('#'+id).fill(value);
 await page.locator('[data-call="submitQuote"] i').click();await expect(page.locator('#fast-quote-error')).toContainText('could not be saved');await expect(page.locator('#step-2')).toHaveClass(/active/);await expect(page.locator('#notes')).toHaveValue('Keep these instructions.');expect(e.mutations.filter(m=>m.path==='emailjs')).toHaveLength(0);
 state.saveFailed=false;await page.locator('[data-call="submitQuote"]').click();await expect(page.locator('#step-3')).toHaveClass(/active/);expect(e.mutations.filter(m=>m.path==='/api/quote_sessions')).toHaveLength(2);expect(e.mutations.filter(m=>m.path==='emailjs')).toHaveLength(2);check(expect,e);
});
for(const scene of ['selected','contact','invalid','submitted','save-failure'])test('CSS quote builders: screenprint-fast '+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,save:true,saveFailed:scene==='save-failure',url:'/quote-builders/screenprint-fast-quote.html'});
 await page.locator('#quantity').selectOption('48-71');
 await page.locator('.option-card[data-value="2"]').click();await page.locator('.option-card[data-value="3-4"]').click();
 if(scene!=='selected'){
  await page.locator('[data-call="nextStep"]').click();
  if(scene==='invalid')await page.locator('[data-call="submitQuote"]').click();
  else{
   for(const [id,value]of Object.entries({customerName:'Example Customer',customerEmail:'customer@example.invalid',customerPhone:'2535550100',companyName:'Example Company',deadline:'2026-10-01',notes:'Example team project. Please confirm artwork placement.'}))await page.locator('#'+id).fill(value);
   if(['submitted','save-failure'].includes(scene)){await page.locator('[data-call="submitQuote"]').click();if(scene==='submitted'||original)await expect(page.locator('#step-3')).toHaveClass(/active/);else await expect(page.locator('[data-call="submitQuote"]')).toBeEnabled();}
  }
 }
 await evidence(page,'screenprint-fast-'+scene,e);
});
