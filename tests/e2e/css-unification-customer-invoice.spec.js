const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),{open,data,check}=require('./helpers/customer-invoice-browser');
const output=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CUSTOMER_INVOICE_BASELINE==='1',prefix=capture?'original':'current';
fs.mkdirSync(output,{recursive:true});test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
async function snapshot(page){return page.evaluate(()=>({title:document.title,text:document.querySelector('#ci-paper').innerText,rows:[...document.querySelectorAll('.ci-table tbody tr')].map(n=>[...n.querySelectorAll('td')].map(c=>c.innerText)),totals:[...document.querySelectorAll('.ci-totals tr')].map(n=>n.innerText.replace(/\s+/g,' ').trim()),back:[...document.querySelectorAll('a[href]')].map(n=>n.getAttribute('href'))}));}
for(const mode of ['normal','paid','empty','long','escaped','preview'])test('CSS customer invoice: '+prefix+' '+mode+' data, layouts and complete paper',async({page})=>{
 const events=await open(page,{original:capture,mode,preview:mode==='preview'});await expect(page.locator('#ci-paper')).toBeVisible();
 const before=await snapshot(page),views=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  views.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,paperWidth:document.querySelector('#ci-paper').getBoundingClientRect().width})));
  if(!capture){expect(views.at(-1).scrollWidth).toBeLessThanOrEqual(width);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);}
  if(['normal','long'].includes(mode))await page.screenshot({path:path.join(output,'customer-invoice-'+mode+'-'+prefix+'-'+width+'.png'),fullPage:true});
 }
 if(mode==='escaped'){expect(await page.evaluate(()=>window.__bad)).toBeUndefined();expect(await page.locator('#ci-paper script').count()).toBe(0);}
 expect(before.text).toContain('Sep 1, 2026');expect(before.text).toContain('Oct 9, 2026');
 expect(before.back.filter(h=>h.startsWith('/portal'))).toEqual(Array(2).fill(mode==='preview'?'/portal-admin/preview/90210':'/portal'));
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});
 if(['normal','long','empty'].includes(mode))await page.pdf({path:path.join(output,'customer-invoice-'+mode+'-'+prefix+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});
 const paper=await page.locator('#ci-paper').innerText();await page.emulateMedia({media:'screen'});
 if(capture)fs.writeFileSync(path.join(__dirname,'../fixtures/customer-invoice-'+mode+'-original-browser.json'),JSON.stringify({before,views,paper},null,2)+'\n');
 else{
  const original=require('../fixtures/customer-invoice-'+mode+'-original-browser.json');
  expect(before.rows).toEqual(original.before.rows);expect(before.totals).toEqual(original.before.totals);expect(before.title).toBe(original.before.title);
  for(const token of original.paper.split(/\s+/).filter(Boolean))expect(paper).toContain(token);
  await expect(page.locator('#ci-download')).toBeEnabled();
 }
 check(expect,events);
});
for(const status of [401,404,500])for(const preview of [false,true])test('CSS customer invoice: '+prefix+' '+status+' '+(preview?'staff':'customer'),async({page})=>{
 const events=await open(page,{original:capture,status,preview});
 if(status===401)await expect(page).toHaveURL(new RegExp(preview?'/auth/saml/login$':'/customer/login$'));
 else{await expect(page.locator('#ci-error')).toBeVisible();await expect(page.locator('#ci-paper')).toBeHidden();if(!capture)await expect(page.locator('#ci-download')).toBeDisabled();}
 check(expect,events);
});
test('CSS customer invoice: '+prefix+' invalid invoice and pending request',async({page})=>{
 const events=await open(page,{original:capture,invalid:true});await expect(page.locator('#ci-error')).toBeVisible();expect(events.reads).toEqual([]);check(expect,events);
});
for(const outcome of ['success','failure','missing'])test('CSS customer invoice: '+prefix+' PDF '+outcome,async({page})=>{
 const events=await open(page,{original:capture,pdf:outcome==='missing'?'missing':undefined});await expect(page.locator('#ci-paper')).toBeVisible();
 await page.locator('#ci-download').click();
 if(outcome==='missing'){
  expect(await page.evaluate(()=>window.__printCalls)).toBe(1);
 }else{
  await expect(page.locator('#ci-download')).toBeDisabled();
  const record=await page.evaluate(()=>window.__pdfCalls[0]);
  expect(record.options.filename).toBe('Invoice-740123.pdf');expect(record.options.jsPDF).toEqual({unit:'mm',format:'letter',orientation:'portrait'});expect(record.text).toContain('$640.87');
  await page.evaluate(outcome=>outcome==='failure'?window.__pdfReject(new Error('Synthetic PDF failure')):window.__pdfResolve(),outcome);
  if(!capture&&outcome==='failure')await expect(page.locator('#ci-download-error')).toBeVisible();
 }
 await expect(page.locator('#ci-download')).toBeEnabled();check(expect,events);
});
test('CSS customer invoice: '+prefix+' real PDF download contains whole invoice',async({page})=>{
 const events=await open(page,{original:capture,pdf:'real'});await expect(page.locator('#ci-paper')).toBeVisible();
 const downloaded=page.waitForEvent('download');await page.locator('#ci-download').click();const download=await downloaded;
 expect(download.suggestedFilename()).toBe('Invoice-740123.pdf');await download.saveAs(path.join(output,'customer-invoice-download-'+prefix+'.pdf'));
 await expect(page.locator('#ci-download')).toBeEnabled();check(expect,events);
});

