const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {ready,configure,fill,normalizeRequests}=require('./helpers/screenprint-customer-browser'),{snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});test.setTimeout(120000);
function record(name,value){const file='tests/fixtures/specialty-calculators-screenprint-customer-'+name+'-original-browser.json',full=path.join(root,file);if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic customer-supplied screen-print presentation, financial and request evidence.\n');}else {const prior=JSON.parse(fs.readFileSync(full,'utf8'));if(original||name==='all-combinations')expect(value).toEqual(prior);else if(name.startsWith('invoice-')){const norm=s=>s.replace(/\s+/g,' ').trim();expect(value.title).toBe(prior.title);expect(norm(value.text)).toBe(norm(prior.text));expect(value.tables.map(norm)).toEqual(prior.tables.map(norm));}else{expect(value.calculation).toEqual(prior.calculation);expect(value.mocked).toEqual(prior.mocked);expect(value.emails).toEqual(prior.emails);for(const state of value.states){expect(state.violations).toEqual([]);expect(state.overflow).toBe(false);}}}}
async function assets(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getClientRects().length).map(n=>n.decode().catch(()=>{})));});expect(await page.locator('img').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&(!n.complete||!n.naturalWidth)).map(n=>n.src))).toEqual([]);}
async function submit(page){await page.locator('#submitQuoteBtn').click();await expect.poll(()=>page.locator('#submitQuoteBtn').isEnabled()).toBe(true);}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await assets(page);await page.evaluate(()=>scrollTo(0,0));const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});await page.screenshot({path:path.join(out,'specialty-calculators-screenprint-customer-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}
 check(expect,events);record(name,{states,calculation:await page.evaluate(()=>window.calculator.currentCalculation),mocked:normalizeRequests(events.mocked),emails:await page.evaluate(()=>window.__emailMessages),dialogs:events.dialogs});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await assets(page);await page.pdf({path:path.join(out,'specialty-calculators-screenprint-customer-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
for(const mode of ['empty','minimum','priced','form','success','failed-pricing','failed-session','failed-item','failed-setup','failed-email','failed-both'])test('CSS specialty customer-supplied screen print: '+mode,async({page})=>{
 const state={original,failedPricing:mode==='failed-pricing',failedSession:['failed-session','failed-both'].includes(mode),failedItem:mode==='failed-item',failedSetup:mode==='failed-setup',failedEmail:['failed-email','failed-both'].includes(mode)};
 const events=await ready(page,state);if(mode!=='empty')await configure(page,{quantity:mode==='minimum'?23:24});
 if(['form','success','failed-session','failed-item','failed-setup','failed-email','failed-both'].includes(mode))await fill(page);
 if(['success','failed-session','failed-item','failed-setup','failed-email','failed-both'].includes(mode)){await submit(page);if(mode!=='failed-both')await expect(page.locator('#successModal')).toBeVisible();else if(original)expect(events.dialogs).toContain('Failed to submit quote. Please try again or call (253) 922-5793.');else await expect(page.locator('#quoteSubmitStatus')).toBeVisible();}
 await evidence(page,mode,events);
});
test('CSS specialty customer-supplied screen print: all 396 quantity color and option results',async({page})=>{
 const events=await ready(page,{original});const values=await page.evaluate(async()=>{const calc=window.calculator,rows=[];for(const quantity of [23,24,47,48,71,72,144,145,576,577,1000])for(const frontColors of [1,3,6])for(const backColors of [0,2,6])for(const dark of [false,true])for(const stripes of [false,true]){const r=await calc.priceOrder(quantity,frontColors,backColors,dark,stripes);if(r.ok)calc.renderResult(quantity,frontColors,backColors,dark,stripes,r);rows.push({quantity,frontColors,backColors,dark,stripes,ok:r.ok,error:r.ok?null:r.error,calculation:r.ok?calc.currentCalculation:null,headline:r.ok?calc.priceDisplay.textContent:null,smallBatch:r.ok?document.getElementById('priceSmallBatchNote').textContent:null,summary:r.ok?calc.orderSummary.textContent.replace(/\s+/g,' ').trim():null});}return rows;});expect(values).toHaveLength(396);record('all-combinations',{values});check(expect,events);
});
for(const quantity of [24,145])test('CSS specialty customer-supplied screen print: saved invoice '+quantity,async({page})=>{
 const events=await ready(page,{original});await configure(page,{quantity});await fill(page);await submit(page);
 // Capture the original action's complete invoice HTML without opening the operating-system print dialog.
 await page.evaluate(()=>{window.__invoiceHTML='';window.open=()=>({document:{write:html=>{window.__invoiceHTML=html;},close:()=>{}},addEventListener:()=>{}});});
 await page.locator('#successModal [data-call="printQuote"]').click();const html=await page.evaluate(()=>window.__invoiceHTML);expect(html).toContain('<!DOCTYPE html>');
 const popup=await page.context().newPage();await popup.setContent(html.replace(/<script>\s*window.onload[\s\S]*?<\/script>/,''));await assets(popup);expect(await popup.title()).toContain('SPC0911-1');
 record('invoice-'+quantity,{title:await popup.title(),text:await popup.locator('body').innerText(),tables:await popup.locator('table').allTextContents()});await popup.screenshot({path:path.join(out,'specialty-calculators-screenprint-customer-invoice-'+quantity+'-'+phase+'-1440.png'),fullPage:true});await popup.pdf({path:path.join(out,'specialty-calculators-screenprint-customer-invoice-'+quantity+'-'+phase+'.pdf'),format:'Letter',printBackground:true});check(expect,events);await popup.close();
});
test('CSS specialty customer-supplied screen print: original pending edits retain stale quote and unsaved print does nothing',async({page})=>{
 test.skip(!original,'original defect evidence');const events=await ready(page,{original});await configure(page);await page.locator('#quoteActions [data-call="printQuote"]').click();expect(page.context().pages()).toHaveLength(1);expect(await page.evaluate(()=>window.__prints)).toEqual([]);
 const state=await page.evaluate(()=>{document.getElementById('quantity').value='145';document.getElementById('quantity').dispatchEvent(new Event('input',{bubbles:true}));return {input:document.getElementById('quantity').value,pricedQuantity:window.calculator.currentCalculation.quantity,actionsVisible:!!document.getElementById('quoteActions').getClientRects().length};});expect(state).toEqual({input:'145',pricedQuantity:24,actionsVisible:true});record('stale-input',{state});check(expect,events);
});

test.describe('CSS customer screen print current request ownership',()=>{
 test.beforeEach(()=>test.skip(original,'current behavior only'));
 for(const stage of ['Session','Item','Setup'])test('retry only missing '+stage+' after a successful email',async({page})=>{
  const state={['failed'+stage]:true},events=await ready(page,state);await configure(page);await fill(page);await submit(page);
  await expect(page.locator('#quoteDeliveryStatus')).toContainText(stage==='Session'?'Saving was not confirmed':'incomplete');
  const acceptedBefore=state.requests.filter(r=>r.path==='/api/quote_sessions').length;expect(acceptedBefore).toBe(1);
  state['failed'+stage]=false;await page.locator('#retryQuoteBtn').click();await expect(page.locator('#retryQuoteBtn')).toBeHidden();
  expect(state.requests.filter(r=>r.path==='/api/quote_sessions')).toHaveLength(stage==='Session'?2:1);
  expect(state.requests.filter(r=>r.body.LineNumber===1)).toHaveLength(stage==='Item'?2:1);
  expect(state.requests.filter(r=>r.body.LineNumber===2)).toHaveLength(stage==='Setup'?2:1);
  expect(new Set(state.requests.map(r=>r.body.QuoteID))).toEqual(new Set(['SPC0911-1']));
  expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(1);await expect(page.locator('#quoteDeliveryStatus')).toBeHidden();check(expect,events);
 });
 test('email retry retains the saved quote and does not repeat its writes',async({page})=>{
  const state={failedEmail:true},events=await ready(page,state);await configure(page);await fill(page);await submit(page);
  await expect(page.locator('#quoteSuccessTitle')).toHaveText('Quote saved');await expect(page.locator('#quoteRecipientLabel')).toHaveText('Your quote is saved for:');
  await page.evaluate(()=>{window.__emailFails=false;});await page.locator('#retryQuoteBtn').click();await expect(page.locator('#quoteSuccessTitle')).toHaveText('Quote sent');
  expect(state.requests).toHaveLength(3);expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(2);check(expect,events);
 });
 test('both failures retain the draft and an exact retry retains its quote ID',async({page})=>{
  const state={failedEmail:true,failedSession:true},events=await ready(page,state);await configure(page);await fill(page);await submit(page);await expect(page.locator('#quoteSubmitStatus')).toBeVisible();await expect(page.locator('#customerName')).toHaveValue('Example Customer');await expect(page.locator('#successModal')).toBeHidden();
  state.failedSession=false;await page.evaluate(()=>{window.__emailFails=false;});await submit(page);await expect(page.locator('#modalQuoteId')).toHaveText('SPC0911-1');expect(state.requests).toHaveLength(4);expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(2);check(expect,events);
 });
 test('pending submission blocks duplicate requests, Escape and editable controls',async({page})=>{
  const state={delay:500},events=await ready(page,state);await configure(page);await fill(page);await page.locator('#submitQuoteBtn').click();await expect(page.locator('#submitQuoteBtn')).toBeDisabled();await page.keyboard.press('Escape');await expect(page.locator('#quoteModal')).toBeVisible();await expect(page.locator('#customerEmail')).toBeDisabled();await expect(page.locator('#quantity')).toBeDisabled();
  await page.evaluate(()=>{window.calculator.handleQuoteSubmit({preventDefault(){}});window.closeQuoteModal();window.calculator.scheduleCalculate();});await expect(page.locator('#successModal')).toBeVisible();expect(state.requests).toHaveLength(3);expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(1);check(expect,events);
 });
 test('native dialog preserves a cancelled draft and keeps keyboard focus inside',async({page})=>{
  const events=await ready(page);await configure(page);await fill(page);await page.locator('#submitQuoteBtn').focus();await page.keyboard.press('Tab');await expect(page.locator('#customerName')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#submitQuoteBtn')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#quoteModal')).toBeHidden();await expect(page.locator('#sendQuoteBtn')).toBeFocused();await page.locator('#sendQuoteBtn').click();await expect(page.locator('#customerName')).toHaveValue('Example Customer');check(expect,events);
 });
 test('short phone dialog keeps quote totals and the submit action reachable',async({page})=>{
  const events=await ready(page);await configure(page);await page.setViewportSize({width:320,height:480});await fill(page);await page.locator('#submitQuoteBtn').scrollIntoViewIfNeeded();await expect(page.locator('#submitQuoteBtn')).toBeInViewport();
  await page.locator('#quotePreview').evaluate(n=>{n.scrollLeft=n.scrollWidth;});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:path.join(out,'specialty-calculators-screenprint-customer-short-dialog-current-320.png')});await submit(page);await expect(page.locator('#modalTotalAmount')).toHaveText('$728.00');check(expect,events);
 });
 test('new inputs immediately invalidate an old quote and an older pricing response cannot restore it',async({page})=>{
  const events=await ready(page);await configure(page);const direct=await page.evaluate(()=>{document.getElementById('quantity').value='145';document.getElementById('quantity').dispatchEvent(new Event('input',{bubbles:true}));return {calc:window.calculator.currentCalculation,hidden:document.getElementById('quoteActions').hidden};});expect(direct).toEqual({calc:null,hidden:true});
  await page.evaluate(()=>{clearTimeout(window.calculator.debounceTimer);const fn=window.calculator.priceOrder.bind(window.calculator);window.calculator.priceOrder=async(...a)=>{const result=await fn(...a);await new Promise(resolve=>{window.__releasePrice=resolve;});return result;};window.__pricingPending=window.calculator.calculatePrice();});await expect.poll(()=>page.evaluate(()=>typeof window.__releasePrice)).toBe('function');
  await page.locator('#quantity').fill('');await page.evaluate(async()=>{window.__releasePrice();await window.__pricingPending;clearTimeout(window.calculator.debounceTimer);await window.calculator.calculatePrice();});expect(await page.evaluate(()=>window.calculator.currentCalculation)).toBeNull();await expect(page.locator('#quoteActions')).toBeHidden();check(expect,events);
 });
 test('an old tier ladder cannot overwrite the latest pricing state',async({page})=>{
  const events=await ready(page);await configure(page);await page.evaluate(()=>{window.__tierResolves=[];const real=window.QuoteCartEngine.singleItemPreview.bind(window.QuoteCartEngine);window.QuoteCartEngine.singleItemPreview=async(...args)=>{const r=await real(...args);if(args[0].id==='__tier_probe__')await new Promise(resolve=>window.__tierResolves.push(resolve));return r;};window.calculator.calculatePrice();});await expect.poll(()=>page.evaluate(()=>window.__tierResolves.length)).toBe(4);await page.locator('#quantity').fill('');await page.evaluate(()=>{clearTimeout(window.calculator.debounceTimer);window.__tierResolves.forEach(r=>r());});await expect(page.locator('#tierLadder')).toBeHidden();expect(await page.evaluate(()=>window.calculator.currentCalculation)).toBeNull();check(expect,events);
 });
 test('failed ladder remains visible while the main quote stays valid',async({page})=>{
  const events=await ready(page);await page.evaluate(()=>{const real=window.QuoteCartEngine.singleItemPreview.bind(window.QuoteCartEngine);window.QuoteCartEngine.singleItemPreview=(item,options)=>item.id==='__tier_probe__'?Promise.reject(new Error('Synthetic ladder failure')):real(item,options);});await page.locator('#quantity').fill('24');await expect(page.locator('#tierLadder')).toContainText('Price breaks are unavailable');await expect(page.locator('#sendQuoteBtn')).toBeVisible();expect(await page.evaluate(()=>window.calculator.currentCalculation.quantity)).toBe(24);check(expect,events);
 });
 test('printing an estimate works before sending and a saved quote keeps its original prices',async({page})=>{
  const events=await ready(page);await configure(page);await page.locator('#quoteActions [data-call="printEstimate"]').click();expect(await page.evaluate(()=>window.__prints.length)).toBe(1);await fill(page);await submit(page);await page.locator('[data-call="closeSuccessModal"]').click();await configure(page,{quantity:145});
  const result=await page.evaluate(()=>{let html='';window.open=()=>({document:{write:value=>{html=value;},close(){}},addEventListener(){}});window.printQuote();return {html,current:window.calculator.currentCalculation.finalTotal,saved:window.calculator.lastQuoteData.finalTotal};});expect(result.current).toBe(2385);expect(result.saved).toBe(728);expect(result.html).toContain('$728.00');expect(result.html).not.toContain('$2385.00');check(expect,events);
 });
 test('clipboard and blocked print failures are visible without false success',async({page})=>{
  const events=await ready(page);await configure(page);await fill(page);await submit(page);await page.locator('[data-call="copyQuoteId"]').click();await expect(page.locator('#quoteCopyStatus')).toHaveText('Quote ID copied.');await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('Synthetic clipboard failure');};});await page.locator('[data-call="copyQuoteId"]').click();await expect(page.locator('#quoteCopyStatus')).toContainText('Copy failed');await page.evaluate(()=>{window.open=()=>null;});await page.locator('#successModal [data-call="printQuote"]').click();await expect(page.locator('#quoteCopyStatus')).toContainText('print window could not open');check(expect,events);
 });
 test('email-only choice does not save or claim a database failure',async({page})=>{
  const state={},events=await ready(page,state);await configure(page);await fill(page);await page.locator('#saveToDatabase').uncheck();await submit(page);await expect(page.locator('#quoteSuccessTitle')).toHaveText('Quote sent');await expect(page.locator('#quoteDeliveryStatus')).toBeHidden();expect(state.requests).toEqual([]);expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(1);check(expect,events);
 });
});

test('CSS customer screen print: pricing retry recovers without a guessed amount',async({page})=>{
 test.skip(original,'current retry only');const state={failedPricing:true},events=await ready(page,state);await configure(page);await expect(page.locator('#pricingError')).toBeVisible();await expect(page.locator('#quoteActions')).toBeHidden();state.failedPricing=false;await page.locator('#retryPricingBtn').click();await expect(page.locator('#priceDisplay')).toHaveText('$19.50');await expect(page.locator('#pricingError')).toBeHidden();await expect(page.locator('#retryPricingBtn')).toBeHidden();check(expect,events);
});

test('CSS customer screen print: a new completed quote can reuse details with a new ID',async({page})=>{
 test.skip(original,'current submission ownership');const state={},events=await ready(page,state);await configure(page);await fill(page);await submit(page);await page.locator('[data-call="closeSuccessModal"]').click();await fill(page);await submit(page);await expect(page.locator('#modalQuoteId')).toHaveText('SPC0911-2');expect(state.requests).toHaveLength(6);expect(await page.evaluate(()=>window.__emailMessages.length)).toBe(2);check(expect,events);
});
