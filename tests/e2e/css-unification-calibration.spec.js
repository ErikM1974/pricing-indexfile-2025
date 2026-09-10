const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./helpers/staff-final-tools-browser');
const fixture=require('../fixtures/staff-final-tools-calibration-synthetic.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
const image='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="white"/><path d="M250 100L100 180L150 380L240 350L240 850L560 850L560 350L650 380L700 180L550 100L460 150L340 150Z" fill="#17324d"/></svg>';
function stateFor(original,mode='populated'){
 const state={original,mode,reads:[],overrides:structuredClone(fixture.overrides)};
 state.respond=async(req,u)=>{
  if(req.method()!=='GET')return null;
  if(state.readOverride){const response=await state.readOverride(req,u);if(response)return response;}
  if(u.pathname==='/api/dtg/top-sellers/styles'){state.reads.push(u.pathname);return mode==='failure'?{status:503,json:{error:'Synthetic catalog unavailable'}}:{json:{records:mode==='empty'?[]:fixture.styles}};}
  if(u.pathname==='/api/dtg-calibration'){state.reads.push(u.pathname+u.search);return mode==='missing-api'?{status:404,json:{error:'Synthetic missing API'}}:{json:{data:state.overrides}};}
  if(u.pathname==='/api/product-details'){state.reads.push(u.pathname+u.search);return {json:fixture.details[u.searchParams.get('styleNumber')]};}
  if(u.pathname==='/api/image-proxy')return state.failPhoto?{status:404}:{contentType:'image/svg+xml',body:image};
  return null;
 };
 state.respondWrite=async(req,u)=>{
  if(state.writeOverride){const response=await state.writeOverride(req,u);if(response)return response;}
  if(u.pathname==='/api/dtg-calibration'&&req.method()==='POST'){const record=JSON.parse(req.postData());state.overrides.push({...record,PK_ID:4502});return {json:{success:true}};}
  if(u.pathname==='/api/dtg-calibration/4502'&&req.method()==='DELETE'){state.overrides=state.overrides.filter(r=>r.PK_ID!==4502);return {json:{success:true}};}
  return null;
 };return state;
}
async function setup(page,state){await page.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied.push(text);}}});});return open(page,'tools/custom-tees-calibrate.html',state);}
async function ready(page){await expect(page.locator('#cal-box')).toBeVisible();await expect(page.locator('#cal-status')).toContainText('starting from');}
async function copied(page){await page.locator('#cal-copy').click();return page.evaluate(()=>JSON.parse(window.__copied.at(-1)));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-final-tools-calibration-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
function cleanCurrent(events) { for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]); }
test('CSS final staff tools: Calibration pending deletion holds editing and sends one request',async({page})=>{
 const state=stateFor(false);let release;const arrived=new Promise(resolve=>{state.writeOverride=async(req,u)=>{if(u.pathname==='/api/dtg-calibration/4501'&&req.method()==='DELETE'){resolve();return new Promise(done=>{release=()=>{state.overrides=state.overrides.filter(r=>r.PK_ID!==4501);done({json:{success:true}});};});}return null;};});
 const events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);await page.locator('#cal-delete').click();await arrived;
 await expect(page.locator('#cal-delete')).toBeDisabled();await expect(page.locator('#cal-save')).toBeDisabled();await expect(page.locator('[data-style="PC61"]')).toBeDisabled();await page.locator('#cal-delete').dispatchEvent('click');expect(events.writes).toHaveLength(1);release();await expect(page.locator('#cal-delete')).toBeHidden();await expect(page.locator('#cal-save')).toBeEnabled();await expect(page.locator('#cal-status')).toContainText('auto-detect');for(const key of ['errors','unknown','missing'])expect(events[key]).toEqual([]);
});
test('CSS final staff tools: Calibration rejects failed deletion even with a misleading success body',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);const before=await copied(page);state.writeOverride=()=>({status:503,json:{success:true}});
 await page.locator('#cal-delete').click();await expect(page.locator('#cal-status')).toContainText('Removal could not be confirmed');await expect(page.locator('#cal-delete')).toBeEnabled();expect(await copied(page)).toEqual(before);expect(events.writes).toHaveLength(1);for(const key of ['errors','unknown','missing'])expect(events[key]).toEqual([]);
});
test('CSS final staff tools: Calibration keyboard controls and accessible four-width layout',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);
 await expect(page.locator('[data-style="PC54"]')).toBeFocused();
 const initial=await copied(page);
 expect(await page.locator('#cal-toasts .cal-toast').first().evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
 await page.locator('#cal-box').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
 const moved=await copied(page);expect(moved.XFrac).toBeCloseTo(initial.XFrac+.01,5);expect(moved.YFrac).toBeCloseTo(initial.YFrac+.01,5);
 await page.locator('#cal-box-handle').focus();await page.keyboard.press('ArrowRight');const resized=await copied(page);expect(resized.WFrac).toBeCloseTo(initial.WFrac+.01,5);expect(resized.WFrac/resized.HFrac).toBeCloseTo(1,5);
 await page.locator('[data-adjust="left"]').click();await page.locator('[data-adjust="up"]').click();await page.locator('[data-adjust="smaller"]').click();expect(await copied(page)).toEqual(initial);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});const audit=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),String(width)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('#cal-color').evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const photo=await page.locator('#cal-photo').boundingBox(),box=await page.locator('#cal-box').boundingBox();
  expect(Math.abs(box.x-(photo.x+initial.XFrac*photo.width))).toBeLessThan(.1);expect(Math.abs(box.y-(photo.y+initial.YFrac*photo.height))).toBeLessThan(.1);
  await copied(page);await expect(page.locator('#cal-toasts .cal-toast')).toHaveCount(1);
  await page.screenshot({path:path.join(output,'staff-final-tools-calibration-reviewed-'+width+'.png'),fullPage:true});
 }
 await page.locator('#cal-tab-front').focus();await page.keyboard.press('ArrowRight');await ready(page);await expect(page.locator('#cal-tab-back')).toBeFocused();await expect(page.locator('#cal-tab-back')).toHaveAttribute('aria-selected','true');await expect(page.locator('#cal-delete')).toBeHidden();
 cleanCurrent(events);
});

