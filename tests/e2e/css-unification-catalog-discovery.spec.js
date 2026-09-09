const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
test.describe.configure({mode:'parallel'});test.use({reducedMotion:'reduce'});
const files=['brands.html','pages/fall-catalog-2026.html'];
const brands=[{name:'Example & Company',logo:'https://catalog.example.test/broken.svg'},{name:'Nike',logo:'https://catalog.example.test/Nike.svg'},{name:'Carhartt',logo:'https://catalog.example.test/Carhartt.svg'},{name:'Port Authority',logo:'https://catalog.example.test/PortAuthority.svg'},'Brand Without Logo'];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="260" height="200"><rect width="260" height="200" fill="#f8fafc"/><path d="M85 25 45 55 65 90 85 78V185H155V78L175 90 195 55 155 25Q120 50 85 25Z" fill="#34495e"/></svg>';
async function open(page,file,state={}){
    const events={errors:[],writes:[],reads:0};page.on('pageerror',e=>events.errors.push(e.message));
    await page.route('**/*',route=>{const req=route.request(),u=new URL(req.url());
        if(u.pathname==='/api/csp-report')return route.fulfill({status:204,body:''});
        if(u.pathname==='/'+file)return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../..',file))});
        if(!['GET','HEAD'].includes(req.method())){events.writes.push(u.pathname);return route.fulfill({status:503,body:'Business writes blocked'});}
        if(u.hostname==='catalog.example.test')return route.fulfill(u.pathname.includes('broken')?{status:404,body:''}:{contentType:'image/svg+xml',body:svg});
        if(u.pathname==='/api/all-brands'){events.reads++;if(state.brands===503)return route.fulfill({status:503,json:{error:'Offline fixture'}});return route.fulfill({json:state.brands===undefined?{brands}:state.brands});}
        if(u.pathname==='/api/products/search'&&u.searchParams.has('styleNumbers')){events.reads++;
            const styles=u.searchParams.get('styleNumbers').split(',');
            if(state.pricing===503||state.pricing==='partial'&&styles.includes('MRA452'))return route.fulfill({status:503,json:{error:'Offline fixture'}});
            if(state.pricing==='malformed')return route.fulfill({json:{data:{}}});
            const products=state.pricing==='missing'?[]:styles.map(styleNumber=>({styleNumber,displayPriceLabel:state.label===undefined?'$47.13 with embroidery':state.label,images:{display:'https://catalog.example.test/'+(state.images==='broken'?'broken':styleNumber)+'.svg'}}));
            return route.fulfill({json:{data:{products}}});
        }
        if(state.images==='broken'&&u.hostname==='cdnm.sanmar.com')return route.fulfill({status:404,body:''});
        if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Unmocked service'}});
        return route.fallback();
    });await page.goto('/'+file);await page.evaluate(()=>document.fonts.ready);return events;
}
function clean(events){expect(events.errors).toEqual([]);expect(events.writes).toEqual([]);}
async function paper(page,name){
    await page.locator('main img').evaluateAll(images=>images.forEach(img=>{img.loading='eager';}));
    await page.emulateMedia({media:'print'});
    expect(await page.locator('.fc-card').evaluateAll(cards=>cards.filter(card=>{const img=card.querySelector('img'),body=card.querySelector('.fc-card-body');return img&&getComputedStyle(img).display!=='none'&&img.getBoundingClientRect().bottom>body.getBoundingClientRect().top+1;}).map(card=>card.dataset.style))).toEqual([]);
    const blocks=await page.locator('main h1,main h2,main .fc-hero-sub,main .fc-hero-stats,main .fc-note,main .fc-card,main .fc-brand-tag,main .brand-name,main .brands-subtitle,main .catalog-result-context,main .fc-count,main [role="alert"],footer p,footer address').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&n.getClientRects().length).map(n=>n.innerText.replace(/\s+/g,' ').trim()).filter(Boolean));
    fs.writeFileSync(path.join(output,'catalog-discovery-'+name+'-print.json'),JSON.stringify({blocks}));
    await page.pdf({path:path.join(output,'catalog-discovery-'+name+'.pdf'),format:'Letter',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});await page.emulateMedia({media:'screen'});
}
for(const file of files){const name=path.basename(file,'.html');
    test('CSS catalog discovery: '+name+' four widths and contrast',async({page})=>{
        test.setTimeout(180000);const events=await open(page,file);
        await expect(page.locator(file==='brands.html'?'.brand-card':'.fc-card-price').first()).toBeVisible();
        for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
            await page.screenshot({path:path.join(output,'catalog-discovery-'+name+'-'+width+'.png')});
            if(file.includes('fall')){await page.locator('.fc-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'catalog-discovery-products-'+width+'.png')});await page.evaluate(()=>scrollTo(0,0));}
        }clean(events);
    });
    test('CSS catalog discovery: '+name+' native menu focus and quote badge survive navigation reuse',async({page})=>{
        const events=await open(page,file);await page.setViewportSize({width:390,height:844});await page.locator('#mobileMenuBtn').click();await expect(page.locator('#sidebar')).toBeVisible();
        await page.locator('#drawerClose').focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('#sidebar a[href]').last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#drawerClose')).toBeFocused();
        await page.keyboard.press('Escape');await expect(page.locator('#mobileMenuBtn')).toBeFocused();
        await page.evaluate(()=>window.QuoteCartStore.add({style:'PC54',productTitle:'Preview',color:'Black',catalogColor:'Black',qty:24,sizes:{M:24},method:'EMB'}));
        await expect(page.locator('[data-quote-badge]')).toBeVisible();await expect(page.locator('[data-quote-badge-count]')).toHaveText('1');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);clean(events);
    });
}
test('CSS catalog discovery: brand priority, named keyboard links and failed-logo fallback',async({page})=>{
    const events=await open(page,'brands.html');await expect(page.locator('.brand-card')).toHaveCount(5);await expect(page.locator('.brand-card').first()).toHaveText('Carhartt');
    await expect(page.getByRole('link',{name:'Carhartt',exact:true})).toHaveAttribute('href','/custom-carhartt');
    const noLogo=page.getByRole('link',{name:'Brand Without Logo',exact:true});await expect(noLogo).toHaveAttribute('href','/catalog?brand=Brand%20Without%20Logo');
    await expect(page.getByRole('link',{name:'Example & Company',exact:true})).toBeVisible();await expect(page.locator('img[src$="broken.svg"]')).toBeHidden();
    await page.locator('#brandSearchInput').fill('Car');await expect(page.locator('.brand-card')).toHaveCount(1);await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Carhartt',exact:true})).toBeFocused();
    await paper(page,'brands-filtered');await page.locator('#brandSearchInput').fill('');await paper(page,'brands-all');clean(events);
});
for(const bad of [503,{brands:[null]},{unexpected:true}])test('CSS catalog discovery: brand failed/malformed '+JSON.stringify(bad)+' retries without clearing search',async({page})=>{
    const state={brands:bad},events=await open(page,'brands.html',state);await expect(page.locator('#errorState')).toBeVisible();await expect(page.locator('#loadingState')).toBeHidden();
    await page.locator('#brandSearchInput').fill('Nike');state.brands={brands};await page.locator('#brandsRetry').click();await expect(page.locator('#errorState')).toBeHidden();await expect(page.locator('.brand-card')).toHaveCount(1);await expect(page.locator('#brandSearchInput')).toHaveValue('Nike');await expect(page.locator('#brandSearchInput')).toBeFocused();clean(events);
});
test('CSS catalog discovery: a successful empty brand list has an explicit message',async({page})=>{
    const state={brands:{brands:[]}},events=await open(page,'brands.html',state);await expect(page.locator('.no-brands')).toHaveText('No brands are available right now.');clean(events);
});
test('CSS catalog discovery: Fall filters, selected category and fragment focus preserve the curated list',async({page})=>{
    const events=await open(page,'pages/fall-catalog-2026.html');await expect(page.locator('.fc-card')).toHaveCount(179);await expect(page.locator('.fc-card-price').first()).toHaveText('$47.13 with embroidery');
    await page.locator('#fcSearch').fill('MRA452');await expect(page.locator('.fc-card')).toHaveCount(1);await page.locator('button[data-cat="Jackets"]').click();await expect(page.locator('button[data-cat="Jackets"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.fc-card-name a')).toHaveAttribute('href','/product.html?style=MRA452');await expect(page.locator('.fc-card-quote')).toHaveAttribute('href',/style=MRA452/);await paper(page,'fall-filtered');
    await page.locator('#fcSearch').fill('zz-no-style');await expect(page.locator('#fcEmpty')).toBeVisible();await page.locator('[data-fc-clear]').click();await expect(page.locator('.fc-card')).toHaveCount(179);
    await page.locator('#fcBrandNav a[href="#brand-nike"]').click();await expect(page).toHaveURL(/#brand-nike$/);await expect(page.locator('#brand-nike')).toBeFocused();clean(events);
});
for(const bad of [503,'malformed','partial'])test('CSS catalog discovery: Fall '+bad+' stays visibly incomplete and retry preserves filters',async({page})=>{
    const state={pricing:bad},events=await open(page,'pages/fall-catalog-2026.html',state);await expect(page.locator('#fcAlert')).toBeVisible();await expect(page.locator('#fcRetry')).toBeEnabled();
    await page.locator('#fcSearch').fill('MRA452');await expect(page.locator('.fc-card')).toHaveCount(1);await expect(page.locator('.fc-card-price-link')).toHaveAttribute('href','/product.html?style=MRA452');
    await paper(page,'fall-'+bad);state.pricing=undefined;await page.locator('#fcRetry').click();await expect(page.locator('#fcAlert')).toBeHidden();await expect(page.locator('.fc-card-price')).toHaveText('$47.13 with embroidery');await expect(page.locator('#fcSearch')).toHaveValue('MRA452');clean(events);
});
test('CSS catalog discovery: verified absent products request pricing',async({page})=>{
    const state={pricing:'missing'},events=await open(page,'pages/fall-catalog-2026.html',state);await expect(page.locator('#fcAlert')).toBeHidden();await expect(page.locator('.fc-card-price-link').first()).toContainText('Request pricing');await expect(page.locator('.fc-card-name a').first()).toHaveAttribute('href',/^\/pages\/request-a-quote.html\?/);clean(events);
});
test('CSS catalog discovery: hostile server price text never creates markup',async({page})=>{
    const label='<img src=x onerror="alert(1)"> $0.00';const events=await open(page,'pages/fall-catalog-2026.html',{label});await expect(page.locator('.fc-card-price').first()).toHaveText(label);await expect(page.locator('.fc-card-price img')).toHaveCount(0);clean(events);
});
test('CSS catalog discovery: broken images leave style labels and all product links usable',async({page})=>{
    const events=await open(page,'pages/fall-catalog-2026.html',{images:'broken'});await page.locator('#fcSearch').fill('MRA452');await expect(page.locator('.fc-card')).toHaveCount(1);await page.locator('.fc-card').scrollIntoViewIfNeeded();await expect(page.locator('.fc-card-fallback')).toBeVisible();await expect(page.locator('.fc-card-name a')).toHaveAttribute('href','/product.html?style=MRA452');clean(events);
});
test('CSS catalog discovery: full Fall paper retains every product and current server price',async({page})=>{
    test.setTimeout(180000);const events=await open(page,'pages/fall-catalog-2026.html');await expect(page.locator('.fc-card-price')).toHaveCount(179);await paper(page,'fall-all');await expect(page.locator('.fc-card')).toHaveCount(179);clean(events);
});
