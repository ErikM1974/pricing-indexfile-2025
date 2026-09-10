const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),{open,data,check}=require('./helpers/compact-invoice-browser');
const output=path.join(__dirname,'screenshots/css-unification'),capture=process.env.COMPACT_INVOICE_BASELINE==='1',edition=capture?'original':'current';
fs.mkdirSync(output,{recursive:true});test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
async function snapshot(page){return page.evaluate(()=>({title:document.title,rows:[...document.querySelectorAll('#items-tbody tr')].map(n=>[...n.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim())),fields:[...document.querySelectorAll('#invoice [id]')].filter(n=>!['invoice','items-tbody','status-banner','discount-row','paid-row','shipping-row','customer-artwork-section','invoice-sync-error'].includes(n.id)).map(n=>({id:n.id,text:n.textContent.replace(/\s+/g,' ').trim(),visible:!!n.getClientRects().length&&getComputedStyle(n).display!=='none'})),links:[...document.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),label:n.textContent.replace(/\s+/g,' ').trim(),download:n.getAttribute('download')})),toolbar:[...document.querySelectorAll('#toolbar button')].map(n=>({id:n.id,text:n.textContent.trim(),visible:!!n.getClientRects().length,disabled:n.disabled})),paper:document.querySelector('#invoice').innerText}));}
function save(name,value){fs.writeFileSync(path.join(__dirname,'../fixtures/compact-invoice-'+name+'-original-browser.json'),JSON.stringify(value,null,2)+'\n');}
for(const mode of ['shopworks','original','quote-items','storefront','empty','tax-exempt','wholesale','cancelled','rush','pickup','waiting','override','sent','shipped','ups-shipped','long'])test('CSS compact invoice: '+edition+' '+mode+' original values and paper',async({page})=>{
 const events=await open(page,{original:capture,mode});await expect(page.locator('#invoice')).toBeVisible();await expect(page.locator('#toolbar')).toBeVisible();
 const before=await snapshot(page),views=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1050});views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})));
  if(!capture){expect(views.at(-1).scrollWidth).toBeLessThanOrEqual(width);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);}
  if(['shopworks','storefront','long'].includes(mode)&&[1440,320].includes(width))await page.screenshot({path:path.join(output,'compact-invoice-'+mode+'-'+edition+'-'+width+'.png'),fullPage:true});
 }
 let paper='';
 if(['shopworks','original','quote-items','storefront','empty','long'].includes(mode)){
  await page.setViewportSize({width:1440,height:1050});await page.emulateMedia({media:'print'});paper=await page.locator('#invoice').innerText();
  await page.pdf({path:path.join(output,'compact-invoice-'+mode+'-'+edition+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});
 }
 if(capture)save(mode,{before,views,paper,events});
 else{const original=require('../fixtures/compact-invoice-'+mode+'-original-browser.json');expect(before.rows).toEqual(original.before.rows);expect(before.fields).toEqual(original.before.fields);for(const link of original.before.links)expect(before.links).toContainEqual(link);}
 check(expect,events);expect(events.actions).toEqual([]);
});

for(const kind of ['missing-fields','changed-storefront'])test('CSS compact invoice: '+edition+' refresh '+kind+' against a fresh render',async({page,browser})=>{
 const initial=data(kind==='missing-fields'?'shopworks':'storefront'),updated=data('shopworks');
 if(kind==='missing-fields'){initial.billingContact.address1='';initial.billingContact.address2='';initial.billingContact.city='';initial.billingContact.state='';initial.billingContact.zip='';Object.assign(initial.shopWorks.snapshot.pushed.ShippingAddresses[0],{ShipAddress01:'',ShipAddress02:'',ShipCity:'',ShipState:'',ShipZip:''});Object.assign(initial.shopWorks.snapshot.order,{cur_Shipping:0,cur_Payments:0});}
 else{const cd=JSON.parse(initial.sessionRaw.CustomerDataJSON);cd.company='Updated Example Buyer';cd.firstName='Updated';cd.billingAddress1='99 Correct Billing Road';updated.sessionRaw.CustomerDataJSON=JSON.stringify(cd);updated.sessionRaw.OrderSettingsJSON=JSON.stringify({shipPromise:{iso:'2026-09-22'}});}
 const events=await open(page,{original:capture,initialData:initial,afterSync:updated});await expect(page.locator('#invoice')).toBeVisible();const before=await snapshot(page);
 await page.locator('#btn-refresh').click();await expect.poll(()=>events.reads.length).toBe(2);await expect(page.locator('#btn-refresh')).toBeEnabled();const after=await snapshot(page);
 const context=await browser.newContext({baseURL:'http://localhost:3400',timezoneId:'America/Los_Angeles'}),freshPage=await context.newPage();
 try{
  const freshEvents=await open(freshPage,{original:capture,initialData:updated});await expect(freshPage.locator('#invoice')).toBeVisible();const fresh=await snapshot(freshPage);
  if(capture)save('refresh-'+kind,{before,after,fresh,events});
  else{expect(after.fields).toEqual(fresh.fields);expect(after.rows).toEqual(fresh.rows);expect(after.links).toEqual(fresh.links);}
  check(expect,freshEvents);
 }finally{await context.close();}
 check(expect,events);
});

