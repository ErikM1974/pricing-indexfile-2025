const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),{open,data,check}=require('./helpers/compact-invoice-browser');
const output=path.join(__dirname,'screenshots/css-unification'),capture=process.env.COMPACT_INVOICE_BASELINE==='1',edition=capture?'original':'current';
fs.mkdirSync(output,{recursive:true});test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
async function snapshot(page){return page.evaluate(()=>({title:document.title,rows:[...document.querySelectorAll('#items-tbody tr')].map(n=>[...n.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim())),fields:[...document.querySelectorAll('#invoice [id]')].filter(n=>!['invoice','items-tbody','status-banner','discount-row','paid-row','shipping-row','customer-artwork-section'].includes(n.id)).map(n=>({id:n.id,text:n.textContent.replace(/\s+/g,' ').trim(),visible:!!n.getClientRects().length&&getComputedStyle(n).display!=='none'})),links:[...document.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),label:n.textContent.replace(/\s+/g,' ').trim(),download:n.getAttribute('download')})),toolbar:[...document.querySelectorAll('#toolbar button')].map(n=>({id:n.id,text:n.textContent.trim(),visible:!!n.getClientRects().length,disabled:n.disabled})),paper:document.querySelector('#invoice').innerText}));}
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
 if(service==='default')page.once('dialog',d=>d.accept());
 await page.locator('#btn-shipstation').click();
 if(service!=='default'){
  await expect(page.locator('#shipstation-override-modal')).toBeVisible();await page.locator('input[name="ss-override"][value="'+service+'"]').check();
  if(service==='USPS Ground'){await page.setViewportSize({width:320,height:900});await page.screenshot({path:path.join(output,'compact-invoice-override-'+edition+'-320.png'),fullPage:true});}
  await page.locator('#ss-modal-confirm').click();
 }
 await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('.nwca-toast')).toContainText('Sent to ShipStation');
 expect(events.actions[0].body).toBe(JSON.stringify(service==='default'?{}:{overrideShipMethod:service}));
 if(capture)save('send-'+service.replace(/\s/g,'-'),{before:await snapshot(page),events});check(expect,events);
});
