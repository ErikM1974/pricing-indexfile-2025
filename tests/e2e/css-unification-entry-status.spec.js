const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path');
const fixture=require('../fixtures/entry-status-original-content.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.describe.configure({mode:'parallel'});test.use({reducedMotion:'reduce'});
const row={QuoteID:'REVIEW-1042',Status:'Processed',CustomerDataJSON:JSON.stringify({firstName:'Example',lastName:'Customer',email:'preview@example.test',deliveryMethod:'shipping'}),ColorConfigsJSON:'[]',OrderTotalsJSON:JSON.stringify({totalQuantity:48,subtotal:960,shipping:0,salesTax:99.84,grandTotal:1059.84}),OrderSettingsJSON:JSON.stringify({emailsSentAt:'2026-09-09T00:00:00Z',styleName:'Sample Shirt',shipPromise:{label:'September 15, 2026',rangeLabel:'7–10 business days'},mockups:[]})};
async function open(page,file,state={},query=''){
    const events={errors:[],writes:[],auth:[],reads:0};page.on('pageerror',e=>events.errors.push(e.message));
    await page.route('**/*',route=>{
        const req=route.request(),u=new URL(req.url());
        if(u.pathname==='/api/csp-report')return route.fulfill({status:204,body:''});
        if(u.pathname===('/'+file))return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../..',file))});
        if(/^\/auth\/(customer|vendor)\/request-link$/.test(u.pathname)){
            events.auth.push({path:u.pathname,body:req.postDataJSON()});
            if(state.auth===0)return route.abort('failed');
            if(state.auth==='pending')return new Promise(resolve=>{state.resolveAuth=()=>resolve(route.fulfill({json:{ok:true}}));});
            return route.fulfill({status:state.auth||200,json:{ok:true}});
        }
        if(!['GET','HEAD'].includes(req.method())){events.writes.push(u.pathname);return route.fulfill({status:503,body:'Business writes blocked'});}
        if(u.hostname.includes('caspio.com')&&u.pathname.endsWith('/emb'))return route.fulfill({contentType:'application/javascript',body:'/* Isolated auth provider */'});
        if(u.href.includes('@emailjs/'))return route.fulfill({contentType:'application/javascript',body:'window.emailjs={init(){},send(){throw new Error("Unexpected business email")}};'});
        if(u.pathname==='/api/quote_sessions'){events.reads++;return route.fulfill(state.quote===503?{status:503,json:{error:'Offline fixture'}}:{json:state.quote||[row]});}
        if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Unmocked service'}});
        return route.fallback();
    });
    await page.goto('/'+file+query);await page.evaluate(()=>document.fonts.ready);return events;
}
const clean=events=>{expect(events.errors).toEqual([]);expect(events.writes).toEqual([]);};
async function paper(page,name){
    const blocks=await page.locator('main h1,main p,main .tot-row,main .success-step,main figcaption,footer p').evaluateAll(nodes=>nodes.filter(n=>!n.closest('[hidden]')).map(n=>n.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
    fs.writeFileSync(path.join(output,'entry-status-'+name+'-print.json'),JSON.stringify({blocks}));
    await page.pdf({path:path.join(output,'entry-status-'+name+'.pdf'),format:'Letter',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
}
for(const entry of fixture.pages){const name=path.basename(entry.file,'.html');
    test('CSS entry status: '+name+' at four widths',async({page})=>{
        test.setTimeout(180000);const events=await open(page,entry.file,{},entry.file.includes('success')?'?quote_id=REVIEW-1042':'');
        await expect(page.locator(entry.file.includes('success')?'#s-done':'h1:visible')).toBeVisible();
        for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
            await page.screenshot({path:path.join(output,'entry-status-'+name+'-'+width+'.png')});
        }clean(events);
    });
}
test('CSS entry status: public sign-in aliases stay accessible and staff links remain gated',async({browser,baseURL})=>{
    const context=await browser.newContext({baseURL,storageState:{cookies:[],origins:[]}});
    try{for(const route of ['/customer/login','/vendor/login','/dashboards/staff-login.html'])expect((await context.request.get(route,{maxRedirects:0})).status(),route).toBe(200);
        for(const route of ['/dashboards/commission-structure.html','/dashboards/seo-strategy.html'])expect((await context.request.get(route,{maxRedirects:0})).status()).toBe(302);
    }finally{await context.close();}
});
for(const type of ['customer','vendor']){
    const file='pages/'+type+'-login.html',prefix=type==='customer'?'/portal':'/vendor';
    test('CSS entry status: '+type+' keyboard validation, pending, sent and try again preserve deep link',async({page})=>{
        const state={auth:'pending'},events=await open(page,file,state,'?next='+encodeURIComponent(prefix+'/product/PC54')+'&error=expired');
        await expect(page.locator('#cl-error')).toContainText('expired');const email=page.getByLabel('Email address');await expect(email).toBeFocused();
        await email.fill('bad');await email.press('Enter');await expect(email).toHaveAttribute('aria-invalid','true');expect(events.auth).toEqual([]);
        expect(await email.evaluate(e=>getComputedStyle(e).borderColor)).toBe('rgb(153, 27, 27)');
        await email.fill('preview@example.test');await email.press('Enter');await expect(page.locator('#cl-submit')).toBeDisabled();await expect.poll(()=>events.auth.length).toBe(1);
        expect(events.auth[0]).toEqual({path:'/auth/'+type+'/request-link',body:{email:'preview@example.test',next:prefix+'/product/PC54'}});
        await state.resolveAuth();await expect(page.locator('#cl-sent-view h1')).toBeFocused();await expect(page.locator('#cl-sent-view')).toContainText('If your email is on file');
        expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
        await paper(page,type+'-sent');await page.locator('#cl-again').click();await expect(email).toBeFocused();await expect(email).toHaveValue('');clean(events);
    });
    for(const status of [429,503,0])test('CSS entry status: '+type+' '+status+' fails visibly and preserves the email for retry',async({page})=>{
        const state={auth:status},events=await open(page,file,state,'?next='+encodeURIComponent('https://example.invalid/portal'));
        await page.getByLabel('Email address').fill('preview@example.test');await page.locator('#cl-submit').click();await expect(page.locator('#cl-error')).toBeVisible();await expect(page.locator('#cl-submit')).toBeEnabled();
        await expect(page.getByLabel('Email address')).toHaveValue('preview@example.test');await expect(page.locator('#cl-sent-view')).toBeHidden();expect(events.auth[0].body).toEqual({email:'preview@example.test'});
        expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
        state.auth=200;await page.locator('#cl-submit').click();await expect(page.locator('#cl-sent-view')).toBeVisible();clean(events);
    });
}
for(const entry of fixture.pages.filter(p=>p.file.includes('success'))){const name=path.basename(entry.file,'.html');
    test('CSS entry status: '+name+' retains mockup images and captions on paper',async({page})=>{
        const settings=JSON.parse(row.OrderSettingsJSON);
        const sample='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><path d="M85 35 45 65 65 100 85 88V205H155V88L175 100 195 65 155 35Q120 60 85 35Z" fill="#34495e"/></svg>');
        settings.mockups=[{url:sample,color:'Navy',view:'Front'},{url:sample,color:'Navy',view:'Back'}];
        const events=await open(page,entry.file,{quote:[{...row,OrderSettingsJSON:JSON.stringify(settings)}]},'?quote_id=REVIEW-1042');
        await expect(page.locator('#s-done')).toBeVisible();await expect(page.locator('#s-mockups img')).toHaveCount(2);
        await expect.poll(()=>page.locator('#s-mockups img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
        await paper(page,name+'-mockups');clean(events);
    });
    test('CSS entry status: '+name+' prints the exact paid amount and server promise without email writes',async({page})=>{
        const events=await open(page,entry.file,{},'?quote_id=REVIEW-1042');await expect(page.locator('#s-done')).toBeVisible();await expect(page.locator('.tot-row.is-grand')).toHaveText('Paid$1059.84');
        await expect(page.locator('#s-ship-line')).toContainText(name.includes('caps')?'7–10 business days':'September 15, 2026');await paper(page,name);expect(events.reads).toBe(1);clean(events);
    });
    test('CSS entry status: '+name+' missing reference has only an honest error state',async({page})=>{
        const events=await open(page,entry.file);await expect(page.locator('#s-error')).toBeVisible();await expect(page.locator('#s-done')).toBeHidden();await expect(page.locator('#s-working')).toBeHidden();expect(events.reads).toBe(0);
        expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await paper(page,name+'-error');clean(events);
    });
    test('CSS entry status: '+name+' transient lookup failure recovers through existing polling',async({page})=>{
        await page.clock.install();const state={quote:503},events=await open(page,entry.file,state,'?quote_id=REVIEW-1042');await expect.poll(()=>events.reads).toBe(1);await expect(page.locator('#s-working')).toBeVisible();
        state.quote=[{...row,Status:'Payment Confirmed - ShopWorks Failed'}];await page.clock.runFor(3100);await expect(page.locator('#s-done')).toBeVisible();await expect(page.locator('#s-email-note')).toContainText('by hand');await paper(page,name+'-manual');clean(events);
    });
    test('CSS entry status: '+name+' pending webhook reaches the existing delayed state',async({page})=>{
        await page.clock.install();const state={quote:[{...row,Status:'Pending Payment'}]},events=await open(page,entry.file,state,'?quote_id=REVIEW-1042');await expect.poll(()=>events.reads).toBe(1);
        for(let i=2;i<=25;i++){await page.clock.runFor(3100);await expect.poll(()=>events.reads).toBe(i);}
        await expect(page.locator('#s-delayed')).toBeVisible();await expect(page.locator('#s-delayed-num')).toHaveText('REVIEW-1042');await expect(page.locator('#s-done')).toBeHidden();await paper(page,name+'-delayed');clean(events);
    });
}
