const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification');
const original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
function record(name,value){const f='tests/fixtures/specialty-calculators-'+name+'-original-browser.json',full=path.join(root,f);if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+f+' — immutable synthetic Richardson calculator evidence.\n');}else {
 const prior=JSON.parse(fs.readFileSync(full,'utf8'));
 if(!original && value.states){
  for(const [i,state] of value.states.entries()){
   const expected=JSON.parse(JSON.stringify(prior.states[i])),actual=JSON.parse(JSON.stringify(state));
   if(name==='richardson-failed')expected.ids.richardsonDataWarning='Unable to verify live SanMar style availability, cap embroidery prices, patch upcharge, puff upcharge, patch setup fee. Built-in values may be used. Refresh the page or contact your sales representative before quoting.';
   if(name==='richardson-changed-style'){
    for(const id of ['setupLabel','setupPerUnit','pricePerCap','lineTotal'])delete expected.ids[id];
    expected.ids.styleDescription='No matching factory-direct style. Choose a matching cap to see pricing.';
    expected.ids.pricePlaceholder='Select a cap style to see pricing';
   }
   if(expected.ids.capGrid)expected.ids.capGrid=expected.ids.capGrid.replace(/BEANIE/g,'Beanie');
   for(const key of ['width','title','url','ids','fields','links','tables','headings'])expect(actual[key],name+' '+state.width+' '+key).toEqual(expected[key]);
  }
  expect(value.mocked).toEqual(prior.mocked);expect(value.dialogs).toEqual(prior.dialogs);
 } else expect(value).toEqual(prior);
}}
async function ready(page,state={}){await page.setViewportSize({width:1440,height:1000});const events=await open(page,{...state,original,richardson:true,url:'/calculators/richardson-2025.html'});await page.waitForFunction(()=>!!window.richardsonPricing);return events;}
async function select(page,style='110'){await page.locator('#capStyle').fill(style);await page.locator('#quantity').focus();await expect(page.locator('#styleAutocomplete')).toBeHidden();await expect(page.locator('#styleDescription')).toContainText(style==='110'?'R-Flex Trucker':'Solid Knit');}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));});if(!original)expect(await page.locator('img').evaluateAll(nodes=>nodes.filter(n=>!n.complete||n.naturalWidth===0).map(n=>n.src)),'All branding assets loaded').toEqual([]);const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});if(!original){expect(state.overflow).toBe(false);expect(axe.violations).toEqual([]);}await page.screenshot({path:path.join(out,'specialty-calculators-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}check(expect,events);record(name,{name,states,dialogs:events.dialogs,mocked:events.mocked});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.pdf({path:path.join(out,'specialty-calculators-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
for(const mode of ['empty','normal','ltm','patch','puff','existing','autocomplete','browse','no-results','failed','alternate-api','changed-style'])test('CSS specialty Richardson: '+mode,async({page})=>{
 const events=await ready(page,{failed:mode==='failed',alternate:mode==='alternate-api'});
 if(!['empty','autocomplete','browse','no-results'].includes(mode))await select(page);
 if(mode==='ltm')await page.locator('#quantity').fill('7');
 if(['patch','alternate-api'].includes(mode)){await page.locator('[name="embellishment"][value="leatherette"]').check();await page.locator('#quantity').fill('8');}
 if(mode==='puff'){await page.locator('[name="embellishment"][value="puff"]').check();await page.locator('#quantity').fill('72');}
 if(mode==='existing'){await page.locator('#newDesign').uncheck();await page.locator('#quantity').fill('48');}
 if(mode==='autocomplete'){await page.locator('#capStyle').fill('R1');await expect(page.locator('.autocomplete-item')).toHaveCount(2);}
 if(['browse','no-results'].includes(mode)){await page.locator('#capBrowserToggle').click();await page.locator('[data-category="beanie"]').click();await page.locator('#capSearchInput').fill(mode==='browse'?'R1':'unmatched-synthetic-cap');}
 if(mode==='changed-style'){await page.locator('#capStyle').fill('unmatched-synthetic-cap');await page.locator('#quantity').focus();}
 await evidence(page,'richardson-'+mode,events);
});
test('CSS specialty Richardson: all tier edges and category results retain native values',async({page})=>{
 const events=await ready(page),prices=[];await select(page);
 for(const type of ['embroidery','leatherette','puff'])for(const fresh of [true,false]){await page.locator('[name="embellishment"][value="'+type+'"]').check();await page.locator('#newDesign').setChecked(fresh);for(const qty of [1,7,8,23,24,47,48,71,72,9999,0,-1]){await page.locator('#quantity').fill(String(qty));prices.push({type,fresh,qty,state:await snapshot(page)});}}
 await page.locator('#capBrowserToggle').click();const categories=[];for(const name of ['all','trucker','performance','beanie','visor','camo','fitted','other']){await page.locator('[data-category="'+name+'"]').click();categories.push({name,cards:await page.locator('.cap-card').evaluateAll(nodes=>nodes.map(n=>({style:n.dataset.style,text:n.textContent.replace(/\s+/g,' ').trim()})))});}
 await page.locator('[data-category="all"]').click();await page.locator('#capSearchInput').fill('R15');await page.locator('.quick-select-btn').click();await expect(page.locator('#capStyle')).toHaveValue('R15');await expect(page.locator('#quantity')).toBeFocused();await page.locator('#quantity').fill('24');await page.locator('#clearCapSearch').click();await page.locator('#capBrowserToggle').click();check(expect,events);record('richardson-tiers-categories',{prices,categories,selected:await snapshot(page)});
});

test('CSS specialty Richardson: keyboard selection clears stale price and keeps controls usable',async({page})=>{
 test.skip(original,'Current accessibility and stale-selection repair');const events=await ready(page);await select(page);await page.locator('#capStyle').fill('R1');await expect(page.locator('#priceBreakdown')).toBeHidden();await page.locator('#capStyle').press('ArrowDown');await expect(page.locator('.autocomplete-item').first()).toBeFocused();await page.waitForTimeout(250);await expect(page.locator('.autocomplete-item').first()).toBeFocused();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.locator('#capStyle')).toHaveValue('R18');await expect(page.locator('#quantity')).toBeFocused();await expect(page.locator('#priceBreakdown')).toBeVisible();
 await page.locator('#capStyle').fill('R1');await page.locator('#capStyle').press('ArrowDown');await page.keyboard.press('Escape');await expect(page.locator('#capStyle')).toBeFocused();await expect(page.locator('#capStyle')).toHaveAttribute('aria-expanded','false');await expect(page.locator('#styleAutocomplete')).toBeHidden();
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});for(const item of await page.locator('.field-input:visible,.radio-option').all()){const box=await item.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}}
 await page.locator('#capBrowserToggle').click();for(const button of await page.locator('.category-chip').all()){await expect(button).toBeVisible();const box=await button.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);expect(box.height).toBeGreaterThanOrEqual(44);}check(expect,events);
});
test('CSS specialty Richardson: API labels reflect actual fees and failures persist on paper',async({page})=>{
 test.skip(original,'Current API label and warning repair');const events=await ready(page,{alternate:true});await expect(page.locator('[data-richardson-upcharge="patch"]')).toHaveText('Leatherette Patch (+$6.25/cap)');await expect(page.locator('[data-richardson-upcharge="puff"]')).toHaveText('3D Puff (+$7.00/cap)');await select(page);await page.locator('[name="embellishment"][value="leatherette"]').check();await expect(page.locator('#setupLabel')).toContainText('$65.00');check(expect,events);
});

for(const read of ['/api/decorated-cap-prices','CAP','PATCH','CAP-PUFF','/api/service-codes'])for(const mode of ['failedRead','incompleteRead'])test('CSS specialty Richardson: visible '+mode+' '+read,async({page})=>{
 test.skip(original,'Current missing-pricing warnings');const events=await ready(page,{[mode]:read});const warning=page.locator('#richardsonDataWarning');await expect(warning).toBeVisible();await expect(warning).toContainText('Built-in values may be used');await select(page);await page.emulateMedia({media:'print'});await expect(warning).toBeVisible();await expect(page.locator('#priceBreakdown')).toBeVisible();check(expect,events);
});
