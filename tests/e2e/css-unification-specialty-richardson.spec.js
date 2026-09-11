const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification');
const original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
function record(name,value){const f='tests/fixtures/specialty-calculators-'+name+'-original-browser.json',full=path.join(root,f);if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+f+' — immutable synthetic Richardson calculator evidence.\n');}else expect(value).toEqual(JSON.parse(fs.readFileSync(full,'utf8')));}
async function ready(page,state={}){await page.setViewportSize({width:1440,height:1000});const events=await open(page,{...state,original,richardson:true,url:'/calculators/richardson-2025.html'});await page.waitForFunction(()=>!!window.richardsonPricing);return events;}
async function select(page,style='110'){await page.locator('#capStyle').fill(style);await page.locator('#quantity').focus();await expect(page.locator('#styleAutocomplete')).toBeHidden();await expect(page.locator('#styleDescription')).toContainText(style==='110'?'R-Flex Trucker':'Solid Knit');}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));});const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});if(!original){expect(state.overflow).toBe(false);expect(axe.violations).toEqual([]);}await page.screenshot({path:path.join(out,'specialty-calculators-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}check(expect,events);record(name,{name,states,dialogs:events.dialogs,mocked:events.mocked});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.pdf({path:path.join(out,'specialty-calculators-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
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
