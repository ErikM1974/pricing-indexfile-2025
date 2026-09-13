const {test,expect}=require('@playwright/test');
const {open}=require('./helpers/quote-builders-browser');
const {evidence}=require('./helpers/quote-builder-workflow-review');
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1';
test.setTimeout(120000);
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});


async function addProduct(page,method){
 if(method==='dtf')await page.waitForFunction(()=>document.getElementById('loading-overlay')?.style.display==='none');
 const search=page.locator('#product-search');await search.click();await search.pressSequentially('PC54',{delay:60});
 const row=page.locator('tr[data-style]').first(),suggestion=page.locator('.suggestion-item').first();
 await Promise.race([row.waitFor({state:'visible'}),suggestion.waitFor({state:'visible'})]);
 if(!await row.isVisible())await suggestion.click();await expect(row).toBeVisible();
 const input=row.locator('input[data-size="M"]');
 if(await input.isDisabled()){await row.locator('.color-picker-selected').first().click();await row.locator('.color-picker-option').first().click();}
 await input.fill('48');await input.dispatchEvent('change');
 if(method==='dtf'){await page.locator('.guided-step[data-step="1"]').click();await page.locator('input[name="front-location"][value="left-chest"]').check();await page.locator('.guided-step[data-step="0"]').click();}
 await expect.poll(()=>page.locator('#grand-total-with-tax,#grand-total').first().textContent()).not.toMatch(/^\s*\$0\.00\s*$/);
 await page.waitForLoadState('networkidle');
}

for(const method of ['embroidery','screenprint','dtf'])for(const scene of ['products','decoration','customer','review','workbench','colors','invoice','extended-sizes','customer-entered','save'])test('CSS quote builders: '+method+' '+scene,async({page,context})=>{
 page.setDefaultTimeout(15000);
 // The local-only schema assertion rejects intentional null draft IDs in SCP/DTF.
 // Use a fully intercepted synthetic production origin for their original draft output.
 const origin=scene==='invoice'&&method!=='embroidery'?'https://quote-builder.example.invalid':'';
 const e=await open(page,{original,save:scene==='save',url:origin+'/quote-builders/'+method+'-quote-builder.html'});
 await addProduct(page,method);
 if(scene==='colors')await page.locator('tr[data-style] .color-picker-selected').first().click();
 if(scene==='extended-sizes')await page.locator('tr[data-style] .xxxl-picker-btn').first().click();
 if(['decoration','customer','review'].includes(scene))await page.locator('.guided-step[data-step="'+({decoration:1,customer:2,review:3}[scene])+'"]').click();
 if(scene==='workbench')await page.locator('.guided-toggle').click();
 if(['invoice','customer-entered','save'].includes(scene)){
  await page.locator('.guided-step[data-step="2"]').click();
  if(!await page.locator('#customer-name').isVisible())await page.locator('.customer-manual summary').click();
  await page.locator('#customer-name').fill('Example Customer');await page.locator('#customer-email').fill('customer@example.invalid');
  if(scene==='customer-entered'){await page.locator('#company-name').fill('Example Company');await evidence(page,method+'-'+scene,e);return;}
  await page.locator('.guided-step[data-step="3"]').click();
  if(scene==='save'){await page.locator('.btn-share-link').click();await expect(page.locator('#quote-share-modal')).toBeVisible();await evidence(page,method+'-'+scene,e);return;}
  const popup=context.waitForEvent('page',{timeout:15000});await page.locator('[data-call="printQuote"]').click();
  const invoice=await popup;await invoice.waitForLoadState('domcontentloaded');await invoice.waitForFunction(()=>document.body.innerText.includes('Example Customer'));
  await evidence(invoice,method+'-invoice',e);return;
 }
 await evidence(page,method+'-'+scene,e);
});

for(const scene of ['import','shipping','design-gallery'])test('CSS quote builders: embroidery '+scene,async({page})=>{
 page.setDefaultTimeout(15000);
 const e=await open(page,{original,url:'/quote-builders/embroidery-quote-builder.html'});await addProduct(page,'embroidery');
 if(scene==='import')await page.locator('button[data-call="openShopWorksImportModal"]').click();
 if(scene==='shipping'){await page.locator('.guided-step[data-step="3"]').click();await page.locator('[data-call="openShippingModal"]').click();await page.locator('#ship-mode-ship').click();}
 if(scene==='design-gallery'){await page.locator('.guided-step[data-step="1"]').click();await page.locator('[data-call="openDesignSearchModal"]').first().click();}
 await evidence(page,'embroidery-'+scene,e);
});
