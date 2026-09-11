const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check,art}=require('./helpers/custom-apparel-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',actionTimeout:15000});
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CUSTOM_APPAREL_ORIGINAL==='1',phase=capture?'original':'current';
// Every current case has isolated mocked APIs, storage and output paths.
// Original capture stays serial because it appends the shared file inventory.
if(!capture)test.describe.configure({mode:'parallel'});
async function evidence(page,name,events,{paper=false}={}){
 const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(state.overflow,name+' '+width).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  if(!capture){
   const layout=await page.evaluate(()=>{
    const shown=n=>n.getClientRects().length>0;
    const labels=[...document.querySelectorAll('.tier-notch-label')].filter(shown).map(n=>({text:n.textContent,rect:n.getBoundingClientRect()}));
    const overlapping=[];
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].rect,b=labels[j].rect;if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)overlapping.push([labels[i].text,labels[j].text]);}
    const wrapped=[...document.querySelectorAll('.review-lines td:nth-last-child(-n+2)')].filter(shown).filter(n=>{const range=document.createRange();range.selectNodeContents(n);return new Set([...range.getClientRects()].map(r=>Math.round(r.top))).size>1;}).map(n=>n.textContent);
    return {overlapping,wrapped};
   });
   expect(layout,name+' readable prices at '+width).toEqual({overlapping:[],wrapped:[]});
  }
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
  // Sentence-case brand labels remove a CSS text-transform; all other visible
  // wording, numbers, fields, actual engine quotes and requests stay exact.
  for(const state of before.states)if(state.ids['gallery-grid'])state.ids['gallery-grid']=state.ids['gallery-grid'].replace(/\bEXAMPLE CAPS\b/g,'Example Caps').replace(/PORT & CO\b/g,'Port & Co');
  // The first tee-gallery capture called the quote observer before selection.
  // Later captures correctly leave it null until the real studio is ready.
  // Normalize only this proven empty quote, never a selected order's price.
  if(name==='tees-gallery')for(const state of before.states){expect(state.quote).toMatchObject({combinedQty:0,lines:[],shirtsSubtotal:0,total:0});state.quote=null;}
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

for(const kind of ['caps','tees'])test('CSS custom apparel: '+kind+' retries an initial failure',async({page})=>{
 test.skip(capture,'Repair is checked against the stored original defect observation.');
 const state={kind,mode:'fatal'},events=await open(page,state),id=kind==='caps'?'caps':'tdt';
 await expect(page.locator('#'+id+'-fatal')).toBeVisible();state.mode='gallery';
 await page.locator('#'+id+'-fatal-retry').click();await ready(page,kind,'gallery',false);
 await expect(page.locator('#'+id+'-fatal')).toBeHidden();check(expect,events);
});

for(const kind of ['caps','tees'])test('CSS custom apparel: '+kind+' reports local save failure and recovers',async({page})=>{
 test.skip(capture,'Repair is checked against the stored original defect observation.');
 await page.context().addInitScript(()=>{const original=Storage.prototype.setItem;window.__quotaBlocked=true;Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&/^(caps|cts)_studio_v1$/.test(k)&&window.__quotaBlocked)throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,k,v);};});
 const events=await open(page,{kind,selected:true});await ready(page,kind,'selected',true);await page.locator('#color-chips button').first().click();
 const qty=page.locator(kind==='caps'?'#color-cards input':'#color-cards input[data-size="M"]').first();await qty.fill('24');await qty.press('Tab');
 await expect(page.locator('#storage-notice')).toContainText('could not save');await expect(qty).toHaveValue('24');
 await page.evaluate(()=>{window.__quotaBlocked=false;});await qty.fill('25');await qty.press('Tab');await expect(page.locator('#storage-notice')).toBeHidden();
 expect(await page.evaluate(key=>sessionStorage.getItem(key),kind==='caps'?'caps_studio_v1':'cts_studio_v1')).toContain('25');check(expect,events);
});

for(const kind of ['caps','tees'])test('CSS custom apparel: '+kind+' summary confines and returns keyboard focus',async({page})=>{
 test.skip(capture,'Repair is checked against the stored original defect observation.');
 const events=await open(page,{kind,selected:true});await ready(page,kind,'selected',true);await page.locator('#color-chips button').first().click();
 if(kind==='tees'){await page.locator('#color-cards input[data-size="M"]').first().fill('24');await page.locator('#color-cards input[data-size="M"]').first().press('Tab');}
 await page.locator('#order-bar-summary').click();await expect(page.locator('#summary-sheet')).toBeVisible();
 await expect(page.locator('#sheet-close')).toBeFocused();
 // A native dialog may hand Tab to browser chrome after its last control.
 // Background form controls must remain inert, and reverse Tab returns inside.
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.activeElement===document.body||document.querySelector('#summary-sheet').contains(document.activeElement))).toBe(true);
 await page.locator('#f-first').evaluate(el=>el.focus());await expect(page.locator('#f-first')).not.toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#sheet-close')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#summary-sheet')).toBeHidden();await expect(page.locator('#order-bar-summary')).toBeFocused();check(expect,events);
});

test('CSS custom apparel: tee color selection by keyboard keeps the requested catalog key',async({page})=>{
 test.skip(capture,'Native swatch activation replaces the demonstrated nested interactive card.');
 const events=await open(page,{kind:'tees'});await ready(page,'tees','gallery',false);
 const swatch=page.locator('.gallery-card').first().locator('.gallery-swatch').nth(1);await swatch.focus();await swatch.press('Space');await page.waitForFunction(()=>window.__TDT?.S.boot.ready);
 expect(await page.evaluate(()=>window.__TDT.S.design.previewColor)).toBe('BrillOrng');check(expect,events);
});

for(const kind of ['caps','tees'])test('CSS custom apparel: '+kind+' prints complete entered notes without changing the draft',async({page})=>{
 test.skip(capture,'Print repair follows the immutable original paper review.');
 const events=await open(page,{kind,selected:true});await ready(page,kind,'selected',true);await fillOrder(page,kind);
 const note=('Keep the original order colors, quantities and artwork placement. ').repeat(15)+'Final note marker 1042.';
 await page.locator('#f-notes').fill(note);await page.locator('#f-notes').press('Tab');
 const footerIndex=await page.locator('.site-foot').evaluate(n=>[...document.body.children].indexOf(n));
 await page.pdf({path:path.join(out,'custom-apparel-'+kind+'-long-note-current.pdf'),format:'Letter',printBackground:true});
 await expect(page.locator('#f-notes')).toHaveValue(note);await expect(page.locator('.apparel-print-value')).toHaveCount(0);
 expect(await page.locator('.site-foot').evaluate(n=>[...document.body.children].indexOf(n))).toBe(footerIndex);check(expect,events);
});
