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
for(const original of [true]){
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
  save(edition+'-browser',{states,paper,reads:state.reads,events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure'])test('CSS final staff tools: Box Labels '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await open(page,'pages/box-labels.html',state);await lookup(page);await expect(page.locator('#errorState')).toBeVisible();await expect(page.locator('#printAllBtn')).toBeDisabled();save(edition+'-'+mode,{message:await page.locator('#errorMessage').textContent(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 test('CSS final staff tools: Box Labels '+edition+' warns when preprint refresh fails',async({page})=>{
  const state=stateFor(original),events=await open(page,'pages/box-labels.html',state);await lookup(page);state.failRefresh=true;await page.locator('#printAllBtn').click();await expect(page.locator('#errorMessage')).toContainText("Couldn't re-check");await expect(page.locator('#sit-label-sheet')).toHaveCount(0);await page.getByRole('button',{name:'Print anyway',exact:true}).click();await expect(page.locator('#sit-label-sheet')).toBeAttached();save(edition+'-preprint-failure',{paper:await page.locator('#sit-label-sheet').textContent(),events});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
