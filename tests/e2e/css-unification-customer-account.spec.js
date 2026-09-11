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
  if(!capture){expect(state.overflow,name+' width '+width).toBe(false);expect(axe.violations,name+' axe '+width).toEqual([]);}
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
   for(const[id,value]of Object.entries(before.states[i].ids))expect(states[i].ids[id],name+' '+id).toBe(value);
   expect(states[i].links).toEqual(before.states[i].links);expect(states[i].rows).toEqual(before.states[i].rows);expect(states[i].fields).toEqual(before.states[i].fields);expect(states[i].engineCalls).toEqual(before.states[i].engineCalls);
  }
  expect(events.actions).toEqual(before.actions);
 }
 if(paper){await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'customer-account-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
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
 await expect(page.locator('#cp-toast')).not.toHaveClass(/show/);
 await evidence(page,'account-'+kind+'-sent',events);
});
test('CSS customer account: order drawer and reorder body',async({page})=>{
 const state={original:capture},events=await open(page,state);await ready(page,state);
 await page.locator('button[data-open-order="7401"]:visible').first().click();await expect(page.locator('#cp-drawer-items')).toContainText('Core Cotton Tee');await expect(page.locator('#cp-drawer-tracking')).toContainText('1ZTEST7401');
 await evidence(page,'account-order-drawer',events,{paper:true});
 await page.locator('#cp-drawer-reorder').click();await expect(page.locator('#cp-req-modal')).toBeVisible();
 await page.locator('#cp-req-note').fill('Preserve this reorder note');await evidence(page,'account-reorder-dialog',events);
 await page.locator('#cp-req-submit').click();await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#cp-req-modal')).toBeHidden();await expect(page.locator('#cp-toast')).not.toHaveClass(/show/);
 await evidence(page,'account-reorder-sent',events);
});
test('CSS customer account: statement and reward request',async({page})=>{
 const state={tab:'invoices',original:capture},events=await open(page,state);await ready(page,state);
 await page.locator('#cp-statement-btn').click();await expect(page.locator('#cp-statement-modal')).toBeVisible();
 await evidence(page,'account-statement',events,{paper:true});await page.locator('#cp-statement-close').click();
 await page.setViewportSize({width:1440,height:1000});await page.locator('#cp-nav a[data-tab="overview"]').click();await page.locator('#cp-redeem-btn').click();await expect(page.locator('#cp-redeem-modal')).toBeVisible();
 await evidence(page,'account-reward-dialog',events);await page.locator('#cp-redeem-submit').click();await expect.poll(()=>events.actions.length).toBe(1);
 await expect(page.locator('#cp-redeem-modal')).toBeHidden();await expect(page.locator('#cp-toast')).not.toHaveClass(/show/);await evidence(page,'account-reward-sent',events);
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
 await expect.poll(()=>events.actions.length).toBe(1);await expect(page.locator('#cp-toast')).not.toHaveClass(/show/);await evidence(page,'product-'+mode+'-sent',events);
});
