const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),fixture=require('../fixtures/brand-guide-original-content.json');
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
    await expect(page.locator('h1')).toBeVisible();return events;
}
const clean=events=>{expect(events.errors).toEqual([]);expect(events.business).toEqual([]);};
test('CSS brand guides: public aliases serve all fifteen unified pages',async({request})=>{
    for(const entry of fixture.pages){const response=await request.get('/'+path.basename(entry.file,'.html'));expect(response.status()).toBe(200);expect(await response.text()).toContain('data-storefront="brand"');}
});
for(const entry of fixture.pages){
    const name=path.basename(entry.file,'.html');
    test('CSS brand guides: '+name+' four widths and native menu',async({page})=>{
        const events=await open(page,entry);test.setTimeout(180000);
        const menu=page.locator('#sidebar'),opener=page.locator('#mobileMenuBtn');
        for(const width of [1440,768,390,320]){
            await page.setViewportSize({width,height:900});
            expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
            await page.screenshot({path:path.join(output,'brand-guide-'+name+'-'+width+'.png')});
        }
        await expect(menu).not.toBeVisible();await opener.focus();await page.keyboard.press('Enter');
        await expect(menu).toBeVisible();await expect(opener).toHaveAttribute('aria-expanded','true');
        await expect(page.locator('#drawerClose')).toBeFocused();
        await page.keyboard.press('Shift+Tab');expect(await menu.evaluate(e=>e.contains(document.activeElement))).toBe(true);
        await page.keyboard.press('Escape');await expect(menu).not.toBeVisible();await expect(opener).toBeFocused();
        await expect(opener).toHaveAttribute('aria-expanded','false');
        await opener.click();await page.locator('#drawerClose').click();await expect(opener).toBeFocused();
        await page.setViewportSize({width:768,height:900});await opener.click();await page.mouse.click(700,200);await expect(menu).not.toBeVisible();
        await opener.click();await page.setViewportSize({width:1440,height:900});await expect(menu).not.toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(/drawer-open/);clean(events);
    });
    test('CSS brand guides: '+name+' preserves search and printable content',async({page})=>{
        const events=await open(page,entry),input=page.locator('#navSearchInput');
        await input.fill('   ');await input.press('Enter');expect(new URL(page.url()).pathname).toBe('/'+entry.file);
        await page.pdf({path:path.join(output,'brand-guide-'+name+'.pdf'),format:'Letter',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
        const searches=[];await page.route('**/catalog?*',route=>{searches.push(new URL(route.request().url()).searchParams.get('q'));return route.fulfill({status:200,contentType:'text/html',body:'<h1>Mock catalogue destination</h1>'});});
        await input.fill('  hoodies & caps / tall  ');await input.press('Enter');await expect(page.locator('h1')).toHaveText('Mock catalogue destination');
        expect(searches).toEqual(['hoodies & caps / tall']);
        await page.goto('/'+entry.file);await input.fill('PC61');await page.locator('#navSearchBtn').click();await expect(page.locator('h1')).toHaveText('Mock catalogue destination');
        expect(searches).toEqual(['hoodies & caps / tall','PC61']);clean(events);
    });
}
