const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/customer-cart-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US'});
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CUSTOMER_CART_ORIGINAL==='1',phase=capture?'original':'current';
async function evidence(page,name,events,{paper=false,compare=true}={}){
 const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(state.overflow,name+' '+width).toBe(false);expect(state.injection).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'customer-cart-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,events);
 const record={name,states,reads:events.reads,actions:events.actions,dialogs:events.dialogs},file='tests/fixtures/customer-cart-'+name+'-original-browser.json';
 if(!capture)fs.writeFileSync(path.join(out,'customer-cart-'+name+'-current-diagnostics.json'),JSON.stringify(record,null,2)+'\n');
 if(capture){
  if(fs.existsSync(path.join(root,file)))expect(record,'Immutable original '+name).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
  else {fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic original cart browser contract.\n');}
 }else if(compare){
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  for(let i=0;i<states.length;i++){
   const originalIds={...before.states[i].ids};
   if(name==='sample-escaped')originalIds.cartItems=originalIds.cartItems.replace('Example company & "team"','Example <b>company</b> & "team"').replace('Color: Orange','Color: Orange <script>window.__cartInjection=true</script>');
   for(const k of ['title','ids','fields','engineCalls','emails'])expect(states[i][k],name+' '+k).toEqual(k==='ids'?originalIds:before.states[i][k]);
   const expected=before.states[i].links;
   // Phone badges now keep their word label. Preserve the original count exactly.
   const links=states[i].links.map(l=>states[i].width<=600&&['/quote-cart','/pages/sample-cart.html'].includes(l.href)?{...l,text:l.text.replace(/^(?:Samples|Quote)(?: |$)/,'')}:l);
   const staticPage=require('../fixtures/customer-cart-original-content.json').pages.find(p=>p.file==='pages/'+(name.startsWith('sample')?'sample':'quote')+'-cart.html');
   // The wrapping desktop masthead exposes existing links previously hidden by
   // the legacy breakpoint. Every extra destination and label must be in the
   // immutable original HTML; all originally visible links retain their order.
   let originalIndex=0;
   for(const l of links){
    if(JSON.stringify(l)===JSON.stringify(expected[originalIndex]))originalIndex++;
    else expect(staticPage.links.some(s=>s.href===l.href&&s.label===l.text.replace(/ NEW$/,' New')),name+' existing extra navigation '+l.href).toBe(true);
   }
   expect(originalIndex,name+' retained original navigation in order').toBe(expected.length);
  }
  expect(events.actions).toEqual(before.actions);
 }
 if(paper){
  await page.setViewportSize({width:1440,height:1000});
  if(!capture){await page.emulateMedia({media:'print'});expect(await page.locator('input:focus-visible,textarea:focus-visible').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).outlineStyle!=='none').map(n=>n.id))).toEqual([]);}
  await page.pdf({path:path.join(out,'customer-cart-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});await page.emulateMedia({media:'screen'});
 }
}
async function ready(page,kind,mode){
 if(kind==='sample'){
  await expect(page.locator('#cartItems')).toContainText(mode==='empty'?'empty':mode==='long'?'TEST1':'PC54',{timeout:20000});
  if(mode!=='empty')await expect(page.locator('#sampleRequestForm [type="submit"]')).toContainText(mode==='free'?'sample request':'secure payment',{timeout:10000});
 }else if(mode==='empty')await expect(page.locator('#qcEmpty')).toBeVisible();
 else {
  await expect(page.locator('#qcGroups .qc-group')).not.toHaveCount(0);
  await expect(page.locator('#qcTotalsBody')).toContainText(mode==='failed'?'Grand total withheld':'Grand total');
  if(mode!=='CAP'&&mode!=='missing')await expect(page.locator('.qc-line-sizes input').first()).toBeVisible();
 }
}

for(const mode of ['empty','free','paid','mixed','legacy','low','out','missing','long','escaped'])test('CSS customer carts original: sample '+mode,async({page})=>{
 const events=await open(page,{kind:'sample',mode,original:capture});await ready(page,'sample',mode);
 await evidence(page,'sample-'+mode,events,{paper:['free','mixed','long'].includes(mode)});
});
for(const mode of ['empty','EMB','CAP','DTG','SCP','DTF','mixed','failed','warning','missing','long','escaped'])test('CSS customer carts original: quote '+mode,async({page})=>{
 const events=await open(page,{kind:'quote',mode,original:capture});await ready(page,'quote',mode);
 await evidence(page,'quote-'+mode,events,{paper:['mixed','failed','long'].includes(mode)});
});

async function fillSample(page,separate=false){
 for(const [name,value] of Object.entries({firstName:'Casey',lastName:'Example',email:'customer@example.test',phone:'2535550142',company:'Example Team',billing_address1:'100 Example Way',billing_address2:'Suite 5',billing_city:'Milton',billing_state:'wa',billing_zip:'98354',notes:'Please send the listed sizes. Reference artwork stays blank on samples.'}))await page.locator('[name="'+name+'"]').fill(value);
 if(separate){await page.locator('#same-as-billing').uncheck();for(const [name,value]of Object.entries({shipping_address1:'200 Sample Lane',shipping_address2:'Unit 8',shipping_city:'Tacoma',shipping_state:'wa',shipping_zip:'98402'}))await page.locator('[name="'+name+'"]').fill(value);}
}
async function fillQuote(page){
 await page.locator('#qcSaveBtn').click();
 for(const [id,value]of Object.entries({qcSvName:'Casey Example',qcSvEmail:'customer@example.test',qcSvPhone:'2535550142',qcSvCompany:'Example Team',qcSvNotes:'Please preserve both locations, all sizes, and the reference artwork.'}))await page.locator('#'+id).fill(value);
}
test('CSS customer carts workflow: free sample request and reference logo',async({page})=>{
 const events=await open(page,{kind:'sample',mode:'free',original:capture});await ready(page,'sample','free');await fillSample(page,true);
 await page.locator('#logoUpload').setInputFiles({name:'example-logo.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="green"/></svg>')});
 await evidence(page,'sample-filled-shipping',events,{paper:true});
 await page.locator('#sampleRequestForm [type="submit"]').click();
 await expect(page.locator('#successMessage')).toBeVisible();await expect(page.locator('#confirmationId')).not.toBeEmpty();
 expect(events.actions.filter(a=>a.path==='/api/manageorders/orders/create')).toHaveLength(1);
 expect(await page.evaluate(()=>window.__cartEmails.length)).toBe(2);
 await evidence(page,'sample-free-sent',events,{paper:true});
 expect(await page.evaluate(()=>sessionStorage.getItem('sampleCart'))).toBeNull();
});
test('CSS customer carts workflow: paid checkout exact payload and disabled pending button',async({page})=>{
 let release;const hold=new Promise(r=>release=r),state={kind:'sample',mode:'mixed',original:capture,hold};
 const events=await open(page,state);await ready(page,'sample','mixed');await fillSample(page);
 await page.locator('#sampleRequestForm [type="submit"]').click();
 await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#sampleRequestForm [type="submit"]')).toBeDisabled();
 await evidence(page,'sample-paid-pending',events);
 release();await expect(page).toHaveURL(/__cart-fixture\/checkout/);check(expect,events);
});
test('CSS customer carts workflow: failed paid checkout retains customer fields and cart',async({page})=>{
 const events=await open(page,{kind:'sample',mode:'mixed',original:capture,postStatus:400});await ready(page,'sample','mixed');await fillSample(page);
 await page.locator('#sampleRequestForm [type="submit"]').click();await expect(page.locator('#sampleRequestForm [type="submit"]')).toBeEnabled();
 await expect(page.locator('main')).toContainText('Synthetic save failed');
 await evidence(page,'sample-paid-failed',events);
});
for(const mode of ['canceled','success'])test('CSS customer carts workflow: checkout '+mode+' return',async({page})=>{
 const events=await open(page,{kind:'sample',mode:'mixed',original:capture,query:mode==='canceled'?'?canceled=1':'?success=1&quote_id=WEB-2026-1042'});
 if(mode==='success')await expect(page.locator('#confirmationId')).toHaveText('WEB-2026-1042');else await ready(page,'sample','mixed');
 await evidence(page,'sample-return-'+mode,events,{paper:mode==='success'});
});
test('CSS customer carts workflow: remove sample retains surviving prices',async({page})=>{
 const events=await open(page,{kind:'sample',mode:'mixed',original:capture});await ready(page,'sample','mixed');await page.locator('[data-remove="0"]').click();
 await expect(page.locator('#cartItems .cart-item')).toHaveCount(1);await evidence(page,'sample-removed',events);
});
test('CSS customer carts workflow: size matrix and cap quantities feed their separate groups',async({page})=>{
 const events=await open(page,{kind:'quote',mode:'mixed',original:capture});await ready(page,'quote','mixed');
 await page.locator('[data-act="size"][data-id="item-EMB"][data-size="M"]').fill('8');await page.locator('[data-act="size"][data-id="item-EMB"][data-size="M"]').press('Enter');
 await expect(page.locator('#qcTotalsBody')).toContainText('637.50');
 await page.locator('[data-act="inc"][data-id="item-CAP"]').click();await expect(page.locator('#qcTotalsBody')).toContainText('656.25');
 await evidence(page,'quote-quantities',events);
});
for(const failure of [false,true])test('CSS customer carts workflow: quote save '+(failure?'failure':'success'),async({page})=>{
 const events=await open(page,{kind:'quote',mode:'mixed',original:capture,postStatus:failure?400:undefined});await ready(page,'quote','mixed');await fillQuote(page);
 if(!failure)await evidence(page,'quote-filled-save',events,{paper:true});
 await page.locator('[data-save-act="submit"]').click();
 await expect(page.locator('#qcSavePanel')).toContainText(failure?'Couldn\'t save':'WQ-2026-1042 saved');
 if(!failure)await expect.poll(()=>page.evaluate(()=>window.__cartEmails.length)).toBe(2);
 await evidence(page,'quote-save-'+(failure?'failed':'sent'),events,{paper:!failure});
});
test('CSS customer carts workflow: removing a failed group restores complete totals',async({page})=>{
 const events=await open(page,{kind:'quote',mode:'failed',original:capture});await ready(page,'quote','failed');
 await page.locator('[data-act="remove"][data-id="item-DTG"]').click();await expect(page.locator('#qcSaveBtn')).toBeEnabled();await expect(page.locator('#qcTotalsBody')).toContainText('450.00');
 await evidence(page,'quote-failed-group-removed',events);
});

