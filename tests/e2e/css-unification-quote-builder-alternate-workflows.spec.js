const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open,check}=require('./helpers/quote-builders-browser');
const {evidence}=require('./helpers/quote-builder-workflow-review');
const AxeBuilder=require('@axe-core/playwright').default;
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1';
test.setTimeout(120000);
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
test('CSS quote builders: dtg runtime-pricing-failure',async({page})=>{
 const state={original,richCatalog:true,pricingFailed:true,url:'/quote-builders/dtg-quote-builder.html'};
 const e=await open(page,state);
 await page.waitForLoadState('networkidle');
 await page.locator('.dtg-cc-add-default').first().click();
 const qty=page.locator('.dtg-line-card input[data-size="M"]').first();await expect(qty).toBeEnabled();
 await qty.fill('24');await qty.dispatchEvent('change');
 await expect(page.locator('#dtg-price-error-banner')).toContainText('the total below is INCOMPLETE',{timeout:15000});
 await evidence(page,'dtg-runtime-pricing-failure',e);
 // Refresh is the actual recovery instruction; successful pricing must clear
 // the failed-row warning, with no quote save or business call escaping.
 page.removeAllListeners('dialog');
 page.on('dialog',async dialog=>{
  e.dialogs.push(dialog.message());
  if(dialog.type()==='beforeunload')await dialog.accept();else await dialog.dismiss();
 });
 state.pricingFailed=false;await page.reload();await page.waitForLoadState('networkidle');
 await page.locator('.dtg-cc-add-default').first().click();
 const nextQty=page.locator('.dtg-line-card input[data-size="M"]').first();
 await nextQty.fill('24');await nextQty.dispatchEvent('change');
 await expect(page.locator('#dtgPriceSummary')).toContainText('$396.72');
 await expect(page.locator('#dtg-price-error-banner')).toHaveCount(0);
 check(expect,e);
});

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

