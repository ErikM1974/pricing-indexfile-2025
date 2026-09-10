const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),source=require('../fixtures/employee-bundles-original-content.json'),{open,rows}=require('./helpers/employee-bundles-browser');
const output=path.join(__dirname,'screenshots/css-unification'),capture=process.env.EMPLOYEE_BUNDLE_BASELINE==='1';fs.mkdirSync(output,{recursive:true});
test.use({reducedMotion:'reduce'});
const tidy=s=>s.replace(/\s+/g,' ').trim();
function check(events,record){for(const k of ['errors','writes','unknown','missing'])expect(events[k],k).toEqual([]);expect(events.providers).toEqual(record.providers);}
for(const record of source.pages){
 const name=path.basename(record.file,'.html'),mode=capture?'original':'current';
 test('CSS employee bundles: '+name+' '+mode+' content, four widths, keyboard and complete paper',async({page})=>{
  const events=await open(page,record.file,{original:capture}),views=[];
  await expect(page.locator('tbody tr')).toHaveCount(rows.length);
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:1050});
   const view=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,text:document.body.innerText.replace(/\s+/g,' ').trim(),rows:[...document.querySelectorAll('tbody tr')].map(n=>n.innerText.replace(/\s+/g,' ').trim()),links:[...document.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),label:n.textContent.replace(/\s+/g,' ').trim()}))}));
   views.push(view);
   if(!capture){
    expect(view.scrollWidth).toBeLessThanOrEqual(width);
    for(const originalLink of record.links)expect(view.links).toContainEqual(originalLink);
    expect(view.rows).toEqual(rows.map(r=>r.join(' ')));
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
   }
   await page.screenshot({path:path.join(output,'employee-bundles-'+name+'-'+mode+'-'+width+'.png'),fullPage:true});
  }
  if(!capture){
   await page.locator('.skip-link').focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
   const region=page.locator('.hosted-embed');await region.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
  }
  await page.emulateMedia({media:'print'});await page.pdf({path:path.join(output,'employee-bundles-'+name+'-'+mode+'.pdf'),format:'Letter',landscape:true,printBackground:true,preferCSSPageSize:true});
  const paper=await page.locator('main').innerText();
  if(capture){fs.writeFileSync(path.join(__dirname,'../fixtures/employee-bundles-'+name+'-original-browser.json'),JSON.stringify({views,paper},null,2)+'\n');}
  else{
   const before=require('../fixtures/employee-bundles-'+name+'-original-browser.json');
   for(const row of rows)for(const value of row)expect(paper).toContain(value);
   for(const phrase of ['Avery 5960 (2.5" x 1") Box Labels','Account Executives must mark each employee name','Download all the names and sizes into Excel','Import them into Microsoft Word using the mail merge','Print them on the Avery 5960 labels']){expect(tidy(paper)).toContain(phrase);expect(tidy(before.paper)).toContain(phrase);}
   expect(await page.locator('.hosted-print-link').isVisible()).toBe(true);
  }
  await page.emulateMedia({media:'screen'});await expect(page.locator('tbody tr')).toHaveCount(rows.length);check(events,record);
 });
 for(const state of ['empty','login','failed'])test('CSS employee bundles: '+name+' '+mode+' provider '+state,async({page})=>{
  const events=await open(page,record.file,{mode:state,original:capture});await page.setViewportSize({width:320,height:1050});
  if(state==='empty')await expect(page.getByRole('status')).toHaveText('No records found');
  if(state==='login'){await page.getByLabel('Email',{exact:true}).fill('review@example.test');await page.getByLabel('Password',{exact:true}).fill('review-only');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('review@example.test');}
  if(!capture){await expect(page.locator('.hosted-help a')).toHaveAttribute('href',record.providers[0].replace(/\/emb$/,''));await page.locator('.hosted-help a').focus();await expect(page.locator('.hosted-help a')).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);}
  await page.screenshot({path:path.join(output,'employee-bundles-'+name+'-'+mode+'-'+state+'-320.png'),fullPage:true});check(events,record);
 });
}
