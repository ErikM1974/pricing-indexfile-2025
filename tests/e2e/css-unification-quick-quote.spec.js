const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/quick-quote-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_QUICK_QUOTE_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,e){
 const states=[];fs.mkdirSync(out,{recursive:true});
 await page.locator('img[loading="lazy"]').evaluateAll(ns=>ns.forEach(n=>{n.loading='eager';}));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getAttribute('src')).map(n=>n.decode().catch(()=>{})));});
  const s=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...s,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(s.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  await page.screenshot({path:path.join(out,'quick-quote-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,e);const record={name,states,reads:e.reads,dialogs:e.dialogs},file='tests/fixtures/quick-quote-'+name+'-original-browser.json';
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable Quick Quote synthetic browser evidence.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 // These unavailable controls used to leak through the native hidden attribute.
 // Only their visibility changes; all active inputs, content and prices must match.
 for(const [wrapper,ids]of [['qqCapEmbWrap',['qqCapEmbType']],['qqInkBackWrap',['qqInkBack']],['qqProduct',['qqColorSelected','qqProductName','qqThumb']],['qqSleeveRow',['qqSleeveL','qqSleeveR','qqSleeveLabel']]])if(await page.locator('#'+wrapper).count()&&await page.locator('#'+wrapper).getAttribute('hidden')!==null)for(const state of before.states){for(const id of ids)delete state.ids[id];state.fields=state.fields.filter(f=>!ids.includes(f.id));}
 if(name==='quick-stock-failed')for(const state of before.states)state.ids.qqInventory='Stock could not be checked. Confirm availability before ordering. Retry stock check';
 for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables'])expect(states[i][key],name+' '+key).toEqual(before.states[i][key]);}
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'quick-quote-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
test('CSS Quick Quote: initial line sheet',async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/index.html'});await expect(page.locator('#qqLineAdd')).toBeVisible();await evidence(page,'line-empty',e);
});
test('CSS Quick Quote: prototype DTF',async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/dtf-prints-prototype.html'});await expect(page.locator('#result')).toContainText('$');await page.waitForLoadState('networkidle');await evidence(page,'prototype-dtf',e);
});
for(const method of ['dtg','emb','scp','cap'])test('CSS Quick Quote: prototype '+method,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/dtf-prints-prototype.html'});
 await expect(page.locator('#result')).toContainText('$');await page.locator('#methodToggle [data-method="'+(method==='cap'?'emb':method)+'"]').click();
 if(method==='cap')await page.locator('#embTypeToggle [data-embtype="cap"]').click();
 await expect(page.locator('#result')).toContainText('$');await page.waitForLoadState('networkidle');await evidence(page,'prototype-'+method,e);
});
for(const mode of ['parts','sizes','ratecard','pricing-failed','stock-failed'])test('CSS Quick Quote: prototype '+mode,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/dtf-prints-prototype.html',pricingFailed:mode==='pricing-failed',stockFailed:mode==='stock-failed'});
 if(mode==='pricing-failed')await expect(page.locator('#protoError')).toBeVisible();
 else{
  await expect(page.locator('#result')).toContainText('$');
  if(mode==='parts'){await page.locator('#addPrint').click();await page.locator('.proto-print-size').last().selectOption('large');await page.locator('#qty').fill('12');}
  if(mode==='sizes'){await page.locator('#methodToggle [data-method="dtg"]').click();await page.locator('#extSizesToggle').click();await page.locator('.proto-ext-count[data-size="2XL"]').fill('6');}
  if(mode==='ratecard'){await page.locator('#rateCardBtn').click();await expect.poll(()=>page.evaluate(()=>window.__printCalls)).toBe(1);await expect(page.locator('#rateCardSheet')).toContainText('DTF');}
 }
 await page.waitForLoadState('networkidle');await evidence(page,'prototype-'+mode,e);
});
for(const mode of ['normal','cap','sizes','screenprint','pricing-failed','product-failed','stock-failed'])test('CSS Quick Quote: quick price '+mode,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/index.html?mode=quick&style='+(mode==='cap'?'C112':'PC54')+'&qty=24',pricingFailed:mode==='pricing-failed',productFailed:mode==='product-failed',stockFailed:mode==='stock-failed'});
 if(mode==='product-failed')await expect(page.locator('#qqStyleStatus')).toContainText(/could|error|failed|unavailable|found/i);
 else if(mode==='pricing-failed')await expect(page.locator('#qqResults')).toContainText('Pricing unavailable');
 else{
  await expect(page.locator('.qq-card-pp').first()).toBeVisible();await expect(page.locator('.qq-skeleton')).toHaveCount(0);
  if(mode==='sizes'){await page.locator('#qqSizesToggle').click();await page.locator('[id="qqs_2XL"]').fill('4');}
  if(mode==='screenprint'){await page.locator('.qq-card[data-method="scp"]').click();await page.locator('#qqInkFront').fill('2');await page.locator('#qqScpDark').check();}
 }
 await page.waitForLoadState('networkidle');await evidence(page,'quick-'+mode,e);
});
for(const method of ['emb','dtg'])test('CSS Quick Quote: populated line sheet '+method,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/quick-quote/index.html'});
 await page.locator('[data-line-method="'+method+'"]').click();await page.locator('#qqLineAdd').click();await page.locator('.qq-line-style').first().fill('PC54');
 await expect(page.locator('#qqSheet')).toContainText('$');await page.locator('#qqLineAdd').click();await page.locator('.qq-line-style').last().fill('PC61');
 await expect(page.locator('.qq-sheet-item')).toHaveCount(2);await page.waitForLoadState('networkidle');await expect(page.locator('#qqLinePrint')).toBeEnabled();
 await page.locator('#qqLinePrint').click();await expect.poll(()=>page.evaluate(()=>window.__printCalls)).toBe(1);await evidence(page,'line-'+method,e);
});