for(const status of [401,404,500])test('CSS compact invoice: '+edition+' load '+status,async({page})=>{
 const events=await open(page,{original:capture,status});await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#invoice')).toBeHidden();
 if(capture)save('load-'+status,{text:await page.locator('#error').innerText(),events});check(expect,events);
});
test('CSS compact invoice: '+edition+' anonymous and forged staff flag',async({page})=>{
 const events=await open(page,{original:capture,staff:false,fakeStaff:true});await expect(page.locator('#invoice')).toBeVisible();
 if(capture){await expect(page.locator('#toolbar')).toBeVisible();save('forged-staff-flag',{before:await snapshot(page),events});}
 else await expect(page.locator('#toolbar')).toBeHidden();check(expect,events);
});
test('CSS compact invoice: '+edition+' customer share token forwarding',async({page})=>{
 const events=await open(page,{original:capture,staff:false,protected:true});
 if(capture){await expect(page.locator('#error')).toBeVisible();save('share-token',{text:await page.locator('#error').innerText(),events});}
 else{await expect(page.locator('#invoice')).toBeVisible();expect(events.reads[0].query).toBe('?k=review%20token%20%2F%20only');}
 check(expect,events);
});
for(const status of [200,500])test('CSS compact invoice: '+edition+' manual sync '+status,async({page})=>{
 const events=await open(page,{original:capture,syncStatus:status===200?undefined:status});await expect(page.locator('#invoice')).toBeVisible();const before=await snapshot(page);
 await page.locator('#btn-refresh').click();await expect(page.locator('#btn-refresh')).toBeEnabled();expect(events.actions).toHaveLength(1);
 if(status===200)expect(events.reads).toHaveLength(2);else await expect(page.locator('.nwca-toast')).toContainText('Sync failed');
 const after=await snapshot(page);if(capture)save('sync-'+status,{before,after,events});else expect(after.rows).toEqual(before.rows);check(expect,events);
});
test('CSS compact invoice: '+edition+' stale quote automatic sync is synthetic',async({page})=>{
 const events=await open(page,{original:capture,mode:'stale'});await expect(page.locator('#invoice')).toBeVisible();await expect.poll(()=>events.reads.length).toBe(2);
 if(capture)save('auto-sync',{before:await snapshot(page),events});expect(events.actions).toHaveLength(1);check(expect,events);
});
for(const service of ['default','Priority Mail','USPS First Class','USPS Ground'])test('CSS compact invoice: '+edition+' ShipStation '+service,async({page})=>{
 const events=await open(page,{original:capture,mode:service==='default'?'shopworks':'override'});await expect(page.locator('#invoice')).toBeVisible();
 if(service==='default'&&capture)page.once('dialog',d=>d.accept());
 await page.locator('#btn-shipstation').click();
 if(service==='default'&&!capture)await page.locator('#ss-modal-confirm').click();
 if(service!=='default'){
  await expect(page.locator('#shipstation-override-modal')).toBeVisible();await page.locator('input[name="ss-override"][value="'+service+'"]').check();
  if(service==='USPS Ground'){await page.setViewportSize({width:320,height:900});await page.screenshot({path:path.join(output,'compact-invoice-override-'+edition+'-320.png'),fullPage:true});}
  await page.locator('#ss-modal-confirm').click();
 }
 await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('.nwca-toast')).toContainText('Sent to ShipStation');
 expect(events.actions[0].body).toBe(JSON.stringify(service==='default'?{}:{overrideShipMethod:service}));
 if(capture)save('send-'+service.replace(/\s/g,'-'),{before:await snapshot(page),events});check(expect,events);
});

