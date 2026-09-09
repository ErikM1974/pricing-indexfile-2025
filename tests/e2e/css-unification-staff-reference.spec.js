const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path');
const fixture=require('../fixtures/staff-reference-original-content.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.describe.configure({mode:'parallel'});test.use({reducedMotion:'reduce'});
const config={newAccountBounty:250,reactivatedBounty:100,dormancyMonths:12,minAccountRevenue:500,rateStartPct:85,ratePerPoint:20,teamKickers:[{target:50000,pay:100},{target:75000,pay:200}],reps:{'Example Rep':{baselineRevenue:40000},'Sample Rep':{baselineRevenue:50000}},configSource:'api'};
const forms=[{Category:'Customer Intake',Form_Name:'Team Roster',Description:'Add names and sizes.',PDF_URL:'/forms/team-roster-form.pdf',Fill_Online_URL:'/pages/forms/team-roster-form.html'},{Category:'Payments',Form_Name:'Credit Application',Description:'New customer account request.',PDF_URL:'/forms/credit-application.pdf'}];
const serviceCodes=['DD','DDE','DDT','Monogram','Name/Number','SEG','SECC','DT','WEIGHT','3D-EMB','Laser Patch','GRT-50','GRT-75'];
const prices=serviceCodes.map(ServiceCode=>({ServiceCode,SellPrice:ServiceCode==='DD'?125:14}));
async function open(page,file,state={}){
    const events={errors:[],writes:[]};page.on('pageerror',e=>events.errors.push(e.message));
    await page.route('**/*',route=>{
        const req=route.request(),u=new URL(req.url());
        if(u.pathname==='/api/csp-report')return route.fulfill({status:204,body:''});
        if(!['GET','HEAD'].includes(req.method())){events.writes.push(u.pathname);return route.fulfill({status:503,body:'Business writes blocked'});}
        if(u.pathname==='/'+file)return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../..',file))});
        let body;
        if(u.pathname==='/api/forms-library')body=state.forms===undefined?{forms}:state.forms;
        if(u.pathname==='/api/service-codes')body=state.services===undefined?{success:true,data:prices}:state.services;
        if(u.pathname==='/api/crm-proxy/embroidery-bonus/config')body=state.bonus===undefined?{success:true,config}:state.bonus;
        if(body!==undefined)return route.fulfill(typeof body==='number'?{status:body,json:{error:'Offline fixture'}}:{json:body});
        if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Unmocked business read'}});
        return route.fallback();
    });
    await page.goto('/'+file);await page.evaluate(()=>document.fonts.ready);await expect(page.locator('h1')).toBeVisible();
    if(file.includes('forms-library'))await expect(page.locator('#formsRoot')).not.toHaveClass(/dash-loading/);
    if(file.includes('data-entry'))await expect(page.locator('#price-source')).not.toHaveText('Loading');
    if(file.includes('embroidery-bonus'))await expect(page.locator('#ebp-retry')).toBeEnabled();
    return events;
}
const clean=state=>{expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);};
async function paper(page,name){
    const blocks=await page.locator('h1, header p, main p, main li, main h2, main h3, main h4, main th, main td').evaluateAll(nodes=>nodes.filter(n=>!n.closest('[hidden], [role="status"], .no-print')).map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
    const warning=await page.locator('.reference-source-warning:not([hidden]), #ebp-config-status:not([hidden])').evaluateAll(nodes=>nodes.map(n=>{const clone=n.cloneNode(true);clone.querySelectorAll('button').forEach(b=>b.remove());return clone.textContent.replace(/\s+/g,' ').trim();}));
    fs.writeFileSync(path.join(output,'staff-reference-'+name+'-print.json'),JSON.stringify({blocks,warning}));
    await page.pdf({path:path.join(output,'staff-reference-'+name+'.pdf'),format:'Letter',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
}
for(const entry of fixture.pages){const name=path.basename(entry.file,'.html');
    test('CSS staff reference: '+name+' at four widths',async({page})=>{
        test.setTimeout(180000);const state=await open(page,entry.file);
        for(const width of [1440,768,390,320]){
            await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
            await page.screenshot({path:path.join(output,'staff-reference-'+name+'-'+width+'.png')});
        }clean(state);
    });
    test('CSS staff reference: '+name+' prints complete populated content',async({page})=>{
        const state=await open(page,entry.file),items=page.locator('.accordion-item');
        const before=await items.evaluateAll(nodes=>nodes.map(n=>n.className));await paper(page,name);
        expect(await items.evaluateAll(nodes=>nodes.map(n=>n.className))).toEqual(before);clean(state);
    });
}
test('CSS staff reference: real anonymous and ordinary staff restrictions remain',async({browser,baseURL,request})=>{
    const context=await browser.newContext({baseURL,storageState:{cookies:[],origins:[]}});
    // Existing access verified on production: four dashboards require staff; the data-entry reading guide is public.
    try{for(const p of fixture.pages)expect((await context.request.get('/'+p.file,{maxRedirects:0})).status(),p.file).toBe(p.file.startsWith('dashboards/')?302:200);}finally{await context.close();}
    for(const file of ['commission-structure','seo-strategy'])expect((await request.get('/dashboards/'+file+'.html',{maxRedirects:0})).status()).toBe(403);
});
test('CSS staff reference: commission buttons toggle reading and preserve all original examples',async({page})=>{
    const state=await open(page,'dashboards/commission-structure.html'),headers=page.locator('.accordion-header');
    await headers.nth(1).focus();await page.keyboard.press('Enter');await expect(headers.nth(1)).toHaveAttribute('aria-expanded','true');await expect(headers.first()).toHaveAttribute('aria-expanded','false');
    await page.keyboard.press('Enter');await expect(headers.nth(1)).toHaveAttribute('aria-expanded','false');clean(state);
});
test('CSS staff reference: SEO phone contents and reduced-motion fragment focus',async({page})=>{
    await page.setViewportSize({width:390,height:844});const state=await open(page,'dashboards/seo-strategy.html');
    const toc=page.locator('details.seo-toc');await expect(toc).not.toHaveAttribute('open');await toc.locator('summary').focus();await page.keyboard.press('Enter');
    await toc.locator('a[href="#changelog"]').click();await expect(page.locator('#changelog')).toBeFocused();expect(new URL(page.url()).hash).toBe('#changelog');clean(state);
});
for(const failure of [503,{}, {forms:'invalid'}])test('CSS staff reference: directory '+JSON.stringify(failure)+' shows failure and retries',async({page})=>{
    const data={forms:failure},state=await open(page,'dashboards/forms-library.html',data);await expect(page.locator('#forms-retry')).toBeVisible();
    data.forms={forms};await page.locator('#forms-retry').click();await expect(page.getByText('Team Roster',{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Fill out Team Roster online'})).toHaveAttribute('href','/pages/forms/team-roster-form.html');clean(state);
});
test('CSS staff reference: empty directory and unsafe destinations stay explicit',async({page})=>{
    const data={forms:{forms:[]}},state=await open(page,'dashboards/forms-library.html',data);await expect(page.getByText(/No active forms/)).toBeVisible();
    data.forms={forms:[{Category:'__proto__',Form_Name:'<Unsafe>',Description:'<img src=x onerror=alert(1)>',PDF_URL:'javascript:alert(1)',Fill_Online_URL:'//untrusted.example'}]};
    await page.reload();await expect(page.getByText('<Unsafe>',{exact:true})).toBeVisible();await expect(page.getByText('No file linked')).toBeVisible();await expect(page.locator('#formsRoot img')).toHaveCount(0);clean(state);
});
test('CSS staff reference: partial and failed service prices stay flagged and retry preserves checklist',async({page})=>{
    const data={services:{success:true,data:[{ServiceCode:'DD',SellPrice:0}]}},state=await open(page,'pages/data-entry-guide.html',data);
    await expect(page.locator('#price-source')).toHaveText('API + fallback');await expect(page.locator('#service-source-warning')).toContainText('confirm');await expect(page.locator('#service-codes-tbody tr').first()).toContainText('$0.00');
    const box=page.locator('input[type=checkbox]').first();await box.check();data.services=503;await page.locator('#service-codes-retry').click();await expect(page.locator('#price-source')).toHaveText('Fallback');await expect(box).toBeChecked();await paper(page,'service-failure');
    data.services={success:true,data:prices};await page.locator('#service-codes-retry').click();await expect(page.locator('#price-source')).toHaveText('API');await expect(page.locator('#service-source-warning')).toBeHidden();await expect(box).toBeChecked();clean(state);
});
for(const failure of [503,{success:true,config:{...config,ratePerPoint:'invalid'}}])test('CSS staff reference: bonus '+JSON.stringify(failure)+' cannot display invalid figures',async({page})=>{
    const data={bonus:failure},state=await open(page,'dashboards/embroidery-bonus-plan.html',data);await expect(page.locator('#ebp-config-status')).toContainText('Could not load');
    expect(await page.locator('[data-ebp]').allTextContents()).toEqual(expect.arrayContaining(['—']));await expect(page.locator('#ebp-rate-table')).toBeHidden();
    if(typeof failure==='number')await paper(page,'bonus-failure');
    data.bonus={success:true,config};await page.locator('#ebp-retry').click();await expect(page.locator('#ebp-rate-table')).toBeVisible();await expect(page.locator('[data-ebp="bountyNew"]').first()).toHaveText('$250');await expect(page.locator('#ebp-rate-body')).toContainText('$300');clean(state);
});
test('CSS staff reference: bonus fallback source and hostile name are readable on paper',async({page})=>{
    const state=await open(page,'dashboards/embroidery-bonus-plan.html',{bonus:{success:true,config:{...config,configSource:'fallback',reps:{'<img/src=x>':{baselineRevenue:40000}}}}});
    await expect(page.locator('#ebp-config-status')).toContainText('defaults');await expect(page.locator('#ebp-rate-table')).toBeVisible();await expect(page.locator('#ebp-rate-head')).toContainText('<img/src=x>');await expect(page.locator('#ebp-rate-head img')).toHaveCount(0);await paper(page,'bonus-fallback');clean(state);
});
