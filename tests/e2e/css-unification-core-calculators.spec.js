const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/core-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CORE_CALCULATORS_ORIGINAL==='1',phase=capture?'original':'current';
const pages={dtg:'dtg-pricing',dtf:'dtf-pricing',emb:'embroidery-pricing',cap:'cap-embroidery-pricing-integrated',sp:'screen-print-pricing'};
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
function tierContract(values){return values.map(v=>v.ids?{...v,ids:Object.fromEntries(Object.entries(v.ids).filter(([k])=>/price|tier|qty|quantity|ltm|amount|fee|upcharge|setup|locations-display/.test(k))),fields:v.fields.filter(f=>f.id!=='styleSearch')}:v);}
// The redesign keeps the warehouse label visible at every width. Original
// captures also cross the inventory auto-load timer; compare the settled
// inventory value independently of which screenshot first saw that response.
function screenContract(value){
 const v=JSON.parse(JSON.stringify(value));if(!v.states)return v;
 const inventory=v.states.map(s=>s.ids['calculator-inventory-section']).filter(Boolean).at(-1);
 for(const state of v.states)if('calculator-inventory-section' in state.ids)state.ids['calculator-inventory-section']=(inventory||'').replace(/Warehouse Inventory\s*/g,'');
 // Moving help outside the toggle makes its existing label a leaf ID.
 for(const state of v.states){
  if('sp-dark-garment-toggle' in state.ids){expect(state.ids['sp-dark-garment-toggle']).toBe('Printing on dark garment? (White underbase required)');delete state.ids['sp-dark-garment-toggle'];}
  if(state.ids['sp-additional-locations-container'])state.ids['sp-additional-locations-container']=state.ids['sp-additional-locations-container'].replace(/^LOCATION /,'Location ').replace(/ COLORS /,' Colors ');
 }
 return v;
}
function contract(name,value){const file='tests/fixtures/core-calculators-'+name+'-original-browser.json',full=path.join(root,file);if(capture&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic public calculator browser contract.\n');}else{const before=JSON.parse(fs.readFileSync(full,'utf8')),normalize=name.endsWith('-tier-values')?tierContract:screenContract;expect(normalize(value),name).toEqual(normalize(before));}}
async function settled(page,key,manual=false){
 if(key==='dtg'){await expect(page.locator('.tier-button[data-tier]')).toHaveCount(5);if(!manual)await expect(page.locator('.dtg-product-card')).toHaveCount(7);}
 else if(key==='dtf'){await expect(page.locator('#dtf-tier-buttons button')).toHaveCount(4);await expect.poll(()=>page.evaluate(()=>window.dtfCalculator?.currentData.garmentCost||0)).toBeGreaterThan(0);}
 else if(key==='sp')await expect(page.locator('.sp-tier-button')).toHaveCount(4);
 else await expect(page.locator('#pricingSection table').first()).toContainText('$');
}
async function start(page,key,state={}){const url='/calculators/'+pages[key]+'.html'+(state.manual?'?manualCost=4':'?StyleNumber='+(key==='cap'?'C112':'PC54')+'&COLOR=Jet%20Black');const e=await open(page,{...state,url,original:capture});if(!state.pricingFailed)await settled(page,key,state.manual);return e;}
async function evidence(page,name,e){fs.mkdirSync(out,{recursive:true});const states=[];
 if(!capture){const before=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/core-calculators-'+name+'-original-browser.json'),'utf8'));if(before.states.some(s=>s.ids['calculator-inventory-section']))await expect(page.locator('.calc-inv-total')).toContainText('units');}

 if(name.startsWith('dtg-')&&!name.endsWith('-manual'))await expect(page.locator('.dtg-product-card')).toHaveCount(7);
 // Full-page evidence includes recommendations below the viewport. Request
 // their existing image sources before decode; a lazy image can otherwise
 // remain pending forever on the failed-product layout.
 await page.locator('img[loading="lazy"]').evaluateAll(ns=>ns.forEach(n=>{n.loading='eager';}));
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getAttribute('src')).map(n=>n.decode().catch(()=>{})));});const s=await snapshot(page);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...s});if(!capture){expect(s.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}else fs.writeFileSync(path.join(out,'core-calculators-'+name+'-original-axe-'+width+'.json'),JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),null,2));await page.screenshot({path:path.join(out,'core-calculators-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}
 // Both original color handlers reference an undeclared variable. Preserve
 // those observed failures during capture; every current state must be clean.
 expect(e.errors).toEqual(capture&&/^(dtg|dtf)-options$/.test(name)?['currentStyleNumber is not defined']:[]);
 check(expect,{...e,errors:[]});const values=states.map(({overflow,...s})=>s);contract(name,{states:values,dialogs:e.dialogs});await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'core-calculators-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
async function priced(page,key){if(key==='dtg'){await page.locator('[data-location="LC"]').click();await expect(page.locator('#live-price-amount')).not.toHaveText('$0.00');}if(key==='dtf'){await page.locator('[data-location="left-chest"]').click();await expect(page.locator('#dtf-live-price')).not.toHaveText('0.00');}}
async function inventory(page){await expect(page.locator('[data-calc-inv-toggle]')).toBeVisible();await page.locator('[data-calc-inv-toggle]').click();await expect(page.locator('.calc-inv-table')).toBeVisible();}
async function tierValues(page,key){const values=[];
 if(key==='emb'||key==='cap'){for(const qty of ['1','7','3']){await page.locator('#ltmQuantity').selectOption(qty);values.push({qty,tables:await page.locator('#pricingSection table').allTextContents()});}}
 else{const selector=key==='dtg'?'.tier-button[data-tier]':key==='dtf'?'#dtf-tier-buttons button':'.sp-tier-button';const labels=await page.locator(selector).evaluateAll(ns=>ns.map(n=>n.dataset.tier));for(const tier of labels){await page.locator(selector).evaluateAll((ns,t)=>ns.find(n=>n.dataset.tier===t).click(),tier);const s=await snapshot(page);values.push({tier,ids:s.ids,fields:s.fields});}}
 contract(key+'-tier-values',values);
}
for(const key of Object.keys(pages)){
 test('CSS core calculators: '+key+' product and price',async({page})=>{const e=await start(page,key);await priced(page,key);await inventory(page);await evidence(page,key+'-normal',e);});
 test('CSS core calculators: '+key+' tiers and selected options',async({page})=>{const e=await start(page,key);await priced(page,key);await tierValues(page,key);
  if(key==='dtg'){await page.locator('[data-location="FB"]').click();await page.locator('[id="tier-1-11"]').click();await page.locator('#dtg-ltm-quantity-input').fill('6');await page.locator('#dtg-ltm-quantity-input').dispatchEvent('input');}
  if(key==='dtf'){await page.locator('[data-location="full-back"]').click();await page.locator('#dtf-tier-buttons [data-tier="10-23"]').click();await page.locator('#dtf-exact-quantity').fill('12');await page.locator('#dtf-exact-quantity').dispatchEvent('input');await page.locator('#dtf-exact-quantity').dispatchEvent('change');}
  if(key==='sp'){await page.locator('#sp-toggle-2color').click();await page.locator('#sp-dark-garment-toggle').click();await page.locator('#sp-add-location').click();await page.locator('#sp-toggle-breakdown-text').click();}
  await page.locator('#colorSwatches .color-swatch').nth(1).click();await expect(page.locator('#currentColor')).toHaveText('Brilliant Orange');await expect(page.locator('.calc-inv-color-name')).toHaveText('Brilliant Orange');await inventory(page);await evidence(page,key+'-options',e);
 });
 test('CSS core calculators: '+key+' manual cost',async({page})=>{const e=await start(page,key,{manual:true});await priced(page,key);await evidence(page,key+'-manual',e);});
 test('CSS core calculators: '+key+' pricing failure',async({page})=>{const e=await start(page,key,{pricingFailed:true});await expect(page.locator('body')).toContainText(/Unable to load|Failed to load|unavailable|Pricing Error/i);await evidence(page,key+'-failed',e);});
}

for(const key of Object.keys(pages)){
 test('CSS core calculators: '+key+' keyboard colors and inventory',async({page})=>{
  const e=await start(page,key);await priced(page,key);
  const color=page.locator('#colorSwatches .color-swatch').nth(1);await color.focus();await color.press('Enter');
  await expect(color).toHaveAttribute('aria-pressed','true');await expect(page.locator('#currentColor')).toHaveText('Brilliant Orange');
  await expect(page.locator('.calc-inv-color-name')).toHaveText('Brilliant Orange');
  const bar=page.locator('[data-calc-inv-toggle]');await bar.focus();await bar.press('Space');await expect(bar).toHaveAttribute('aria-expanded','true');
  await page.setViewportSize({width:320,height:850});const table=page.locator('.core-table-scroll').filter({has:page.locator('.calc-inv-table')});await table.focus();await table.press('ArrowRight');
  if(key!=='cap')await expect.poll(()=>table.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
  expect(e.reads.some(r=>r.path.includes('/sanmar/inventory/')&&new URLSearchParams(r.query).get('color')==='BrillOrng')).toBe(true);
  check(expect,e);
 });
 test('CSS core calculators: '+key+' inventory failure stays visible',async({page})=>{
  const e=await start(page,key,{stockFailed:true});await priced(page,key);await expect(page.locator('.calc-inv-error')).toContainText('Unable to load inventory');
  await page.setViewportSize({width:320,height:850});expect((await snapshot(page)).overflow).toBe(false);check(expect,e);
 });
}
for(const key of ['dtg','dtf','sp']){
 test('CSS core calculators: '+key+' keyboard selection and fee information',async({page})=>{
  const e=await start(page,key);await priced(page,key);
  const selector=key==='dtg'?'[id="tier-1-11"]':key==='dtf'?'#dtf-tier-buttons [data-tier="10-23"]':'[id="sp-tier-24-47"]';
  const tier=page.locator(selector);await tier.focus();await tier.press('Enter');await expect(tier).toHaveAttribute('aria-pressed','true');await expect(tier).toBeFocused();
  const id=key==='dtg'?'setup-fee-badge':key==='dtf'?'dtf-setup-fee-badge':'sp-setup-fee-badge',button=page.locator('#'+id);
  await button.focus();await button.press('Enter');await expect(button).toHaveAttribute('aria-expanded','true');
  const panel=page.locator('#'+await button.getAttribute('aria-controls'));await expect(panel).toContainText('Art Setup Fee');
  await page.setViewportSize({width:320,height:850});expect((await snapshot(page)).overflow).toBe(false);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
  await button.press('Escape');await expect(panel).toBeHidden();await expect(button).toBeFocused();check(expect,e);
 });
}
for(const key of ['emb','cap'])test('CSS core calculators: '+key+' keyboard reaches every price column',async({page})=>{
 const e=await start(page,key);await page.setViewportSize({width:320,height:850});const wrap=page.locator('#pricingSection .core-table-scroll').first();await wrap.focus();await wrap.press('End');await wrap.press('ArrowRight');await expect.poll(()=>wrap.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);await expect(wrap.locator('th').last()).toContainText('72+');check(expect,e);
});

test('CSS core calculators: failed screen print pricing remains visible after the former timeout',async({page})=>{
 await page.clock.install();const e=await start(page,'sp',{pricingFailed:true});await expect(page.locator('#sp-error-banner')).toBeVisible();await page.clock.fastForward(15000);await expect(page.locator('#sp-error-banner')).toBeVisible();await expect(page.locator('#sp-error-banner')).toHaveAttribute('role','alert');check(expect,e);
});