test('CSS final staff tools: Calibration failed saved-layout read remains visible after selecting a style and retry recovers',async({page})=>{
 const state=stateFor(false);let failing=true;
 state.readOverride=(_req,u)=>u.pathname==='/api/dtg-calibration'&&failing?{status:503,json:{error:'Synthetic saved layouts unavailable'}}:null;
 const events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);
 await expect(page.locator('#cal-warning')).toContainText('could not be loaded');await expect(page.locator('#cal-save')).toBeDisabled();await expect(page.locator('#cal-copy')).toBeEnabled();
 failing=false;await page.locator('#cal-retry').click();await page.locator('[data-style="PC54"]').click();await ready(page);await expect(page.locator('#cal-warning')).toBeHidden();await expect(page.locator('#cal-save')).toBeEnabled();cleanCurrent(events);
});

test('CSS final staff tools: Calibration failed photo clears old geometry until retry',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);state.failPhoto=true;
 await page.locator('#cal-tab-back').click();await expect(page.locator('#cal-empty')).toContainText('Photo failed');await expect(page.locator('#cal-box')).toBeHidden();await expect(page.locator('#cal-save')).toBeDisabled();await expect(page.locator('#cal-readout')).toBeEmpty();
 state.failPhoto=false;await page.locator('#cal-tab-back').click();await ready(page);await expect(page.locator('#cal-save')).toBeEnabled();cleanCurrent(events);
});

