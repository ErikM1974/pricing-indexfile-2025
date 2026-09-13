const { test, expect } = require('@playwright/test');
const { openChristmas, goToChristmasState, fillDelivery } = require('./helpers/seasonal-christmas-browser');
const quoteBrowser = require('./helpers/quote-view-browser');
const fs = require('node:fs'), path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
function holidayReceipt(complimentary=false,draft=false) {
 const id='XMAS-'+'A1'.repeat(14),prices=[210,85,45,23],subtotal=372;
 const customer={dueDate:'2026-10-16',jacketEmbLocation:'right-chest',hoodieEmbLocation:'left-chest',threadColors:'Green and white',specialInstructions:'Confirm our company logo before stitching.',holidayTeamSize:'40',holidayGiftDate:'2026-12-15',imageUpload:'SYNTHETIC-LOGO'};
 const session={QuoteID:id,Status:draft?'Draft':'Open',CustomerName:'Example Customer',CompanyName:'Example Company',CustomerEmail:'customer@example.invalid',Phone:'2535550100',CreatedAt:'2026-09-10',SalesRepEmail:'sales@nwcustomapparel.com',SalesRepName:'NWCA Sales',TotalQuantity:4,ShipToAddress:'123 Example Street',ShipToCity:'Milton',ShipToState:'WA',ShipToZip:'98354',
  PaymentTerms:'Request summary only. No payment is due. Staff will confirm artwork, availability, delivery, sales tax and any additional artwork charges before issuing a final quote or invoice.',TotalAmount:complimentary?0:subtotal,SubtotalAmount:subtotal,ShippingFee:complimentary?0:25,TaxAmount:0,TaxRate:0,PaidToDate:0,Discount:complimentary?subtotal:0,DiscountReason:complimentary?'Verified holiday sample invitation; shipping also waived':'',
  Notes:JSON.stringify({source:'holiday-gift-box',requestType:complimentary?'complimentary-sample':'public-priced',share_token:'synthetic'}),OrderSettingsJSON:JSON.stringify({source:'holiday-gift-box',requestType:complimentary?'complimentary-sample':'public-priced',deliveryMethod:'Ship',customer})};
 const items=['CT104670','CTK121','CT104597','CTGD0794'].map((StyleNumber,index)=>({QuoteID:id,LineNumber:index+1,StyleNumber,ProductName:['Carhartt Storm Defender jacket','Carhartt midweight hoodie','Carhartt beanie','Carhartt gloves'][index],Color:'Black',ColorCode:'Black',Quantity:1,SizeBreakdown:JSON.stringify({[index===2?'OSFA':'L']:1}),FinalUnitPrice:prices[index],BaseUnitPrice:prices[index],LineTotal:prices[index],EmbellishmentType:index===3?'blank':'embroidery',ImageURL:'http://localhost:3400/__invoice-fixture/product.png'}));
 items.push({StyleNumber:'XMAS-BOX',ProductName:'Holiday gift box',Quantity:1,FinalUnitPrice:9,LineTotal:9,EmbellishmentType:'fee'},{StyleNumber:'SHIP',ProductName:'Shipping',Quantity:1,FinalUnitPrice:session.ShippingFee,LineTotal:session.ShippingFee,EmbellishmentType:'fee'});
 return {id,session,items,full:{quoteId:id,status:session.Status,sessionRaw:session,quoteItems:items,shopWorks:null,originalSubmission:null,shipStation:null}};
}
async function receiptEvidence(page,name) {
 const output=path.join(__dirname,'screenshots/css-unification');fs.mkdirSync(output,{recursive:true});
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(await page.locator('#quote-id-header').count())expect(await page.locator('#quote-id-header').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  if([1440,320].includes(width))await page.screenshot({path:path.join(output,name+'-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(output,name+'.pdf'),format:'Letter',printBackground:true});
}
for(const [gift,staff,draft] of [[false,false,false],[true,false,false],[false,true,false],[false,true,true]])test('holiday receipt: complimentary='+gift+' staff='+staff+' draft='+draft,async({page})=>{
 const fixture=holidayReceipt(gift,draft),events=await quoteBrowser.open(page,{fixture,staff,token:true});
 await expect(page.locator('#quote-content')).toBeVisible();await expect(page.locator('#holiday-request-note')).toContainText('No payment has been collected');
 await expect(page.locator('#holiday-request-note')).toContainText('Planned team gifts: 40');await expect(page.locator('#holiday-request-note a')).toHaveAttribute('href',/\/api\/files\/SYNTHETIC-LOGO$/);
 await expect(page.locator('#holiday-request-note')).toContainText('Ship to: 123 Example Street, Milton, WA, 98354');
 await expect(page.locator('.grand-total .value').first()).toHaveText(gift?'$0.00':'$397.00');
 await expect(page.locator('#quote-status')).toHaveText(draft?'Save incomplete':'Awaiting staff review');
 await expect(page.locator('.terms-list')).toContainText('No payment is due');
 await expect(page.locator('.print-only-terms')).toContainText('No payment is due');
 await expect(page.locator('#items-container')).toContainText('Size OSFA');await expect(page.locator('#items-container')).toContainText('Size L');
 await expect(page.locator('#accept-quote-btn')).toBeHidden();await expect(page.locator('#deposit-panel')).toBeHidden();await expect(page.locator('#open-invoice-link')).toBeHidden();
 await receiptEvidence(page,'holiday-quote-'+(gift?'gift':'priced')+'-'+(staff?'staff':'customer')+(draft?'-draft':''));quoteBrowser.check(expect,events);expect(events.actions).toEqual([]);
});
test('paid public offer uses live sizes, then code verification makes the request complimentary', async ({page}) => {
 const events=await openChristmas(page); await expect(page.locator('#jacketGrid')).not.toContainText('FREE'); await expect(page.locator('#jacketGrid .size-quantity').first()).toContainText('30 available');
 await page.locator('#giftCode').fill('WRONG'); await page.locator('#applyGiftCode').click(); await expect(page.locator('#giftCodeStatus')).toContainText('not recognized');
 await page.locator('#giftCode').fill('SYNTHETIC'); await page.locator('#applyGiftCode').click(); await expect(page.locator('#giftCodeStatus')).toContainText('Invitation verified');
 await goToChristmasState(page,events,'review-ship'); await expect(page.locator('#orderEstimateTotal')).toHaveText('$0.00');
 await page.locator('#submitBtn').click(); await expect(page.locator('#successModal')).toBeVisible(); expect(events.writes).toHaveLength(1);
 expect(events.writes[0].body).not.toHaveProperty('total'); expect(events.writes[0].body.items).toHaveLength(4); expect(events.errors).toEqual([]);
});
test('paid pickup removes shipping and removing code restores paid estimate', async ({page}) => {
 const events=await openChristmas(page); await goToChristmasState(page,events,'review-pickup'); await expect(page.locator('#orderShippingCharge')).toHaveText('$0.00'); await expect(page.locator('#orderEstimateTotal')).toHaveText('$372.00');
 await page.locator('#giftCode').fill('SYNTHETIC'); await page.locator('#applyGiftCode').click(); await expect(page.locator('#orderEstimateTotal')).toHaveText('$0.00');
 await page.locator('#removeGiftCode').click(); await expect(page.locator('#orderEstimateTotal')).toHaveText('$372.00');
});
test('unknown inventory is visible, retry recovers, zero stock remains disabled', async ({page}) => {
 const state={failInventory:true},events=await openChristmas(page,state),card=page.locator('#jacketGrid .product-card').first();
 await expect(card.locator('.product-error')).toBeVisible(); await expect(card.locator('.select-btn')).toBeDisabled(); state.failInventory=false;
 await card.locator('.inventory-retry').click(); await expect(card.locator('.size-btn').first()).toBeEnabled(); state.zeroStock=true;
 await card.locator('.color-swatch').last().click(); await expect(card.locator('.stock-status')).toContainText('out of stock'); await expect(card.locator('.select-btn')).toBeDisabled(); expect(events.writes).toEqual([]);
});
test('slow older color response cannot replace the current color', async ({page}) => {
 let release;const state={colorHolds:{Black:new Promise(resolve=>{release=resolve;})}},events=await openChristmas(page,state),card=page.locator('#jacketGrid .product-card').first();
 await card.locator('.color-swatch').last().click(); await expect(card.locator('.size-btn').first()).toBeEnabled(); const selected=await card.locator('.color-swatch.selected').getAttribute('data-color-code');
 release(); await expect(card.locator('.color-swatch.selected')).toHaveAttribute('data-color-code',selected); expect(events.errors).toEqual([]);
});
test('delivery validates weekdays and two-week lead time', async ({page}) => {
 const events=await openChristmas(page); await goToChristmasState(page,events,'delivery');
 await page.locator('#deliveryDate').fill('2026-10-03'); await page.locator('#reviewBtn').click(); await expect(page.locator('#giftBoxError')).toContainText('weekday');
 await page.locator('#deliveryDate').fill('2026-09-15'); await page.locator('#reviewBtn').click(); await expect(page.locator('#step6')).toBeVisible(); expect(events.writes).toEqual([]);
});
test('unknown estimate blocks submit and retains details for retry', async ({page}) => {
 const state={failEstimate:true},events=await openChristmas(page,state); await goToChristmasState(page,events,'delivery'); await page.locator('#reviewBtn').click();
 await expect(page.locator('#retryEstimate')).toBeVisible(); await expect(page.locator('#submitBtn')).toBeDisabled(); state.failEstimate=false;
 await page.locator('#retryEstimate').click(); await expect(page.locator('#submitBtn')).toBeEnabled(); await expect(page.locator('#reviewDelivery')).toContainText('Example Company'); expect(events.writes).toEqual([]);
});
for(const stage of ['session','item'])test('uncertain '+stage+' save resumes one captured request after reload',async({page})=>{
 const state={[stage==='session'?'failSession':'failItem']:true},events=await openChristmas(page,state); await goToChristmasState(page,events,'failed-'+stage);
 await expect(page.locator('#requestRecovery')).toBeVisible(); const before=events.writes[0].body; state.failSession=false; state.failItem=false;
 await page.reload(); await expect(page.locator('#requestRecovery')).toBeVisible(); await page.getByRole('button',{name:'Resume saved request'}).click();
 await expect(page.locator('#successModal')).toBeVisible(); expect(events.writes[1].body).toEqual(before); expect(events.errors).toEqual([]);
});
test('pending submissions capture details and prevent double submission',async({page})=>{
 let release;const state={hold:new Promise(resolve=>{release=resolve;})},events=await openChristmas(page,state); await goToChristmasState(page,events,'review-ship');
 await page.locator('#submitBtn').click(); await expect(page.locator('#submissionOverlay')).toBeVisible(); await page.evaluate(()=>{document.getElementById('firstName').value='Late edit';window.submitOrder();});
 release(); await expect(page.locator('#successModal')).toBeVisible(); expect(events.writes).toHaveLength(1); expect(events.writes[0].body.customer.firstName).toBe('Example');
});
test('email failure reports saved request and retries with the same request key',async({page})=>{
 const state={failEmail:true},events=await openChristmas(page,state); await goToChristmasState(page,events,'failed-email'); await expect(page.locator('#christmasConfirmationStatus')).toContainText('request is saved');
 state.failEmail=false; await page.locator('#retryChristmasEmail').click(); await expect(page.locator('#christmasConfirmationStatus')).toContainText('accepted by our email service'); expect(events.writes[1].body.requestKey).toBe(events.writes[0].body.requestKey);
});
test('failed logo upload creates no request; retry captures artwork',async({page})=>{
 const state={failUpload:true},events=await openChristmas(page,state); await goToChristmasState(page,events,'customize');
 await page.locator('#logoFile').setInputFiles({name:'synthetic-logo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-synthetic')}); await page.locator('#step5 [data-call="nextStep"]').click(); await fillDelivery(page); await page.locator('#reviewBtn').click(); await page.locator('#submitBtn').click();
 await expect(page.locator('#giftBoxError')).toBeVisible(); expect(events.writes.filter(w=>w.path.endsWith('/requests'))).toHaveLength(0); state.failUpload=false; await page.locator('#submitBtn').click();
 await expect(page.locator('#successModal')).toBeVisible(); expect(events.writes.at(-1).body.customer.imageUpload).toBe('SYNTHETIC-LOGO');
});
test('keyboard image dialog restores focus and printing retains confirmation until Done',async({page})=>{
 const events=await openChristmas(page); const image=page.locator('#jacketGrid .product-image').first(); await image.focus(); await image.press('Enter'); await expect(page.locator('#imageZoomModal')).toBeVisible(); await page.keyboard.press('Escape'); await expect(image).toBeFocused();
 await goToChristmasState(page,events,'success'); await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint'))); await expect(page.locator('#giftPrintConfirmation')).toContainText('XMAS-SYNTHETIC-REQUEST');
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint'))); await expect(page.locator('#successModal')).toBeVisible(); await page.getByRole('button',{name:'Done',exact:true}).click(); await expect(page.locator('#step1')).toBeVisible();
 expect(events.errors).toEqual([]); expect(events.unknown).toEqual([]);
});
