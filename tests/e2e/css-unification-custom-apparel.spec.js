const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check,art}=require('./helpers/custom-apparel-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',actionTimeout:15000});
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CUSTOM_APPAREL_ORIGINAL==='1',phase=capture?'original':'current';
async function evidence(page,name,events,{paper=false}={}){
 const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(state.overflow,name+' '+width).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'custom-apparel-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,events);
 const record={name,states,actions:events.actions,dialogs:events.dialogs},file='tests/fixtures/custom-apparel-'+name+'-original-browser.json';
 if(capture){
  if(fs.existsSync(path.join(root,file)))expect(record,'Immutable original '+name).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
  else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic original custom apparel browser contract.\n');}
 }else{
  fs.writeFileSync(path.join(out,'custom-apparel-'+name+'-current-diagnostics.json'),JSON.stringify(record,null,2)+'\n');
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  for(let i=0;i<states.length;i++)for(const k of ['title','ids','fields','links','cart','quote'])expect(states[i][k],name+' '+k).toEqual(before.states[i][k]);
  expect(events.actions).toEqual(before.actions);
 }
 if(paper){await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'custom-apparel-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
}
async function ready(page,kind,mode,selected){
 if(['empty','fatal'].includes(mode)){await expect(page.locator(kind==='caps'?'#caps-fatal':'#tdt-fatal')).toBeVisible();return;}
 await expect(page.locator('#gallery-grid .gallery-card')).toHaveCount(3);
 if(selected&&mode!=='pricing-failed'){await expect(page.locator('#studio')).toBeVisible();await page.waitForFunction(()=>!!(window.__CAPS||window.__TDT)?.S.boot.ready);}
 else if(selected){await expect(page.locator(kind==='caps'?'#caps-fatal':'#tdt-fatal')).toBeVisible();}
 else await page.waitForFunction(()=>!!(window.__CAPS||window.__TDT));
 if(kind==='caps'&&mode!=='pricing-failed')await expect(page.locator('#gallery-grid')).not.toContainText('Loading price');
 if(kind==='tees')await expect(page.locator('#gallery-grid')).not.toContainText('Loading price');
}
for(const kind of ['caps','tees'])for(const mode of ['gallery','selected','fatal','empty','pricing-failed','inventory-failed','low','out'])test('CSS custom apparel original: '+kind+' '+mode,async({page})=>{
 const selected=!['gallery','fatal','empty'].includes(mode),events=await open(page,{kind,mode,selected,original:capture});await ready(page,kind,mode,selected);
 if(['selected','inventory-failed','low','out'].includes(mode)){await page.locator('#color-chips button').first().click();if(kind==='tees'&&mode!=='out'){const q=page.locator('#color-cards input[data-size="M"]').first();await q.fill(mode==='low'?'2':'12');await q.press('Tab');}}
 await evidence(page,kind+'-'+mode,events,{paper:['gallery','selected','fatal'].includes(mode)});
});
async function fillOrder(page,kind,back=false,{valid=true}={}){
 await page.locator('#color-chips button').first().click();
 // The existing pricing-unit fixture has the complete full/jumbo front/back
 // cost grid at 24 pieces. Its 12-piece rows cover left chest only.
 if(kind==='tees'){const q=page.locator('#color-cards input[data-size="M"]').first();await q.fill('24');await q.press('Tab');}
 await page.locator(kind==='caps'?'#front-input':'#art-input').setInputFiles({name:'example-front.svg',mimeType:'image/svg+xml',buffer:Buffer.from(art)});
 await expect(page.locator(kind==='caps'?'#front-file-name':'#art-file-name')).toContainText('example-front.svg');
 if(back){await page.locator('#back-toggle').focus();await page.locator('#back-toggle').press('Space');await expect(page.locator('#back-toggle')).toBeChecked();await page.locator(kind==='caps'?'#back-input':'#art-input').setInputFiles({name:'example-back.svg',mimeType:'image/svg+xml',buffer:Buffer.from(art)});}
 for(const[id,value]of Object.entries({'f-first':'Casey','f-last':'Example','f-email':'customer@example.test','f-phone':'2535550142','f-company':'Example Team','f-addr1':'100 Example Way','f-city':'Milton','f-state':'WA','f-zip':'98354','f-notes':'Preserve all selected colors, sizes, and both artwork files. Example request only.'}))await page.locator('#'+id).fill(value);
 await page.locator('#rights-ack').focus();await page.locator('#rights-ack').press('Space');await expect(page.locator('#rights-ack')).toBeChecked();if(valid)await expect(page.locator('#pay-btn')).toBeEnabled({timeout:20000});
}
for(const kind of ['caps','tees'])for(const mode of ['filled','back','checkout-failed'])test('CSS custom apparel original: '+kind+' '+mode,async({page})=>{
 const events=await open(page,{kind,mode,selected:true,original:capture,checkoutStatus:mode==='checkout-failed'?503:0});await ready(page,kind,mode,true);await fillOrder(page,kind,mode==='back');
 if(mode==='checkout-failed'){await page.locator('#pay-btn').click();await expect(page.locator('#pipeline-error')).toContainText('Synthetic checkout unavailable');}
 await evidence(page,kind+'-'+mode,events,{paper:true});
});

for(const kind of ['caps','tees'])for(const mode of ['pickup','tax-failed','checkout-sent','sheet','multiple-colors'])test('CSS custom apparel original workflow: '+kind+' '+mode,async({page})=>{
 const events=await open(page,{kind,mode,selected:true,original:capture,taxFailure:mode==='tax-failed'});await ready(page,kind,mode,true);await fillOrder(page,kind,false,{valid:mode!=='tax-failed'});
 if(mode==='pickup'){await page.locator('#d-pickup').focus();await page.locator('#d-pickup').press('Space');await expect(page.locator('#pay-btn')).toBeEnabled();}
 if(mode==='tax-failed'){await expect(page.locator('#pay-btn')).toBeDisabled();await expect(page.locator('#pay-reasons')).toContainText('Tax lookup failed');}
 if(mode==='multiple-colors'){
  await page.locator('#color-chips button').nth(1).click();const q=page.locator(kind==='caps'?'#color-cards input[data-color="BrillOrng"]':'#color-cards input[data-color="BrillOrng"][data-size="2XL"]');await q.fill('8');await q.press('Tab');
 }
 if(mode==='sheet'){await page.setViewportSize({width:390,height:1000});await page.locator('#order-bar-summary').click();await expect(page.locator('#summary-sheet')).toBeVisible();}
 if(mode==='checkout-sent'){await page.locator('#pay-btn').click();await page.waitForURL(/\/__apparel-fixture\/checkout$/);expect(events.actions.filter(a=>a.path==='/api/create-checkout-session')).toHaveLength(1);}
 await evidence(page,kind+'-'+mode,events,{paper:['pickup','multiple-colors','sheet'].includes(mode)});
});
test('CSS custom apparel original workflow: tees search and category',async({page})=>{
 const events=await open(page,{kind:'tees',original:capture});await ready(page,'tees','gallery',false);
 await page.locator('#gallery-search').fill('missing garment');await expect(page.locator('#gallery-empty')).toBeVisible();await evidence(page,'tees-search-empty',events);
 await page.locator('#gallery-search').fill('');await page.locator('#gallery-chips button').filter({hasText:'Hoodies'}).click();await expect(page.locator('#gallery-grid .gallery-card')).toHaveCount(1);await page.locator('#gallery-sort').selectOption('price');await evidence(page,'tees-filtered',events);
});
test('CSS custom apparel original workflow: tees rush',async({page})=>{
 const events=await open(page,{kind:'tees',selected:true,original:capture});await ready(page,'tees','filled',true);await fillOrder(page,'tees');await page.locator('#rush-toggle').focus();await page.locator('#rush-toggle').press('Space');await expect(page.locator('#pay-btn')).toBeEnabled();await evidence(page,'tees-rush',events,{paper:true});
});
test('CSS custom apparel original workflow: caps below minimum',async({page})=>{
 const events=await open(page,{kind:'caps',selected:true,original:capture});await ready(page,'caps','selected',true);await page.locator('#color-chips button').first().click();const q=page.locator('#color-cards input').first();await q.fill('7');await q.press('Tab');await expect(page.locator('#pay-btn')).toBeDisabled();await evidence(page,'caps-below-minimum',events,{paper:true});
});
