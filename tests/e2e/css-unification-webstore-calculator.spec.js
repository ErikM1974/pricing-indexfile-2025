const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/webstore-calculator-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_WEBSTORE_CALCULATOR_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,e){
 const states=[];fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));});
  const s=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...s,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(s.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  await page.screenshot({path:path.join(out,'webstore-calculator-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,e);const record={name,states,mocked:e.mocked,dialogs:e.dialogs},file='tests/fixtures/webstore-calculator-'+name+'-original-browser.json';
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic webstore calculator browser and request evidence.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const key of ['title','url','cards','headings','links'])expect(states[i][key],name+' '+key).toEqual(before.states[i][key]);expect(e.mocked).toEqual(name==='item-failed'?before.mocked.slice(0,-1):before.mocked);}
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'webstore-calculator-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
for(const mode of ['initial','reference','assistant','setup','on-demand','fundraiser','search','chat-failed','session-failed','item-failed'])test('CSS webstore calculator: '+mode,async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const e=await open(page,{original:capture,onDemand:mode==='on-demand',fundraiser:mode==='fundraiser',search:mode==='search',chatFailed:mode==='chat-failed',sessionFailed:mode==='session-failed',itemFailed:mode==='item-failed'});
 await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden','false');
 if(['initial','reference'].includes(mode)){await page.keyboard.press('Escape');if(mode==='reference')await page.locator('details').evaluateAll(ns=>ns.forEach(n=>{n.open=true;}));}
 else if(mode!=='assistant'){
  await page.locator('#aiChatTextarea').fill('Example company store with two logos and 500 items annually.');await page.locator('#aiChatSend').click();
  await expect(page.locator('#aiChatMessages')).toContainText(mode==='chat-failed'?"couldn't reach the AI":'Example webstore quote ready.');await expect(page.locator('#aiChatSend')).toBeEnabled();
  if(mode!=='chat-failed'){
   await page.locator('#aiCopyEmailBtn').click();await expect.poll(()=>page.evaluate(()=>window.__copied.length)).toBe(1);
   await page.locator('#aiSaveQuoteBtn').click();await expect(page.locator('#aiSaveQuoteBtn')).toBeEnabled();
   if(mode==='session-failed')await expect(page.locator(capture?'#shareToast':'#quoteSaveStatus')).toContainText('Save failed');
   else if(mode==='item-failed'&&!capture)await expect(page.locator('#quoteSaveStatus')).toContainText('Save failed');
   else await expect(page.locator('#aiSaveQuoteBtn')).toContainText('Copy share link');
  }
 }
 await evidence(page,mode,e);
});
if(!capture){
 async function quoted(page,state={}){await page.setViewportSize({width:1440,height:1000});const e=await open(page,state);await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden','false');await expect(page.locator('#aiSaveQuoteBtn')).toBeEnabled();return e;}
 test('CSS webstore calculator: partial retry keeps accepted session and first item',async({page})=>{
  const e=await quoted(page,{itemFailed:true,itemFailedLine:2});await page.locator('#aiSaveQuoteBtn').click();await expect(page.locator('#quoteSaveStatus')).toBeVisible();
  expect(e.mocked.filter(r=>r.path==='/api/quote_sessions')).toHaveLength(1);await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Save & share link');
  await page.locator('#aiSaveQuoteBtn').click();await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Copy share link');await expect(page.locator('#quoteSaveStatus')).toBeHidden();
  expect(e.mocked.filter(r=>r.path==='/api/quote_sessions')).toHaveLength(1);const items=e.mocked.filter(r=>r.path==='/api/quote_items');expect(items.map(r=>r.body.LineNumber)).toEqual([1,2,2]);expect(items[2]).toEqual(items[1]);check(expect,e);
 });
 test('CSS webstore calculator: pending saves reject reset, editing and duplicate submissions',async({page})=>{
  let release;const holdSession=new Promise(resolve=>{release=resolve;});const e=await quoted(page,{holdSession});
  try{await page.locator('#aiSaveQuoteBtn').click();await expect.poll(()=>e.mocked.filter(r=>r.path==='/api/quote_sessions').length).toBe(1);
   for(const id of ['aiSaveQuoteBtn','aiChatResetBtn','aiChatSend','aiChatTextarea'])await expect(page.locator('#'+id)).toBeDisabled();
   await page.locator('#aiSaveQuoteBtn').dispatchEvent('click');await page.locator('#aiChatResetBtn').dispatchEvent('click');await expect(page.locator('.webstore-quote-card')).toHaveCount(1);
  }finally{release();}
  await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Copy share link');expect(e.mocked.filter(r=>r.path==='/api/quote_sessions')).toHaveLength(1);for(const id of ['aiChatResetBtn','aiChatSend','aiChatTextarea'])await expect(page.locator('#'+id)).toBeEnabled();check(expect,e);
 });
 test('CSS webstore calculator: a revised price saves under a new quote identifier',async({page})=>{
  const e=await quoted(page,{changedQuote:true});await page.locator('#aiChatTextarea').fill('Confirm example quote.');await page.locator('#aiChatSend').click();await expect(page.locator('#aiChatSend')).toBeEnabled();
  await page.locator('#aiSaveQuoteBtn').click();await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Copy share link');
  await page.locator('#aiChatTextarea').fill('Revise the example setup amount.');await page.locator('#aiChatSend').click();await expect(page.locator('#aiChatSend')).toBeEnabled();await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Save & share link');
  await page.locator('#aiSaveQuoteBtn').click();await expect(page.locator('#aiSaveQuoteBtn')).toHaveText('Copy share link');
  const sessions=e.mocked.filter(r=>r.path==='/api/quote_sessions').map(r=>r.body);expect(sessions.map(s=>s.TotalAmount)).toEqual([500,800]);expect(sessions[0].QuoteID).not.toBe(sessions[1].QuoteID);check(expect,e);
 });
 test('CSS webstore calculator: keyboard reaches conversation and returns after close',async({page})=>{
  const e=await quoted(page);await page.setViewportSize({width:320,height:700});await page.locator('#aiChatMessages').focus();await expect(page.locator('#aiChatMessages')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#aiOpenBtn')).toBeFocused();await expect(page.locator('#aiChatPanel')).toHaveAttribute('inert','');await page.keyboard.press('Enter');await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden','false');check(expect,e);
 });
 test('CSS webstore calculator: printing opens every reference section then restores choices',async({page})=>{
  const e=await quoted(page);await page.keyboard.press('Escape');await page.locator('details').first().locator('summary').click();const before=await page.locator('details').evaluateAll(ns=>ns.map(n=>n.open));
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));expect(await page.locator('details').evaluateAll(ns=>ns.every(n=>n.open))).toBe(true);
  await page.emulateMedia({media:'print'});await expect(page.locator('h1')).toBeVisible();await expect(page.locator('.pricing-footer')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));expect(await page.locator('details').evaluateAll(ns=>ns.map(n=>n.open))).toEqual(before);check(expect,e);
 });
}

