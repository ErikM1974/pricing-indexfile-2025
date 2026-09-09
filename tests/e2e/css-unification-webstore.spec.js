const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),fixture=require('../fixtures/webstore-original-content.json');
const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.describe.configure({mode:'parallel'});test.use({reducedMotion:'reduce'});
async function open(page,entry){
    const events={errors:[],business:[]};page.on('pageerror',e=>events.errors.push(e.message));
    await page.route('**/*',route=>{
        const r=route.request(),p=new URL(r.url()).pathname;
        if(p==='/api/csp-report')return route.fulfill({status:204,body:''});
        if(!['GET','HEAD'].includes(r.method())||p.startsWith('/api/')){events.business.push(p);return route.fulfill({status:503,json:{error:'Business calls blocked'}});}
        return route.fallback();
    });
    await page.goto('/'+entry.file);await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('h1')).toHaveText(entry.headings[0]);
    return events;
}
const clean=events=>{expect(events.errors).toEqual([]);expect(events.business).toEqual([]);};
test('CSS webstore: all twelve public route aliases serve the unified source',async({request})=>{
    for(const entry of fixture.pages){
        const response=await request.get('/'+path.basename(entry.file,'.html'));
        expect(response.status()).toBe(200);
        expect(await response.text()).toContain('data-webstore="'+path.basename(entry.file,'.html')+'"');
    }
});
for(const entry of fixture.pages){
    const name=path.basename(entry.file,'.html');
    test('CSS webstore: '+name+' four widths and keyboard navigation',async({page})=>{
        test.setTimeout(180000);const events=await open(page,entry);
        for(const width of [1440,768,390,320]){
            await page.setViewportSize({width,height:900});
            expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
            await page.screenshot({path:path.join(output,'webstore-'+name+'-'+width+'.png')});
        }
        const link=page.locator('.sticky-nav a[href^="#"]').first(),href=await link.getAttribute('href');
        await link.focus();await page.keyboard.press('Enter');
        await expect(page.locator(href)).toBeFocused();
        expect(new URL(page.url()).hash).toBe(href);
        const details=page.locator('.faq details').first();
        await details.locator('summary').focus();await page.keyboard.press('Enter');
        await expect(details).toHaveAttribute('open');
        await expect(details.locator('p').first()).toBeVisible();
        await page.keyboard.press('Enter');await expect(details).not.toHaveAttribute('open');
        clean(events);
    });
    test('CSS webstore: '+name+' prints every FAQ and restores disclosure state',async({page})=>{
        const events=await open(page,entry),details=page.locator('.faq details');
        await details.first().locator('summary').click();
        const before=await details.evaluateAll(nodes=>nodes.map(n=>n.open));
        await page.pdf({path:path.join(output,'webstore-'+name+'.pdf'),format:'Letter',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
        expect(await details.evaluateAll(nodes=>nodes.map(n=>n.open))).toEqual(before);
        clean(events);
    });
}