test('CSS quote builders: dtg push confirms are named modal dialogs that keep and return focus',async({page})=>{
 test.skip(original,'Native confirm dialogs replaced the reviewed overlay.');
 const e=await open(page,{richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'});await page.waitForLoadState('networkidle');
 // A push that gets past both confirms is refused here, so nothing leaves the browser.
 const pushes=[];await page.route('**/api/submit-order-form',route=>{pushes.push(route.request().postDataJSON());return route.fulfill({status:503,json:{error:'Synthetic push refused'}});});
 await page.locator('.dtg-cc-add-default').first().click();
 const qty=page.locator('.dtg-line-card input[data-size="M"]').first();await qty.fill('200');await qty.dispatchEvent('change');
 await expect(page.locator('#dtgPriceSummary')).toContainText('$');
 await page.locator('#dtgFirstName').fill('Example');await page.locator('#dtgLastName').fill('Customer');await page.locator('#dtgEmail').fill('customer@example.invalid');
 const email=page.locator('#dtgEmail'),status=page.locator('#dtgSubmitStatus'),push=page.locator('#dtgSubmitBtn');
 // Push is blocked without a design #, so the design warning is reached through the form API.
 await email.focus();await page.evaluate(()=>{window.__push=window.DTGInlineForm.submitToShopWorks().then(()=>'settled');});
 const design=page.getByRole('dialog',{name:'No design # entered'});
 await expect(design).toBeVisible();await expect(design).toHaveAccessibleDescription(/art team can assign one/);
 expect(await design.evaluate(d=>d.matches(':modal'))).toBe(true);
 await expect(design.getByRole('button',{name:'Cancel'})).toBeFocused();
 expect(await page.evaluate(()=>{document.getElementById('dtgFirstName').focus();return document.activeElement.id;})).not.toBe('dtgFirstName');
 for(const [key,name] of [['Tab','Push without design #'],['Tab','Cancel'],['Shift+Tab','Push without design #'],['Shift+Tab','Cancel'],['Shift+Tab','Push without design #']]){await page.keyboard.press(key);await expect(design.getByRole('button',{name})).toBeFocused();}
 await page.keyboard.press('Escape');await expect(design).toHaveCount(0);await expect(email).toBeFocused();
 await expect(status).toContainText('Push cancelled — add a design #');expect(await page.evaluate(()=>window.__push)).toBe('settled');
 // Proceeding without a design # opens the stock check, which returns focus to the same opener.
 await page.evaluate(()=>{window.__push=window.DTGInlineForm.submitToShopWorks();});
 await design.getByRole('button',{name:'Push without design #'}).click();
 const stock=page.getByRole('dialog',{name:'Stock check'});
 await expect(stock).toBeVisible();await expect(design).toHaveCount(0);
 await stock.getByRole('button',{name:'Cancel'}).click();await expect(stock).toHaveCount(0);await expect(email).toBeFocused();
 await expect(status).toContainText('Push cancelled — adjust quantities');
 // The Push button itself: described dialog, Tab kept inside, backdrop click, then proceed.
 const designNumber=page.locator('#dtgDesignNumber');await designNumber.fill('12345');await designNumber.dispatchEvent('change');await designNumber.press('Tab');
 await expect(push).toBeEnabled();await push.press('Enter');
 await expect(stock).toBeVisible();await expect(stock).toHaveAccessibleDescription(/^1 size exceeds SanMar's current stock\./);
 await expect(stock.locator('.dscm-item')).toHaveText('PC54 Jet Black M × 200 125 in stock');
 for(let i=0;i<4;i++){await page.keyboard.press('Tab');expect(await stock.evaluate(d=>d.contains(document.activeElement))).toBe(true);}
 const axe=await new AxeBuilder({page}).include('dialog.dtg-stock-confirm-backdrop').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(axe.violations.map(v=>v.id)).toEqual([]);
 await status.evaluate(n=>{n.textContent='';});
 await page.mouse.click(8,8);await expect(stock).toHaveCount(0);await expect(push).toBeFocused();
 await expect(status).toContainText('Push cancelled — adjust quantities');expect(pushes).toHaveLength(0);
 await push.press('Enter');await stock.getByRole('button',{name:'Proceed anyway'}).click();await expect(stock).toHaveCount(0);
 await expect.poll(()=>pushes.length).toBe(1);await expect(status).toContainText('Synthetic push refused');
 check(expect,e);
});

test('CSS quote builders: dtg assistant overwrite confirm keeps the panel open and returns focus',async({page})=>{
 test.skip(original,'Native confirm dialogs replaced the reviewed overlay.');
 const e=await open(page,{assistant:true,richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'});await page.waitForLoadState('networkidle');
 await page.locator('.dtg-cc-add-default').first().click();
 const qty=page.locator('.dtg-line-card input[data-size="M"]').first();await qty.fill('24');await qty.dispatchEvent('change');
 await expect(page.locator('#dtgPriceSummary')).toContainText('$396.72');
 await page.locator('#floatingQuoteBtn').click();await expect(page.locator('#aiChatPanel')).toHaveClass(/open/);await expect(page.locator('#aiChatMessages')).toContainText('Synthetic research reply.');
 const input=page.locator('#aiChatTextarea'),panel=page.locator('#aiChatPanel');await input.focus();
 const quote={locationCode:'LC',lineItems:[{styleNumber:'PC54',color:'Jet Black',sizes:{L:12}}]};
 await page.evaluate(q=>{window.__fill=window.DTGInlineForm.fillFromQuote(q,null).then(()=>'settled');},quote);
 const overwrite=page.getByRole('dialog',{name:'AI updated the quote'});
 await expect(overwrite).toBeVisible();await expect(overwrite).toHaveAccessibleDescription(/^You have edits on the form\./);
 await expect(overwrite.getByRole('button',{name:'Keep my edits'})).toBeFocused();
 // Escape closes only the confirm; the assistant behind it stays open and the edits stay.
 await page.keyboard.press('Escape');await expect(overwrite).toHaveCount(0);
 await expect(panel).toHaveClass(/open/);await expect(input).toBeFocused();
 expect(await page.evaluate(()=>window.__fill)).toBe('settled');await expect(qty).toHaveValue('24');
 await page.evaluate(q=>{window.__fill=window.DTGInlineForm.fillFromQuote(q,null);},quote);
 await overwrite.getByRole('button',{name:'Apply new quote'}).click();await expect(overwrite).toHaveCount(0);
 await expect(page.locator('.dtg-line-card input[data-size="L"]').first()).toHaveValue('12');await expect(input).toBeFocused();
 await page.keyboard.press('Escape');await expect(panel).not.toHaveClass(/open/);
 check(expect,e);
});

test('CSS quote builders: dtg assistant swatches render without inline styles or broken images',async({page})=>{
 test.skip(original,'Runtime swatch rendering changed after the reviewed migration.');
 // Block style attributes as the target CSP will, so a colour written as style="" would render transparent.
 const html=fs.readFileSync(path.join(__dirname,'../../quote-builders/dtg-quote-builder.html'));
 await page.route('**/quote-builders/dtg-quote-builder.html',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"style-src-attr 'none'"},body:html}));
 const e=await open(page,{assistant:true,richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'});await page.waitForLoadState('networkidle');
 const image='/__core-fixture/garment.svg',sse=(event,data)=>'event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n';
 await page.route('**/__missing-swatch/**',route=>route.fulfill({status:404,body:''}));
 await page.route('**/api/dtg-quote-ai/chat',route=>route.fulfill({contentType:'text/event-stream',body:
  sse('tool_result',{tool:'recommend_top_sellers',result:{category:'T-Shirts',count:1,products:[{styleNumber:'PC54',name:'Essential Cotton Tee',brand:'Port & Company',fabric:'100% cotton',salesRank:1,bestColors:[{color:'#263b46',name:'Jet Black',units:'240'},{color:'#c64f13',name:'Brilliant Orange'}]}]}})
  +sse('tool_result',{tool:'lookup_product_details',result:{styleNumber:'PC54',title:'Essential Cotton Tee',colorCount:2,sizeCount:2,colors:[{name:'Jet Black',catalogColor:'JetBlack',swatchImageUrl:'/__missing-swatch/jet-black.png',mainImageUrl:image},{name:'Brilliant Orange',catalogColor:'BrillOrng',swatchImageUrl:image,mainImageUrl:image}],sizes:[{size:'S'},{size:'M'}]}})
  +sse('delta',{text:'Synthetic research reply.'})}));
 await page.locator('#floatingQuoteBtn').click();await expect(page.locator('#aiChatMessages')).toContainText('Synthetic research reply.');
 const chips=page.locator('.ts-color-chip .swatch');await expect(chips).toHaveCount(2);
 await expect(chips.nth(0)).toHaveCSS('background-color','rgb(38, 59, 70)');await expect(chips.nth(1)).toHaveCSS('background-color','rgb(198, 79, 19)');
 // The failed swatch shows the placeholder through a loaded blank image, keeping its alt text for screen readers.
 const failed=page.locator('.product-details-card .color-swatch[data-color-name="Jet Black"] .cs-img');
 await expect(failed).toHaveClass(/placeholder/);await expect(failed).toHaveAttribute('alt','Jet Black');
 await expect.poll(()=>failed.evaluate(img=>img.complete&&img.naturalWidth)).toBe(1);
 check(expect,e);
});

// Runtime markup from the builder scripts carries no style="" attributes (2026-09-17). This page has no static
// style attributes either, so it serves with them blocked; the shared pieces are mounted into test hosts here.
test('CSS quote builders: runtime pieces keep their styles with style attributes blocked',async({page})=>{
 test.skip(original,'Runtime markup moved to classes after the reviewed migration.');
 const html=fs.readFileSync(path.join(__dirname,'../../quote-builders/dtg-quote-builder.html'));
 await page.route('**/quote-builders/dtg-quote-builder.html',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"style-src-attr 'none'"},body:html}));
 await page.route('**/api/mo/orders**',route=>route.fulfill({json:{result:[{id_Order:141001,DesignName:'Example Logo',date_Ordered:'2026-08-03T10:00:00'}]}}));
 const e=await open(page,{richCatalog:true,url:'/quote-builders/dtg-quote-builder.html'});await page.waitForLoadState('networkidle');
 // DTG line card: the colour swatch image and the colour menu rows.
 await page.locator('.dtg-cc-add-default').first().click();
 await expect(page.locator('.dtg-line-card .dtg-row-color-swatch').first()).toHaveCSS('background-image',/garment\.svg/);
 const colour=page.locator('.dtg-line-card [data-combo-kind="color"] input').first();await colour.click();await colour.fill('');
 const menuRow=page.locator('.dtg-combobox-item-body').first();
 await expect(menuRow).toHaveCSS('display','flex');await expect(menuRow).toHaveCSS('gap','8px');await expect(menuRow).toHaveCSS('align-items','center');
 await colour.press('Escape');
 await page.evaluate(()=>{
  document.querySelector('main').insertAdjacentHTML('beforeend','<section id="qb-shared-hosts"><div id="qb-test-checklist"></div><div class="quantity-nudge" id="qb-test-nudge"></div><div class="qb-test-logo-mount"></div><textarea id="qb-test-notes" aria-label="Notes"></textarea><div class="form-group"><input id="qb-test-lookup" aria-label="Customer"></div><div id="qb-test-warning"></div></section>');
  updateEditModeUI('DTG-2026-777',2);
  renderPushChecklist(document.getElementById('qb-test-checklist'),[{ok:true,label:'Customer name'},{ok:false,label:'Design number',focusId:'qb-test-notes'}]);
  updateQuantityNudge(20,'emb',1.25,'qb-test-nudge','garment');
  initLogoStatusChips({mountSel:'.qb-test-logo-mount',notesSel:'#qb-test-notes',assumption:()=>'Pricing assumes a standard logo.'});
  showRecentCustomerOrders(10001,{anchorId:'qb-test-lookup'});
  surfaceCustomerContext({Customer_Warning:'Pay before release'},{warningContainerId:'qb-test-warning'});
 });
 const hosts=page.locator('#qb-shared-hosts');
 await expect(page.locator('.power-header-subtitle .qb-edit-mode-label')).toHaveCSS('color','rgb(251, 191, 36)');
 const todo=hosts.locator('button.pr-item.pr-no');
 for(const hover of [false,true]){
  if(hover)await todo.hover();
  await expect(todo).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(todo).toHaveCSS('border-top-width','0px');
  await expect(todo).toHaveCSS('text-decoration-style','dotted');await expect(todo).toHaveCSS('text-align','left');await expect(todo).toHaveCSS('font-weight','400');
 }
 await expect(hosts.locator('.nudge-icon')).toHaveCSS('margin-right','4px');await expect(hosts.locator('.nudge-savings')).toHaveCSS('color','rgb(21, 128, 61)');
 const assumption=hosts.locator('#logo-assumption-panel');await expect(assumption).toBeHidden();
 const tbd=hosts.locator('.lsc-chip[data-status="tbd"]');
 await tbd.click();await expect(assumption).toBeVisible();await expect(assumption).toContainText('Pricing assumes a standard logo.');
 await tbd.click();await expect(assumption).toBeHidden();
 const orders=hosts.locator('#qb-recent-orders');
 await expect(orders).toHaveCSS('background-color','rgb(248, 250, 252)');await expect(orders).toHaveCSS('border-top-color','rgb(226, 232, 240)');await expect(orders).toHaveCSS('font-size','12px');
 await expect(orders.locator('.qb-ro-head')).toHaveCSS('display','flex');await expect(orders.locator('.qb-ro-title')).toHaveCSS('text-transform','uppercase');
 await expect(orders.locator('.qb-ro-row')).toHaveCSS('display','flex');await expect(orders.locator('.qb-ro-text')).toHaveCSS('white-space','nowrap');
 await expect(orders.locator('.qb-ro-date')).toHaveCSS('color','rgb(156, 163, 175)');
 await expect(orders.locator('.qb-ro-ref')).toHaveCSS('border-top-width','1px');await expect(orders.locator('.qb-ro-dismiss')).toHaveCSS('border-top-width','0px');
 await expect(hosts.locator('.ccb-warning-icon')).toHaveCSS('font-size','18px');await expect(hosts.locator('.ccb-warning-label')).toHaveCSS('color','rgb(146, 64, 14)');
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
