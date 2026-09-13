const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const AxeBuilder=require('@axe-core/playwright').default;
const {openChristmas,goToChristmasState}=require('./helpers/seasonal-christmas-browser');
const out=path.join(__dirname,'screenshots/css-unification');
// September 2026 deliberately replaces the original free-only business flow.
// Original browser/financial fixtures remain immutable historical evidence.
for(const mode of ['products','hoodie','beanie','gloves','gift-code','customize','delivery','review-ship','review-pickup','success','failed-session','failed-item','failed-email'])test('CSS Christmas gift box: '+mode,async({page})=>{
 const events=await openChristmas(page,{failSession:mode==='failed-session',failItem:mode==='failed-item',failEmail:mode==='failed-email'}); await goToChristmasState(page,events,mode);
 const states=[];
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getAttribute('src')&&n.getClientRects().length).map(n=>{n.loading='eager';return n.decode().catch(()=>{});}));window.scrollTo(0,0);});
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,missingImages:[...document.images].filter(n=>n.getClientRects().length&&n.getAttribute('src')&&!n.naturalWidth).map(n=>n.src),text:document.querySelector('main').innerText}));
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.overflow).toBe(false);expect(result.missingImages).toEqual([]);expect(axe.violations).toEqual([]); states.push({width,...result});
  await page.screenshot({path:path.join(out,'specialty-calculators-christmas-'+mode+'-current-'+width+'.png'),fullPage:true});
 }
 if(['review-ship','success','failed-session','failed-item','failed-email'].includes(mode))await expect(page.locator('#orderEstimateTotal')).toHaveText('$397.00');
 if(mode==='review-pickup')await expect(page.locator('#orderEstimateTotal')).toHaveText('$372.00');
 expect(events.errors).toEqual([]);expect(events.unknown).toEqual([]);
 fs.writeFileSync(path.join(out,'seasonal-christmas-'+mode+'-current-browser.json'),JSON.stringify({mode,states,events},null,2)+'\n');
 await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({media:'print'});
 await page.pdf({path:path.join(out,'specialty-calculators-christmas-'+mode+'-current.pdf'),format:'Letter',printBackground:true});
});