test('CSS final staff tools: Calibration failed details cannot save another style image',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);
 state.readOverride=(_req,u)=>u.pathname==='/api/product-details'?{status:503,json:{error:'Synthetic photos unavailable'}}:null;
 await page.locator('[data-style="PC61"]').click();await expect(page.locator('#cal-status')).toContainText('Could not load product photos');await expect(page.locator('#cal-box')).toBeHidden();await expect(page.locator('#cal-save')).toBeDisabled();await expect(page.locator('#cal-color option')).toHaveCount(0);cleanCurrent(events);
});

test('CSS final staff tools: Calibration ignores an older product lookup',async({page})=>{
 const state=stateFor(false);let release;const arrived=new Promise(resolve=>{state.readOverride=async(_req,u)=>{if(u.pathname==='/api/product-details'&&u.searchParams.get('styleNumber')==='PC54'){resolve();return new Promise(done=>{release=()=>done({json:fixture.details.PC54});});}return null;};});
 const events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await arrived;await page.locator('[data-style="PC61"]').click();await ready(page);expect((await copied(page)).StyleNumber).toBe('PC61');release();await page.waitForLoadState('networkidle');expect((await copied(page)).StyleNumber).toBe('PC61');cleanCurrent(events);
});

test('CSS final staff tools: Calibration ignores an older garment photo',async({page})=>{
 const state=stateFor(false);let release;const arrived=new Promise(resolve=>{state.readOverride=async(_req,u)=>{if(u.pathname==='/api/image-proxy'&&u.searchParams.get('url')?.endsWith('PC54-Black-front.svg')){resolve();return new Promise(done=>{release=()=>done({contentType:'image/svg+xml',body:image});});}return null;};});
 const events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await arrived;await page.locator('#cal-tab-back').click();await ready(page);expect((await copied(page)).ViewName).toBe('flatBack');release();await page.waitForLoadState('networkidle');expect((await copied(page)).ViewName).toBe('flatBack');await expect(page.locator('#cal-photo')).toHaveAttribute('alt','PC54 Black back garment photo');cleanCurrent(events);
});

test('CSS final staff tools: Calibration pending save holds editing and cannot duplicate',async({page})=>{
 const state=stateFor(false);let release;const arrived=new Promise(resolve=>{state.writeOverride=async(req,u)=>{if(u.pathname==='/api/dtg-calibration'&&req.method()==='POST'){resolve();return new Promise(done=>{release=()=>{state.overrides.push({...JSON.parse(req.postData()),PK_ID:4502});done({json:{success:true}});};});}return null;};});
 const events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);const before=await copied(page);await page.locator('#cal-save').click();await arrived;
 for(const selector of ['#cal-save','#cal-delete','#cal-tab-back','#cal-color','#cal-color-only','[data-style="PC61"]'])await expect(page.locator(selector)).toBeDisabled();
 await page.locator('#cal-save').dispatchEvent('click');await page.locator('[data-style="PC61"]').dispatchEvent('click');expect(events.writes).toHaveLength(1);release();await expect(page.locator('#cal-save')).toBeEnabled();expect(JSON.parse(events.writes[0].body)).toEqual(before);expect((await copied(page)).StyleNumber).toBe('PC54');for(const key of ['errors','unknown','missing'])expect(events[key]).toEqual([]);
});

test('CSS final staff tools: Calibration successful save and failed refresh give an honest outcome',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);
 state.readOverride=(_req,u)=>u.pathname==='/api/dtg-calibration'?{status:503,json:{error:'Synthetic refresh unavailable'}}:null;
 await page.locator('#cal-save').click();await expect(page.locator('#cal-warning')).toContainText('Layout saved, but saved layouts could not be refreshed');await expect(page.locator('#cal-save')).toBeDisabled();await expect(page.locator('#cal-copy')).toBeEnabled();await expect(page.locator('#cal-delete')).toBeHidden();expect(events.writes).toHaveLength(1);
 for(const key of ['errors','unknown','missing'])expect(events[key]).toEqual([]);
});

