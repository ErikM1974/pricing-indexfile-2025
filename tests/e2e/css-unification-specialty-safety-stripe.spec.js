const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {ready,select,fill,normalizeRequests}=require('./helpers/safety-stripe-browser'),{snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});test.setTimeout(120000);
function record(name,value){const file='tests/fixtures/specialty-calculators-safety-stripe-'+name+'-original-browser.json',full=path.join(root,file);
 if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic Safety Stripe selection, presentation and save evidence.\n');}
 else expect(value).toEqual(JSON.parse(fs.readFileSync(full,'utf8')));
}
async function assets(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getClientRects().length&&n.getAttribute('src')).map(n=>n.decode().catch(()=>{})));});
 expect(await page.locator('img').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&n.getAttribute('src')&&(!n.complete||!n.naturalWidth)).map(n=>n.src)),'visible original assets load').toEqual([]);
}
async function submit(page){if(original)await page.locator('#sendForm').dispatchEvent('submit',{bubbles:true,cancelable:true});else await page.locator('#sendButton').click();await expect.poll(()=>page.locator('#sendButton').isEnabled()).toBe(true);}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){
 await page.setViewportSize({width,height:1000});await assets(page);await page.evaluate(()=>scrollTo(0,0));
 const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
 if(!original){expect(state.overflow).toBe(false);expect(axe.violations).toEqual([]);}
 await page.screenshot({path:path.join(out,'specialty-calculators-safety-stripe-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }check(expect,events);record(name,{states,mocked:normalizeRequests(events.mocked),dialogs:events.dialogs});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await assets(page);await page.pdf({path:path.join(out,'specialty-calculators-safety-stripe-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
for(const mode of ['empty','Standard','Warning','DiamondPlate','ConstructionZone','form','success','failed-session','failed-item'])test('CSS specialty Safety Stripe: '+mode,async({page})=>{
 const events=await ready(page,{original,failedSession:mode==='failed-session',failedItem:mode==='failed-item'});
 if(mode!=='empty')await select(page,['Standard','Warning','DiamondPlate','ConstructionZone'].includes(mode)?mode:'Standard');
 if(['form','success','failed-session','failed-item'].includes(mode))await fill(page);
 if(['success','failed-session','failed-item'].includes(mode)){
  await submit(page);
  if(mode!=='failed-session')await expect(page.locator('#successModal')).toHaveClass(/show/);else expect(events.dialogs).toContain('Unable to submit the design. Please try again or call (253) 922-5793.');
 }
 await evidence(page,mode,events);
});
test('CSS specialty Safety Stripe: all 64 original style and placement combinations',async({page})=>{
 const events=await ready(page,{original}),values=[];
 for(const style of ['Standard','Warning','DiamondPlate','ConstructionZone'])for(const front of ['JustStripes','LeftChestLogo','FrontCenterLogo','BuiltInImage'])for(const back of ['JustStripes','BackCenterLogo','BackBetweenLinesText','BackBuiltInImage']){
  await select(page,style,front,back);values.push(await page.evaluate(()=>({design:{...currentDesign},selected:[...document.querySelectorAll('.selected')].map(n=>n.dataset.style||n.dataset.option),front:document.getElementById('frontPreview').getAttribute('src'),back:document.getElementById('backPreview').getAttribute('src')})));
 }
 expect(values).toHaveLength(64);record('all-combinations',{values});check(expect,events);
});
test('CSS specialty Safety Stripe: original inaccessible dialogs and placement limitations are captured',async({page})=>{
 test.skip(!original,'original defect evidence');const events=await ready(page,{original});await select(page);
 expect(await page.locator('#frontOptions .placement-option').evaluateAll(ns=>ns.map(n=>({tag:n.tagName,tabIndex:n.tabIndex})))).toEqual(Array.from({length:4},()=>({tag:'DIV',tabIndex:-1})));
 await fill(page);await expect(page.locator('#sendModal')).toHaveClass(/show/);await expect(page.locator('#sendModal')).toBeHidden();
 await submit(page);await expect(page.locator('#successModal')).toHaveClass(/show/);await expect(page.locator('#successModal')).toBeHidden();check(expect,events);
});
