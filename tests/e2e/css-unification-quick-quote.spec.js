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
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables'])expect(states[i][key],name+' '+key).toEqual(before.states[i][key]);}
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
