const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {ready,select,fill,normalizeRequests}=require('./helpers/safety-stripe-browser'),{snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});test.setTimeout(120000);
function record(name,value){const file='tests/fixtures/specialty-calculators-safety-stripe-'+name+'-original-browser.json',full=path.join(root,file);
 if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic Safety Stripe selection, presentation and save evidence.\n');}
 else {
 const prior=JSON.parse(fs.readFileSync(full,'utf8'));
 if(original||value.values)expect(value).toEqual(prior);
 else {
  expect(value.mocked.map(r=>{if(r.path!=='/api/quote_items')return r;const design=JSON.parse(r.body.SizeBreakdown);expect(design.message).toBe('Synthetic design review; no email or live record.');delete design.message;return {...r,body:{...r.body,SizeBreakdown:JSON.stringify(design)}};})).toEqual(prior.mocked);
  expect(value.dialogs).toEqual([]);
  for(const state of value.states){const old=prior.states.find(s=>s.width===state.width);expect(state.title).toBe(old.title);expect(state.url).toBe(old.url);expect(state.links).toEqual(old.links);expect(state.tables).toEqual(old.tables);
   expect(state.headings).toContain('Safety Stripe Creator');expect(state.headings).toContain('Step 1: Choose Your Stripe Style');
   if(name!=='empty'){expect(state.headings).toContain('Step 2: Select Front Design');expect(state.headings).toContain('Step 3: Select Back Design');}
   if(['form','failed-session','failed-item'].includes(name)){expect(state.fields.map(f=>[f.id,f.value])).toEqual([['customerName','Example Customer'],['customerEmail','example@example.invalid'],['customerPhone','555-0100'],['companyName','Example Company'],['salesRep','erik@nwcustomapparel.com'],['customMessage','Synthetic design review; no email or live record.']]);expect(state.ids.summaryStyle).toBe('Standard');expect(state.ids.summaryFront).toBe('Left Chest Logo');expect(state.ids.summaryBack).toBe('Back Between Lines Text');}
   if(name==='success')expect(state.ids.quoteIdDisplay).toBe('SSC0911-1');
   if(name.startsWith('failed-'))expect(state.ids.stripeSaveStatus).toContain('Unable to save the complete design');
  }
  fs.writeFileSync(path.join(out,'specialty-calculators-safety-stripe-'+name+'-current-browser.json'),JSON.stringify(value,null,2)+'\n');
 }
}
}
async function assets(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getClientRects().length&&n.getAttribute('src')).map(n=>n.decode().catch(()=>{})));});
 expect(await page.locator('img').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&n.getAttribute('src')&&(!n.complete||!n.naturalWidth)).map(n=>n.src)),'visible original assets load').toEqual([]);
}
async function submit(page){if(original)await page.locator('#sendForm').dispatchEvent('submit',{bubbles:true,cancelable:true});else await page.locator('#sendButton').click();await expect.poll(()=>page.locator('#sendButton').isEnabled()).toBe(true);}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){
 await page.setViewportSize({width,height:1000});await assets(page);if(!original)await expect(page.locator("#stripeImageWarning")).toBeHidden();await page.evaluate(()=>scrollTo(0,0));
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
  if(original){if(mode!=='failed-session')await expect(page.locator('#successModal')).toHaveClass(/show/);else expect(events.dialogs).toContain('Unable to submit the design. Please try again or call (253) 922-5793.');}
  else if(mode==='success')await expect(page.locator('#successModal')).toBeVisible();else await expect(page.locator('#stripeSaveStatus')).toBeVisible();
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

test('CSS specialty Safety Stripe: keyboard choices, native dialog and retained draft',async({page})=>{
 test.skip(original);const events=await ready(page);const style=page.locator('[data-style="Warning"]');await style.focus();await page.keyboard.press('Enter');await expect(style).toHaveAttribute('aria-pressed','true');const front=page.locator('#frontOptions [data-option="FrontCenterLogo"]');await front.focus();await page.keyboard.press('Space');await expect(front).toHaveAttribute('aria-pressed','true');
 await fill(page);await expect(page.locator('#sendModal')).toBeVisible();await page.locator('#customerName').focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('#sendButton')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#customerName')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#sendModal')).toBeHidden();await expect(page.locator('[data-call="openSendModal"]')).toBeFocused();await page.locator('[data-call="openSendModal"]').click();await expect(page.locator('#customerEmail')).toHaveValue('example@example.invalid');check(expect,events);
});
for(const failure of ['failedSession','failedItem'])test('CSS specialty Safety Stripe: '+failure+' retries only missing work',async({page})=>{
 test.skip(original);const state={[failure]:true},events=await ready(page,state);await select(page);await fill(page);await submit(page);await expect(page.locator('#stripeSaveStatus')).toBeVisible();await expect(page.locator('#successModal')).toBeHidden();await expect(page.locator('#customMessage')).toHaveValue('Synthetic design review; no email or live record.');
 state[failure]=false;await submit(page);await expect(page.locator('#successModal')).toBeVisible();const expected=failure==='failedSession'?['/api/quote_sessions','/api/quote_sessions','/api/quote_items']:['/api/quote_sessions','/api/quote_items','/api/quote_items'];expect(events.mocked.map(r=>r.path)).toEqual(expected);if(failure==='failedItem')expect(events.mocked[2].body).toEqual(events.mocked[1].body);await expect(page.locator('#stripeSuccessTitle')).toHaveText('Design saved');await expect(page.locator('.success-content')).toContainText('No customer email has been sent.');check(expect,events);
});
test('CSS specialty Safety Stripe: pending save blocks duplicate submits and closing',async({page})=>{
 test.skip(original);const events=await ready(page,{delay:350});await select(page);await fill(page);await page.locator('#sendButton').click();await expect(page.locator('#sendButton')).toBeDisabled();await page.locator('#sendForm').dispatchEvent('submit',{bubbles:true,cancelable:true});await page.keyboard.press('Escape');await expect(page.locator('#sendModal')).toBeVisible();await expect(page.locator('#customerEmail')).toBeDisabled();await expect(page.locator('#successModal')).toBeVisible();expect(events.mocked.map(r=>r.path)).toEqual(['/api/quote_sessions','/api/quote_items']);check(expect,events);
});
for(const fail of [false,true])test('CSS specialty Safety Stripe: clipboard '+(fail?'failure':'success')+' is visible',async({page})=>{
 test.skip(original);const events=await ready(page);await select(page);await fill(page);await submit(page);await expect(page.locator('#successModal')).toBeVisible();if(fail)await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('Synthetic clipboard denial');};});await page.locator('[data-call="copyQuoteId"]').click();await expect(page.locator('#stripeCopyStatus')).toContainText(fail?'Unable to copy':'Reference copied');if(!fail)expect(await page.evaluate(()=>window.__copied)).toEqual(['SSC0911-1']);await page.locator('[data-call="startNewDesign"]').click();await expect(page.locator('#designArea')).toBeHidden();await expect(page.locator('.stripe-option').first()).toBeFocused();check(expect,events);
});

