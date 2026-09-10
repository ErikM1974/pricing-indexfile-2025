const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default,fs=require('node:fs'),path=require('node:path');
const {open,fixture,check}=require('./helpers/quote-view-browser'),output=path.join(__dirname,'screenshots/css-unification');
const capture=process.env.QUOTE_VIEW_BASELINE==='1',edition=capture?'original':'current';
fs.mkdirSync(output,{recursive:true});test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
async function ready(page){await expect(page.locator('#quote-content')).toBeVisible();await page.waitForFunction(()=>!!window.__quoteView?.fullData);await expect(page.locator('.sw-vendor-loading:visible')).toHaveCount(0);}
async function snapshot(page){return page.evaluate(()=>({title:document.title,fields:[...document.querySelectorAll('#quote-content [id]')].filter(n=>!n.querySelector('[id]')).map(n=>({id:n.id,text:n.textContent.replace(/\s+/g,' ').trim(),visible:!!n.getClientRects().length,disabled:!!n.disabled})),rows:[...document.querySelectorAll('#items-container tr')].map(r=>[...r.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim())),links:[...document.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),text:n.textContent.replace(/\s+/g,' ').trim()})),forms:[...document.querySelectorAll('input,select,textarea')].map(n=>({id:n.id,name:n.name,type:n.type,value:n.value,checked:n.checked})),totalText:document.querySelector('.totals-card').innerText.replace(/\s+/g,' ').trim(),paper:document.querySelector('#quote-content').innerText}));}
function original(name){return JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/quote-view-'+name+'-original-browser.json'),'utf8'));}
function compareSnapshot(actual, expected){
 expect(actual.title).toBe(expected.title);
 expect(actual.rows).toEqual(expected.rows);
 const paper=expected.paper.replace(/\s+/g,' ').trim(),start=paper.lastIndexOf('Subtotal:');
 const savedTotals=paper.slice(start).match(/^Subtotal:.*?Total items:\s*\d+/)?.[0];
 expect(savedTotals,'original totals captured on paper').toBeTruthy();
 expect(actual.totalText).toBe(savedTotals);
 const byId=new Map(actual.fields.map(f=>[f.id,f]));
 for(const field of expected.fields){
  expect(byId.has(field.id),field.id).toBe(true);
  const text=field.id==='req-ship-date'&&field.text==='September 20, 2026'?'September 21, 2026':field.text;
  expect(byId.get(field.id).text,field.id).toBe(text);
 }
 expect(actual.forms).toEqual(expected.forms);
 for(const link of expected.links)expect(actual.links).toContainEqual(link);
}
function compareActions(name,events){expect(events.actions).toEqual(original(name).events.actions);}
function save(name,value){fs.writeFileSync(path.join(__dirname,'../fixtures/quote-view-'+name+'-original-browser.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
for(const mode of ['open','accepted','deposit','paid','full-payment','expired','empty','escaped','mixed','dtf','dtg','screenprint','contract','sizeless','long','shopworks','cancelled','shipped','artwork'])test('CSS Quote View: '+edition+' '+mode+' values and print',async({page})=>{
 const events=await open(page,{original:capture,mode,staff:!['open','deposit','paid','full-payment','expired'].includes(mode)});await ready(page);const before=await snapshot(page),views=[];
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1050});views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));if(!capture){expect(views.at(-1).scrollWidth).toBeLessThanOrEqual(width);const controls=await page.locator('#sw-actions-row button:visible, #sw-sync-refresh-btn:visible, #qv-deposit-enable-btn:visible').evaluateAll(nodes=>nodes.map(n=>({id:n.id,height:n.getBoundingClientRect().height})));for(const c of controls)expect(c.height,c.id+' touch target').toBeGreaterThanOrEqual(44);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);}if(['open','mixed','shopworks','artwork'].includes(mode)&&[1440,320].includes(width))await page.screenshot({path:path.join(output,'quote-view-'+mode+'-'+edition+'-'+width+'.png'),fullPage:true});}
 let paper='';if(['open','mixed','shopworks','contract','long','sizeless','paid'].includes(mode)){await page.setViewportSize({width:1440,height:1050});await page.emulateMedia({media:'print'});paper=await page.locator('#quote-content').innerText();await page.pdf({path:path.join(output,'quote-view-'+mode+'-'+edition+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});}
 check(expect,events);expect(events.actions).toEqual([]);if(capture)save(mode,{before,views,paper,events});else compareSnapshot(before,original(mode).before);
});
for(const status of [401,404,500])test('CSS Quote View: '+edition+' failed load '+status,async({page})=>{
 const events=await open(page,{original:capture,status});await expect(page.locator('#error-state')).toBeVisible();await expect(page.locator('#quote-content')).toBeHidden();check(expect,events);if(capture)save('load-'+status,{text:await page.locator('#error-state').innerText(),events});
});
test('CSS Quote View: '+edition+' token on full quote and invoice destination',async({page})=>{
 const events=await open(page,{original:capture,staff:false,token:true});await ready(page);const href=await page.locator('#open-invoice-link').getAttribute('href');check(expect,events);expect(events.reads.every(r=>new URLSearchParams(r.query).get('k')==='review token / only')).toBe(true);if(capture)save('token',{href,events});else expect(new URL(href,'http://localhost:3400').searchParams.get('k')).toBe('review token / only');
});
for(const delivery of ['pickup','ship'])test('CSS Quote View: '+edition+' accepting '+delivery+' exact request',async({page})=>{
 const events=await open(page,{original:capture,staff:false,token:true});await ready(page);await page.locator('#accept-quote-btn').click();await expect(page.locator('#accept-modal')).toBeVisible();await page.locator('#accept-name').fill('River Sample');await page.locator('#accept-email').fill('review@example.test');await page.locator('#accept-'+delivery).check();await page.locator('#modal-accept').click();await expect(page.locator('#success-modal')).toBeVisible();expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({name:'River Sample',email:'review@example.test',deliveryMethod:delivery});check(expect,events);if(!capture)compareActions('accept-'+delivery,events);if(capture)save('accept-'+delivery,{after:await snapshot(page),success:await page.locator('#success-modal').innerText(),events});
});
test('CSS Quote View: '+edition+' staff enables payment with saved preview inputs',async({page})=>{
 const events=await open(page,{original:capture,mode:'accepted'});await ready(page);await expect(page.locator('#qv-deposit-form')).toBeVisible();await page.locator('#qv-deposit-shipping').fill('10');await page.locator('#qv-deposit-taxrate').fill('10');const preview=await page.locator('#qv-deposit-preview').innerText();await page.locator('#qv-deposit-enable-btn').click();await expect(page.locator('#deposit-pay-btn')).toBeVisible();expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({shipping:10,taxRatePct:10});check(expect,events);if(!capture){compareActions('enable-deposit',events);expect(preview).toBe(original('enable-deposit').preview);}if(capture)save('enable-deposit',{preview,after:await snapshot(page),events,copied:await page.evaluate(()=>window.__copied)});
});
test('CSS Quote View: '+edition+' checkout destination is fully synthetic',async({page})=>{
 const events=await open(page,{original:capture,mode:'deposit',staff:false,token:true});await ready(page);await page.locator('#deposit-pay-btn').click();await expect(page).toHaveURL('http://localhost:3400/__quote-fixture/checkout');expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe('{}');check(expect,events);if(!capture)compareActions('checkout',events);if(capture)save('checkout',{url:page.url(),events});
});
test('CSS Quote View: '+edition+' product detail and copy/print remain local',async({page})=>{
 const events=await open(page,{original:capture});await ready(page);await page.locator('[data-qv-group]').first().click();await expect(page.locator('.product-modal')).toBeVisible();const detail=await page.locator('.product-modal').innerText();await page.locator('.product-modal-close').click();await page.locator('#sw-action-copy-link').click();await page.locator('#sw-action-print').click();expect(await page.evaluate(()=>window.__printCalls)).toBe(1);check(expect,events);if(capture)save('detail-copy-print',{detail,copied:await page.evaluate(()=>window.__copied),events});
});

