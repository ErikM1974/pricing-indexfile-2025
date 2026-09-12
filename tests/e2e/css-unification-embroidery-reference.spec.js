const {test,expect}=require('@playwright/test'),fs=require('fs'),path=require('path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/embroidery-reference-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_EMBROIDERY_REFERENCE_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,e){
 fs.mkdirSync(out,{recursive:true});const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getAttribute('src')).map(n=>n.decode().catch(()=>{})));});
  const s=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...s,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(s.overflow).toBe(false);expect(axe.violations.map(v=>v.id)).toEqual([]);}
  await page.screenshot({path:path.join(out,'embroidery-reference-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,e);const record={name,states,reads:e.reads,dialogs:e.dialogs},file='tests/fixtures/embroidery-reference-'+name+'-original-browser.json';
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable embroidery reference synthetic browser evidence.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables','headings'])expect(states[i][key],name+' '+key).toEqual(before.states[i][key]);}
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'embroidery-reference-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
for(const tab of ['al-retail','decg-retail','stitch-charges','fullback'])test('CSS embroidery reference: '+tab,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/embroidery-pricing-all/index.html?tab='+tab});await page.waitForLoadState('networkidle');await expect(page.locator('.loading-cell')).toHaveCount(0);await evidence(page,tab,e);
});
for(const [tab,prefix]of [['al-retail','alRetail'],['decg-retail','decgRetail']])for(const type of ['cap','laser-patch','extras'])test('CSS embroidery reference: '+tab+' '+type,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/embroidery-pricing-all/index.html?tab='+tab});await page.waitForLoadState('networkidle');
 if(type==='extras'){await page.locator('#'+prefix+'Quantity').fill('5');await page.locator('#'+prefix+'Stitches').fill('18000');if(prefix==='decgRetail')await page.locator('#decgRetailHeavyweight').check();}
 else{await page.locator('#'+prefix+'ItemType').selectOption(type);if(type==='laser-patch')await page.locator('#'+prefix+'Quantity').fill('5');}
 await evidence(page,tab+'-'+type,e);
});
test('CSS embroidery reference: expanded information',async({page})=>{
 const e=await open(page,{original:capture});await page.waitForLoadState('networkidle');for(const detail of await page.locator('#tab-al-retail details').all())await detail.locator('summary').click();await evidence(page,'information',e);
});
test('CSS embroidery reference: expanded account',async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/embroidery-pricing-all/index.html?tab=stitch-charges'});await page.waitForLoadState('networkidle');await page.locator('.es-account-hdr').first().click();await evidence(page,'account',e);
});
for(const mode of ['all','filter','empty','sort'])test('CSS embroidery reference: customer dialog '+mode,async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/embroidery-pricing-all/index.html?tab=stitch-charges'});await page.waitForLoadState('networkidle');await page.locator('#openSurchargeModal').click();
 if(mode==='filter'){await page.locator('#scTierFilters [data-filter="Mid"]').click();await page.locator('#scRepFilters [data-rep="unassigned"]').click();}
 if(mode==='empty')await page.locator('#scSearch').fill('No matching example');
 if(mode==='sort')await page.locator('#scTable th[data-col="company"]').click();
 await evidence(page,'dialog-'+mode,e);
});
for(const mode of ['failed','stitchesFailed','upgradesFailed'])test('CSS embroidery reference: '+mode,async({page})=>{
 const e=await open(page,{original:capture,[mode]:true,url:'/calculators/embroidery-pricing-all/index.html?tab='+(mode==='stitchesFailed'?'stitch-charges':'al-retail')});await page.waitForLoadState('networkidle');await evidence(page,mode,e);
});

test('CSS embroidery reference: existing contract print',async({page})=>{
 const e=await open(page,{original:capture,url:'/calculators/embroidery-pricing-all/index.html?tab=fullback'});await page.waitForLoadState('networkidle');
 await page.evaluate(()=>window.printContractPricing());await expect.poll(()=>page.evaluate(()=>window.__prints)).toBe(1);await evidence(page,'contract-print',e);
});
