const path = require('node:path');
const { expect } = require('@playwright/test');
const fixture = require('../../fixtures/seasonal-christmas-products.json');
const campaign = require('../../../config/christmas-campaign.json');
const root = path.resolve(__dirname, '../../..');
const amounts = { CT104670:210, CT100617:120, CT103828:170, CTK121:85, F281:65, CT104597:45, CTGD0794:23 };
const sizesFor = style => style === 'CT104597' ? ['OSFA'] : style === 'CTGD0794' ? ['M','L','XL'] : ['S','M','L','XL','2XL','3XL','4XL'];
const estimateFor = body => {
 const items = body.items.map(item => ({ ...item, unitPrice: amounts[item.style] + (item.size === '2XL' ? 2 : 0) }));
 const subtotal = items.reduce((sum, item) => sum + item.unitPrice, 0) + 9;
 const shipping = body.deliveryMethod === 'Ship' ? 25 : 0, complimentary = body.promotionToken === 'synthetic-invitation-token';
 return { items, subtotal, box:9, shipping, referenceTotal:subtotal+shipping, total:complimentary?0:subtotal+shipping,
  complimentary, discount:complimentary?subtotal+shipping:0, taxPending:!complimentary, estimateToken:'synthetic-estimate-token' };
};
async function openChristmas(page, state={}) {
 const events={ errors:[], writes:[], unknown:[], dialogs:[], cspReports:[] };
 await page.clock.setFixedTime(new Date('2026-09-13T19:00:00Z'));
 page.on('pageerror', error => events.errors.push(error.message));
 page.on('dialog', async dialog => { events.dialogs.push(dialog.message()); await dialog.dismiss(); });
 await page.context().route('**/*', async route => {
  const req=route.request(), url=new URL(req.url()), p=url.pathname;
  if(p==='/api/csp-report' && req.method()==='POST') { events.cspReports.push(req.postDataJSON()); return route.fulfill({status:204}); }
  if(p==='/api/christmas-gift-box/campaign') return route.fulfill({ json:campaign });
  if(p.startsWith('/api/christmas-gift-box/products/')) {
   const style=p.split('/').pop(), entry=Object.values(campaign.products).flat().find(item=>item.style===style), product=fixture.products[style];
   const category=Object.entries(campaign.products).find(([,items])=>items.some(item=>item.style===style))[0];
   const colors=product.colors.filter(color=>!entry.excludedColors.includes(color.COLOR_NAME)).map(color=>({ ...color,
    pricing:{ tier:'8-23', minimum:amounts[style], bySize:Object.fromEntries(sizesFor(style).map(size=>[size,amounts[style]+(size==='2XL'?2:0)])) } }));
   return route.fulfill({status:state.failProducts?503:200,json:state.failProducts?{error:'Synthetic catalog failure'}:{...entry,type:category==='gloves'?'gloves':category.slice(0,-1),colors,minimum:amounts[style],description:product.PRODUCT_DESCRIPTION}});
  }
  if(p.startsWith('/api/sanmar/inventory/')) {
   const style=p.split('/').pop(), color=url.searchParams.get('color');
   if(state.holdInventory)await state.holdInventory;
   if(state.colorHolds?.[color])await state.colorHolds[color];
   return route.fulfill({status:state.failInventory?503:200,json:state.failInventory?{error:'Synthetic stock failure'}:{style,inventory:sizesFor(style).map(size=>({partId:style+'-'+color+'-'+size,color,size,totalQty:state.zeroStock?0:30}))}});
  }
  if(p==='/api/christmas-gift-box/gift-code') return route.fulfill({status:req.postDataJSON().code==='SYNTHETIC'?200:400,json:req.postDataJSON().code==='SYNTHETIC'?{applied:true,promotionToken:'synthetic-invitation-token'}:{error:'That gift code was not recognized.'}});
  if(p==='/api/christmas-gift-box/estimate') return route.fulfill({status:state.failEstimate?503:200,json:state.failEstimate?{error:'Current pricing is unavailable. Retry your estimate.'}:estimateFor(req.postDataJSON())});
  if(p==='/api/christmas-gift-box/requests') {
   const body=req.postDataJSON(); events.writes.push({path:p,body}); if(state.hold)await state.hold;
   if(state.failSession||state.failItem) return route.fulfill({status:503,json:{error:'The request could not be confirmed. Resume the saved request.'}});
   return route.fulfill({json:{saved:true,complete:!state.failEmail,quoteID:'XMAS-SYNTHETIC-REQUEST',quoteUrl:'/quote/XMAS-SYNTHETIC-REQUEST?k=synthetic',pricing:estimateFor(body),customerEmailSent:!state.failEmail,salesEmailSent:true,emailRetryable:!!state.failEmail,emailUncertain:false}});
  }
  if(p==='/api/files/upload' && req.method()==='POST') { events.writes.push({path:p,file:'synthetic-logo'}); return route.fulfill({status:state.failUpload?503:201,json:{externalKey:'SYNTHETIC-LOGO'}}); }
  if(p.startsWith('/api/') || !['GET','HEAD'].includes(req.method())) { events.unknown.push(req.method()+' '+p); return route.fulfill({status:503}); }
  if(['localhost','127.0.0.1'].includes(url.hostname)||['image','font','stylesheet'].includes(req.resourceType())||url.hostname==='fonts.googleapis.com'||url.hostname==='cdnjs.cloudflare.com'&&p.endsWith('.css')) return route.continue();
  events.unknown.push(req.url()); return route.fulfill({status:503});
 });
 await page.goto('/christmas-bundles.html'); await expect(page.locator('#jacketGrid .product-card')).toHaveCount(3);
 events.advance=async()=>{};
 return events;
}
async function fillDelivery(page) {
 for(const[id,value]of Object.entries({firstName:'Example',lastName:'Customer',companyName:'Example Company',email:'example@example.invalid',phone:'2535550100',address1:'123 Example Street',address2:'Suite 2',city:'Example City',state:'WA',zipCode:'98000'})) {
  if(id==='state')await page.locator('#'+id).selectOption(value); else await page.locator('#'+id).fill(value);
 }
 await page.locator('#deliveryDate').fill('2026-10-16');
}
async function goToChristmasState(page, events, mode) {
 const stop={products:0,hoodie:1,beanie:2,gloves:3}[mode];
 for(const[index,type]of ['jacket','hoodie','beanie','gloves'].entries()) {
  if(stop===index)return;
  const card=page.locator('#'+type+'Grid .product-card').first();
  await expect(card.locator('.size-btn:not([disabled])').first()).toBeVisible();
  await card.locator('.size-btn[data-size="'+(type==='beanie'?'OSFA':'L')+'"]').click();
  await card.locator('.select-btn').click(); await page.locator('#'+type+'Next').click();
 }
 if(mode==='gift-code') { await page.locator('#giftCode').fill('SYNTHETIC'); await page.locator('#applyGiftCode').click(); await expect(page.locator('#giftCodeStatus')).toContainText('Invitation verified'); return; }
 if(mode==='customize')return;
 await page.locator('#threadColors').fill('Green, White'); await page.locator('#specialInstructions').fill('Synthetic gift-box review. No real order.');
 await page.locator('#step5 [data-call="nextStep"]').click(); await fillDelivery(page);
 if(mode==='review-pickup')await page.locator('input[value="Pickup"]').check();
 if(mode==='delivery')return;
 await page.locator('#reviewBtn').click(); await expect(page.locator('#step7')).toBeVisible(); await expect(page.locator('#submitBtn')).toBeEnabled();
 if(['success','failed-session','failed-item','failed-email'].includes(mode)) { await page.locator('#submitBtn').click(); await expect(page.locator('#submissionOverlay')).not.toBeVisible({timeout:40000}); }
}
module.exports={root,openChristmas,goToChristmasState,fillDelivery,estimateFor};
