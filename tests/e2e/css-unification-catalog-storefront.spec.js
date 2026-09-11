const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/catalog-storefront-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CATALOG_STOREFRONT_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,events,{paper=true}={}){
 const states=[];fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(state.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  await page.screenshot({path:path.join(out,'catalog-storefront-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 check(expect,events);
 const file='tests/fixtures/catalog-storefront-'+name+'-original-browser.json',record={name,states,actions:events.actions,dialogs:events.dialogs};
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic home/catalog/product browser contract.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const k of ['title','url','ids','fields','links','selection'])expect(states[i][k],name+' '+k).toEqual(before.states[i][k]);expect(events.actions).toEqual(before.actions);}
 if(paper){await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'catalog-storefront-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
}
for(const [name,url]of [['home','/'],['catalog','/catalog'],['product','/product.html?style=PC61']])test('CSS catalog storefront original: '+name,async({page})=>{
 const events=await open(page,{url,original:capture});
 if(name==='catalog')await expect(page.locator('.pcard')).toHaveCount(4);
 if(name==='product'){await expect(page.locator('#productTitle')).not.toHaveText('Loading…');await page.waitForFunction(()=>window.PdpConfigurator?.getSelection()?.price);}
 await evidence(page,name,events);
});

async function productReady(page,method,qty){
 await page.waitForFunction(({method,qty})=>{const s=window.PdpConfigurator?.getSelection();return s?.status==='ok'&&s.price&&(!method||s.methodId===method)&&(!qty||s.qty===qty);},{method,qty});
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
