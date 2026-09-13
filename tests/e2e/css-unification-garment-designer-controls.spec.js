const {test,expect}=require('@playwright/test');
const fs=require('fs');
const {open,addArt,snapshot,check}=require('./helpers/garment-designer-browser');
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});

test('CSS garment designer controls: resizing retains whole canvas and artwork geometry',async({page})=>{
 const e=await open(page);await addArt(page);
 const before=(await snapshot(page)).entries;
 for(const width of [768,390,320,1440]){
  await page.setViewportSize({width,height:1000});
  await expect.poll(()=>page.evaluate(()=>{
   const a=document.querySelector('#stage').getBoundingClientRect(),b=document.querySelector('#canvasHolder canvas').getBoundingClientRect();
   return b.width>0&&b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1;
  })).toBe(true);
  expect((await snapshot(page)).entries).toEqual(before);
 }
 check(expect,e);
});

test('CSS garment designer controls: placement dialog traps focus and returns its opener',async({page})=>{
 const e=await open(page);const opener=page.getByRole('button',{name:'⬆ Add Front Logo',exact:true});
 await opener.focus();await page.keyboard.press('Enter');
 const dialog=page.locator('#placementChooser');
 await expect(dialog.locator('button').first()).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');await expect(dialog.locator('button').first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
 expect(await page.locator('main').evaluate(n=>n.inert)).toBe(false);check(expect,e);
});

test('CSS garment designer controls: nested details close one dialog at a time',async({page})=>{
 const e=await open(page);await addArt(page,{dst:true});await page.locator('#threadColorsBtn').click();
 const first=page.locator('#threadColorsModal'),second=page.locator('#artDetailsModal');
 const opener=first.getByRole('button',{name:'Art Details',exact:true});await opener.click();
 await expect(second).toBeVisible();await page.keyboard.press('Escape');
 await expect(second).not.toBeVisible();await expect(first).toBeVisible();await expect(opener).toBeFocused();
 await page.keyboard.press('Escape');await expect(first).not.toBeVisible();await expect(page.locator('#threadColorsBtn')).toBeFocused();
 check(expect,e);
});

test('CSS garment designer controls: form keyboard shortcuts cannot edit background artwork',async({page})=>{
 const e=await open(page);await addArt(page);const before=(await snapshot(page)).entries;
 await page.evaluate(()=>{window.__artRequestSeed={designId:'990001',company:'Example Company',contactEmail:'customer@example.invalid'};});
 await page.locator('#sendCustomerBtn').click();await page.locator('#custName').fill('Example Customer');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');
 expect((await snapshot(page)).entries).toEqual(before);
 await page.locator('#custModalCancel').click();await expect(page.locator('#sendCustomerBtn')).toBeFocused();
 expect(await page.locator('main').evaluate(n=>n.inert)).toBe(false);check(expect,e);
});

test('CSS garment designer controls: proof and specification keep original printable content',async({browser})=>{
 const records=[];
 for(const original of [true,false]){
  const context=await browser.newContext({baseURL:'http://127.0.0.1:3000',timezoneId:'America/Los_Angeles',locale:'en-US'}),page=await context.newPage();
  const e=await open(page,{original});await addArt(page);
  const record=await page.evaluate(()=>{
   buildProofSheet(current());const proof=$('specSheet').textContent.replace(/\s+/g,' ').trim();
   buildSpecSheet(current());const spec=$('specSheet').textContent.replace(/\s+/g,' ').trim();
   return{proof,spec};
  });records.push(record);check(expect,e);await context.close();
 }
 expect(records[1]).toEqual(records[0]);
});

test('CSS garment designer controls: print lifecycle restores form and mockup state',async({page})=>{
 const e=await open(page);await addArt(page);const before=(await snapshot(page)).entries;
 await page.locator('#proofBtn').click();await expect(page.locator('body')).toHaveClass(/print-spec/);
 expect(await page.evaluate(()=>window.__prints)).toBe(1);
 // Older code removed the sheet after three seconds while print preview was still open.
 await page.waitForTimeout(3200);await expect(page.locator('body')).toHaveClass(/print-spec/);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await expect(page.locator('body')).not.toHaveClass(/print-spec/);
 await page.locator('#sendSteveBtn').click();await expect(page.locator('#steveModal')).toHaveClass(/open/);
 await page.evaluate(()=>window.print());await expect(page.locator('#steveModal')).toHaveClass(/designer-print-active/);
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await expect(page.locator('#steveModal')).not.toHaveClass(/designer-print-active/);
 await expect(page.locator('#steveModal')).toHaveClass(/open/);
 expect((await snapshot(page)).entries).toEqual(before);check(expect,e);
});

test('CSS garment designer controls: PNG download preserves export dimensions',async({page})=>{
 const e=await open(page);await addArt(page);
 const dimensions=await page.evaluate(()=>{const c=getCleanMock(current());return{width:c.width,height:c.height};});
 const downloaded=page.waitForEvent('download');await page.locator('#dlBtn').click();const file=await downloaded;
 expect(file.suggestedFilename()).toMatch(/\.png$/);const bytes=fs.readFileSync(await file.path());
 expect(bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
 expect({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}).toEqual(dimensions);
 check(expect,e);
});

test('CSS garment designer controls: shared form upload remains keyboard operable',async({page})=>{
 const e=await open(page);await addArt(page);await page.locator('#sendSteveBtn').click();
 const upload=page.locator('#gsf-file-drop');await expect(upload).toBeVisible();await upload.focus();
 const chooser=page.waitForEvent('filechooser');await page.keyboard.press('Enter');
 expect((await chooser).isMultiple()).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#steveModal')).not.toBeVisible();
 check(expect,e);
});