test('CSS Quick Quote: failed stock can be retried without changing prices',async({page})=>{
 test.skip(capture,'Behavior added after preserving the original screens.');
 const state={stockFailed:true,url:'/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24'},e=await open(page,state);
 await expect(page.locator('.qq-card-pp').first()).toBeVisible();await expect(page.locator('.qq-skeleton')).toHaveCount(0);
 await expect(page.locator('#qqInventory')).toContainText('Stock could not be checked');
 await expect(page.locator('#qqInventory')).not.toContainText('Out of stock');
 const prices=await page.locator('.qq-card-pp').allTextContents(),reads=e.reads.filter(r=>r.path==='/api/inventory').length;
 state.stockFailed=false;await page.getByRole('button',{name:'Retry stock check'}).click();
 await expect(page.locator('#qqInventory')).toContainText('875 total');await expect(page.locator('.qq-inv-qty').first()).toHaveText('125');
 expect(e.reads.filter(r=>r.path==='/api/inventory')).toHaveLength(reads+1);
 expect(await page.locator('.qq-card-pp').allTextContents()).toEqual(prices);check(expect,e);
});

test('CSS Quick Quote: populated safety recommendations preserve garment handoff',async({page})=>{
 const e=await open(page,{original:capture,safetyRecs:true,url:'/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24'});
 await expect(page.locator('.qq-card-pp').first()).toBeVisible();await expect(page.locator('.qq-skeleton')).toHaveCount(0);
 const header=page.locator('#qqSafetyRecs .ssr-head');await expect(header).toBeVisible();await header.focus();await header.press('Enter');
 await expect(header).toHaveAttribute('aria-expanded','true');await expect(page.locator('#qqSafetyRecs .ssr-card')).toHaveCount(2);
 await page.locator('#qqSafetyRecs .ssr-card').last().getByRole('button',{name:'Safety Orange',exact:true}).click();
 await page.waitForLoadState('networkidle');await evidence(page,'safety-expanded',e);
 await page.locator('#qqSafetyRecs .ssr-card').last().getByRole('button',{name:'Price this style'}).click();
 await expect(page.locator('#qqStyle')).toHaveValue('PC61');await expect(page.locator('.qq-skeleton')).toHaveCount(0);
 await page.waitForLoadState('networkidle');await evidence(page,'safety-handoff',e);
});

test('CSS Quick Quote: narrow line-sheet prices remain whole and keyboard scrollable',async({page})=>{
 test.skip(capture,'Regression found during the phone visual review.');
 await page.setViewportSize({width:320,height:1000});
 const e=await open(page,{url:'/calculators/quick-quote/index.html'});
 await page.locator('[data-line-method="emb"]').click();
 await page.locator('#qqLineAdd').click();await page.locator('.qq-line-style').fill('PC54');
 const region=page.locator('.qq-sheet-ladder-wrap').first();
 await expect(region).toContainText('$');
 const money=await region.locator('td').evaluateAll(cells=>cells.filter(cell=>/^\$\d/.test(cell.textContent.trim())).map(cell=>{
  const range=document.createRange();range.selectNodeContents(cell);
  return {text:cell.textContent,lines:new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size};
 }));
 expect(money.length).toBeGreaterThan(0);expect(money.every(cell=>cell.lines===1)).toBe(true);
 await region.focus();await region.press('ArrowRight');
 await expect.poll(()=>region.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
 check(expect,e);
});

for(const [name,mount]of [['dtf','dtf'],['screenprint','scp']])test('CSS Quick Quote: shared safety panel in '+name+' builder styles',async({page})=>{
 test.skip(capture,'Shared component compatibility with the existing builder stylesheet stacks.');
 const e=await open(page,{safetyBuilder:mount,safetyRecs:true,url:'/quote-builders/'+name+'-quote-builder.html'});
 await page.evaluate(async id=>{window.__safetyHandoffs=[];await SafetyStripeRecs.render(id,{collapsible:true,onAdd:(style,color)=>window.__safetyHandoffs.push({style,color})});},mount+'-safety-recs');
 const panel=page.locator('#'+mount+'-safety-recs'),header=panel.locator('.ssr-head');
 expect(await page.locator('body').getAttribute('data-ui')).toBeNull();
 await header.focus();await header.press('Enter');await expect(header).toHaveAttribute('aria-expanded','true');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  const swatch=panel.getByRole('button',{name:'Safety Orange',exact:true}).last();await swatch.focus();await swatch.press('Space');
  await expect(swatch).toHaveClass(/is-selected/);const bounds=await swatch.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  const axe=await new AxeBuilder({page}).include('#'+mount+'-safety-recs').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>v.id)).toEqual([]);
  await panel.screenshot({path:path.join(out,'quick-quote-safety-builder-'+name+'-current-'+width+'.png')});
 }
 await panel.getByRole('button',{name:'Add to quote'}).last().click();
 expect(await page.evaluate(()=>window.__safetyHandoffs)).toEqual([{style:'PC61',color:{color_name:'Safety Orange',catalog_color:'SafetyOrange'}}]);
 await header.press('Space');await expect(panel.locator('.ssr-grid')).toBeHidden();
 await page.evaluate(id=>SafetyStripeRecs.expand(id),mount+'-safety-recs');await expect(panel.locator('.ssr-grid')).toBeVisible();check(expect,e);
});