test.describe('CSS Quote View: additional original contracts',()=>{
 for(const method of ['open','dtf','screenprint'])test(edition+' '+method+' push payload and confirmation',async({page})=>{
  const events=await open(page,{original:capture,mode:method});await ready(page);let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.accept();});await page.locator('#push-shopworks-btn').click();await expect(page.locator('#push-shopworks-label')).toContainText('Pushed');expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({quoteId:fixture(method).id,isTest:false,force:false});check(expect,events);if(!capture)compareActions('push-'+method,events);if(capture)save('push-'+method,{confirmation,events,after:await snapshot(page)});
 });
 for(const status of [200,500])test(edition+' sync '+status+' result',async({page})=>{
  const events=await open(page,{original:capture,mode:'shopworks',actionStatus:status===500?500:undefined,token:true});await ready(page);const before=await snapshot(page);await page.locator('#sw-sync-refresh-btn').click();await expect(page.locator('#sw-sync-refresh-btn')).toBeEnabled();expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe(null);if(status===500)await expect(page.locator('#sw-sync-pill-text')).toContainText('Sync failed');check(expect,events);if(!capture)compareActions('sync-'+status,events);if(capture)save('sync-'+status,{before,after:await snapshot(page),events});
 });
 test(edition+' manually linked order keeps its exact payload',async({page})=>{
  const f=fixture();f.full.status='Processed';f.full.shopWorks={status:'Pending',lastSynced:'2026-09-10T19:00:00Z'};
  const events=await open(page,{original:capture,fixture:f});await ready(page);await expect(page.locator('#sw-manual-wo-strip')).toBeVisible();await page.locator('#sw-manual-wo-input').fill('740123');await page.locator('#sw-manual-wo-btn').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#sw-manual-wo-btn')).toBeEnabled();expect(JSON.parse(events.actions[0].body)).toEqual({shopWorksOrderNumber:740123});check(expect,events);if(!capture)compareActions('manual-wo',events);if(capture)save('manual-wo',{events,after:await snapshot(page)});
 });
 test(edition+' ShipStation request stays synthetic',async({page})=>{
  const events=await open(page,{original:capture,mode:'shopworks'});await ready(page);let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.accept();});await page.locator('#sw-action-shipstation').click();await expect(page.locator('#sw-action-shipstation')).toContainText('In ShipStation');expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe(null);check(expect,events);if(!capture)compareActions('shipstation',events);if(capture)save('shipstation',{confirmation,events,after:await snapshot(page)});
 });
 test(edition+' forged storage is recorded before identity migration',async({page})=>{
  await page.addInitScript(()=>{sessionStorage.setItem('nwca_user_name','Forged');sessionStorage.setItem('nwca_user_email','fake@example.test');sessionStorage.setItem('nwca_user_role','admin');});
  const events=await open(page,{original:capture,staff:false});await ready(page);const staff=await page.evaluate(()=>window.__quoteView.isStaff);check(expect,events);if(capture)save('forged-storage',{staff,after:await snapshot(page),events});else expect(staff).toBe(false);
 });
 test(edition+' failed supplemental order data',async({page})=>{
  const events=await open(page,{original:capture,fullStatus:500});await expect(page.locator('#quote-content')).toBeVisible();await expect.poll(()=>events.reads.length).toBe(2);check(expect,events);if(capture)save('full-failed',{after:await snapshot(page),events});
 });
 test(edition+' builder size rows and date-only requested ship date',async({page})=>{
  const f=fixture();f.items[1].StyleNumber='PC90H';f.items[0].LineNumber=1;f.items[1].LineNumber=2;
  const events=await open(page,{original:capture,fixture:f});await ready(page);const before=await snapshot(page);check(expect,events);if(capture)save('builder-sizes',{before,events});else compareSnapshot(before,original('builder-sizes').before);
 });
});