test('CSS customer carts repair: stored garment markup stays literal',async({page})=>{
 test.skip(capture,'Current safety regression; the original defect is recorded separately.');
 const events=await open(page,{kind:'sample',mode:'mixed'});await ready(page,'sample','mixed');
 const name='<img src="/__cart-fixture/probe.svg" onload="window.__cartInjection=true">';
 await page.evaluate(async name=>{const cart=JSON.parse(sessionStorage.getItem('sampleCart'));cart.samples[0].name=name;sessionStorage.setItem('sampleCart',JSON.stringify(cart));await loadCart();},name);
 await expect(page.locator('.item-details h3').first()).toHaveText(name);expect(await page.locator('.item-details h3 img').count()).toBe(0);
 expect(await page.evaluate(()=>window.__cartInjection)).toBe(false);await expect(page.locator('#summaryTotalPrice')).toHaveText('$30.25');check(expect,events);
});

test('CSS customer carts repair: checkout error markup stays literal and announces failure',async({page})=>{
 test.skip(capture,'Current checkout-error safety regression; original execution is recorded separately.');
 const events=await open(page,{kind:'sample',mode:'mixed'});await ready(page,'sample','mixed');await fillSample(page);
 const message='<img src="/__cart-fixture/probe.svg" onload="window.__cartInjection=true">';let requests=0;
 await page.route('**/api/samples/create-checkout-session',route=>{requests++;return route.fulfill({status:400,json:{error:message}});});
 await page.locator('#sampleRequestForm [type="submit"]').click();await expect(page.locator('#sampleCheckoutBanner p')).toHaveText(message);await expect(page.locator('#sampleCheckoutBanner')).toHaveAttribute('role','alert');
 await expect(page.locator('#sampleRequestForm [type="submit"]')).toBeEnabled();expect(await page.locator('#sampleCheckoutBanner img').count()).toBe(0);expect(await page.evaluate(()=>window.__cartInjection)).toBe(false);expect(requests).toBe(1);
 await expect(page.locator('#summaryTotalPrice')).toHaveText('$30.25');await expect(page.locator('#fldFirstName')).toHaveValue('Casey');check(expect,events);
});

