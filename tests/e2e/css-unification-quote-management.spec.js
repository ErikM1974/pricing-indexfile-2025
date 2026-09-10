const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open}=require('./helpers/staff-workspaces-browser');
const fixtures=require('../fixtures/staff-workspaces-quotes-synthetic.json');
const inboundFixtures=require('../fixtures/staff-workspaces-ae-synthetic.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
const norm=s=>s.replace(/\s+/g,' ').trim().toLowerCase();
async function ready(page){await expect(page.locator('#qm-updated')).not.toBeEmpty();await expect(page.locator('#table-loading')).toBeHidden();await page.waitForLoadState('networkidle');}
async function snapshot(page){return page.evaluate(()=>({stats:[...document.querySelectorAll('.stat-value')].map(n=>n.textContent.trim()),counts:[...document.querySelectorAll('.qm-tab-count')].map(n=>n.textContent),window:document.getElementById('filter-date').value,tableCount:document.getElementById('table-count').textContent,rows:[...document.querySelectorAll('#quotes-tbody tr')].map(row=>({id:row.dataset.quoteId,cells:[...row.cells].map(c=>c.textContent.replace(/\s+/g,' ').trim()),controls:[...row.querySelectorAll('button,select,input')].map(n=>({action:n.dataset.action||n.type,label:n.getAttribute('aria-label'),value:n.value,disabled:n.disabled})),links:[...row.querySelectorAll('a')].map(n=>n.getAttribute('href')),titles:[...row.querySelectorAll('[title]')].map(n=>n.title)}))}));}
function save(name,data){fs.writeFileSync(path.join(output,'staff-workspaces-quotes-'+name+'.json'),JSON.stringify(data,null,2)+'\n');}
async function setup(page,state){await page.addInitScript(()=>{window.__opened=[];window.open=(url,target)=>{window.__opened.push({url,target});return null;};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Synthetic clipboard unavailable'))}});});return open(page,'quote-management',state);}

for(const original of [true,false]){
 const edition=original?'original':'current';
 test('CSS staff workspaces: Quote Management '+edition+' table filters pagination and paper',async({page})=>{
  const state=quoteState(original),events=await setup(page,state),states=[];await ready(page);
  states.push({name:'initial',data:await snapshot(page)});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});if(!original){expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth),width+' width').toBeLessThanOrEqual(width);const axe=await new(require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa']).analyze();expect.soft(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,why:n.failureSummary}))})),width+' accessibility').toEqual([]);}await page.screenshot({path:path.join(output,'staff-workspaces-quotes-'+edition+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#btn-next').click();states.push({name:'second-page',data:await snapshot(page)});await page.locator('#btn-prev').click();
  for(const tab of ['completed','all','active']){await page.locator('[data-tab="'+tab+'"]').click();await ready(page);states.push({name:tab,data:await snapshot(page)});}
  for(const tile of ['accepted','expiring','cancelled','failed','active']){await page.locator('[data-tile="'+tile+'"]').click();await ready(page);states.push({name:'tile-'+tile,data:await snapshot(page)});await page.locator('[data-tile="'+tile+'"]').click();}
  await page.locator('#filter-status').selectOption('Pending Payment');states.push({name:'awaiting-payment',data:await snapshot(page)});await page.locator('#filter-status').selectOption('');
  await page.locator('[data-tab="active"]').click();await ready(page);
  await page.locator('#filter-search').fill('archived');await page.locator('[data-action="search"]').click();await ready(page);await expect(page.locator('#qm-notice')).toBeVisible();states.push({name:'search-older',data:await snapshot(page)});
  await page.locator('#filter-search').fill('');await ready(page);await page.locator('[data-tab="all"]').click();await ready(page);
  const paper=await snapshot(page);await page.pdf({path:path.join(output,'staff-workspaces-quotes-'+edition+'.pdf'),preferCSSPageSize:true,printBackground:true});
  if(!original){const baseline=require('../fixtures/staff-workspaces-quotes-original-browser.json');expect(states).toEqual(baseline.states);expect(paper).toEqual(baseline.paper);}
  save(edition+'-browser',{states,paper,reads:state.reads,events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });

 test('CSS staff workspaces: Quote Management '+edition+' mocked actions and dialogs',async({page})=>{
  const state=quoteState(original),events=await setup(page,state),dialogs=[];await ready(page);const row=id=>page.locator('tr[data-quote-id="'+id+'"]');
  for(const action of ['view','edit','duplicate','audit'])await row('EMB0910-3001').locator('[data-action="'+action+'"]').click();
  await row('EMB0910-3001').locator('[data-action="copy-link"]').click();await expect(page.locator('#qm-modal')).toBeVisible();dialogs.push({kind:'copy',text:await page.locator('#qm-modal').innerText(),value:await page.locator('#qm-modal-input').inputValue()});await page.locator('#qm-modal-confirm').click();
  await row('EMB0910-3001').locator('[data-action="resend"]').click();await expect(page.locator('#qm-modal-input')).toHaveValue('workshop1@example.test');await page.locator('#qm-modal-input').fill('alternate@example.test');dialogs.push({kind:'email',text:await page.locator('#qm-modal').innerText()});await page.locator('#qm-modal-confirm').click();await expect(page.locator('#qm-toasts')).toContainText('Email resent');
  await row('DTG0910-3003').locator('[data-action="shipstation"]').click();dialogs.push({kind:'shipstation',text:await page.locator('#qm-modal').innerText()});await page.locator('#qm-modal-confirm').click();await expect(page.locator('#qm-toasts')).toContainText('sent to ShipStation');await ready(page);
  await row('EMB0910-3001').locator('.status-dropdown').selectOption('Lost');await expect(page.locator('#qm-toasts')).toContainText('marked as Lost');
  await row('DTF0910-3002').locator('[data-action="delete"]').click();dialogs.push({kind:'accepted-delete',text:await page.locator('#delete-modal').innerText()});await page.locator('[data-action="delete-cancel"]').click();
  await row('EMB0910-3001').locator('.quote-checkbox').check();await row('DTF0910-3002').locator('.quote-checkbox').check();await page.locator('#btn-bulk-delete').click();dialogs.push({kind:'bulk-delete',text:await page.locator('#delete-modal').innerText()});await page.locator('[data-action="delete-confirm"]').click();await expect(page.locator('#qm-toasts')).toContainText('Successfully deleted 2');
  await page.locator('#btn-sync-sw').click();await expect(page.locator('#btn-sync-sw')).toBeEnabled();await expect(page.locator('#qm-toasts')).toContainText('ShopWorks sync:');
  await page.locator('#btn-refresh-inbound').click();await expect(page.locator('#btn-refresh-inbound')).toBeEnabled({timeout:15000});await expect(page.locator('#qm-toasts')).toContainText('Inbound synced');
  const opened=await page.evaluate(()=>window.__opened);if(!original){const b=require('../fixtures/staff-workspaces-quotes-original-actions.json');expect(opened).toEqual(b.opened);expect(events.writes).toEqual(b.events.writes);expect(dialogs.map(d=>({...d,text:norm(d.text)}))).toEqual(b.dialogs.map(d=>({...d,text:norm(d.text)})));}
  save(edition+'-actions',{dialogs,opened,reads:state.reads,events});expect(events.writes.length).toBe(8);for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
 });

 for(const mode of ['empty','failure','rep'])test('CSS staff workspaces: Quote Management '+edition+' '+mode,async({page})=>{
  const state=quoteState(original,mode),events=await setup(page,state);await ready(page);const text=await page.locator('body').innerText(),data=await snapshot(page);await page.screenshot({path:path.join(output,'staff-workspaces-quotes-'+edition+'-'+mode+'.png'),fullPage:true});if(mode==='rep'){await page.locator('#select-all').check();expect(await page.locator('.quote-checkbox:checked:disabled').count()).toBe(0);await page.locator('#btn-bulk-delete').click();await expect(page.locator('#delete-modal')).toBeVisible();await page.locator('[data-action="delete-cancel"]').click();}
  save(edition+'-'+mode,{text,data,events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
 });
}

function quoteState(original=true,mode='populated'){
 const state={original,mode,reads:[],quotes:structuredClone(fixtures.quotes)};
 state.respond=async(req,url)=>{
  if(req.method()!=='GET')return null;
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@emailjs/browser@3/dist/email.min.js')return {contentType:'application/javascript',body:'window.emailjs={init:function(){},send:async function(service,template,params){const r=await fetch("/__synthetic-email",{method:"POST",body:JSON.stringify({service,template,params})});if(!r.ok)throw new Error("Synthetic email failure");return {status:200};}};'};
  if(!['localhost','127.0.0.1','caspio-pricing-proxy-ab30a049961a.herokuapp.com'].includes(url.hostname)||!url.pathname.startsWith('/api/'))return null;
  state.reads.push(url.pathname+url.search);
  if(state.holdShare && /\/quote-sessions\/[^/]+\/full$/.test(url.pathname)){state.sharePending=true;await state.holdShare;}
  if(url.pathname==='/api/crm-session/me')return {json:{authenticated:true,email:'cedar@example.test',name:'Cedar Example',firstName:'Cedar',role:mode==='rep'?'sales':'admin'}};
  if(url.pathname==='/api/quote_sessions') {
   const response=state.mode==='failure'?{status:503,json:{error:'Synthetic quotes unavailable'}}:state.mode==='malformed'?{json:{missing:'records'}}:{json:{Result:state.mode==='empty'?[]:state.quotes.filter(q=>!url.searchParams.has('createdAfter')||q.CreatedAt.slice(0,10)>=url.searchParams.get('createdAfter'))}};
   if(state.holdQuotes && url.searchParams.get('createdAfter')==='2026-06-12'){state.pending=true;await state.holdQuotes;}
   return response;
  }
  if(url.pathname==='/api/sanmar-orders/batch-status'){if(state.holdInbound){state.inboundPending=true;await state.holdInbound;}return {json:fixtures.inbound};}
  if(/^\/api\/quote-sessions\/[^/]+\/full$/.test(url.pathname))return {json:{originalSubmission:{share_token:'synthetic-share-only'}}};
  if(url.pathname==='/api/sanmar-orders/sync-recent-completed-status')return {json:{success:true,running:false,lastResult:{ingested:2}}};
  if(url.pathname==='/api/sanmar-orders/daily-inbound')return {json:{days:[{date:'2026-09-10',orders:3,boxes:5,pieces:120,cost:500}]}};
  if(url.pathname==='/api/thumbnails/by-designs')return {json:{thumbnails:{}}};
  if(url.pathname==='/api/sanmar-orders/inbound-today')return {json:{date:'2026-09-10',orders:require('../fixtures/staff-workspaces-ae-original-documents.json').paperInputs,totals:{pos:2,workOrders:2,boxes:8,piecesShipped:276,cost:1284,received:1}}};
  const routes=inboundFixtures.scenarios.admin;const id=routes[url.pathname];if(id)return inboundFixtures.responses[id];
  return null;
 };
 state.respondWrite=async(req,url)=>{
  if(!['localhost','127.0.0.1'].includes(url.hostname))return null;
  if(state.holdWrite){state.writePending=true;await state.holdWrite;}
  if(state.failWrite)return {status:state.failWrite,json:{message:'Synthetic action blocked',error:'Synthetic action blocked'}};
  if(url.pathname==='/__synthetic-email'&&req.method()==='POST')return {json:{success:true}};
  if(/^\/api\/quote_sessions\/\d+$/.test(url.pathname)){
   const id=Number(url.pathname.split('/').pop());if(req.method()==='DELETE'){state.quotes=state.quotes.filter(q=>q.PK_ID!==id);return {json:{success:true}};}if(req.method()==='PUT'){Object.assign(state.quotes.find(q=>q.PK_ID===id),req.postDataJSON());return {json:{success:true}};}
  }
  if(url.pathname.endsWith('/send-to-shipstation')&&req.method()==='POST'){state.quotes.find(q=>url.pathname.includes(q.QuoteID)).ShipStation_Order_ID=990099;return {json:{success:true,shipstationOrderId:990099}};}
  if(url.pathname==='/api/quote-sessions/bulk-sync-from-shopworks')return {json:{success:true,imported:2,pending:1,deleted:0,errors:0}};
  if(url.pathname==='/api/sanmar-orders/sync-recent-completed')return {json:{success:true}};
  if(url.pathname==='/api/sanmar-orders/sync-shipments')return {json:{success:true,shipmentsAdded:2,remaining:1}};
  return null;
 };
 return state;
}

for(const mode of ['failure','malformed'])test('CSS staff workspaces: Quote Management current '+mode+' after success remains unknown through filtering and recovers',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);state.mode=mode;
 await page.locator('#filter-date').selectOption('90');await expect(page.locator('#qm-updated')).toContainText('Load failed');
 await page.locator('#filter-status').selectOption('Open');await page.locator('[data-tile="active"]').click();
 await expect(page.locator('#table-empty')).toContainText('Error Loading Quotes');
 await expect(page.locator('.stat-value')).toHaveText(['—','—','—','—','—','—']);
 await expect(page.locator('#quotes-tbody tr')).toHaveCount(0);await expect(page.locator('#table-count')).toHaveText('Unavailable');
 state.mode='populated';await page.locator('[data-action="retry-quotes"]').click();await ready(page);
 await expect(page.locator('#quotes-table')).toBeVisible();await expect(page.locator('#stat-total')).not.toHaveText('—');
 for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});
test('CSS staff workspaces: Quote Management current latest date window owns its response',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);let release;state.holdQuotes=new Promise(r=>{release=r;});
 await page.locator('#filter-date').selectOption('90');await expect.poll(()=>state.pending).toBe(true);
 await page.locator('[data-tab="all"]').click();await expect(page.locator('#qm-updated')).toContainText('34 in all time');
 release();await page.waitForLoadState('networkidle');await expect(page.locator('#qm-updated')).toContainText('34 in all time');
 await expect(page.locator('#filter-date')).toHaveValue('all');await expect(page.locator('#table-count')).toHaveText('34 quotes');
 for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});
test('CSS staff workspaces: Quote Management current late inbound cannot revive a failed list',async({page})=>{
 const state=quoteState(false);let release;state.holdInbound=new Promise(r=>{release=r;});const events=await setup(page,state);await expect.poll(()=>state.inboundPending).toBe(true);
 state.mode='failure';await page.locator('#filter-date').selectOption('90');await expect(page.locator('#qm-updated')).toContainText('Load failed');
 release();await page.waitForLoadState('networkidle');await expect(page.locator('#quotes-table')).toBeHidden();await expect(page.locator('#quotes-tbody tr')).toHaveCount(0);await expect(page.locator('#table-empty')).toContainText('Error Loading Quotes');
 for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});

test('CSS staff workspaces: Quote Management current native dialogs contain focus and preserve cancellation',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);const row=page.locator('tr[data-quote-id="EMB0910-3001"]');
 for(const action of ['copy-link','resend','delete']){
  const trigger=row.locator('[data-action="'+action+'"]');await trigger.click();const modal=page.locator(action==='delete'?'#delete-modal':'#qm-modal');await expect(modal).toBeVisible();await expect(modal).toHaveJSProperty('open',true);
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});const box=await modal.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);const axe=await new(require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);await modal.screenshot({path:path.join(output,'staff-workspaces-quotes-current-'+action+'-'+width+'.png')});}
  for(let i=0;i<6;i++){await page.keyboard.press('Tab');expect(await modal.evaluate(n=>n.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(modal).toBeHidden();await expect(trigger).toBeFocused();await page.setViewportSize({width:1440,height:1000});
 }
 for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});