test('CSS Quote View: '+edition+' lazy artwork form boundaries',async({page})=>{
 const events=await open(page,{original:capture,mode:'artwork',artForm:true});await ready(page);await page.locator('#sw-action-send-steve').click();await expect(page.locator('#sts-modal')).toBeVisible();await expect(page.locator('#gsf-company')).toHaveValue('Cedar Example Construction');await expect(page.locator('#gsf-order-num')).toHaveValue('740123');await expect(page.locator('#gsf-design-num')).toHaveValue('44012');await expect(page.locator('#gsf-prelim')).toBeEnabled();await expect.poll(()=>events.actions.length).toBe(3);
 const fields=await page.locator('#sts-form-mount').evaluate(n=>[...n.querySelectorAll('input,select,textarea')].map(f=>({id:f.id,name:f.name,type:f.type,value:f.value,checked:f.checked}))),styles=await page.locator('link[data-href]').evaluateAll(list=>list.map(n=>n.getAttribute('href'))),views=[];
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1050});views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));if([1440,320].includes(width))await page.screenshot({path:path.join(output,'quote-view-art-form-'+edition+'-'+width+'.png'),fullPage:true});}
 await page.locator('#sts-modal-close').click();await expect(page.locator('#sts-modal')).toBeHidden();check(expect,events);if(!capture){compareActions('lazy-art-form',events);expect(fields).toEqual(original('lazy-art-form').fields);}if(capture)save('lazy-art-form',{fields,styles,views,events});
});


