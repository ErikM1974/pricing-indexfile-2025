const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const {open,fixture,check}=require('./helpers/quote-view-browser'),output=path.join(__dirname,'screenshots/css-unification');
const capture=process.env.QUOTE_VIEW_BASELINE==='1',edition=capture?'original':'current';
fs.mkdirSync(output,{recursive:true});test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
async function ready(page){await expect(page.locator('#quote-content')).toBeVisible();await page.waitForFunction(()=>!!window.__quoteView?.fullData);await expect(page.locator('.sw-vendor-loading:visible')).toHaveCount(0);}
async function snapshot(page){return page.evaluate(()=>({title:document.title,fields:[...document.querySelectorAll('#quote-content [id]')].filter(n=>!n.querySelector('[id]')).map(n=>({id:n.id,text:n.textContent.replace(/\s+/g,' ').trim(),visible:!!n.getClientRects().length,disabled:!!n.disabled})),rows:[...document.querySelectorAll('#items-container tr')].map(r=>[...r.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim())),links:[...document.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),text:n.textContent.replace(/\s+/g,' ').trim()})),forms:[...document.querySelectorAll('input,select,textarea')].map(n=>({id:n.id,name:n.name,type:n.type,value:n.value,checked:n.checked})),paper:document.querySelector('#quote-content').innerText}));}
function save(name,value){fs.writeFileSync(path.join(__dirname,'../fixtures/quote-view-'+name+'-original-browser.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
for(const mode of ['open','accepted','deposit','paid','full-payment','expired','empty','escaped','mixed','dtf','dtg','screenprint','contract','sizeless','long','shopworks','cancelled','shipped','artwork'])test('CSS Quote View: '+edition+' '+mode+' values and print',async({page})=>{
 const events=await open(page,{original:capture,mode,staff:!['open','deposit','paid','full-payment','expired'].includes(mode)});await ready(page);const before=await snapshot(page),views=[];
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1050});views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));if(['open','mixed','shopworks','artwork'].includes(mode)&&[1440,320].includes(width))await page.screenshot({path:path.join(output,'quote-view-'+mode+'-'+edition+'-'+width+'.png'),fullPage:true});}
 let paper='';if(['open','mixed','shopworks','contract','long','sizeless','paid'].includes(mode)){await page.setViewportSize({width:1440,height:1050});await page.emulateMedia({media:'print'});paper=await page.locator('#quote-content').innerText();await page.pdf({path:path.join(output,'quote-view-'+mode+'-'+edition+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});}
 check(expect,events);expect(events.actions).toEqual([]);if(capture)save(mode,{before,views,paper,events});
});
for(const status of [401,404,500])test('CSS Quote View: '+edition+' failed load '+status,async({page})=>{
 const events=await open(page,{original:capture,status});await expect(page.locator('#error-state')).toBeVisible();await expect(page.locator('#quote-content')).toBeHidden();check(expect,events);if(capture)save('load-'+status,{text:await page.locator('#error-state').innerText(),events});
});
test('CSS Quote View: '+edition+' token on full quote and invoice destination',async({page})=>{
 const events=await open(page,{original:capture,staff:false,token:true});await ready(page);const href=await page.locator('#open-invoice-link').getAttribute('href');check(expect,events);expect(events.reads.every(r=>new URLSearchParams(r.query).get('k')==='review token / only')).toBe(true);if(capture)save('token',{href,events});else expect(new URL(href,'http://localhost:3400').searchParams.get('k')).toBe('review token / only');
});
for(const delivery of ['pickup','ship'])test('CSS Quote View: '+edition+' accepting '+delivery+' exact request',async({page})=>{
 const events=await open(page,{original:capture,staff:false,token:true});await ready(page);await page.locator('#accept-quote-btn').click();await expect(page.locator('#accept-modal')).toBeVisible();await page.locator('#accept-name').fill('River Sample');await page.locator('#accept-email').fill('review@example.test');await page.locator('#accept-'+delivery).check();await page.locator('#modal-accept').click();await expect(page.locator('#success-modal')).toBeVisible();expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({name:'River Sample',email:'review@example.test',deliveryMethod:delivery});check(expect,events);if(capture)save('accept-'+delivery,{after:await snapshot(page),success:await page.locator('#success-modal').innerText(),events});
});
test('CSS Quote View: '+edition+' staff enables payment with saved preview inputs',async({page})=>{
 const events=await open(page,{original:capture,mode:'accepted'});await ready(page);await expect(page.locator('#qv-deposit-form')).toBeVisible();await page.locator('#qv-deposit-shipping').fill('10');await page.locator('#qv-deposit-taxrate').fill('10');const preview=await page.locator('#qv-deposit-preview').innerText();await page.locator('#qv-deposit-enable-btn').click();await expect(page.locator('#deposit-pay-btn')).toBeVisible();expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({shipping:10,taxRatePct:10});check(expect,events);if(capture)save('enable-deposit',{preview,after:await snapshot(page),events,copied:await page.evaluate(()=>window.__copied)});
});
test('CSS Quote View: '+edition+' checkout destination is fully synthetic',async({page})=>{
 const events=await open(page,{original:capture,mode:'deposit',staff:false,token:true});await ready(page);await page.locator('#deposit-pay-btn').click();await expect(page).toHaveURL('http://localhost:3400/__quote-fixture/checkout');expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe('{}');check(expect,events);if(capture)save('checkout',{url:page.url(),events});
});
test('CSS Quote View: '+edition+' product detail and copy/print remain local',async({page})=>{
 const events=await open(page,{original:capture});await ready(page);await page.locator('[data-qv-group]').first().click();await expect(page.locator('.product-modal')).toBeVisible();const detail=await page.locator('.product-modal').innerText();await page.locator('.product-modal-close').click();await page.locator('#sw-action-copy-link').click();await page.locator('#sw-action-print').click();expect(await page.evaluate(()=>window.__printCalls)).toBe(1);check(expect,events);if(capture)save('detail-copy-print',{detail,copied:await page.evaluate(()=>window.__copied),events});
});

