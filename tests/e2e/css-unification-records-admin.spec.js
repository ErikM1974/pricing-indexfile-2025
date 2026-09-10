const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./helpers/staff-final-tools-browser');
const fixture=require('../fixtures/staff-final-tools-records-synthetic.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
function stateFor(original,mode='populated'){
 const state={original,mode,reads:[],quotes:structuredClone(fixture.quotes)};
 state.respond=async(req,u)=>{
  if(req.method()!=='GET')return null;
  const override=state.readOverride&&await state.readOverride(req,u);if(override)return override;
  if(u.pathname==='/api/quote_sessions'){state.reads.push(u.pathname);return state.mode==='failure'?{status:503,json:{error:'Synthetic quote service unavailable'}}:{json:state.mode==='empty'?[]:state.quotes};}
  if(u.pathname==='/api/quote_items'){state.reads.push(u.pathname+u.search);return {json:fixture.items};}
  return null;
 };
 state.respondWrite=async(req,u)=>{
  const override=state.writeOverride&&await state.writeOverride(req,u);if(override)return override;
  const body=req.postDataJSON(),pk=Number(u.pathname.split('/').pop());
  if(req.method()==='PUT'&&u.pathname.startsWith('/api/quote_sessions/')){Object.assign(state.quotes.find(q=>q.PK_ID===pk),body);return {json:{success:true}};}
  if(req.method()==='POST'&&u.pathname==='/api/quote_sessions'){state.quotes.push({...body,PK_ID:889999,CreatedAt:'2026-09-10T18:00:00Z'});return {json:{PK_ID:889999}};}
  if(req.method()==='POST'&&u.pathname==='/api/quote_items')return {json:{PK_ID:889998}};
  if(req.method()==='DELETE'&&u.pathname.startsWith('/api/quote_items/'))return {json:{success:true}};
  if(req.method()==='DELETE'&&u.pathname.startsWith('/api/quote_sessions/')){state.quotes=state.quotes.filter(q=>q.PK_ID!==pk);return {json:{success:true}};}
  return null;
 };return state;
}
async function snapshot(page){return page.evaluate(()=>({count:document.getElementById('recordsCount').textContent,pagination:document.getElementById('paginationInfo').textContent,rows:[...document.querySelectorAll('#recordsTableBody tr')].map(row=>[...row.cells].map(cell=>cell.textContent.replace(/\s+/g,' ').trim())),statuses:[...document.querySelectorAll('[data-action="status"]')].map(n=>({quote:n.dataset.quoteId,pk:n.dataset.pkId,value:n.value})),filters:[...document.querySelectorAll('.filter-control')].map(n=>({id:n.id,value:n.value}))}));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-final-tools-records-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
function detailText(text){return text.replace(/Status: OPEN/g,'Status: Open').replace(/\s+/g,' ').trim();}
function clean(events){for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);}
async function setup(page,state){const events=await open(page,'admin/universal-records-admin.html',state);await expect(page.locator('#recordsCount')).toContainText('of 52 records');return events;}
test('CSS final staff tools: Records Admin accessible four-width table and contained dialogs',async({page})=>{
 const events=await setup(page,stateFor(false));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const audit=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),String(width)).toEqual([]);
  await expect(page.locator('#recordsTableBody tr').first()).toContainText('DTG0910-8001');await page.screenshot({path:path.join(output,'staff-final-tools-records-reviewed-'+width+'.png'),fullPage:true});
 }
 const edit=page.locator('[data-action="edit"]').first();await edit.click();const dialog=page.locator('.quote-edit-modal');await expect(dialog).toBeVisible();expect(await dialog.evaluate(n=>n.tagName)).toBe('DIALOG');await expect(page.locator('#editCustomerName')).toBeFocused();
 await dialog.locator('button[type="submit"]').focus();await page.keyboard.press('Tab');expect(await dialog.evaluate(n=>n.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(edit).toBeFocused();
 await page.locator('[data-action="view"]').first().click();await expect(page.locator('.items-table')).toBeVisible();
 const audit=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 await page.locator('.quote-view-modal').screenshot({path:path.join(output,'staff-final-tools-records-reviewed-dialog-320.png')});await page.keyboard.press('Escape');await expect(page.locator('[data-action="view"]').first()).toBeFocused();clean(events);expect(events.writes).toEqual([]);
});
test('CSS final staff tools: Records Admin failed refresh survives filters and recovers',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);state.mode='failure';await page.locator('[data-call="refreshData"]').click();await expect(page.locator('#recordsTableBody')).toContainText('Failed to load quote data');await expect(page.locator('[data-action="view"]')).toHaveCount(0);await page.locator('#customerFilter').fill('Cedar');await page.locator('[data-call="applyFilters"]').click();await expect(page.locator('#recordsTableBody')).toContainText('Failed to load quote data');await expect(page.locator('[data-call="exportData"]')).toBeDisabled();
 state.mode='populated';await page.locator('[data-call="refreshData"]').click();await expect(page.locator('#recordsCount')).toContainText('of 52 records');await expect(page.locator('#recordsFeedback')).toBeHidden();clean(events);expect(events.writes).toEqual([]);
});
test('CSS final staff tools: Records Admin latest refresh owns the result',async({page})=>{
 const state=stateFor(false),events=await setup(page,state),releases=[];state.readOverride=(_req,u)=>u.pathname==='/api/quote_sessions'?new Promise(resolve=>releases.push(resolve)):null;
 await page.locator('[data-call="refreshData"]').click();await expect.poll(()=>releases.length).toBe(1);await page.locator('[data-call="refreshData"]').click();await expect.poll(()=>releases.length).toBe(2);releases[1]({json:[{...fixture.quotes[0],CustomerName:'Newest Customer'}]});await expect(page.locator('#recordsTableBody')).toContainText('Newest Customer');releases[0]({status:503,json:{error:'Obsolete failure'}});await page.waitForLoadState('networkidle');await expect(page.locator('#recordsTableBody')).toContainText('Newest Customer');await expect(page.locator('#recordsFeedback')).toBeHidden();clean(events);expect(events.writes).toEqual([]);
});
test('CSS final staff tools: Records Admin dismissed detail cannot return after a late read',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);let release;state.readOverride=(_req,u)=>u.pathname==='/api/quote_items'?new Promise(resolve=>{release=resolve;}):null;
 await page.locator('[data-action="view"]').first().click();await expect.poll(()=>typeof release).toBe('function');await expect(page.locator('.quote-view-modal')).toContainText('Loading quote details');await page.keyboard.press('Escape');release({json:fixture.items});await page.waitForLoadState('networkidle');await expect(page.locator('dialog')).toHaveCount(0);await expect(page.locator('[data-action="view"]').first()).toBeFocused();clean(events);
});
test('CSS final staff tools: Records Admin pending status rejects duplicate action and rolls back on failure',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);let release;state.writeOverride=()=>new Promise(resolve=>{release=resolve;});const status=page.locator('[data-action="status"]').first();await status.selectOption('Converted');await expect.poll(()=>events.writes.length).toBe(1);await expect(status).toBeDisabled();await expect(page.locator('[data-action="edit"]').first()).toBeDisabled();await page.evaluate(()=>updateQuoteStatus('DTG0910-8001',880001,'Sent'));expect(events.writes).toHaveLength(1);release({status:503,json:{success:true}});await expect(status).toBeEnabled();await expect(status).toHaveValue('Open');await expect(page.locator('#recordsFeedback')).toContainText('Failed to update status');clean(events);
});
test('CSS final staff tools: Records Admin holds edit fields during a failed save',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);let release;state.writeOverride=()=>new Promise(resolve=>{release=resolve;});await page.locator('[data-action="edit"]').first().click();await page.locator('#editCustomerName').fill('Unsaved Synthetic Name');await page.locator('#editQuoteForm [type="submit"]').click();await expect.poll(()=>events.writes.length).toBe(1);await expect(page.locator('#editCustomerName')).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('.quote-edit-modal')).toBeVisible();await page.locator('#editQuoteForm').dispatchEvent('submit');expect(events.writes).toHaveLength(1);release({status:503,json:{error:'Synthetic write unavailable'}});await expect(page.locator('#editCustomerName')).toBeEnabled();await expect(page.locator('#editCustomerName')).toHaveValue('Unsaved Synthetic Name');await expect(page.locator('.records-dialog-feedback')).toContainText('Failed to update quote');await page.keyboard.press('Escape');await expect(page.locator('[data-action="edit"]').first()).toBeFocused();clean(events);
});
test('CSS final staff tools: Records Admin partial duplication never claims all items copied',async({page})=>{
 const state=stateFor(false),dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});const events=await setup(page,state);state.writeOverride=(req,u)=>req.method()==='POST'&&u.pathname==='/api/quote_items'?{status:503,json:{success:true}}:null;
 await page.locator('[data-action="duplicate"]').first().click();await expect(page.locator('#recordsFeedback')).toContainText('was created, but some items could not be copied');expect(events.writes).toHaveLength(2);expect(dialogs).toHaveLength(1);await expect(page.locator('[data-action="duplicate"]').first()).toBeEnabled();clean(events);
});
test('CSS final staff tools: Records Admin failed item deletion does not remove the session',async({page})=>{
 const state=stateFor(false);page.on('dialog',d=>d.accept());const events=await setup(page,state);state.writeOverride=(req,u)=>req.method()==='DELETE'&&u.pathname.startsWith('/api/quote_items/')?{status:503,json:{success:true}}:null;
 await page.locator('[data-action="delete"]').first().click();await expect(page.locator('#recordsFeedback')).toContainText('Deletion could not be confirmed');expect(events.writes.map(w=>w.path)).toEqual(['/api/quote_items/980001']);await expect(page.locator('[data-action="view"]').first()).toBeVisible();clean(events);
});
test('CSS final staff tools: Records Admin malformed details remain visible and dismissible',async({page})=>{
 const state=stateFor(false),events=await setup(page,state);state.readOverride=(_req,u)=>u.pathname==='/api/quote_items'?{status:503,json:fixture.items}:null;await page.locator('[data-action="view"]').first().click();await expect(page.locator('.quote-view-modal')).toContainText('Could not load quote details');await page.keyboard.press('Escape');await expect(page.locator('[data-action="view"]').first()).toBeFocused();clean(events);
});