test('CSS staff workspaces: Quote Management current pending deletion cannot be canceled or duplicated',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);let release;state.holdWrite=new Promise(r=>{release=r;});state.failWrite=403;
 await page.locator('tr[data-quote-id="EMB0910-3001"] [data-action="delete"]').click();await page.locator('[data-action="delete-confirm"]').click();await expect.poll(()=>state.writePending).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#delete-modal')).toBeVisible();await expect(page.locator('[data-action="delete-cancel"]')).toBeDisabled();await page.locator('[data-action="delete-confirm"]').dispatchEvent('click');expect(events.writes).toHaveLength(1);
 release();await expect(page.locator('#delete-modal')).toBeHidden();await expect(page.locator('#qm-toasts')).toContainText('Synthetic action blocked');await expect(page.locator('tr[data-quote-id="EMB0910-3001"]')).toBeVisible();
 for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);expect(events.writes).toHaveLength(1);
});
test('CSS staff workspaces: Quote Management current expired session leaves the quote intact',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);state.failWrite=401;
 await page.locator('tr[data-quote-id="EMB0910-3001"] [data-action="delete"]').click();await page.locator('[data-action="delete-confirm"]').click();await expect(page.locator('#qm-toasts')).toContainText('Your staff session expired');await expect(page.locator('tr[data-quote-id="EMB0910-3001"]')).toBeVisible();expect(events.writes).toHaveLength(1);
 for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
});
test('CSS staff workspaces: Quote Management current pending ShipStation request cannot duplicate',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);let release;state.holdWrite=new Promise(r=>{release=r;});state.failWrite=403;
 const button=page.locator('tr[data-quote-id="DTG0910-3003"] [data-action="shipstation"]');await button.click();await page.keyboard.press('Escape');await expect(button).toBeFocused();expect(events.writes).toHaveLength(0);
 await button.click();await page.locator('#qm-modal-confirm').click();await expect.poll(()=>state.writePending).toBe(true);await expect(button).toBeDisabled();await button.dispatchEvent('click');await expect(page.locator('#qm-modal')).toBeHidden();expect(events.writes).toHaveLength(1);
 release();await expect(button).toBeEnabled();await expect(page.locator('#qm-toasts')).toContainText('Synthetic action blocked');expect(events.writes).toHaveLength(1);
 for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
});