test('CSS specialty Safety Stripe: unavailable preview is visible on screen and paper',async({page})=>{
 test.skip(original);const events=await ready(page,{failedPreview:true});await select(page);await expect(page.locator('#stripeImageWarning')).toContainText('could not load');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));scrollTo(0,0);});expect((await snapshot(page)).overflow).toBe(false);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:path.join(out,'specialty-calculators-safety-stripe-failed-preview-current-'+width+'.png'),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await expect(page.locator('#stripeImageWarning')).toBeVisible();await page.pdf({path:path.join(out,'specialty-calculators-safety-stripe-failed-preview-current.pdf'),format:'Letter',printBackground:true});check(expect,events);
});

for(const failed of [false,true])test('CSS specialty Safety Stripe: phone dialog scroll reaches '+(failed?'retry':'save'),async({page})=>{
 test.skip(original);const events=await ready(page,{failedItem:failed});await select(page);await fill(page);if(failed)await submit(page);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:740});const dialog=page.locator('#sendModal');await dialog.evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(page.locator('#sendButton')).toBeInViewport();await expect(page.locator('[data-call="closeSendModal"]')).toBeInViewport();if(failed)await expect(page.locator('#stripeSaveStatus')).toBeInViewport();await page.screenshot({path:path.join(out,'specialty-calculators-safety-stripe-'+(failed?'retry':'form')+'-dialog-bottom-current-'+width+'.png')});
 }
 await page.locator('[data-call="closeSendModal"]').click();await expect(page.locator('#sendModal')).toBeHidden();check(expect,events);
});

for(const failed of [false,true])test('CSS specialty Safety Stripe: changed designs clear prior '+(failed?'failure':'saved reference'),async({page})=>{
 test.skip(original);const events=await ready(page,{failedItem:failed});await select(page);await fill(page);await submit(page);
 if(failed)await page.locator('[data-call="closeSendModal"]').click();else await page.locator('[data-call="closeSuccessModal"]').click();
 await expect(page.locator('#stripePaperStatus')).not.toHaveText('');
 await page.locator('#frontOptions [data-option="FrontCenterLogo"]').click();await expect(page.locator('#stripePaperStatus')).toHaveText('');await expect(page.locator('#stripeSaveStatus')).toBeHidden();
 await page.locator('[data-call="openSendModal"]').click();await expect(page.locator('#summaryFront')).toHaveText('Front Center Logo');await expect(page.locator('#stripeSaveStatus')).toBeHidden();check(expect,events);
});