test('CSS customer carts repair: failed removal is visible and retry preserves the other item',async({page})=>{
 test.skip(capture,'Current recovery regression; the original failure is recorded separately.');
 const events=await open(page,{kind:'sample',mode:'mixed'});await ready(page,'sample','mixed');
 await page.evaluate(()=>{window.__cartSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sampleCart')throw new DOMException('Synthetic full storage','QuotaExceededError');return window.__cartSetItem.call(this,k,v);};});
 await page.locator('[data-remove="0"]').click();await expect(page.locator('#sampleCartStorageError')).toContainText('Your cart is unchanged');await expect(page.locator('#sampleCartStorageError')).toBeFocused();
 await expect(page.locator('#cartItems .cart-item')).toHaveCount(2);await expect(page.locator('#summaryTotalPrice')).toHaveText('$30.25');
 await page.evaluate(()=>{Storage.prototype.setItem=window.__cartSetItem;});await page.locator('[data-remove="0"]').click();
 await expect(page.locator('#cartItems .cart-item')).toHaveCount(1);await expect(page.locator('#cartItems')).toContainText('K500');await expect(page.locator('#sampleCartStorageError')).toHaveCount(0);check(expect,events);
});

test('CSS customer carts repair: pending quote cannot reopen or allocate a duplicate',async({page})=>{
 test.skip(capture,'Current duplicate-save regression; the original duplicate is recorded separately.');
 let release;const hold=new Promise(r=>release=r),events=await open(page,{kind:'quote',mode:'mixed',hold});await ready(page,'quote','mixed');await fillQuote(page);
 await page.locator('[data-save-act="submit"]').click();await expect(page.locator('.qc-save-busy')).toBeVisible();await expect.poll(()=>events.actions.filter(a=>a.path==='/api/quote_sessions').length).toBe(1);
 await expect(page.locator('#qcSaveBtn')).toBeDisabled();await page.locator('#qcSaveBtn').dispatchEvent('click');await expect(page.locator('#qcSvName')).toHaveCount(0);
 expect(events.actions.filter(a=>a.path==='/api/quote-sequence/WQ')).toHaveLength(1);release();await expect(page.locator('#qcSavePanel')).toContainText('WQ-2026-1042 saved');await expect(page.locator('#qcSaveBtn')).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>window.__cartEmails.length)).toBe(2);expect(events.actions.filter(a=>a.path==='/api/quote_sessions')).toHaveLength(1);check(expect,events);
});

