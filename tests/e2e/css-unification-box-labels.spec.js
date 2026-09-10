const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./helpers/staff-final-tools-browser');
const fixture=require('../fixtures/staff-final-tools-box-labels-synthetic.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
function stateFor(original,mode='populated'){
 const state={original,mode,reads:[],orders:structuredClone(fixture.orders)};
 state.respond=async(req,u)=>{
  if(req.method()!=='GET')return null;
  const override=state.readOverride&&await state.readOverride(req,u);if(override)return override;
  if(u.pathname.startsWith('/api/sanmar-orders/label-data/')){state.reads.push(u.pathname+u.search);if(state.holdRead)await state.holdRead;
   if(state.mode==='failure'||(state.failRefresh&&u.searchParams.has('refresh')))return {status:503,json:{error:'Synthetic shipment unavailable'}};
   return {json:{orders:state.mode==='empty'?[]:state.orders}};
  }
  if(u.pathname==='/api/thumbnails/by-designs')return {json:{thumbnails:{}}};
  return null;
 };return state;
}
async function lookup(page,id='882211'){await page.locator('#searchInput').fill(id);await page.locator('#lookupBtn').click();await expect(page.locator('#loadingState')).toBeHidden();await page.waitForLoadState('networkidle');}
async function snapshot(page){return page.evaluate(()=>({totals:['totalBoxed','totalShipped','totalOrdered'].map(id=>document.getElementById(id).textContent),warning:getComputedStyle(document.getElementById('shortShipWarning')).display!=='none',groups:[...document.querySelectorAll('.bl-order')].map(n=>({po:n.dataset.po,title:n.querySelector('.bl-order__title').textContent.replace(/\s+/g,' ').trim(),flags:n.querySelector('.bl-order__flags').textContent.replace(/\s+/g,' ').trim()})),boxes:[...document.querySelectorAll('.bl-box-card')].map(n=>({key:n.dataset.key,verified:n.classList.contains('bl-box-card--verified'),items:[...n.querySelectorAll('.bl-item-card')].map(item=>({style:item.querySelector('.bl-item-card__style').textContent.trim(),color:item.querySelector('.bl-item-card__color').textContent.trim(),quantity:item.querySelector('.bl-item-card__qty').textContent.trim(),description:item.querySelector('.bl-item-card__desc')?.textContent.trim()}))})),references:[...document.querySelectorAll('.bl-ref__table tr')].map(n=>[...n.cells].map(c=>c.textContent.trim()))}));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-final-tools-box-labels-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
function clean(events){for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);}
async function setup(page,state){const events=await open(page,'pages/box-labels.html',state);await lookup(page);await expect(page.locator('.bl-box-card')).toHaveCount(8);return events;}
test('CSS final staff tools: Box Labels accessible station and keyboard box controls',async({page})=>{
 const events=await setup(page,stateFor(false));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const audit=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),String(width)).toEqual([]);
  await page.screenshot({path:path.join(output,'staff-final-tools-box-labels-reviewed-'+width+'.png'),fullPage:true});
 }
 const card=page.locator('.bl-box-card').first(),toggle=card.locator('[data-act="toggle-box"]');await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(card.locator('.bl-box-card__body')).toBeHidden();await page.keyboard.press('Enter');await expect(card.locator('.bl-box-card__body')).toBeVisible();
 const split=card.locator('[data-act="split"]').first();await split.click();await expect(page.locator('#splitQty')).toBeFocused();expect(await page.locator('#splitModal').evaluate(n=>n.tagName)).toBe('DIALOG');await page.locator('#splitConfirmBtn').focus();await page.keyboard.press('Tab');await expect(page.locator('#splitQty')).toBeFocused();
 const audit=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);await page.locator('#splitModal').screenshot({path:path.join(output,'staff-final-tools-box-labels-reviewed-dialog-320.png')});await page.keyboard.press('Escape');await expect(split).toBeFocused();clean(events);
});
test('CSS final staff tools: Box Labels failed second lookup clears old print data',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);state.mode='failure';await lookup(page,'000000');await expect(page.locator('#errorMessage')).toContainText('Lookup failed');await expect(page.locator('.bl-box-card')).toHaveCount(0);await expect(page.locator('#printAllBtn')).toBeDisabled();await page.locator('#printAllBtn').dispatchEvent('click');await expect(page.locator('#sit-label-sheet')).toHaveCount(0);await page.locator('#errorDismissBtn').click();await expect(page.locator('#printAllBtn')).toBeDisabled();state.mode='populated';await lookup(page);await expect(page.locator('.bl-box-card')).toHaveCount(8);clean(events);
});
test('CSS final staff tools: Box Labels latest lookup owns orders and loading state',async({page})=>{
 const state=stateFor(false),events=await setup(page,state),responses=[];state.readOverride=(_req,u)=>u.pathname.startsWith('/api/sanmar-orders/label-data/')?new Promise(resolve=>responses.push(resolve)):null;
 await page.locator('#searchInput').fill('111111');await page.locator('#lookupBtn').click();await expect.poll(()=>responses.length).toBe(1);await page.locator('#searchInput').fill('222222');await page.locator('#lookupBtn').click();await expect.poll(()=>responses.length).toBe(2);
 responses[1]({json:{orders:[{...fixture.orders[1],company:'Newest Synthetic Order'}]}});await expect(page.locator('#ordersContainer')).toContainText('Newest Synthetic Order');responses[0]({status:503,json:{error:'Old synthetic failure'}});await page.waitForLoadState('networkidle');await expect(page.locator('#ordersContainer')).toContainText('Newest Synthetic Order');await expect(page.locator('#errorState')).toBeHidden();await expect(page.locator('#loadingState')).toBeHidden();clean(events);
});
test('CSS final staff tools: Box Labels pending print holds arrangement and restores the print control',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);let release,refreshes=0;state.readOverride=(_req,u)=>u.pathname.startsWith('/api/sanmar-orders/label-data/')&&u.searchParams.has('refresh')?new Promise(resolve=>{release=resolve;refreshes++;}):null;
 const before=await snapshot(page);await page.locator('#printAllBtn').click();await expect.poll(()=>refreshes).toBe(1);await expect(page.locator('#lookupBtn')).toBeDisabled();await expect(page.locator('[data-act="split"]').first()).toBeDisabled();await page.locator('#printAllBtn').dispatchEvent('click');await page.locator('[data-act="add-box"]').first().dispatchEvent('click');expect(refreshes).toBe(1);expect(await snapshot(page)).toEqual(before);
 release({json:{orders:state.orders}});await expect(page.locator('#sit-label-sheet')).toHaveCount(1);await expect(page.locator('#printAllBtn')).toBeDisabled();await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await expect(page.locator('#printAllBtn')).toBeEnabled();await expect(page.locator('#printAllBtn svg')).toHaveCount(1);clean(events);
});
test('CSS final staff tools: Box Labels old print-anyway choice cannot print a new lookup',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);state.failRefresh=true;await page.locator('#printAllBtn').click();const old=await page.getByRole('button',{name:'Print anyway',exact:true}).elementHandle();await lookup(page,'882244');await old.evaluate(n=>n.click());await expect(page.locator('#sit-label-sheet')).toHaveCount(0);clean(events);
});
test('CSS final staff tools: Box Labels incomplete refresh requires an explicit stale-print choice',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);state.readOverride=(_req,u)=>u.searchParams.has('refresh')?{json:{orders:[state.orders[0]]}}:null;await page.locator('#printAllBtn').click();await expect(page.locator('#errorMessage')).toContainText('did not include every order');await expect(page.locator('#sit-label-sheet')).toHaveCount(0);await expect(page.getByRole('button',{name:'Print anyway',exact:true})).toBeVisible();clean(events);
});
test('CSS final staff tools: Box Labels saves a pending draft under its original lookup',async({page})=>{
 const state=stateFor(false),events=await setup(page,state),first=page.locator('.bl-box-card').first();await first.locator('[data-act="verify"]').click();await page.locator('#searchInput').fill('882244');await page.locator('#lookupBtn').click();await expect(page.locator('#loadingState')).toBeHidden();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bl_draft_v2_po_882211'))?.boxes[0]?.verified)).toBe(true);await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bl_draft_v2_po_882244'))?.boxes[0]?.verified)).toBe(false);clean(events);
});
test('CSS final staff tools: Box Labels storage failure leaves the station usable and warns clearly',async({page})=>{
 await page.context().addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Synthetic storage denied');};Storage.prototype.setItem=()=>{throw new Error('Synthetic storage denied');};});const events=await setup(page,stateFor(false));await expect(page.locator('#storageNotice')).toContainText('Local saving is unavailable');await expect(page.locator('#printAllBtn')).toBeEnabled();clean(events);
});
test('CSS final staff tools: Box Labels keyboard moves a single piece without the drag library',async({page})=>{
 const state=stateFor(false);state.orders[0].boxDetail[0].items[0].qty=1;state.block=u=>u.pathname.includes('Sortable.min.js');const events=await setup(page,state),card=page.locator('.bl-box-card').first();await card.locator('[data-act="verify"]').click();const before=await snapshot(page);const move=card.getByRole('button',{name:'Move to another box',exact:true});await move.focus();await page.keyboard.press('Enter');await page.locator('#splitTarget').selectOption('882211#2');await page.locator('#splitConfirmBtn').click();const after=await snapshot(page);expect(after.totals).toEqual(before.totals);expect(after.boxes[0].verified).toBe(false);expect(after.boxes[0].items).toHaveLength(3);expect(after.boxes[1].items).toHaveLength(5);clean(events);
});
test('CSS final staff tools: Box Labels rejects invalid split quantities and retains original packing',async({page})=>{
 const events=await setup(page,stateFor(false)),before=await snapshot(page);await page.locator('[data-act="split"]').first().click();await page.locator('#splitQty').fill('0');await page.locator('#splitConfirmBtn').click();await expect(page.locator('#splitModal')).toBeVisible();expect(await snapshot(page)).toEqual(before);await page.keyboard.press('Escape');clean(events);
});
test('CSS final staff tools: Box Labels prints only the selected box',async({page})=>{
 const events=await setup(page,stateFor(false));await page.locator('[data-key="882244#3"].bl-box-card [data-act="print-box"]').click();await expect(page.locator('#sit-label-sheet .sit-label')).toHaveCount(1);await expect(page.locator('#sit-label-sheet')).toContainText('3 of 5');await page.pdf({path:path.join(output,'staff-final-tools-box-labels-current-single.pdf'),preferCSSPageSize:true,printBackground:true});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));clean(events);
});

