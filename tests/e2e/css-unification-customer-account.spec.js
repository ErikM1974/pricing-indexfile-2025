const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check,tabs}=require('./helpers/customer-account-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US'});
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CUSTOMER_ACCOUNT_ORIGINAL==='1',phase=capture?'original':'current',widths=[1440,768,390,320];
async function evidence(page,name,events,{paper=false,compare=true}={}){
 const states=[];
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){
   fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'customer-account-'+name+'-current-diagnostics.json'),JSON.stringify({states,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,reason:n.failureSummary}))}))},null,2));
   expect(state.overflow,name+' width '+width).toBe(false);expect(await page.locator('.pp-up-mxtable td:not(.lbl)').evaluateAll(cells=>cells.filter(c=>c.getClientRects().length&&getComputedStyle(c).whiteSpace!=='nowrap').map(c=>c.textContent)),name+' unbroken price amounts '+width).toEqual([]);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),name+' axe '+width).toEqual([]);
  }
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'customer-account-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,events);
 const record={name,states,reads:events.reads,actions:events.actions},file='tests/fixtures/customer-account-'+name+'-original-browser.json';
 if(capture){
  if(fs.existsSync(path.join(root,file)))expect(record,'Existing immutable original '+name).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
  else{
   fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');
   fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic original Customer Account/Product browser contract.\n');
  }
 }else if(compare){
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  for(let i=0;i<states.length;i++){
   expect(states[i].title).toBe(before.states[i].title);
   for(const[id,value]of Object.entries(before.states[i].ids)){
    // The drawer's due date now occupies its own line; retain every saved amount and date.
    const expected=id==='cp-drawer-meta'?value.replace(/(BALANCE \$[0-9,.]+)due /,'$1 due '):value;
    expect(states[i].ids[id],name+' '+id).toBe(expected);
   }
   const links=states[i].links.map((link,index)=>{
    const old=before.states[i].links[index];
    if(old&&old.label===null&&old.text===''&&/^\/portal(?:-admin\/preview\/7401)?\/product\//.test(old.href)){expect(link.label).toMatch(/^View .+/);return {...link,label:null};}
    return link;
   });
   expect(links).toEqual(before.states[i].links);expect(states[i].rows).toEqual(before.states[i].rows);expect(states[i].fields).toEqual(before.states[i].fields);expect(states[i].engineCalls).toEqual(before.states[i].engineCalls);
  }
  expect(events.actions).toEqual(before.actions);
 }
 if(paper){
  await page.setViewportSize({width:1440,height:1000});
  if(!capture){await page.emulateMedia({media:'print'});expect(await page.locator('.cp-table td.cp-num').evaluateAll(cells=>cells.filter(c=>c.getClientRects().length).map(c=>({text:c.textContent,nowrap:getComputedStyle(c).whiteSpace==='nowrap'}))).then(cells=>cells.filter(c=>!c.nowrap)),'printed amounts remain unbroken').toEqual([]);}
  await page.pdf({path:path.join(out,'customer-account-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
  await page.emulateMedia({media:'screen'});
 }
}
async function ready(page,state){if(state.page==='product')await expect(page.locator('#pp-content')).toBeVisible();else await expect(page.locator('#cp-acct-email')).toHaveText('customer@example.test');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}

for(const mode of ['normal','empty'])for(const tab of tabs)test('CSS customer account: '+mode+' '+tab,async({page})=>{
 const state={mode,tab,original:capture},events=await open(page,state);await ready(page,state);
 await evidence(page,'account-'+mode+'-'+tab,events,{paper:mode==='normal'&&['overview','invoices','account'].includes(tab)});
});
for(const tab of ['orders','invoices'])test('CSS customer account: long '+tab,async({page})=>{
 const state={mode:'long',tab,original:capture},events=await open(page,state);await ready(page,state);
 const more=page.locator('#cp-panel-'+tab+' .cp-rows-more');if(await more.count())await more.click();
 await evidence(page,'account-long-'+tab,events,{paper:true});
});
for(const mode of ['normal','empty','long','escaped','upgrade'])test('CSS customer product: '+mode,async({page})=>{
 const state={page:'product',mode,original:capture},events=await open(page,state);await ready(page,state);
 await expect(page.locator('#pp-methods .pp-method')).toHaveCount(4);
 if(mode==='upgrade')await expect(page.locator('#pp-up-mx-0')).toContainText('Price breaks');
 await evidence(page,'product-'+mode,events,{paper:['normal','long','upgrade'].includes(mode)});
});
for(const kind of ['account','product'])test('CSS customer account: staff preview '+kind,async({page})=>{
 const state={page:kind==='product'?'product':undefined,preview:true,original:capture},events=await open(page,state);await ready(page,state);
 await evidence(page,'preview-'+kind,events);expect(events.actions).toEqual([]);
});
for(const [feed,tab,marker]of [['aggregate','logos','#cp-global-alert'],['/orders','orders','#cp-orders-wrap'],['/my-products','products','#cp-products-grid'],['/quotes','quotes','#cp-quotes-wrap'],['/me','account','#cp-acct-email'],['/rewards','account','#cp-rewards-sub']])test('CSS customer account: failed '+feed,async({page})=>{
 const state={tab,statuses:{[feed]:500},original:capture},events=await open(page,state);
 await expect(page.locator(marker)).toContainText(/couldn't|Unavailable|unavailable/i);
 await evidence(page,'account-failed-'+feed.replace('/',''),events);
});
for(const status of [401,404,429,500])test('CSS customer product: failed '+status,async({page})=>{
 const state={page:'product',statuses:{'/product/PC54':status},original:capture},events=await open(page,state);
 if(status===401)await page.waitForURL(/\/customer\/login$/);else await expect(page.locator('#pp-error')).toBeVisible();
 await evidence(page,'product-failed-'+status,events);
});

for(const kind of ['quote','logo','logo-change'])test('CSS customer account: original '+kind+' request body',async({page})=>{
 const state={original:capture},events=await open(page,state);await ready(page,state);
 if(kind==='logo-change'){await page.locator('.cp-strip-item').first().click();await page.locator('#cp-lb-change').click();}
 else await page.locator('[data-open-request="'+kind+'"]:visible').first().click();
 await expect(page.locator('#cp-gen-modal')).toBeVisible();
 await page.locator('#cp-gen-desc').fill('Synthetic sample request only');
 await page.locator('#cp-gen-note').fill('Keep this note & all quantities');
 if(kind==='quote'){await page.locator('#cp-gen-method').selectOption('Embroidery');await page.locator('#cp-gen-qty').fill('36');}
 await evidence(page,'account-'+kind+'-dialog',events);
 await page.locator('#cp-gen-submit').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#cp-gen-modal')).toBeHidden();
 // The page keeps confirmations for 4.2 seconds. Allow shared-runner scheduling
 // beyond that interval while still requiring the real UI timer to dismiss it.
 await expect(page.locator('#cp-toast')).not.toHaveClass(/show/,{timeout:10000});
 await evidence(page,'account-'+kind+'-sent',events);
});
test('CSS customer account: order drawer and reorder body',async({page})=>{
 const state={original:capture},events=await open(page,state);await ready(page,state);
 await page.locator('button[data-open-order="7401"]:visible').first().click();await expect(page.locator('#cp-drawer-items')).toContainText('Core Cotton Tee');await expect(page.locator('#cp-drawer-tracking')).toContainText('1ZTEST7401');
 await evidence(page,'account-order-drawer',events,{paper:true});
 await page.locator('#cp-drawer-reorder').click();await expect(page.locator('#cp-req-modal')).toBeVisible();
 await page.locator('#cp-req-note').fill('Preserve this reorder note');await evidence(page,'account-reorder-dialog',events);
 await page.locator('#cp-req-submit').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#cp-req-modal')).toBeHidden();await expect(page.locator('#cp-toast')).not.toHaveClass(/show/,{timeout:10000});
 await evidence(page,'account-reorder-sent',events);
});
test('CSS customer account: statement and reward request',async({page})=>{
 const state={tab:'invoices',original:capture},events=await open(page,state);await ready(page,state);
 await page.locator('#cp-statement-btn').click();await expect(page.locator('#cp-statement-modal')).toBeVisible();
 await evidence(page,'account-statement',events,{paper:true});await page.locator('#cp-statement-close').click();
 await page.setViewportSize({width:1440,height:1000});await page.locator('#cp-nav a[data-tab="overview"]').click();await page.locator('#cp-redeem-btn').click();await expect(page.locator('#cp-redeem-modal')).toBeVisible();
 await evidence(page,'account-reward-dialog',events);await page.locator('#cp-redeem-submit').click();await expect.poll(()=>events.actions.length).toBe(1);
 await expect(page.locator('#cp-redeem-modal')).toBeHidden();await expect(page.locator('#cp-toast')).not.toHaveClass(/show/,{timeout:10000});await evidence(page,'account-reward-sent',events);
});
for(const mode of ['single','batch','upgrade'])test('CSS customer product: original '+mode+' request body',async({page})=>{
 const state={page:'product',mode:mode==='upgrade'?'upgrade':'normal',original:capture},events=await open(page,state);await ready(page,state);await expect(page.locator('#pp-methods .pp-method')).toHaveCount(4);
 if(mode==='upgrade'){
  await page.locator('#pp-up-sizes-0 input[data-size="M"]').fill('12');await page.locator('#pp-up-sizes-0 input[data-size="2XL"]').fill('3');await page.locator('.pp-up-btn').click();
 }else{
  await page.locator('#pp-swatches [data-color="Brilliant Orange"]').click();await page.locator('#pp-sizes [data-size="3XL"]').fill('2');await page.locator('#pp-note').fill('Synthetic reorder & exact sizes');
  if(mode==='single')await page.locator('#pp-req-submit').click();
  else{
   await page.locator('#pp-req-addlist').click();await page.locator('#rl-fab').click();await page.locator('#rl-note').fill('Synthetic grouped request');
   await evidence(page,'product-batch-drawer',events);await page.locator('#rl-send').click();
  }
 }
 await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#cp-toast')).not.toHaveClass(/show/,{timeout:10000});await evidence(page,'product-'+mode+'-sent',events);
});

if(!capture){
 const workflowOriginal=process.env.PROBE_CUSTOMER_ACCOUNT_ORIGINAL==='1';
 async function workflow(page,extra={}){const state={page:'product',original:workflowOriginal,...extra},events=await open(page,state);await ready(page,state);await expect(page.locator('#pp-methods .pp-method')).toHaveCount(4);return {state,events};}
 const queued={style:'PC54',color:'Navy',title:'Core Cotton Tee',method:'DTG',qty:'24',sizeBreakdown:'M:24'};
 test('CSS customer account workflow: a storage failure cannot claim that a reorder was saved',async({page})=>{
  const {events}=await workflow(page);await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='nwca.reorderList.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,k,v);};});
  await page.locator('#pp-req-addlist').click();await expect(page.locator('#cp-toast')).toContainText(/could not save/i);expect(await page.evaluate(()=>window.ReorderList.count())).toBe(0);check(expect,events);
 });
 test('CSS customer account workflow: sent batch stays sent when local cleanup fails',async({page})=>{
  const {events}=await workflow(page,{storage:[queued]});await page.locator('#rl-fab').click();await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='nwca.reorderList.v1')throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,k,v);};});
  await page.locator('#rl-send').click();await expect(page.locator('#cp-toast')).toContainText('Sent');await expect(page.locator('#cp-toast')).toContainText(/local list.*reload/i);expect(await page.evaluate(()=>window.ReorderList.count())).toBe(0);await expect(page.locator('#rl-drawer')).toBeHidden();expect(events.actions).toHaveLength(1);check(expect,events);
 });
 test('CSS customer account workflow: a pending batch preserves items added after submission',async({page})=>{
  let release;const hold=new Promise(r=>release=r);const {events}=await workflow(page,{storage:[queued],actionHold:hold});
  await page.locator('#rl-fab').click();await page.locator('#rl-send').click();await expect.poll(()=>events.actions.length).toBe(1);
  await page.locator('#rl-cont').click();await page.locator('#pp-req-addlist').click();expect(await page.evaluate(()=>window.ReorderList.count())).toBe(2);
  release();await expect(page.locator('#cp-toast')).toContainText('Sent');expect(await page.evaluate(()=>window.ReorderList.count())).toBe(1);expect(JSON.parse(events.actions[0].body).items).toHaveLength(1);check(expect,events);
 });
 test('CSS customer account workflow: reorder drawer contains focus and restores its trigger',async({page})=>{
  const {events}=await workflow(page,{storage:[queued]});await page.locator('#rl-fab').click();await expect(page.locator('#rl-close')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#rl-cont')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#rl-drawer')).toBeHidden();await expect(page.locator('#rl-fab')).toBeFocused();check(expect,events);
 });
 test('CSS customer account workflow: late availability cannot replace the selected color',async({page})=>{
  const {events}=await workflow(page);let release,arrived=false;const hold=new Promise(r=>release=r);
  await page.route('**/api/portal/product/PC54/availability?**',async route=>{const color=new URL(route.request().url()).searchParams.get('color');if(color==='BrillOrng'){arrived=true;await hold;}await route.fulfill({json:{lights:{S:color==='BrillOrng'?'out':'in'}}});});
  await page.locator('#pp-swatches [data-color="Brilliant Orange"]').click();await expect.poll(()=>arrived).toBe(true);await page.locator('#pp-swatches [data-color="Navy"]').click();await expect(page.locator('#pp-avail [aria-label="S: in stock"]')).toBeVisible();
  const oldResponse=page.waitForResponse(r=>r.url().includes('/availability?color=BrillOrng')).then(r=>r.finished());release();await oldResponse;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await expect(page.locator('#pp-avail [aria-label="S: in stock"]')).toBeVisible();check(expect,events);
 });
 test('CSS customer account workflow: unavailable minimums show a rep-confirmation warning',async({page})=>{
  const {events}=await workflow(page);await page.route('**/api/pricing-bundle?**',route=>route.fulfill({status:500,json:{error:'Synthetic minimum unavailable'}}));await page.locator('#pp-methods [data-method="SCP"]').click();await expect(page.locator('#pp-method-min')).toContainText(/minimum.*unavailable/i);await expect(page.locator('#pp-method-min')).toContainText(/rep.*confirm/i);check(expect,events);
 });
 test('CSS customer account workflow: order details open from a native keyboard control',async({page})=>{
  const state={tab:'orders',original:workflowOriginal},events=await open(page,state);await ready(page,state);const control=page.locator('#cp-orders-wrap button[data-open-order="7401"]');await expect(control).toHaveCount(1);await control.focus();await page.keyboard.press('Enter');await expect(page.locator('#cp-drawer')).toBeVisible();await expect(page.locator('#cp-drawer-items')).toContainText('Core Cotton Tee');check(expect,events);
 });
 test('CSS customer account workflow: failed batch keeps its rows and note for an exact retry',async({page})=>{
  const {state,events}=await workflow(page,{storage:[queued],postStatus:500});await page.locator('#rl-fab').click();await page.locator('#rl-note').fill('Keep this batch note');await page.locator('#rl-send').click();await expect(page.locator('#rl-err')).toContainText('Synthetic request failed');await expect(page.locator('#rl-note')).toHaveValue('Keep this batch note');expect(await page.evaluate(()=>window.ReorderList.count())).toBe(1);
  state.postStatus=0;await page.locator('#rl-send').click();await expect(page.locator('#rl-drawer')).toBeHidden();expect(events.actions).toHaveLength(2);expect(events.actions[1].body).toBe(events.actions[0].body);expect(await page.evaluate(()=>window.ReorderList.count())).toBe(0);check(expect,events);
 });
 test('CSS customer account workflow: failed single reorder keeps sizes and note for retry',async({page})=>{
  const {state,events}=await workflow(page,{postStatus:500});await page.locator('#pp-note').fill('Keep single request note');await page.locator('#pp-req-submit').click();await expect(page.locator('#pp-req-error')).toContainText('Synthetic request failed');await expect(page.locator('#pp-note')).toHaveValue('Keep single request note');await expect(page.locator('#pp-sizes [data-size="M"]')).toHaveValue('4');state.postStatus=0;await page.locator('#pp-req-submit').click();await expect(page.locator('#cp-toast')).toContainText('Sent');expect(events.actions).toHaveLength(2);expect(events.actions[1].body).toBe(events.actions[0].body);check(expect,events);
 });
 test('CSS customer account workflow: late modal response cannot close a newer draft',async({page})=>{
  let release;const state={original:workflowOriginal,actionHold:new Promise(r=>release=r)},events=await open(page,state);await ready(page,state);await page.locator('#cp-btn-quote').click();await page.locator('#cp-gen-desc').fill('First synthetic draft');await page.locator('#cp-gen-submit').click();await expect.poll(()=>events.actions.length).toBe(1);await page.locator('#cp-gen-close').click();await page.locator('#cp-btn-quote').click();await page.locator('#cp-gen-desc').fill('A newer unsent draft');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/portal/request')).then(r=>r.finished());release();await response;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await expect(page.locator('#cp-gen-modal')).toBeVisible();await expect(page.locator('#cp-gen-desc')).toHaveValue('A newer unsent draft');expect(events.actions).toHaveLength(1);check(expect,events);
 });
 test('CSS customer account workflow: request modal contains keyboard focus',async({page})=>{
  const state={original:workflowOriginal},events=await open(page,state);await ready(page,state);await page.locator('#cp-btn-quote').click();await page.locator('#cp-gen-submit').focus();await page.keyboard.press('Tab');await expect(page.locator('#cp-gen-close')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#cp-gen-submit')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#cp-gen-modal')).toBeHidden();await expect(page.locator('#cp-btn-quote')).toBeFocused();check(expect,events);
 });
 test('CSS customer account workflow: staff preview never sends single or batch requests',async({page})=>{
  const {events}=await workflow(page,{preview:true,storage:[queued]});await page.locator('#pp-req-submit').click();await expect(page.locator('#cp-toast')).toContainText('Staff preview');await page.locator('#rl-fab').click();await page.locator('#rl-send').click();await expect(page.locator('#cp-toast')).toContainText('Staff preview');expect(events.actions).toEqual([]);check(expect,events);
 });
 test('CSS customer account workflow: printed product retains a long entered note',async({page})=>{
  const {events}=await workflow(page);const note='Synthetic print note: keep every requested detail. '.repeat(12)+'END OF NOTE';await page.locator('#pp-note').fill(note);await page.emulateMedia({media:'print'});await expect(page.locator('#pp-note')).toBeVisible();expect(await page.locator('#pp-note').evaluate(n=>n.clientHeight>=n.scrollHeight-1)).toBe(true);await page.emulateMedia({media:'screen'});await evidence(page,'product-printed-note',events,{compare:false,paper:true});
 });
}
