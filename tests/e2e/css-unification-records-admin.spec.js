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
  if(u.pathname==='/api/quote_sessions'){state.reads.push(u.pathname);return state.mode==='failure'?{status:503,json:{error:'Synthetic quote service unavailable'}}:{json:state.mode==='empty'?[]:state.quotes};}
  if(u.pathname==='/api/quote_items'){state.reads.push(u.pathname+u.search);return {json:fixture.items};}
  return null;
 };return state;
}
async function snapshot(page){return page.evaluate(()=>({count:document.getElementById('recordsCount').textContent,pagination:document.getElementById('paginationInfo').textContent,rows:[...document.querySelectorAll('#recordsTableBody tr')].map(row=>[...row.cells].map(cell=>cell.textContent.replace(/\s+/g,' ').trim())),statuses:[...document.querySelectorAll('[data-action="status"]')].map(n=>({quote:n.dataset.quoteId,pk:n.dataset.pkId,value:n.value})),filters:[...document.querySelectorAll('.filter-control')].map(n=>({id:n.id,value:n.value}))}));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-final-tools-records-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
for(const original of [true]){
 const edition=original?'original':'current';
 test('CSS final staff tools: Records Admin '+edition+' table filters pagination details and CSV',async({page})=>{
  const state=stateFor(original),events=await open(page,'admin/universal-records-admin.html',state),states=[];await expect(page.locator('#recordsCount')).toContainText('of 52 records');states.push({name:'initial',data:await snapshot(page)});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(output,'staff-final-tools-records-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.locator('#nextBtn').click();states.push({name:'page-two',data:await snapshot(page)});await page.locator('#prevBtn').click();await page.locator('#quoteTypeFilter').selectOption('EMB');states.push({name:'embroidery',data:await snapshot(page)});await page.locator('#statusFilter').selectOption('Open');states.push({name:'open-embroidery',data:await snapshot(page)});await page.locator('[data-call="clearFilters"]').click();states.push({name:'all-time',data:await snapshot(page)});await page.locator('#customerFilter').fill('Archived');await expect(page.locator('#recordsCount')).toContainText('of 1 records');states.push({name:'search-old',data:await snapshot(page)});await page.locator('[data-call="clearFilters"]').click();
  const download=page.waitForEvent('download');await page.locator('[data-call="exportData"]').click();const csvFile=await download,csv=fs.readFileSync(await csvFile.path(),'utf8');
  await page.locator('[data-action="view"][data-quote-id="DTG0910-8001"]').click();await expect(page.locator('.quote-view-modal')).toBeVisible();const detail=await page.locator('.quote-view-modal').innerText();await page.locator('.quote-view-modal').screenshot({path:path.join(output,'staff-final-tools-records-'+edition+'-detail.png')});await page.locator('.quote-view-modal .close-btn').click();await expect(page.locator('.quote-view-modal')).toHaveCount(0);
  save(edition+'-browser',{states,csv,csvName:csvFile.suggestedFilename(),detail,reads:state.reads,events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
 for(const mode of ['empty','failure'])test('CSS final staff tools: Records Admin '+edition+' '+mode,async({page})=>{
  const state=stateFor(original,mode),events=await open(page,'admin/universal-records-admin.html',state);await page.waitForLoadState('networkidle');await expect(page.locator('#recordsTableBody')).toContainText(mode==='empty'?'No records found':original?'Loading records...':'Failed to load quote data');save(edition+'-'+mode,{data:await snapshot(page),text:await page.locator('main').innerText(),events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}
