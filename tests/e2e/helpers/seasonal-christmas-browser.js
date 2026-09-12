const fs=require('node:fs'),path=require('node:path');
const {expect}=require('@playwright/test');
const root=path.resolve(__dirname,'../../..');
const fixture=require('../../fixtures/seasonal-christmas-products.json');
const start=Date.parse('2026-09-12T18:30:00.000Z');
async function openChristmas(page,state={}){
 const events={errors:[],writes:[],unknown:[],dialogs:[],cspReports:[]};let tick=5;
 await page.clock.setFixedTime(new Date(start));
 await page.context().addInitScript(({failEmail})=>{
  Math.random=()=>0.1;window.__emails=[];window.__failEmail=failEmail;
  window.emailjs={init(){},send:async(service,template,data)=>{window.__emails.push({service,template,data});if(window.__failEmail)throw new Error('Synthetic email failure');return {status:200};}};
  window.print=()=>{};
 },{failEmail:Boolean(state.failEmail)});
 page.on('pageerror',e=>events.errors.push(e.message));
 page.on('dialog',async d=>{events.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(p==='/api/csp-report'&&req.method()==='POST'){events.cspReports.push(req.postDataJSON());return route.fulfill({status:204});}
  if(req.method()==='POST'&&['/api/quote_sessions','/api/quote_items'].includes(p)){
   events.writes.push({path:p,body:req.postDataJSON()});
   if(state.hold)await state.hold;
   const fail=p.endsWith('sessions')&&state.failSession||p.endsWith('items')&&state.failItem;
   return route.fulfill({status:fail?503:201,json:fail?{error:'Synthetic persistence failure'}:{success:true}});
  }
  if(p==='/api/files/upload'&&req.method()==='POST'){
   events.writes.push({path:p,file:'synthetic-logo'});
   return route.fulfill({status:state.failUpload?503:201,json:{externalKey:'SYNTHETIC-LOGO'}});
  }
  if(!['GET','HEAD'].includes(req.method())){events.unknown.push(req.method()+' '+p);return route.fulfill({status:503});}
  if(p==='/api/product-colors'){
   const product=fixture.products[url.searchParams.get('styleNumber')];
   return route.fulfill({status:state.failProducts?503:200,json:state.failProducts?{error:'Synthetic catalog failure'}:product});
  }
  if(p==='/api/size-pricing')return route.fulfill({json:[{sizeUpcharges:{S:0,M:0,L:0,XL:0,'2XL':2,'3XL':3,'4XL':4,OSFA:0,'One Size':0}}]});
  if(p==='/api/sizes-by-style-color'){
   const style=url.searchParams.get('styleNumber');
   const sizes=style==='CT104597'?['OSFA']:style==='CTGD0794'?['M','L','XL']:['S','M','L','XL','2XL','3XL','4XL'];
   if(state.holdInventory)await state.holdInventory;
   return route.fulfill({status:state.failInventory?503:200,json:state.failInventory?{error:'Synthetic stock failure'}:{sizes,sizeTotals:sizes.map(()=>30)}});
  }
  if(p.startsWith('/api/')){events.unknown.push(p);return route.fulfill({status:503});}
  if(url.hostname==='cdn.jsdelivr.net'&&p.endsWith('/email.min.js'))return route.fulfill({contentType:'application/javascript',body:'/* Email provider stubbed before load. */'});
  if(['localhost','127.0.0.1'].includes(url.hostname)){
   if(process.env.CAPTURE_CHRISTMAS_ORIGINAL!=='1')return route.continue();
   const file=p==='/christmas-bundles.html'?'calculators/christmas-bundles.html':decodeURIComponent(p.slice(1)),abs=path.resolve(root,file);
   if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||!fs.statSync(abs).isFile()){events.unknown.push(p);return route.fulfill({status:404});}
   return route.fulfill({body:fs.readFileSync(abs),contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'});
  }
  if(['image','font','stylesheet'].includes(req.resourceType())||url.hostname==='fonts.googleapis.com'||url.hostname==='cdnjs.cloudflare.com'&&p.endsWith('.css'))return route.continue();
  events.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto('/christmas-bundles.html');
 await expect(page.locator('#jacketGrid .product-card')).toHaveCount(3);
 await page.evaluate(()=>document.fonts.ready);
 events.advance=async()=>page.clock.setFixedTime(new Date(start+(tick++)*1000));
 await events.advance();
 return events;
}
async function goToChristmasState(page,events,mode){
 const original=process.env.CAPTURE_CHRISTMAS_ORIGINAL==='1';
 const activate=async locator=>original?locator.press('Enter'):locator.click();
 const stop={products:0,hoodie:1,beanie:2,gloves:3,bonus:4}[mode];
 for(const [index,type]of['jacket','hoodie','beanie','gloves'].entries()){
  if(stop===index)return;
  const card=page.locator('#'+type+'Grid .product-card').first();
  // The immutable native baseline records its fixed Continue bar intercepting
  // swatch clicks. Diagnostic original flows dispatch only this non-keyboard
  // control; original CSS stays untouched. Current flows use real mouse input.
  if(original)await card.locator('.color-swatch').first().dispatchEvent('click');
  else await card.locator('.color-swatch').first().click();
  await expect(card.locator('.size-btn:not([disabled])').first()).toBeVisible();
  const size=type==='beanie'?'OSFA':'L';
  await activate(card.locator('.size-btn[data-size="'+size+'"]'));
  await activate(card.locator('.select-btn'));
  await events.advance();
  await activate(page.locator('#'+type+'Next'));
 }
 if(mode==='bonus')return;
 await activate(page.locator('[data-call="proceedFromBonus"]'));
 if(mode==='customize')return;
 await page.locator('#threadColors').fill('Green, White');
 await page.locator('#specialInstructions').fill('Synthetic gift-box review. No real order.');
 await events.advance();await activate(page.locator('#step5 [data-call="nextStep"]'));
 for(const[id,value]of Object.entries({firstName:'Example',lastName:'Customer',companyName:'Example Company',email:'example@example.invalid',phone:'2535550100',address1:'123 Example Street',address2:'Suite 2',city:'Example City',state:'WA',zipCode:'98000'})){
  if(id==='state')await page.locator('#'+id).selectOption(value);else await page.locator('#'+id).fill(value);
 }
 await page.locator('#deliveryDate').evaluate(n=>{n.value='2026-10-16';n.dispatchEvent(new Event('change',{bubbles:true}));});
 if(mode==='review-pickup'){
  const pickup=page.locator('input[name="deliveryMethod"][value="Pickup"]');
  if(original)await pickup.evaluate(n=>{n.checked=true;n.dispatchEvent(new Event('change',{bubbles:true}));});
  else await pickup.check();
 }
 if(mode==='delivery')return;
 await events.advance();await activate(page.locator('#reviewBtn'));
 await expect(page.locator('#step7')).toBeVisible();
 if(['success','failed-session','failed-item','failed-email'].includes(mode)){
  await expect.poll(()=>page.locator('#submitBtn').evaluate(n=>Boolean(n.onclick||n.dataset.handlersAttached||n.dataset.call==='submitOrder'))).toBeTruthy();
  await activate(page.locator('#submitBtn'));
  await expect(page.locator('#submissionOverlay')).not.toBeVisible({timeout:40000});
 }
}
module.exports={root,openChristmas,goToChristmasState};
