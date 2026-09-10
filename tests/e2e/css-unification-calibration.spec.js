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
  if(u.pathname==='/api/dtg/top-sellers/styles'){state.reads.push(u.pathname);return mode==='failure'?{status:503,json:{error:'Synthetic catalog unavailable'}}:{json:{records:mode==='empty'?[]:fixture.styles}};}
  if(u.pathname==='/api/dtg-calibration'){state.reads.push(u.pathname+u.search);return mode==='missing-api'?{status:404,json:{error:'Synthetic missing API'}}:{json:{data:state.overrides}};}
  if(u.pathname==='/api/product-details'){state.reads.push(u.pathname+u.search);return {json:fixture.details[u.searchParams.get('styleNumber')]};}
  if(u.pathname==='/api/image-proxy')return state.failPhoto?{status:404}:{contentType:'image/svg+xml',body:image};
  return null;
 };
 state.respondWrite=async(req,u)=>{
  if(u.pathname==='/api/dtg-calibration'&&req.method()==='POST'){const record=JSON.parse(req.postData());state.overrides.push({...record,PK_ID:4502});return {json:{success:true}};}
  if(u.pathname==='/api/dtg-calibration/4502'&&req.method()==='DELETE'){state.overrides=state.overrides.filter(r=>r.PK_ID!==4502);return {json:{success:true}};}
  return null;
 };return state;
}
async function setup(page,state){await page.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied.push(text);}}});});return open(page,'tools/custom-tees-calibrate.html',state);}
async function ready(page){await expect(page.locator('#cal-box')).toBeVisible();await expect(page.locator('#cal-status')).toContainText('starting from');}
async function copied(page){await page.locator('#cal-copy').click();return page.evaluate(()=>JSON.parse(window.__copied.at(-1)));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-final-tools-calibration-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
for(const original of [true]){
 const edition=original?'original':'current';
 test('CSS final staff tools: Calibration '+edition+' geometry colors views and mocked saves',async({page})=>{
  const state=stateFor(original),events=await setup(page,state),states=[];await expect(page.locator('.style-item')).toHaveCount(2);await page.locator('[data-style="PC54"]').click();await ready(page);states.push({name:'saved-front',record:await copied(page)});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});const box=await page.locator('#cal-box').boundingBox();expect(box.width/box.height).toBeCloseTo(.8,1);await page.screenshot({path:path.join(output,'staff-final-tools-calibration-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.locator('#cal-tab-back').click();await ready(page);states.push({name:'auto-back',record:await copied(page)});await page.locator('#cal-color').selectOption('Navy');await ready(page);states.push({name:'navy-back',record:await copied(page)});await page.locator('#cal-color-only').check();
  const photo=await page.locator('#cal-photo').boundingBox(),box=await page.locator('#cal-box').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+photo.width*.05,box.y+box.height/2+photo.height*.04,{steps:4});await page.mouse.up();states.push({name:'moved-color-only',record:await copied(page)});
  await page.locator('#cal-save').click();await expect(page.locator('#cal-toasts')).toContainText('Saved PC54 back');await expect(page.locator('#cal-save')).toBeEnabled();expect(events.writes).toHaveLength(1);expect(JSON.parse(events.writes[0].body)).toEqual(states.at(-1).record);
  await page.locator('#cal-delete').click();await expect(page.locator('#cal-toasts')).toContainText('Saved layout removed');if(original)await expect(page.locator('#cal-delete')).toHaveAttribute('hidden','');else await expect(page.locator('#cal-delete')).toBeHidden();expect(events.writes).toHaveLength(2);states.push({name:'after-delete',record:await copied(page)});
  save(edition+'-browser',{states,reads:state.reads,events});for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure','missing-api'])test('CSS final staff tools: Calibration '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await setup(page,state);await page.waitForLoadState('networkidle');if(mode==='failure')await expect(page.locator('#style-list')).toContainText('Failed to load');if(mode==='missing-api')await expect(page.locator('#cal-status')).toContainText('API not deployed');save(edition+'-'+mode,{text:await page.locator('main').innerText(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