for(const original of [true,false]){
 const edition=original?'original':'current';
 test('CSS final staff tools: Records Admin '+edition+' paper retains visible quote records',async({page})=>{
  const events=await setup(page,stateFor(original));await page.locator('#quoteTypeFilter').selectOption('LT');await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'staff-final-tools-records-'+edition+'.pdf'),format:'Letter',landscape:true,preferCSSPageSize:true,printBackground:true});clean(events);
 });
 test('CSS final staff tools: Records Admin '+edition+' mutation and single export contracts',async({page})=>{
  const state=stateFor(original),dialogs=[];page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});await d.accept();});
  await page.context().addInitScript(()=>{Math.random=()=>0.375;});
  const events=await open(page,'admin/universal-records-admin.html',state);await expect(page.locator('#recordsCount')).toContainText('of 52 records');
  const id=fixture.quotes[0].QuoteID,select=page.locator('[data-action="status"][data-quote-id="'+id+'"]');
  await select.selectOption('Sent');await expect(select).toBeEnabled();await expect.poll(()=>events.writes.length).toBe(1);
  await page.locator('[data-action="edit"][data-quote-id="'+id+'"]').click();await expect(page.locator('.quote-edit-modal')).toBeVisible();
  const edits={editCustomerName:'Cedar Updated',editCustomerEmail:'updated@example.test',editCompanyName:'Synthetic Updated Workshop',editPhone:'555-0100',editTotalQuantity:'24',editSubtotalAmount:'225.5',editLTMFeeTotal:'30',editTotalAmount:'255.5',editNotes:'Synthetic revised note\nSecond line'};
  for(const [field,value] of Object.entries(edits))await page.locator('#'+field).fill(value);await page.locator('#editStatus').selectOption('Converted');await page.locator('#editQuoteForm [type="submit"]').click();await expect(page.locator('.quote-edit-modal')).toHaveCount(0);
  const download=page.waitForEvent('download');await page.locator('[data-action="export"][data-quote-id="'+id+'"]').click();const file=await download,csv=fs.readFileSync(await file.path(),'utf8');
  await page.locator('[data-action="duplicate"][data-quote-id="'+id+'"]').click();await expect.poll(()=>events.writes.length).toBe(4);await expect.poll(()=>state.reads.filter(p=>p==='/api/quote_sessions').length).toBe(2);
  await page.locator('[data-action="delete"][data-quote-id="'+id+'"]').click();await expect(page.locator('[data-action="view"][data-quote-id="'+id+'"]')).toHaveCount(0);
  const result={writes:events.writes.map(w=>({...w,body:w.body?JSON.parse(w.body):null})),csv,csvName:file.suggestedFilename(),dialogs,reads:state.reads};
  save(edition+'-mutations',result);if(!original)expect(result).toEqual(require('../fixtures/staff-final-tools-records-original-mutations.json'));
  expect(events.writes).toHaveLength(6);for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
 });
 test('CSS final staff tools: Records Admin '+edition+' table filters pagination details and CSV',async({page})=>{
  const state=stateFor(original),events=await open(page,'admin/universal-records-admin.html',state),states=[];await expect(page.locator('#recordsCount')).toContainText('of 52 records');states.push({name:'initial',data:await snapshot(page)});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(output,'staff-final-tools-records-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.locator('#nextBtn').click();states.push({name:'page-two',data:await snapshot(page)});await page.locator('#prevBtn').click();await page.locator('#quoteTypeFilter').selectOption('EMB');states.push({name:'embroidery',data:await snapshot(page)});await page.locator('#statusFilter').selectOption('Open');states.push({name:'open-embroidery',data:await snapshot(page)});await page.locator('[data-call="clearFilters"]').click();states.push({name:'all-time',data:await snapshot(page)});await page.locator('#customerFilter').fill('Archived');await expect(page.locator('#recordsCount')).toContainText('of 1 records');states.push({name:'search-old',data:await snapshot(page)});await page.locator('[data-call="clearFilters"]').click();
  const download=page.waitForEvent('download');await page.locator('[data-call="exportData"]').click();const csvFile=await download,csv=fs.readFileSync(await csvFile.path(),'utf8');
  await page.locator('[data-action="view"][data-quote-id="DTG0910-8001"]').click();await expect(page.locator('.quote-view-modal')).toBeVisible();const detail=await page.locator('.quote-view-modal').innerText();await page.locator('.quote-view-modal').screenshot({path:path.join(output,'staff-final-tools-records-'+edition+'-detail.png')});await page.locator('.quote-view-modal .close-btn').click();await expect(page.locator('.quote-view-modal')).toHaveCount(0);
  save(edition+'-browser',{states,csv,csvName:csvFile.suggestedFilename(),detail,reads:state.reads,events});if(!original){const old=require('../fixtures/staff-final-tools-records-original-browser.json');expect(states).toEqual(old.states);expect(csv).toBe(old.csv);expect(detailText(detail)).toBe(detailText(old.detail));}for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure'])test('CSS final staff tools: Records Admin '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await open(page,'admin/universal-records-admin.html',state);await page.waitForLoadState('networkidle');await expect(page.locator('#recordsTableBody')).toContainText(mode==='empty'?'No records found':original?'Loading records...':'Failed to load quote data');save(edition+'-'+mode,{data:await snapshot(page),text:await page.locator('main').innerText(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