for(const original of [true,false]){
 const edition=original?'original':'current';
 test('CSS final staff tools: Box Labels '+edition+' cartons split draft and paper',async({page})=>{
  const state=stateFor(original),events=await open(page,'pages/box-labels.html',state);await lookup(page);const states=[{name:'initial',data:await snapshot(page)}];expect(states[0].data.totals).toEqual(['276','276','288']);await expect(page.locator('.bl-box-card')).toHaveCount(8);
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(output,'staff-final-tools-box-labels-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.locator('#repackerName').fill('Cedar Example');await page.locator('#repackerName').blur();
  const first=page.locator('[data-key="882211#1"].bl-box-card');await first.locator('[data-act="verify"]').click();states.push({name:'verified',data:await snapshot(page)});
  await first.locator('[data-act="split"]').first().click();await expect(page.locator('#splitModal')).toBeVisible();await page.locator('#splitQty').fill('2');await page.locator('#splitTarget').selectOption('882211#2');await page.locator('#splitConfirmBtn').click();states.push({name:'split',data:await snapshot(page)});
  await page.locator('[data-act="add-box"][data-po="882211"]').click();await expect(page.locator('.bl-box-card')).toHaveCount(9);states.push({name:'added',data:await snapshot(page)});await page.locator('.bl-box-card [data-act="delete-box"]:enabled').click();await expect(page.locator('.bl-box-card')).toHaveCount(8);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bl_draft_v2_po_882211')||'null')?.boxes[0]?.items[0]?.qty)).toBe(2);
  await page.reload();await lookup(page);await expect(page.locator('#draftNote')).toBeVisible();states.push({name:'restored',data:await snapshot(page)});await page.locator('#draftResetBtn').click();states.push({name:'reset',data:await snapshot(page)});expect(states.at(-1).data).toEqual(states[0].data);
  await page.locator('#printAllBtn').click();await expect(page.locator('body')).toHaveClass(/sit-label-printing/);const paper=await page.locator('#sit-label-sheet').textContent();await page.pdf({path:path.join(output,'staff-final-tools-box-labels-'+edition+'.pdf'),preferCSSPageSize:true,printBackground:true});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await expect(page.locator('#sit-label-sheet')).toHaveCount(0);
  save(edition+'-browser',{states,paper,reads:state.reads,events});if(!original){const old=structuredClone(require('../fixtures/staff-final-tools-box-labels-original-browser.json'));for(const state of old.states)if(['split','added','restored'].includes(state.name))state.data.boxes[0].verified=false;expect(states).toEqual(old.states);expect(paper).toBe(old.paper);expect(state.reads).toEqual(old.reads);}for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure'])test('CSS final staff tools: Box Labels '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await open(page,'pages/box-labels.html',state);await lookup(page);await expect(page.locator('#errorState')).toBeVisible();await expect(page.locator('#printAllBtn')).toBeDisabled();save(edition+'-'+mode,{message:await page.locator('#errorMessage').textContent(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 test('CSS final staff tools: Box Labels '+edition+' warns when preprint refresh fails',async({page})=>{
  const state=stateFor(original),events=await open(page,'pages/box-labels.html',state);await lookup(page);state.failRefresh=true;await page.locator('#printAllBtn').click();await expect(page.locator('#errorMessage')).toContainText("Couldn't re-check");await expect(page.locator('#sit-label-sheet')).toHaveCount(0);await page.getByRole('button',{name:'Print anyway',exact:true}).click();await expect(page.locator('#sit-label-sheet')).toBeAttached();save(edition+'-preprint-failure',{paper:await page.locator('#sit-label-sheet').textContent(),events});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
