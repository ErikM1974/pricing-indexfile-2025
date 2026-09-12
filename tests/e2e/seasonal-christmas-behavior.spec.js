const {test,expect}=require('@playwright/test');
const {openChristmas,goToChristmasState}=require('./helpers/seasonal-christmas-browser');
test('Christmas 2026: printing preserves confirmation and draft until Done',async({page})=>{
 const events=await openChristmas(page);await goToChristmasState(page,events,'success');
 const dialog=page.locator('#successModal');await expect(dialog).toBeVisible();
 const before=await dialog.innerText();await page.pdf({format:'Letter',printBackground:true});
 await expect(dialog).toBeVisible();expect(await dialog.innerText()).toBe(before);
 await expect(page.locator('#giftPrintConfirmation')).toBeHidden();
 await expect(page.locator('#firstName')).toHaveValue('Example');expect(events.writes).toHaveLength(2);
 await dialog.getByRole('button',{name:'Done',exact:true}).click();
 await expect(dialog).toBeHidden();await expect(page.locator('#step1')).toBeVisible();
 await expect(page.locator('#firstName')).toHaveValue('');expect(events.errors).toEqual([]);
});
test('Christmas 2026: catalog failure is visible and recoverable',async({page})=>{
 const state={failProducts:true},events=await openChristmas(page,state);
 await expect(page.locator('#giftBoxError')).toContainText('could not load');await expect(page.locator('#jacketNext')).toBeDisabled();
 state.failProducts=false;await page.locator('#retryChristmasProducts').click();
 await expect(page.locator('#jacketGrid .color-swatch').first()).toBeVisible();await expect(page.locator('#giftBoxError')).toBeHidden();
 expect(events.writes).toEqual([]);expect(events.errors).toEqual([]);
});
test('Christmas 2026: unavailable stock blocks selection and retries retain size upcharges',async({page})=>{
 const state={failInventory:true},events=await openChristmas(page,state),card=page.locator('#jacketGrid .product-card').first();
 await card.locator('.color-swatch').first().click();await expect(card.locator('.product-error')).toBeVisible();await expect(card.locator('.select-btn')).toBeDisabled();
 state.failInventory=false;await card.locator('.inventory-retry').click();await card.locator('[data-size="2XL"]').click();await card.locator('.select-btn').click();
 await expect(page.locator('#totalValueAmount')).toHaveText('$210.00');expect(events.writes).toEqual([]);expect(events.errors).toEqual([]);
});
test('Christmas 2026: changing color immediately invalidates a selected size',async({page})=>{
 const state={},events=await openChristmas(page,state),card=page.locator('#jacketGrid .product-card').first();
 await card.locator('.color-swatch').first().click();await card.locator('[data-size="L"]').click();await card.locator('.select-btn').click();
 let release;state.holdInventory=new Promise(resolve=>{release=resolve;});
 await card.locator('.color-swatch').nth(1).click();await expect(page.locator('#jacketNext')).toBeDisabled();await expect(card.locator('.select-btn')).toBeDisabled();
 release();await expect(card.locator('[data-size="L"]')).toBeVisible();await expect(card.locator('.select-btn')).toBeDisabled();expect(events.errors).toEqual([]);
});
test('Christmas 2026: details and image zoom support the keyboard',async({page})=>{
 const events=await openChristmas(page),card=page.locator('#jacketGrid .product-card').first();
 await card.locator('summary').focus();await page.keyboard.press('Enter');await expect(card.locator('details')).toHaveAttribute('open','');
 await card.locator('.product-image').focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog',{name:'Product image'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(card.locator('.product-image')).toBeFocused();expect(events.errors).toEqual([]);
});
test('Christmas 2026: invalid delivery dates preserve the contact draft',async({page})=>{
 const events=await openChristmas(page);await goToChristmasState(page,events,'delivery');
 await page.locator('#deliveryDate').fill('2026-10-17');await page.locator('#reviewBtn').click();await expect(page.locator('#giftBoxError')).toContainText('weekday');
 await expect(page.locator('#email')).toHaveValue('example@example.invalid');
 await page.locator('#deliveryDate').fill('2026-09-14');await page.locator('#reviewBtn').click();await expect(page.locator('#step6')).toBeVisible();expect(events.writes).toEqual([]);
});
test('Christmas 2026: pending submissions share one captured order',async({page})=>{
 let release;const state={hold:new Promise(resolve=>{release=resolve;})},events=await openChristmas(page,state);
 await goToChristmasState(page,events,'review-ship');await page.locator('#submitBtn').click();await expect(page.locator('#submissionOverlay')).toBeVisible();await expect(page.locator('#submitBtn')).toBeDisabled();
 await page.evaluate(()=>{document.getElementById('firstName').value='Late edit';window.submitOrder();window.submitOrder();});
 release();await expect(page.locator('#successModal')).toBeVisible();
 expect(events.writes).toHaveLength(2);expect(events.writes[0].body.CustomerName).toBe('Example Customer');expect(events.writes[1].body.Shipping_Address).toBe('123 Example Street\nSuite 2');
 const emails=await page.evaluate(()=>window.__emails);expect(emails[0].data.thread_color_1).toBe('Green');expect(emails[0].data.address_2).toBe('Suite 2');expect(events.errors).toEqual([]);
});
for(const stage of ['session','item'])test('Christmas 2026: retry '+stage+' without repeating confirmed saves',async({page})=>{
 const state={[stage==='session'?'failSession':'failItem']:true},events=await openChristmas(page,state);
 await goToChristmasState(page,events,'failed-'+stage);await expect(page.locator('#successModal')).toBeHidden();await expect(page.locator('#giftBoxError')).toContainText('retained');expect(await page.evaluate(()=>window.__emails)).toEqual([]);
 state.failSession=false;state.failItem=false;await page.locator('#submitBtn').click();await expect(page.locator('#successModal')).toBeVisible();
 const sessions=events.writes.filter(w=>w.path.endsWith('sessions'));expect(sessions).toHaveLength(stage==='session'?2:1);
 if(stage==='session')expect(sessions[0].body).toEqual(sessions[1].body);expect(events.errors).toEqual([]);
});
test('Christmas 2026: email retry creates no second order',async({page})=>{
 const events=await openChristmas(page,{failEmail:true});await goToChristmasState(page,events,'failed-email');await expect(page.locator('#christmasConfirmationStatus')).toContainText('has not been sent');
 await page.evaluate(()=>{window.__failEmail=false;});await page.locator('#retryChristmasEmail').click();
 await expect(page.locator('#christmasConfirmationStatus')).toContainText('both confirmation emails have been sent');expect(events.writes).toHaveLength(2);expect(events.errors).toEqual([]);
});
test('Christmas 2026: failed logo upload blocks saves and emails until retry',async({page})=>{
 const state={failUpload:true},events=await openChristmas(page,state);await goToChristmasState(page,events,'customize');
 await page.locator('#logoFile').setInputFiles({name:'synthetic-logo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-synthetic-fixture')});await expect(page.locator('#uploadPreview')).toContainText('synthetic-logo.pdf');
 await page.locator('#step5 [data-call="nextStep"]').click();
 for(const[id,value]of Object.entries({firstName:'Example',lastName:'Customer',companyName:'Example Company',email:'example@example.invalid',phone:'2535550100',address1:'123 Example Street',city:'Example City',zipCode:'98000'}))await page.locator('#'+id).fill(value);
 await page.locator('#state').selectOption('WA');await page.locator('#deliveryDate').fill('2026-10-16');await page.locator('#reviewBtn').click();await page.locator('#submitBtn').click();
 await expect(page.locator('#giftBoxError')).toContainText('Logo upload failed');expect(events.writes.map(w=>w.path)).toEqual(['/api/files/upload']);expect(await page.evaluate(()=>window.__emails)).toEqual([]);
 state.failUpload=false;await page.locator('#submitBtn').click();await expect(page.locator('#successModal')).toBeVisible();expect(events.writes.at(-1).body.Image_Upload).toBe('SYNTHETIC-LOGO');expect(events.errors).toEqual([]);
});