test('CSS Quick Quote: price breaks and conditional controls work from the keyboard',async({page})=>{
 test.skip(capture,'Behavior added after preserving the original screens.');
 const e=await open(page,{url:'/calculators/quick-quote/index.html?mode=quick&style=PC54&qty=24'});
 await expect(page.locator('.qq-card-pp').first()).toBeVisible();await expect(page.locator('.qq-skeleton')).toHaveCount(0);
 const button=page.locator('.qq-card[data-method="scp"] .qq-show-breaks');
 await button.focus();await button.press('Enter');await expect(button).toHaveAttribute('aria-pressed','true');await expect(button).toBeFocused();
 await expect(page.locator('#qqInkFront')).toBeVisible();await expect(page.locator('#qqInkBack')).toBeHidden();await expect(page.locator('#qqCapEmbType')).toBeHidden();
 const back=page.locator('.qq-place-chip[data-kind="back"][data-code="FB"]');await back.focus();await back.press('Space');
 await expect(page.locator('#qqInkBack')).toBeVisible();await expect(page.locator('#qqInkBack')).toHaveValue('1');
 await page.locator('#qqSizesToggle').click();await expect(page.locator('#qqSizesToggle')).toHaveAttribute('aria-expanded','true');
 await page.locator('#qqSizesToggle').click();await expect(page.locator('#qqSizesToggle')).toHaveAttribute('aria-expanded','false');check(expect,e);
});

test('CSS Quick Quote: prototype quantity table works from the keyboard',async({page})=>{
 test.skip(capture,'Behavior added after preserving the original screens.');
 const e=await open(page,{url:'/calculators/quick-quote/dtf-prints-prototype.html'});
 await expect(page.locator('#result')).toContainText('$');const button=page.locator('.proto-mx-table tr[data-qty="48"] button');
 await button.focus();await button.press('Enter');await expect(page.locator('#qty')).toHaveValue('48');
 await expect(button).toHaveAttribute('aria-pressed','true');await expect(button).toBeFocused();check(expect,e);
});

test('CSS Quick Quote: ordinary print and fresh rate card remain separate',async({page})=>{
 test.skip(capture,'Behavior added after preserving the original screens.');
 const e=await open(page,{url:'/calculators/quick-quote/dtf-prints-prototype.html'});
 await expect(page.locator('#result')).toContainText('$');
 await page.evaluate(()=>window.print());await page.emulateMedia({media:'print'});
 await expect(page.locator('#result')).toBeVisible();await expect(page.locator('.qq-print-summary')).toContainText('PC61');await expect(page.locator('#rateCardSheet')).toBeHidden();
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
 await page.locator('#rateCardBtn').click();await expect.poll(()=>page.evaluate(()=>window.__printCalls)).toBe(2);
 await page.emulateMedia({media:'print'});await expect(page.locator('#rateCardSheet')).toBeVisible();await expect(page.locator('#result')).toBeHidden();
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
 // Simulate a failed preparation: an old sheet exists, but this click cannot rebuild it.
 await page.locator('#rateCardBtn').evaluate(button=>button.addEventListener('click',event=>event.stopImmediatePropagation(),{capture:true,once:true}));
 await page.locator('#rateCardBtn').click();await page.evaluate(()=>window.print());await page.emulateMedia({media:'print'});
 await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#rateCardSheet')).toBeHidden();check(expect,e);
});