test.describe('CSS Quote View: migrated recovery and keyboard behavior',()=>{
 test.skip(capture,'Original baseline contracts are already immutable.');
 for(const invalid of ['name','email','delivery'])test('acceptance '+invalid+' validation stays inside the dialog',async({page})=>{
  const events=await open(page,{staff:false});await ready(page);await page.locator('#accept-quote-btn').click();
  if(invalid==='name')await page.locator('#accept-name').fill('');
  if(invalid==='email')await page.locator('#accept-email').fill('invalid');
  if(invalid!=='delivery')await page.locator('#accept-pickup').check();
  await page.locator('#modal-accept').click();await expect(page.locator('#accept-error')).toBeVisible();expect(events.actions).toEqual([]);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');await expect(page.locator('#accept-modal')).toBeHidden();await expect(page.locator('#accept-quote-btn')).toBeFocused();check(expect,events);
 });
 test('pending acceptance blocks duplicates and escape; failure remains retryable',async({page})=>{
  let release;const state={staff:false,token:true,actionStatus:500,actionHold:new Promise(r=>release=r)};
  const events=await open(page,state);await ready(page);await page.locator('#accept-quote-btn').click();await page.locator('#accept-ship').check();
  await page.locator('#modal-accept').click();await expect.poll(()=>events.actions.length).toBe(1);
  await page.evaluate(()=>window.__quoteView.acceptQuote());await page.keyboard.press('Escape');await expect(page.locator('#accept-modal')).toBeVisible();await expect(page.locator('#modal-cancel')).toBeDisabled();expect(events.actions).toHaveLength(1);
  release();await expect(page.locator('#accept-error')).toBeVisible();await expect(page.locator('#modal-accept')).toBeEnabled();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  state.actionStatus=undefined;state.actionHold=undefined;await page.locator('#modal-accept').click();await expect(page.locator('#success-modal')).toBeVisible();expect(events.actions).toHaveLength(2);expect(events.actions[0]).toEqual(events.actions[1]);check(expect,events);
 });
 test('acceptance radio keyboard navigation and success focus',async({page})=>{
  const events=await open(page,{staff:false});await ready(page);await page.locator('#accept-quote-btn').focus();await page.keyboard.press('Enter');await expect(page.locator('#accept-name')).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('#accept-email')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#accept-pickup')).toBeFocused();await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await expect(page.locator('#accept-ship')).toBeChecked();
  await page.locator('#modal-accept').click();await expect(page.locator('#success-close')).toBeFocused();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.keyboard.press('Enter');await expect(page.locator('#success-modal')).toBeHidden();check(expect,events);
 });
 test('checkout error restores the payment button and keeps the stored amount',async({page})=>{
  let release;const state={staff:false,mode:'deposit',actionStatus:500,actionHold:new Promise(r=>release=r)},events=await open(page,state);await ready(page);
  const text=await page.locator('#deposit-pay-btn').innerText();await page.locator('#deposit-pay-btn').click();await expect.poll(()=>events.actions.length).toBe(1);await page.evaluate(()=>window.__quoteView.startDepositCheckout(document.getElementById('deposit-pay-btn')));expect(events.actions).toHaveLength(1);
  release();await expect(page.locator('.nwca-toast-error')).toBeVisible();await expect(page.locator('#deposit-pay-btn')).toHaveText(text);await expect(page.locator('#deposit-pay-btn')).toBeEnabled();
  state.actionStatus=undefined;await page.locator('#deposit-pay-btn').click();await expect(page).toHaveURL('http://localhost:3400/__quote-fixture/checkout');expect(events.actions).toHaveLength(2);expect(events.actions[0]).toEqual(events.actions[1]);check(expect,events);
 });
 test('staff payment setup failure can be retried without duplicate requests',async({page})=>{
  let release;const state={mode:'accepted',actionStatus:500,actionHold:new Promise(r=>release=r)},events=await open(page,state);await ready(page);
  await page.locator('#qv-deposit-shipping').fill('10');await page.locator('#qv-deposit-taxrate').fill('10');await page.locator('#qv-deposit-enable-btn').click();await expect.poll(()=>events.actions.length).toBe(1);await page.evaluate(()=>window.__quoteView.enableDeposit());expect(events.actions).toHaveLength(1);
  release();await expect(page.locator('.nwca-toast-error')).toBeVisible();await expect(page.locator('#qv-deposit-enable-btn')).toBeEnabled();await expect(page.locator('#deposit-panel')).toBeHidden();
  state.actionStatus=undefined;await page.locator('#qv-deposit-enable-btn').click();await expect(page.locator('#deposit-pay-btn')).toBeVisible();expect(events.actions).toHaveLength(2);expect(events.actions[0]).toEqual(events.actions[1]);check(expect,events);
 });
 test('supplemental failure exposes a retry without replacing saved quote values',async({page})=>{
  const state={fullStatus:500},events=await open(page,state);await expect(page.locator('#quote-data-warning')).toBeVisible();await expect(page.locator('.grand-total .value')).toHaveText('$785.40');
  state.fullStatus=undefined;await page.locator('#quote-data-retry').click();await ready(page);await expect(page.locator('#quote-data-warning')).toBeHidden();await expect(page.locator('.grand-total .value')).toHaveText('$785.40');expect(events.reads).toHaveLength(3);expect(events.actions).toEqual([]);check(expect,events);
 });
 test('failed sync keeps a warning through print, and retry is wired once',async({page})=>{
  const state={mode:'shopworks',actionStatus:500},events=await open(page,state);await ready(page);const total=await page.locator('.grand-total .value').textContent();
  await page.locator('#sw-sync-refresh-btn').click();await expect(page.locator('#quote-data-warning')).toBeVisible();await page.emulateMedia({media:'print'});await expect(page.locator('#quote-data-warning')).toBeVisible();await expect(page.locator('#quote-data-retry')).toBeHidden();await page.emulateMedia({media:'screen'});
  await expect(page.locator('.grand-total .value')).toHaveText(total);state.actionStatus=undefined;await page.locator('#quote-data-retry').click();await expect(page.locator('#quote-data-warning')).toBeHidden();expect(events.actions).toHaveLength(2);await page.locator('#sw-sync-refresh-btn').click();await expect(page.locator('#sw-sync-refresh-btn')).toBeEnabled();expect(events.actions).toHaveLength(3);check(expect,events);
 });
 test('pending sync does not send a second request',async({page})=>{
  let release;const state={mode:'shopworks',actionHold:new Promise(r=>release=r)},events=await open(page,state);await ready(page);await page.locator('#sw-sync-refresh-btn').click();await expect.poll(()=>events.actions.length).toBe(1);
  await page.evaluate(()=>window.__quoteView.syncFromShopWorks({manual:true}));expect(events.actions).toHaveLength(1);await expect(page.locator('#sw-sync-refresh-btn')).toBeDisabled();release();await expect(page.locator('#sw-sync-refresh-btn')).toBeEnabled();check(expect,events);
 });
 for(const status of [401,404,500])test('initial '+status+' load can be retried',async({page})=>{
  const state={status},events=await open(page,state);await expect(page.locator('#error-state')).toBeVisible();state.status=undefined;await page.locator('#quote-retry').click();await ready(page);await expect(page.locator('#error-state')).toBeHidden();check(expect,events);
 });
 test('staff controls wait for verified identity and reject forged storage',async({page})=>{
  let release;await page.addInitScript(()=>{sessionStorage.setItem('nwca_user_name','Forged');sessionStorage.setItem('nwca_user_email','forged@example.test');sessionStorage.setItem('nwca_user_role','admin');});
  const state={staff:false,identityHold:new Promise(r=>release=r)},events=await open(page,state);
  await expect(page.locator('#sw-actions-row')).toBeHidden();await expect(page.locator('#push-shopworks-btn')).toBeHidden();release();await ready(page);await expect(page.locator('#sw-actions-row')).toBeHidden();await expect(page.locator('#qv-deposit-strip')).toBeHidden();expect(events.actions).toEqual([]);check(expect,events);
 });
 test('loading quote hides all print and acceptance controls',async({page})=>{
  let release;const state={staff:false,hold:new Promise(r=>release=r)},events=await open(page,state);await expect(page.locator('#loading-state')).toBeVisible();await expect(page.locator('#download-pdf-btn')).toBeHidden();await expect(page.locator('#accept-quote-btn')).toBeHidden();release();await ready(page);check(expect,events);
 });
 test('product detail keyboard close restores the original item focus',async({page})=>{
  const events=await open(page,{staff:false});await ready(page);const trigger=page.locator('[data-qv-group]').first();await trigger.focus();await page.keyboard.press('Enter');await expect(page.locator('#product-modal')).toBeVisible();await expect(page.locator('.product-modal-close')).toBeFocused();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.keyboard.press('Escape');await expect(page.locator('#product-modal')).toBeHidden();await expect(trigger).toBeFocused();check(expect,events);
 });
 for(const method of ['open','dtf','screenprint'])test(method+' push failures and cancel preserve the original request',async({page})=>{
  const state={mode:method,actionStatus:500},events=await open(page,state);await ready(page);page.once('dialog',d=>d.dismiss());await page.locator('#push-shopworks-btn').click();expect(events.actions).toEqual([]);
  page.once('dialog',d=>d.accept());await page.locator('#push-shopworks-btn').click();await expect(page.locator('.nwca-toast-error')).toBeVisible();await expect(page.locator('#push-shopworks-btn')).toBeEnabled();compareActions('push-'+method,events);check(expect,events);
 });
 test('shipped orders with no tracking number stay closed to another shipment',async({page})=>{
  const f=fixture('shipped');f.full.shipStation={status:'shipped',trackingNumber:'',orderId:null};const events=await open(page,{fixture:f});await ready(page);await expect(page.locator('#sw-action-shipstation')).toBeDisabled();await expect(page.locator('#sw-action-shipstation')).toContainText('Shipped');expect(events.actions).toEqual([]);check(expect,events);
 });
 test('real artwork form closes by keyboard and restores staff action focus',async({page})=>{
  const events=await open(page,{mode:'artwork',artForm:true});await ready(page);await page.locator('#sw-action-send-steve').click();await expect(page.locator('#sts-modal-close')).toBeFocused();await expect(page.locator('#gsf-prelim')).toBeEnabled();await expect.poll(()=>events.actions.length).toBe(3);
  await page.keyboard.press('Escape');await expect(page.locator('#sts-modal')).toBeHidden();await expect(page.locator('#sw-action-send-steve')).toBeFocused();compareActions('lazy-art-form',events);check(expect,events);
 });
});