test('CSS staff workspaces: Quote Management current pending email lookup and send retain one request',async({page})=>{
 const state=quoteState(false),events=await setup(page,state);await ready(page);let releaseShare,releaseWrite;state.holdShare=new Promise(r=>{releaseShare=r;});state.holdWrite=new Promise(r=>{releaseWrite=r;});
 const button=page.locator('tr[data-quote-id="EMB0910-3001"] [data-action="resend"]');await button.click();await page.locator('#qm-modal-confirm').click();await expect.poll(()=>state.sharePending).toBe(true);await button.dispatchEvent('click');await expect(page.locator('#qm-modal')).toBeHidden();expect(events.writes).toHaveLength(0);
 releaseShare();await expect.poll(()=>state.writePending).toBe(true);await button.dispatchEvent('click');expect(events.writes).toHaveLength(1);releaseWrite();await expect(page.locator('#qm-toasts')).toContainText('Email resent');await expect(button).toBeEnabled();expect(events.writes).toHaveLength(1);
 for(const key of ['errors','unknown','missing'])expect(events[key],key).toEqual([]);
});
for(const original of [true,false])test('CSS staff workspaces: Quote Management '+(original?'original':'current')+' shared inbound calendar and paper',async({page})=>{
 const state=quoteState(original),events=await setup(page,state),views=[],papers=[];await ready(page);await page.locator('#btn-inbound-today').click();await expect(page.locator('.sit-modal')).toBeVisible();await page.waitForLoadState('networkidle');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});if(!original){const axe=await new(require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}views.push({width,text:await page.locator('.sit-modal').innerText()});await page.locator('.sit-modal').screenshot({path:path.join(output,'staff-workspaces-quotes-'+(original?'original':'current')+'-inbound-'+width+'.png')});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('#sit-print').click();await page.locator('#sit-printmenu [data-print]').first().click();await expect(page.locator('body')).toHaveClass(/sit-printing/,{timeout:10000});papers.push({name:'inbound',text:await page.locator('#sit-print-sheet').textContent()});await page.pdf({path:path.join(output,'staff-workspaces-quotes-'+(original?'original':'current')+'-inbound.pdf'),preferCSSPageSize:true,printBackground:true});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));if(original)await page.waitForTimeout(1600);
 await page.locator('#sit-labels').click();await expect(page.locator('body')).toHaveClass(/sit-label-printing/);papers.push({name:'labels',text:await page.locator('#sit-label-sheet').textContent()});await page.pdf({path:path.join(output,'staff-workspaces-quotes-'+(original?'original':'current')+'-labels.pdf'),preferCSSPageSize:true,printBackground:true});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 if(!original){await page.keyboard.press('Escape');await expect(page.locator('.sit-modal')).toBeHidden();await expect(page.locator('#btn-inbound-today')).toBeFocused();const b=require('../fixtures/staff-workspaces-quotes-original-documents.json');expect(papers.map(p=>({...p,text:norm(p.text)}))).toEqual(b.papers.map(p=>({...p,text:norm(p.text)})));}
 save((original?'original':'current')+'-documents',{views,papers,events});for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});