test('CSS final staff tools: Calibration failed save keeps the adjustment available',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);await page.locator('[data-adjust="right"]').click();const before=await copied(page);
 state.writeOverride=()=>({status:503,json:{error:'Synthetic save unavailable'}});
 await page.locator('#cal-save').click();await expect(page.locator('#cal-status')).toContainText('Save could not be confirmed');await expect(page.locator('#cal-save')).toBeEnabled();expect(await copied(page)).toEqual(before);expect(events.writes).toHaveLength(1);for(const key of ['errors','unknown','missing'])expect(events[key]).toEqual([]);
});

test('CSS final staff tools: Calibration clipboard failure does not claim a successful copy',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);await page.locator('[data-style="PC54"]').click();await ready(page);await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Synthetic denied');};});await page.locator('#cal-copy').click();await expect(page.locator('#cal-toasts')).toContainText('Could not copy JSON');await expect(page.locator('#cal-toasts')).not.toContainText('JSON copied.');await expect(page.locator('#cal-copy')).toBeEnabled();cleanCurrent(events);
});
for(const original of [true,false]){
 const edition=original?'original':'current';
 test('CSS final staff tools: Calibration '+edition+' paper preserves selected garment and geometry',async({page})=>{
  const events=await setup(page,stateFor(original));await page.locator('[data-style="PC54"]').click();await ready(page);await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'staff-final-tools-calibration-'+edition+'.pdf'),format:'Letter',preferCSSPageSize:true,printBackground:true});await expect(page.locator('#cal-photo')).toBeVisible();await expect(page.locator('#cal-box')).toBeVisible();cleanCurrent(events);
 });
 test('CSS final staff tools: Calibration '+edition+' geometry colors views and mocked saves',async({page})=>{
  const state=stateFor(original),events=await setup(page,state),states=[];await expect(page.locator('.style-item')).toHaveCount(2);await page.locator('[data-style="PC54"]').click();await ready(page);states.push({name:'saved-front',record:await copied(page)});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});const box=await page.locator('#cal-box').boundingBox();expect(box.width/box.height).toBeCloseTo(.8,1);await page.screenshot({path:path.join(output,'staff-final-tools-calibration-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.locator('#cal-tab-back').click();await ready(page);states.push({name:'auto-back',record:await copied(page)});await page.locator('#cal-color').selectOption('Navy');await ready(page);states.push({name:'navy-back',record:await copied(page)});await page.locator('#cal-color-only').check();
  const photo=await page.locator('#cal-photo').boundingBox(),box=await page.locator('#cal-box').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+photo.width*.05,box.y+box.height/2+photo.height*.04,{steps:4});await page.mouse.up();states.push({name:'moved-color-only',record:await copied(page)});
  await page.locator('#cal-save').click();await expect(page.locator('#cal-toasts')).toContainText('Saved PC54 back');await expect(page.locator('#cal-save')).toBeEnabled();expect(events.writes).toHaveLength(1);expect(JSON.parse(events.writes[0].body)).toEqual(states.at(-1).record);
  await page.locator('#cal-delete').click();await expect(page.locator('#cal-toasts')).toContainText('Saved layout removed');if(original)await expect(page.locator('#cal-delete')).toHaveAttribute('hidden','');else await expect(page.locator('#cal-delete')).toBeHidden();expect(events.writes).toHaveLength(2);states.push({name:'after-delete',record:await copied(page)});
  if(!original){const baseline=require('../fixtures/staff-final-tools-calibration-original-browser.json');expect(states).toEqual(baseline.states);expect(events.writes).toEqual(baseline.events.writes);}
  save(edition+'-browser',{states,reads:state.reads,events});for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure','missing-api'])test('CSS final staff tools: Calibration '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await setup(page,state);await page.waitForLoadState('networkidle');if(mode==='failure')await expect(page.locator('#style-list')).toContainText('Failed to load');if(mode==='missing-api')await expect(page.locator(original?'#cal-status':'#cal-warning')).toContainText(original?'API not deployed':'Saved layouts could not be loaded');if(!original&&mode==='empty')await expect(page.locator('#style-list')).toContainText('No styles');save(edition+'-'+mode,{text:await page.locator('main').innerText(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
