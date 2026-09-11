const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {ready,logo,products,variants}=require('./helpers/polar-camel-browser'),{snapshot,check}=require('./helpers/specialty-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),original=process.env.CAPTURE_SPECIALTY_CALCULATORS_ORIGINAL==='1',phase=original?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
function record(name,value){const f='tests/fixtures/specialty-calculators-polar-camel-'+name+'-original-browser.json',full=path.join(root,f);if(original&&!fs.existsSync(full)){fs.writeFileSync(full,JSON.stringify(value,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+f+' — immutable synthetic Polar Camel browser and native financial evidence.\n');}else {
 const prior=JSON.parse(fs.readFileSync(full,'utf8'));
 if(original)expect(value).toEqual(prior);
 else if(value.values){const normalize=v=>({...v,values:v.values.map(row=>({...row,inventory:row.inventory.replace(/\s+/g,' ').trim(),quote:row.quote.trim()}))});expect(normalize(value)).toEqual(normalize(prior));}
 else {
  expect(value.mocked).toEqual(prior.mocked);expect(value.dialogs).toEqual(prior.dialogs);
  for(const state of value.states){const old=prior.states.find(v=>v.width===state.width);expect(state.title).toBe(old.title);expect(state.url).toBe(old.url);
   const core=['product-name','product-sku','product-description','ltmk-color-name','ltmk-quote-result','ltmk-logo-name','ltmk-size-pct','ltmk-warning-title','ltmk-warning-body'];
   if(name==='failed-product'){expect(state.ids['error-message']).toBe(old.ids['error-message']);expect(state.tables).toEqual([]);expect(state.headings).toContain('Polar Camel tumblers');}
   else {for(const id of core)if(id in old.ids)expect(state.ids[id],id).toBe(old.ids[id]);
    expect(state.fields.filter(v=>v.id.startsWith('color-')||v.id.startsWith('ltmk-'))).toEqual(old.fields.filter(v=>v.id.startsWith('color-')||v.id.startsWith('ltmk-')));
    if(name==='failed-inventory'){expect(state.ids['inventory-status']).toContain('Unknown');expect(state.ids['tumblerInventoryWarning']).toContain('Unable to verify');}
    else {expect(state.tables).toEqual(old.tables);expect(state.ids['inventory-status']).toBe(old.ids['inventory-status']);}
    if(name==='failed-policy')expect(state.ids['tumblerPolicyWarning']).toContain('default settings');
   }
  }
  fs.writeFileSync(path.join(out,'specialty-calculators-polar-camel-'+name+'-current-browser.json'),JSON.stringify(value,null,2)+'\n');
 }
}
}
async function evidence(page,name,events){const states=[];fs.mkdirSync(out,{recursive:true});for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{scrollTo(0,document.body.scrollHeight);await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));scrollTo(0,0);});const state=await snapshot(page);delete state.ids['color-announcement'];const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});if(!original){expect(state.overflow).toBe(false);expect(axe.violations).toEqual([]);}await page.screenshot({path:path.join(out,'specialty-calculators-polar-camel-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}check(expect,events);record(name,{states,mocked:events.mocked,dialogs:events.dialogs});await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.pdf({path:path.join(out,'specialty-calculators-polar-camel-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});}
for(const mode of ['normal','zero-stock','failed-product','failed-policy','failed-inventory','logo','artwork-warning','lightbox'])test('CSS specialty Polar Camel: '+mode,async({page})=>{
 const events=await ready(page,{original,color:mode==='zero-stock'?'maroon':undefined,failedProduct:mode==='failed-product',failedPolicy:mode==='failed-policy',failedInventory:mode==='failed-inventory'});
 if(mode==='zero-stock')await page.locator('#ltmk-qty').fill('8');
 if(['logo','artwork-warning'].includes(mode)){await page.locator('#ltmk-file-input').setInputFiles(logo(mode==='artwork-warning'));await expect(page.locator('#ltmk-logo-name')).toContainText('sample-');if(mode==='logo'){await expect(page.locator('#ltmk-size-step')).toBeVisible();await page.locator('#ltmk-qty').fill('8');}else await expect(page.locator('#ltmk-warning')).toBeVisible();}
 if(mode==='lightbox')await page.locator('.gallery-thumbnail').first().click();
 await evidence(page,mode,events);
});
test('CSS specialty Polar Camel: mobile drawer',async({page})=>{const events=await ready(page,{original});await page.setViewportSize({width:390,height:1000});await page.locator('#mobileMenuBtn').click();await expect(page.locator('#sidebar')).toHaveClass(/show/);await evidence(page,'drawer',events);});
test('CSS specialty Polar Camel: all four colors and native tier boundaries',async({page})=>{
 const events=await ready(page,{original}),values=[];
 for(const [sku] of variants){if(sku!=='LTM752')await page.locator('label[for="color-'+sku+'"]').click();await expect(page.locator('#product-sku')).toHaveText(sku);await page.locator('#ltmk-preview-loading').waitFor({state:'hidden'});if(!original)await page.waitForFunction(()=>!window.laserTumblerPage.inventoryPending);const table=await page.locator('.pricing-table').innerText(),inventory=await page.locator('#inventory-status').innerText();for(const qty of [1,11,12,23,24,119,120,239,240,479,480,959,960,9999,0,-1]){await page.locator('#ltmk-qty').fill(String(qty));values.push({sku,qty,table,inventory,quote:await page.locator('#ltmk-quote-result').innerText()});}}
 check(expect,events);record('tiers-colors',{values,mocked:events.mocked});
});
test('CSS specialty Polar Camel: real logo editing, errors and local PNG download',async({page})=>{
 const events=await ready(page,{original});await page.locator('#ltmk-file-input').setInputFiles(logo());await expect(page.locator('#ltmk-download-step')).toBeVisible();
 const canvas=page.locator('#ltmk-canvas'),before=await canvas.evaluate(n=>n.toDataURL());await canvas.focus();await page.keyboard.press('ArrowRight');expect(await canvas.evaluate(n=>n.toDataURL())).not.toEqual(before);await page.locator('#ltmk-center-btn').click();expect(await canvas.evaluate(n=>n.toDataURL())).toEqual(before);
 await page.locator('#ltmk-size-slider').fill('90');await expect(page.locator('#ltmk-size-pct')).toHaveText('90');await page.locator('#ltmk-fit-btn').click();const downloadEvent=page.waitForEvent('download');await page.locator('#ltmk-download-btn').click();const download=await downloadEvent;expect(download.suggestedFilename()).toBe('LTM752-sample_mark.png');const file=path.join(out,'specialty-calculators-polar-camel-download-'+phase+'.png');await download.saveAs(file);const bytes=fs.readFileSync(file);expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([1800,1800]);if(!original)expect(bytes.equals(fs.readFileSync(path.join(out,'specialty-calculators-polar-camel-download-original.png')))).toBe(true);
 await page.locator('#ltmk-logo-remove').click();await expect(page.locator('#ltmk-size-step')).toBeHidden();await expect(page.locator('#ltmk-download-step')).toBeHidden();await page.locator('#ltmk-file-input').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('synthetic invalid image')});await expect(page.locator('#ltmk-preview-error')).toContainText("couldn't read");check(expect,events);
});
test('CSS specialty Polar Camel: cached product prices with altered live policy',async({page})=>{
 await page.addInitScript(({products})=>{sessionStorage.setItem('polar_camel_16oz_variants_v2',JSON.stringify({timestamp:new Date('2026-09-11T18:29:00.000Z').getTime(),products:products.map(p=>({...p,tiers:[{range:'1-11',quantity:11,customerPrice:19.5,description:'Small Order',handlingFee:50},{range:'12-23',quantity:23,customerPrice:19.5,description:'Small Order'},{range:'24-119',quantity:24,customerPrice:18.5,description:'Standard Order'},{range:'120-239',quantity:120,customerPrice:17.5,description:'Volume Order'},{range:'240+',quantity:240,customerPrice:16.5,description:'Bulk Order'}]}))}));},{products:products()});
 const events=await ready(page,{original,alternate:true,slowPolicy:true});await page.evaluate(()=>window.laserTumblerPage.apiService.ready);await page.locator('#ltmk-qty').fill('8');check(expect,events);if(original)record('cached-policy',{table:await page.locator('.pricing-table').innerText(),quote:await page.locator('#ltmk-quote-result').innerText(),mocked:events.mocked});else {const prior=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/specialty-calculators-polar-camel-cached-policy-original-browser.json'),'utf8'));expect(await page.locator('#ltmk-quote-result').innerText()).toBe(prior.quote);expect(events.mocked).toEqual(prior.mocked);expect(await page.locator('.price-large').allTextContents()).toEqual(['$19.00','$19.00','$18.00','$17.00','$16.50']);await expect(page.locator('.pricing-info')).toContainText('$65.00');}
});


test('CSS specialty Polar Camel: product retry recovers',async({page})=>{
 test.skip(original);const state={failedProduct:true},events=await ready(page,state);await expect(page.locator('#page-content')).toBeHidden();state.failedProduct=false;await page.locator('#tumblerRetry').click();await expect(page.locator('#mockup-section')).toBeVisible();await expect(page.locator('#tumblerErrorPanel')).toBeHidden();check(expect,events);
});
for(const option of ['incompletePolicy','failedMetadata','failedImage','missingWholesale'])test('CSS specialty Polar Camel: '+option+' stays visible',async({page})=>{
 test.skip(original);const events=await ready(page,{[option]:true});
 if(option==='incompletePolicy')await expect(page.locator('#tumblerPolicyWarning')).toContainText('default settings');
 if(option==='failedMetadata')await expect(page.locator('#tumblerPreviewWarning')).toContainText('approximate silver');
 if(option==='failedImage'){await expect(page.locator('#ltmk-preview-error')).toContainText("couldn't load");await expect(page.locator('#ltmk-canvas')).toBeHidden();}
 if(option==='missingWholesale'){await expect(page.locator('#error-message')).toBeVisible();await expect(page.locator('#page-content')).toBeHidden();}
 check(expect,events);
});
test('CSS specialty Polar Camel: stock failure does not claim zero stock for small orders',async({page})=>{
 test.skip(original);const events=await ready(page,{failedInventory:true});await page.locator('#ltmk-qty').fill('8');await expect(page.locator('#ltmk-quote-result')).toContainText('confirm availability');await expect(page.locator('#ltmk-quote-result')).not.toContainText('no local stock');check(expect,events);
});
test('CSS specialty Polar Camel: latest keyboard color owns stock, prices and preview',async({page})=>{
 test.skip(original);const events=await ready(page,{slowInventory:'LTM763',slowImage:'LTM763'});await page.locator('#color-LTM752').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#ltmk-quote-result')).toContainText('Checking stock');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>!window.laserTumblerPage.inventoryPending);await page.locator('#ltmk-preview-loading').waitFor({state:'hidden'});
 await expect(page.locator('#product-sku')).toHaveText('LTM765');await expect(page.locator('.local-inventory')).toContainText('5 units');await expect(page.locator('#color-LTM765')).toBeChecked();await expect(page.locator('#ltmk-color-name')).toHaveText('Green');
 const pixels=await page.locator('#ltmk-canvas').evaluate(n=>n.toDataURL());await page.waitForTimeout(500);expect(await page.locator('#ltmk-canvas').evaluate(n=>n.toDataURL())).toBe(pixels);await expect(page.locator('.local-inventory')).toContainText('5 units');check(expect,events);
});
test('CSS specialty Polar Camel: drawer and product image own keyboard focus',async({page})=>{
 test.skip(original);const events=await ready(page);await page.setViewportSize({width:390,height:1000});await page.locator('#mobileMenuBtn').click();await expect(page.locator('#drawerClose')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.locator('#sidebar .drawer-contact a').last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('#drawerClose')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#mobileMenuBtn')).toBeFocused();await expect(page.locator('#sidebar')).toBeHidden();
 const trigger=page.locator('.gallery-item').first();await trigger.focus();await page.keyboard.press('Enter');await expect(page.locator('.lightbox-close')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('.lightbox-close')).toBeFocused();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();check(expect,events);
});
