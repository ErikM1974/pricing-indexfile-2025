const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/catalog-storefront-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CATALOG_STOREFRONT_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,events,{paper=true}={}){
 const states=[];fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  if(!capture){
   await page.evaluate(async()=>{const images=[...document.images];for(const img of images)img.loading='eager';await Promise.all(images.map(img=>img.decode().catch(()=>{})));});
   expect(await page.locator('body').evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(width-25);
   if(await page.locator('.catalog-shell').count()){
    const gap=await page.locator('.catalog-shell').evaluate(shell=>shell.querySelector('.catalog-results').getBoundingClientRect().top-shell.getBoundingClientRect().top);
    expect(gap,'catalog results start directly below the heading and promotion').toBeLessThan(50);
    if(width<=960)await expect(page.locator('#filtersRail')).toHaveCSS('position','fixed');
   }
  }
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(state.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  await page.screenshot({path:path.join(out,'catalog-storefront-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,events);
 const file='tests/fixtures/catalog-storefront-'+name+'-original-browser.json',record={name,states,actions:events.actions,dialogs:events.dialogs};
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic home/catalog/product browser contract.\n');}}
 else{
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  // Native dialogs remove closed off-canvas links from visible output. The masthead
  // also wraps at different widths. Preserve those destinations in the DOM contract
  // below, while comparing every remaining visible content link without changes.
  const navigation=await page.locator('.util-strip a[href],.nav-bar a[href],.sidebar a[href]').evaluateAll(nodes=>nodes.map(n=>JSON.stringify({href:n.getAttribute('href'),text:n.textContent.replace(/\s+/g,' ').trim()})));
  const contentLinks=links=>links.filter(link=>!navigation.includes(JSON.stringify(link)));
  for(let i=0;i<states.length;i++){
   const expectedIds={...before.states[i].ids};
   // The legacy sample-drawer stylesheet exposed the mobile-only filter close
   // button on desktop. Its repaired visibility is checked explicitly below.
   if(states[i].width===1440)delete expectedIds.filtersClose;
   expect(states[i].ids,name+' ids').toEqual(expectedIds);
   for(const k of ['title','url','fields','selection'])expect(states[i][k],name+' '+k).toEqual(before.states[i][k]);
   expect(contentLinks(states[i].links),name+' content links').toEqual(contentLinks(before.states[i].links));
  }
  expect(events.actions).toEqual(before.actions);
 }
 if(paper){await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'catalog-storefront-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
}
for(const [name,url]of [['home','/'],['catalog','/catalog'],['product','/product.html?style=PC61']])test('CSS catalog storefront original: '+name,async({page})=>{
 const events=await open(page,{url,original:capture});
 if(name==='catalog')await expect(page.locator('.pcard')).toHaveCount(4);
 if(name==='product'){await expect(page.locator('#productTitle')).not.toHaveText('Loading…');await page.waitForFunction(()=>window.PdpConfigurator?.getSelection()?.price);}
 await evidence(page,name,events);
});

async function productReady(page,method,qty){
 await page.waitForFunction(({method,qty})=>{const s=window.PdpConfigurator?.getSelection();return s?.status==='ok'&&s.price&&(!method||s.methodId===method)&&(!qty||s.qty===qty&&Object.values(s.sizes||{}).reduce((a,b)=>a+b,0)===qty);},{method,qty});
 // Every method reprices independently; a settled selected method does not mean
 // the other method cards are ready for the immutable visible-content snapshot.
 await expect(page.locator('#cfgMethods')).not.toContainText('Getting your live price…');
}
async function remember(page,events,label){events.actions.push({label,selection:await page.evaluate(()=>window.PdpConfigurator?.getSelection()||null),url:new URL(page.url()).pathname+new URL(page.url()).search});}

test('CSS catalog storefront: catalog filters sorting history and quick view',async({page})=>{
 const events=await open(page,{url:'/catalog',original:capture});await expect(page.locator('.pcard')).toHaveCount(4);
 await page.locator('[name="f-category"][value="T-Shirts"]').check();await expect(page.locator('.pcard')).toHaveCount(2);
 await page.locator('#sortSelect').selectOption('name_desc');await expect(page).toHaveURL(/sort=name_desc/);
 await expect(page.locator('.pcard').first()).toHaveAttribute('data-style','PC54');
 await page.goBack();await expect(page).not.toHaveURL(/sort=/);
 await page.locator('.pcard-quick[data-style="PC61"]').click();await expect(page.locator('#qvColorName')).toHaveText('Jet Black');
 await page.locator('.qv-swatch[data-color-index="1"]').click();await expect(page.locator('#qvDetailsLink')).toHaveAttribute('href',/color=Brilliant%20Orange.*pricingHeading/);
 await evidence(page,'catalog-quick-view',events);
 await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Escape');await expect(page.locator('#quickViewModal')).toBeHidden();
 await expect(page.locator('.pcard-quick[data-style="PC61"]')).toBeFocused();
});
test('CSS catalog storefront: catalog search clear and brand filter',async({page})=>{
 const events=await open(page,{url:'/catalog',original:capture});await expect(page.locator('.pcard')).toHaveCount(4);
 await page.locator('#navSearchInput').fill('PC61');await page.locator('#navSearchBtn').click();await expect(page.locator('.pcard')).toHaveCount(1);
 await expect(page).toHaveURL(/q=PC61/);await remember(page,events,'search');
 await page.locator('#clearAllFilters').click();await expect(page.locator('.pcard')).toHaveCount(4);
 await page.locator('[name="f-brand"][value="Port Authority"]').check();await expect(page.locator('.pcard')).toHaveCount(1);
 await evidence(page,'catalog-brand',events);
});
test('CSS catalog storefront: catalog pagination keeps the final four products',async({page})=>{
 const events=await open(page,{url:'/catalog',pages:true,original:capture});await expect(page.locator('.pcard')).toHaveCount(48);
 await page.locator('#pager [data-page="2"]').first().click();await expect(page).toHaveURL(/page=2/);await expect(page.locator('.pcard')).toHaveCount(4);
 await expect(page.locator('#resultsStatus')).toHaveText('Showing 49–52 of 52 products');await evidence(page,'catalog-final-page',events);
});
for(const mode of ['empty','searchFailed','rulesFailed'])test('CSS catalog storefront: catalog '+mode,async({page})=>{
 const state={url:'/catalog?q=missing&method=emb',original:capture,[mode]:true},events=await open(page,state);
 if(mode==='rulesFailed')await expect(page.locator('#alertSlot')).toContainText('Decoration filter unavailable');
 else await expect(page.locator(mode==='empty'?'#resultsGrid':'#alertSlot')).toContainText(mode==='empty'?'No products found':'try again',{ignoreCase:true});
 await evidence(page,'catalog-'+mode,events);
});
test('CSS catalog storefront: mobile filters remain usable',async({page})=>{
 const events=await open(page,{url:'/catalog',original:capture});await expect(page.locator('.pcard')).toHaveCount(4);
 await page.setViewportSize({width:390,height:900});await page.locator('#filtersOpen').click();
 await page.locator('[name="f-category"][value="Caps"]').check();await expect(page.locator('#filtersApply')).toContainText('1 result');
 await page.locator('#filtersApply').click();await expect(page.locator('.pcard')).toHaveCount(1);
 await evidence(page,'catalog-mobile-filter',events);
});
test('CSS catalog storefront: home browse drawer keeps navigation destinations',async({page})=>{
 const events=await open(page,{url:'/',original:capture});await page.locator('#allCategoriesTile').click();
 await expect(page.locator('#sidebar')).toHaveClass(/show/);await evidence(page,'home-browse',events,{paper:false});
 await page.keyboard.press('Escape');await expect(page.locator('#sidebar')).not.toHaveClass(/show/);
});
for(const mode of ['productFailed','productEmpty','missing','stockFailed','out','pricingFailed'])test('CSS catalog storefront: product '+mode,async({page})=>{
 const state={url:mode==='missing'?'/product.html':'/product.html?style=PC61',original:capture,[mode]:true},events=await open(page,state);
 if(['productFailed','productEmpty','missing'].includes(mode))await expect(page.locator('#pdpFatal')).toBeVisible();
 else if(mode==='pricingFailed'){await expect(page.locator('#cfgRetryAll')).toBeVisible();await expect(page.locator('#cfgAddToQuote')).toBeDisabled();}
 else{await productReady(page);await expect(page.locator('#inventoryBody')).toContainText(mode==='stockFailed'?'Retry':'OUT',{ignoreCase:true});}
 await evidence(page,'product-'+mode,events);
 if(mode==='productFailed'){state.productFailed=false;await page.locator('#fatalRetry').click();await productReady(page);await remember(page,events,'product retry');check(expect,events);}
 if(mode==='pricingFailed'){state.pricingFailed=false;await page.locator('#cfgRetryAll').click();await productReady(page);await remember(page,events,'price retry');check(expect,events);}
});
for(const [method,loc,qty]of [['emb','frontBack',6],['capemb','frontBack',24],['dtg','fullFront',12],['dtg','frontBack',24],['scp','frontBack',48],['dtf','leftChest',24],['dtf','frontBack',24]])test('CSS catalog storefront: product '+method+' '+loc+' '+qty,async({page})=>{
 const events=await open(page,{url:'/product.html?style='+(method==='capemb'?'C112':'PC61'),original:capture,allMethods:true});
 await productReady(page);await page.locator('[data-method="'+method+'"]').click();await page.locator('[data-loc="'+loc+'"]').click();
 await page.locator('#cfgQtyInput').fill(String(qty));await page.locator('#cfgQtyInput').blur();
 if(method==='scp'){await page.locator('#cfgInkInput').fill('2');await page.locator('#cfgInkInput').dispatchEvent('change');}
 await productReady(page,method,qty);await expect(page.locator('#cfgMatrix')).toContainText(method==='capemb'?'Price per cap':'Price per piece');
 await page.locator('#swatchGrid .pdp-swatch').nth(1).click();await productReady(page,method,qty);
 await remember(page,events,'configured');await page.locator('#cfgAddToQuote').click();
 const items=await page.evaluate(()=>window.QuoteCartStore.getItems());expect(items).toHaveLength(1);expect(items[0].catalogColor).toBe('BrillOrng');expect(items[0].qty).toBe(qty);
 events.actions.push({label:'successful quote cart payload',items});await evidence(page,'product-'+method+'-'+loc+'-'+qty,events);
});
test('CSS catalog storefront: product sample picker and stock keys',async({page})=>{
 const events=await open(page,{url:'/product.html?style=PC61',original:capture});await productReady(page);
 await page.locator('#ctaSample').click();await expect(page.locator('#cart-drawer')).toHaveClass(/open/);
 await page.locator('#drawer-color-swatches .color-swatch').first().click();await page.locator('#drawer-size-buttons .size-button').filter({hasText:/^M$/}).click();
 await page.locator('#drawer-add-to-cart').click();await expect(page.locator('#cart-count')).toHaveText('1');
 events.actions.push({label:'sample draft',cart:await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sampleCart')))});
 await evidence(page,'product-sample',events,{paper:false});
});
test('CSS catalog storefront: home search lands on the existing catalog URL',async({page})=>{
 const events=await open(page,{url:'/',original:capture});await page.locator('#navSearchInput').fill('PC61');await page.locator('#navSearchBtn').click();
 await expect(page).toHaveURL(/\/catalog\?q=PC61$/);await expect(page.locator('.pcard')).toHaveCount(1);await evidence(page,'home-search',events,{paper:false});
});
test('CSS catalog storefront: DTF minimum is visible and can recover',async({page})=>{
 const events=await open(page,{url:'/product.html?style=PC61',allMethods:true,original:capture});await productReady(page);
 await page.locator('[data-method="dtf"]').click();await page.locator('#cfgQtyInput').fill('6');await page.locator('#cfgQtyInput').blur();
 await page.waitForFunction(()=>window.PdpConfigurator?.getSelection()?.status==='belowmin');await expect(page.locator('#cfgAddToQuote')).toBeDisabled();
 await evidence(page,'product-dtf-minimum',events);
 await page.locator('#cfgQtyPlus').click();await productReady(page,'dtf',12);await expect(page.locator('#cfgAddToQuote')).toBeEnabled();check(expect,events);
});

test('CSS catalog storefront: DTG complete synthetic cost ladder',async({page})=>{
 const events=await open(page,{url:'/product.html?style=PC61',allMethods:true,completeDtg:true,original:capture});await productReady(page);
 await page.locator('[data-method="dtg"]').click();await page.locator('[data-loc="frontBack"]').click();
 await page.locator('#cfgQtyInput').fill('12');await page.locator('#cfgQtyInput').blur();await productReady(page,'dtg',12);
 await remember(page,events,'complete DTG cost ladder');await evidence(page,'product-dtg-complete-cost-ladder-settled',events);
});

test('CSS catalog storefront: original quantity edit exposes the previous price',async({page})=>{
 const events=await open(page,{url:'/product.html?style=PC61',allMethods:true,completeDtg:true,original:true});await productReady(page);
 const result=await page.evaluate(()=>{
  const input=document.getElementById('cfgQtyInput');input.value='12';input.dispatchEvent(new Event('input',{bubbles:true}));
  const selection=window.PdpConfigurator.getSelection();return {selection,addDisabled:document.getElementById('cfgAddToQuote').disabled};
 });
 expect(result.selection.qty).toBe(12);expect(result.selection.status).toBe('ok');expect(Object.values(result.selection.sizes).reduce((a,b)=>a+b,0)).toBe(24);expect(result.addDisabled).toBe(false);check(expect,events);
});

test('CSS catalog storefront: changed quantity withholds the old price and handoff',async({page})=>{
 test.skip(capture,'Regression for the demonstrated stale-price state.');
 const events=await open(page,{url:'/product.html?style=PC61',allMethods:true,completeDtg:true});await productReady(page);
 await page.locator('[data-method="dtg"]').click();await page.locator('[data-loc="frontBack"]').click();await productReady(page,'dtg',24);
 const result=await page.evaluate(()=>{
  const input=document.getElementById('cfgQtyInput');input.value='12';input.dispatchEvent(new Event('input',{bubbles:true}));
  return {selection:window.PdpConfigurator.getSelection(),addDisabled:document.getElementById('cfgAddToQuote').disabled,email:decodeURIComponent(document.getElementById('cfgEmailQuote').href)};
 });
 expect(result.selection.status).toBe('loading');expect(result.selection.price).toBe(null);expect(result.addDisabled).toBe(true);expect(result.email).toContain('Quantity: 12');expect(result.email).not.toContain('Online price:');
 await productReady(page,'dtg',12);await expect(page.locator('#cfgTotal')).toContainText('$330.96');await expect(page.locator('#cfgAddToQuote')).toBeEnabled();check(expect,events);
});

for(const [name,url]of [['home','/'],['catalog','/catalog'],['product','/product.html?style=PC61']])test('CSS catalog storefront: native menu keyboard and original destinations '+name,async({page})=>{
 test.skip(capture,'Current keyboard repair; original DOM is independently reconstructed below.');
 const events=await open(page,{url});
 if(name==='catalog')await expect(page.locator('.pcard')).toHaveCount(4);
 if(name==='product')await productReady(page);
 const before=await page.context().newPage(),originalEvents=await open(before,{url,original:true});
 if(name==='catalog')await expect(before.locator('.pcard')).toHaveCount(4);
 if(name==='product')await productReady(before);
 const navigation=p=>p.locator('.util-strip a[href],.nav-bar a[href],.sidebar a[href]').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),text:n.textContent.replace(/\s+/g,' ').trim()})));
 await expect.poll(()=>navigation(page)).toEqual(await navigation(before));check(expect,originalEvents);await before.close();
 await page.setViewportSize({width:390,height:900});await page.locator('#mobileMenuBtn').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#sidebar')).toHaveJSProperty('open',true);await expect(page.locator('#drawerClose')).toBeFocused();
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.activeElement.closest('#sidebar')!==null)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#sidebar')).toHaveJSProperty('open',false);await expect(page.locator('#mobileMenuBtn')).toBeFocused();
 check(expect,events);
});

test('CSS catalog storefront: filter close is mobile only and sample colors work with keys',async({page})=>{
 test.skip(capture,'Current accessibility repair.');
 const events=await open(page,{url:'/catalog'});await expect(page.locator('.pcard')).toHaveCount(4);
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#filtersClose')).toBeHidden();
 await page.setViewportSize({width:390,height:900});await page.locator('#filtersOpen').click();await expect(page.locator('#filtersClose')).toBeFocused();
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('#filtersRail'))).toBe(true);
 await page.keyboard.press('Tab');await expect(page.locator('#filtersClose')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#filtersOpen')).toBeFocused();check(expect,events);
 const productEvents=await open(page,{url:'/product.html?style=PC61'});await productReady(page);
 await page.locator('#ctaSample').click();await expect(page.locator('#drawer-close')).toBeFocused();
 const drawerAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(drawerAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 const color=page.locator('#drawer-color-swatches button').first();await color.focus();await page.keyboard.press('Space');await expect(color).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(page.locator('#cart-drawer')).toHaveJSProperty('open',false);await expect(page.locator('#ctaSample')).toBeFocused();check(expect,productEvents);
});