if(!capture){
 test('CSS Quote View: dialog visual review at desktop and phone widths',async({page})=>{
  const events=await open(page,{staff:false});await ready(page);
  for(const width of [1440,320]){
   await page.setViewportSize({width,height:1050});await page.locator('[data-qv-group]').first().click();await page.locator('#product-modal').screenshot({path:path.join(output,'quote-view-product-dialog-current-'+width+'.png')});await page.keyboard.press('Escape');
   await page.locator('#accept-quote-btn').click();await page.locator('#accept-email').fill('invalid');await page.locator('#modal-accept').click();await expect(page.locator('#accept-error')).toBeVisible();await page.locator('#accept-modal').screenshot({path:path.join(output,'quote-view-accept-dialog-current-'+width+'.png')});await page.keyboard.press('Escape');
  }
  await page.locator('#accept-quote-btn').click();await page.locator('#accept-pickup').check();await page.locator('#modal-accept').click();await expect(page.locator('#success-modal')).toBeVisible();await page.locator('#success-modal').screenshot({path:path.join(output,'quote-view-success-dialog-current-320.png')});check(expect,events);
 });
 test('CSS Quote View: change-history notices preserve readable severity and disclosure',async({page})=>{
  const events=await open(page);await ready(page);
  for(const severity of ['info','warning','critical']){
   await page.evaluate(severity=>window.__quoteView._renderChangeBanner(Array.from({length:4},(_,i)=>({PK_ID:91001+i,Severity:severity,FieldName:'CustomerEmail',OldValue:'before@example.test',NewValue:'after@example.test',ChangedAt:'2026-09-10T18:00:00Z'}))),severity);
   for(const width of [1440,320]){await page.setViewportSize({width,height:1050});await expect(page.locator('#sw-change-banner')).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.locator('#sw-change-banner').screenshot({path:path.join(output,'quote-view-change-'+severity+'-current-'+width+'.png')});}
   await page.locator('#sw-change-banner summary').click();await expect(page.locator('#sw-change-banner details')).toHaveAttribute('open','');expect(await page.locator('#sw-change-banner details li').count()).toBe(4);
  }
  expect(events.actions).toEqual([]);check(expect,events);
 });
}