for(const kind of ['sample','quote'])test('CSS customer carts keyboard: '+kind+' menu confines focus and restores its trigger',async({page})=>{
 test.skip(capture,'Current native navigation regression.');
 await page.setViewportSize({width:390,height:900});const events=await open(page,{kind,mode:'mixed'});await ready(page,kind,'mixed');
 const opener=page.locator('#mobileMenuBtn'),menu=page.locator('#sidebar');await opener.click();await expect(menu).toBeVisible();await expect(opener).toHaveAttribute('aria-expanded','true');
 await page.locator('#drawerClose').focus();await page.keyboard.press('Shift+Tab');await expect(menu.locator('a[href], button:not([disabled])').last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#drawerClose')).toBeFocused();
 await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(opener).toBeFocused();await expect(opener).toHaveAttribute('aria-expanded','false');check(expect,events);
});

for(const kind of ['sample','quote'])test('CSS customer carts paper: '+kind+' complete note and selected artwork',async({page})=>{
 test.skip(capture,'Additional complete-paper regression for the unified layout.');
 const events=await open(page,{kind,mode:'mixed'});await ready(page,kind,'mixed');
 const note=Array.from({length:8},(_,i)=>'Reference '+(i+1)+': Please preserve the navy and orange garments, all requested sizes, both decoration locations and delivery instructions.').join('\n')+'\nEND OF CUSTOMER NOTE.';
 if(kind==='sample'){await fillSample(page,true);await page.locator('#fldNotes').fill(note);await page.locator('#logoUpload').setInputFiles({name:'sample-reference.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')});}
 else {await fillQuote(page);await page.locator('#qcSvNotes').fill(note);await page.locator('input[data-art-gid]').first().setInputFiles({name:'quote-reference.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')});await expect(page.locator('.qc-art-picked')).toHaveText('quote-reference.svg');}
 await evidence(page,kind+'-long-note',events,{paper:true,compare:false});expect(events.actions).toHaveLength(0);
});