test.describe('CSS compact invoice: revised workflow guards',()=>{
 test.skip(capture,'These checks exercise the reviewed UI, not the historical capture.');
 const defer=()=>{let release;const promise=new Promise(r=>release=r);return{promise,release};};
 test('pending data and delayed verified identity keep actions unavailable',async({page})=>{
  const read=defer(),identity=defer(),state={hold:read.promise,identityHold:identity.promise};
  const events=await open(page,state);await expect(page.locator('#loading')).toBeVisible();await expect(page.locator('#invoice-public-actions')).toBeHidden();await expect(page.locator('#toolbar')).toBeHidden();
  read.release();await expect(page.locator('#invoice')).toBeVisible();await expect(page.locator('#btn-print')).toBeEnabled();await expect(page.locator('#toolbar')).toBeHidden();
  identity.release();await expect(page.locator('#toolbar')).toBeVisible();check(expect,events);
 });
 test('forged session storage does not expose operations and public print works',async({page})=>{
  await page.addInitScript(()=>{for(const [k,v]of Object.entries({nwca_user_name:'Forged',nwca_user_email:'fake@example.test',nwca_user_role:'admin'}))sessionStorage.setItem(k,v);});
  const events=await open(page,{staff:false,fakeStaff:true});await expect(page.locator('#invoice')).toBeVisible();await expect(page.locator('#toolbar')).toBeHidden();await page.locator('#btn-print').click();expect(await page.evaluate(()=>window.__printCalls)).toBe(1);expect(events.actions).toEqual([]);check(expect,events);
 });
 test('load failure can retry',async({page})=>{
  const state={status:500},events=await open(page,state);await expect(page.locator('#error')).toBeVisible();state.status=undefined;await page.locator('#btn-invoice-retry').click();await expect(page.locator('#invoice')).toBeVisible();await expect(page.locator('#error')).toBeHidden();expect(events.reads).toHaveLength(2);check(expect,events);
 });
 test('shared customer automatic sync and back link retain the token',async({page})=>{
  const events=await open(page,{staff:false,protected:true,mode:'stale'});await expect.poll(()=>events.reads.length).toBe(2);expect(events.reads.every(r=>r.query==='?k=review%20token%20%2F%20only')).toBe(true);expect(events.actions[0].query).toBe('?k=review%20token%20%2F%20only');await expect(page.locator('#btn-back-to-quote')).toHaveAttribute('href','/quote/EMB0910-7401?k=review%20token%20%2F%20only');await expect(page.locator('#toolbar')).toBeHidden();check(expect,events);
 });
 test('pending sync rejects duplicate refresh, print and shipment',async({page})=>{
  const pending=defer(),events=await open(page,{actionHold:pending.promise});await expect(page.locator('#toolbar')).toBeVisible();await page.locator('#btn-refresh').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#btn-print')).toBeDisabled();await expect(page.locator('#btn-shipstation')).toBeDisabled();
  await page.evaluate(()=>{window.invoicePage.syncNow(true);window.invoicePage.sendToShipStation();document.querySelector('#btn-print').click();});expect(events.actions).toHaveLength(1);expect(await page.evaluate(()=>window.__printCalls||0)).toBe(0);
  pending.release();await expect(page.locator('#btn-refresh')).toBeEnabled();await expect(page.locator('#btn-print')).toBeEnabled();expect(events.reads).toHaveLength(2);check(expect,events);
 });
 test('automatic sync failure remains visible and clears after retry',async({page})=>{
  const state={mode:'stale',syncStatus:500},events=await open(page,state);await expect(page.locator('#invoice-sync-error')).toContainText('last loaded invoice');const money=await page.locator('#total-amount-due').textContent();
  state.syncStatus=undefined;await page.locator('#btn-refresh').click();await expect(page.locator('#invoice-sync-error')).toBeHidden();await expect(page.locator('#btn-refresh')).toBeEnabled();expect(events.actions).toHaveLength(2);await expect(page.locator('#total-amount-due')).toHaveText(money);check(expect,events);
 });
 for(const mode of ['shopworks','override'])test(mode+' dialog keyboard, cancellation, focus and accessibility',async({page})=>{
  const events=await open(page,{mode});await expect(page.locator('#toolbar')).toBeVisible();const trigger=page.locator('#btn-shipstation');
  await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(page.locator('#ss-modal-cancel')).toBeFocused();await page.keyboard.press('Shift+Tab');if(mode==='override'){await expect(page.locator('input[name="ss-override"]:checked')).toBeFocused();await page.keyboard.press('Shift+Tab');}await expect(page.locator('#ss-modal-confirm')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator(mode==='override'?'input[name="ss-override"]:checked':'#ss-modal-cancel')).toBeFocused();
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
  await page.screenshot({path:path.join(output,'compact-invoice-'+mode+'-dialog-current-320.png'),fullPage:true});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();expect(await page.locator('body').evaluate(n=>n.style.overflow)).toBe('');
  await trigger.click();await page.locator('#ss-modal-cancel').click();await expect(trigger).toBeFocused();expect(events.actions).toEqual([]);check(expect,events);
 });
 test('pending shipment claims one action and restores refresh after completion',async({page})=>{
  const pending=defer(),events=await open(page,{actionHold:pending.promise});await expect(page.locator('#toolbar')).toBeVisible();await page.locator('#btn-shipstation').click();await page.locator('#ss-modal-confirm').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#btn-refresh')).toBeDisabled();await expect(page.locator('#btn-shipstation')).toBeDisabled();
  await page.evaluate(()=>{window.invoicePage.sendToShipStation();window.invoicePage.syncNow(true);});expect(events.actions).toHaveLength(1);pending.release();await expect(page.locator('#btn-refresh')).toBeEnabled();await expect(page.locator('#btn-shipstation')).toContainText('In ShipStation');await expect(page.locator('#btn-shipstation')).toBeDisabled();check(expect,events);
 });
 test('shipment failure allows one deliberate retry',async({page})=>{
  const state={sendStatus:500},events=await open(page,state);await expect(page.locator('#toolbar')).toBeVisible();await page.locator('#btn-shipstation').click();await page.locator('#ss-modal-confirm').click();await expect(page.locator('.nwca-toast').last()).toContainText('Failed to send');await expect(page.locator('#btn-shipstation')).toBeEnabled();
  state.sendStatus=undefined;await page.locator('#btn-shipstation').click();await page.locator('#ss-modal-confirm').click();await expect(page.locator('#btn-shipstation')).toContainText('In ShipStation');expect(events.actions).toHaveLength(2);expect(events.actions.map(x=>x.body)).toEqual(['{}','{}']);check(expect,events);
 });
 for(const mode of ['sent','ups-shipped','shipped-no-tracking'])test(mode+' is terminal and cannot send again',async({page})=>{
  const initialData=data(mode==='shipped-no-tracking'?'shopworks':mode);if(mode==='shipped-no-tracking')initialData.shipStation={status:'shipped'};
  const events=await open(page,{initialData});await expect(page.locator('#toolbar')).toBeVisible();if(mode==='ups-shipped'){await expect(page.locator('#shipstation-tracking')).toHaveAttribute('href',initialData.shipStation.trackingURL);await expect(page.locator('#btn-shipstation')).toBeHidden();await page.locator('#shipstation-tracking').evaluate(n=>{n.addEventListener('click',e=>e.preventDefault());n.click();});}else await expect(page.locator('#btn-shipstation')).toBeDisabled();
  await page.evaluate(()=>window.invoicePage.sendToShipStation());expect(events.actions).toEqual([]);check(expect,events);
 });
 for(const kind of ['skipped','already-sent'])test('shipment '+kind+' response stays visible',async({page})=>{
  const events=await open(page,{sendResult:kind==='skipped'?{success:true,skipped:true,message:'Production is incomplete'}:{success:true,alreadySent:true,shipstationOrderId:55001}});
  await expect(page.locator('#toolbar')).toBeVisible();await page.locator('#btn-shipstation').click();await page.locator('#ss-modal-confirm').click();await expect(page.locator('.nwca-toast').last()).toContainText(kind==='skipped'?'Production is incomplete':'No duplicate created');if(kind==='skipped')await expect(page.locator('#btn-shipstation')).toBeEnabled();else await expect(page.locator('#btn-shipstation')).toBeDisabled();expect(events.actions).toHaveLength(1);check(expect,events);
 });
 test('failed artwork keeps download destinations and disappears after refresh',async({page})=>{
  const events=await open(page,{mode:'storefront',artworkFailure:true,afterSync:data('shopworks')});await expect(page.locator('#customer-artwork-section')).toBeVisible();await page.locator('#customer-artwork-section').scrollIntoViewIfNeeded();await expect(page.locator('img[data-art-fallback]:visible')).toHaveCount(0);await expect(page.locator('.cust-art-download')).toHaveCount(3);
  await page.locator('#btn-refresh').click();await expect(page.locator('#btn-refresh')).toBeEnabled();await expect(page.locator('#customer-artwork-section')).toHaveCount(0);check(expect,events);
 });
 for(const mode of ['shopworks','rush','cancelled','empty'])test(mode+' print status respects actual visibility',async({page})=>{
  const events=await open(page,{mode});await expect(page.locator('#invoice')).toBeVisible();await page.emulateMedia({media:'print'});const text=await page.locator('#invoice').innerText();if(mode==='rush')expect(text).toContain('RUSH ORDER');else expect(text).not.toContain('RUSH ORDER');if(mode==='cancelled')expect(text).toContain('CANCELLED');expect(text).toContain('1.5% monthly finance charge.');await expect(page.locator('#toolbar')).toBeHidden();await expect(page.locator('.document-header')).toBeHidden();check(expect,events);
 });
});