test.describe('CSS Quote View: additional original contracts',()=>{
 for(const method of ['open','dtf','screenprint'])test(edition+' '+method+' push payload and confirmation',async({page})=>{
  const events=await open(page,{original:capture,mode:method});await ready(page);let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.accept();});await page.locator('#push-shopworks-btn').click();await expect(page.locator('#push-shopworks-label')).toContainText('Pushed');expect(events.actions).toHaveLength(1);expect(JSON.parse(events.actions[0].body)).toEqual({quoteId:fixture(method).id,isTest:false,force:false});check(expect,events);if(capture)save('push-'+method,{confirmation,events,after:await snapshot(page)});
 });
 for(const status of [200,500])test(edition+' sync '+status+' result',async({page})=>{
  const events=await open(page,{original:capture,mode:'shopworks',actionStatus:status===500?500:undefined,token:true});await ready(page);const before=await snapshot(page);await page.locator('#sw-sync-refresh-btn').click();await expect(page.locator('#sw-sync-refresh-btn')).toBeEnabled();expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe(null);if(status===500)await expect(page.locator('#sw-sync-pill-text')).toContainText('Sync failed');check(expect,events);if(capture)save('sync-'+status,{before,after:await snapshot(page),events});
 });
 test(edition+' manually linked order keeps its exact payload',async({page})=>{
  const f=fixture();f.full.status='Processed';f.full.shopWorks={status:'Pending',lastSynced:'2026-09-10T19:00:00Z'};
  const events=await open(page,{original:capture,fixture:f});await ready(page);await expect(page.locator('#sw-manual-wo-strip')).toBeVisible();await page.locator('#sw-manual-wo-input').fill('740123');await page.locator('#sw-manual-wo-btn').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#sw-manual-wo-btn')).toBeEnabled();expect(JSON.parse(events.actions[0].body)).toEqual({shopWorksOrderNumber:740123});check(expect,events);if(capture)save('manual-wo',{events,after:await snapshot(page)});
 });
 test(edition+' ShipStation request stays synthetic',async({page})=>{
  const events=await open(page,{original:capture,mode:'shopworks'});await ready(page);let confirmation='';page.once('dialog',async d=>{confirmation=d.message();await d.accept();});await page.locator('#sw-action-shipstation').click();await expect(page.locator('#sw-action-shipstation')).toContainText('In ShipStation');expect(events.actions).toHaveLength(1);expect(events.actions[0].body).toBe(null);check(expect,events);if(capture)save('shipstation',{confirmation,events,after:await snapshot(page)});
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
  const events=await open(page,{original:capture,fixture:f});await ready(page);const before=await snapshot(page);check(expect,events);if(capture)save('builder-sizes',{before,events});
 });
});

test('CSS Quote View: '+edition+' lazy artwork form boundaries',async({page})=>{
 const events=await open(page,{original:capture,mode:'artwork',artForm:true});await ready(page);await page.locator('#sw-action-send-steve').click();await expect(page.locator('#sts-modal')).toBeVisible();await expect(page.locator('#gsf-company')).toHaveValue('Cedar Example Construction');await expect(page.locator('#gsf-order-num')).toHaveValue('740123');await expect(page.locator('#gsf-design-num')).toHaveValue('44012');await expect(page.locator('#gsf-prelim')).toBeEnabled();await expect.poll(()=>events.actions.length).toBe(3);
 const fields=await page.locator('#sts-form-mount').evaluate(n=>[...n.querySelectorAll('input,select,textarea')].map(f=>({id:f.id,name:f.name,type:f.type,value:f.value,checked:f.checked}))),styles=await page.locator('link[data-href]').evaluateAll(list=>list.map(n=>n.getAttribute('href'))),views=[];
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1050});views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));if([1440,320].includes(width))await page.screenshot({path:path.join(output,'quote-view-art-form-'+edition+'-'+width+'.png'),fullPage:true});}
 await page.locator('#sts-modal-close').click();await expect(page.locator('#sts-modal')).toBeHidden();check(expect,events);if(capture)save('lazy-art-form',{fields,styles,views,events});
});
