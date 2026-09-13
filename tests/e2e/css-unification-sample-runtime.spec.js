const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {open,check}=require('./helpers/catalog-storefront-browser');
const out=path.join(__dirname,'screenshots/css-unification');
test.use({reducedMotion:'reduce',timezoneId:'America/Los_Angeles',locale:'en-US'});
for(const [name,url] of [['catalog','/catalog'],['product','/product.html?style=PC61']]) {
 test('CSS sample runtime: '+name+' notifications and icons',async({page})=>{
  const events=await open(page,{url});
  if(name==='catalog')await expect(page.locator('.pcard')).toHaveCount(4);
  else await page.waitForFunction(()=>window.PdpConfigurator?.getSelection()?.price);
  const iconCount=()=>page.locator('link[rel="stylesheet"][href*="/fontawesome/"]').count();
  await page.evaluate(()=>window.sampleCartEnsureIcons());
  const before=await iconCount();expect(before).toBe(1);
  const cartBefore=await page.evaluate(()=>sessionStorage.getItem('sampleCart'));
  for(const width of [1440,768,390,320]) {
   await page.setViewportSize({width,height:1000});
   for(const type of ['success','warning','info']) {
    await page.evaluate(type=>{
     document.querySelectorAll('.drawer-toast').forEach(n=>n.remove());
     window.sampleCart.showNotification('Core Cotton Tee (Brilliant Orange) — size M: '+(type==='warning'?'currently out of stock':type==='success'?'added — FREE sample':'already in your sample cart'),type);
    },type);
    await expect(page.locator('.drawer-toast.show')).toHaveCount(1);
    const toast=page.locator('.drawer-toast.show');
    const box=await toast.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    await expect(toast).toHaveAttribute('role',type==='warning'?'alert':'status');
    fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'sample-runtime-'+name+'-'+type+'-'+width+'.png')});
   }
  }
  expect(await page.evaluate(()=>sessionStorage.getItem('sampleCart'))).toBe(cartBefore);
  expect(await iconCount()).toBe(before);
  // The real picker stays open after an add or an out-of-stock result. Its
  // notification must remain above the modal, with its text safely escaped.
  await page.evaluate(()=>{document.querySelectorAll('.drawer-toast').forEach(n=>n.remove());window.cartDrawer.open();});
  await expect(page.locator('#cart-drawer')).toHaveJSProperty('open',true);
  await expect(page.locator('#drawer-close')).toBeFocused();
  await page.evaluate(()=>window.sampleCart.showNotification('<img src=x onerror=alert(1)> — stock check unavailable','warning'));
  const toast=page.locator('.drawer-toast.show');await expect(toast).toHaveCount(1);
  expect(await toast.locator('img').count()).toBe(0);
  await expect(page.locator('#drawer-close')).toBeFocused();
  expect(await toast.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  await page.screenshot({path:path.join(out,'sample-runtime-'+name+'-modal-320.png')});
  await expect(toast).toHaveCount(0,{timeout:5000});
  check(expect,events);
 });
}

test('CSS sample runtime: unavailable stock keeps the picker and visible warning',async({page})=>{
 const events=await open(page,{url:'/product.html?style=PC61',out:true});
 await page.waitForFunction(()=>window.PdpConfigurator?.getSelection()?.price);
 await page.locator('#ctaSample').click();
 await page.locator('#drawer-color-swatches .color-swatch').first().click();
 await page.locator('#drawer-size-buttons .size-button').filter({hasText:/^M$/}).click();
 await page.locator('#drawer-add-to-cart').click();
 const warning=page.locator('.drawer-toast[role="alert"]');
 await expect(warning).toContainText('currently out of stock');
 await expect(page.locator('#cart-count')).toHaveText('0');
 await expect(page.locator('#cart-drawer')).toHaveJSProperty('open',true);
 await expect(page.locator('#drawer-add-to-cart')).toBeFocused();
 expect(await warning.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await page.emulateMedia({media:'print'});await expect(warning).toBeHidden();
 await page.emulateMedia({media:'screen'});
 await page.keyboard.press('Escape');await expect(page.locator('#ctaSample')).toBeFocused();
 check(expect,events);
});
