const {open}=require('./specialty-calculators-browser');
const bundle=require('../../fixtures/pricing/scp-bundle-PC61.json'),codes=require('../../fixtures/pricing/service-codes.json');
async function ready(page,state={}) {
 state.requests ||= [];
 await page.context().addInitScript(()=>{
  window.close=()=>{};
  const nativeOpen=window.open.bind(window);
  window.open=(...args)=>{const popup=nativeOpen(...args);if(popup){popup.print=()=>{window.__invoicePrints=(window.__invoicePrints||0)+1;};popup.close=()=>{};}return popup;};
 });
 const events=await open(page,{original:state.original,url:'/calculators/screenprint-customer/index.html',route:async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/@emailjs/browser@3/'))return {contentType:'application/javascript',body:'window.__emailMessages=[];window.__emailFails='+JSON.stringify(!!state.failedEmail)+';window.emailjs={init:function(){},send:async function(service,template,data){window.__emailMessages.push({service,template,data});if(window.__emailFails)throw Error("Synthetic mail failure");return {status:200};}};'};
  if(url.pathname==='/api/service-codes')return {json:codes};
  if(url.pathname==='/api/pricing-bundle'&&url.searchParams.get('method')==='ScreenPrint')return state.failedPricing?{status:503,json:{error:'Synthetic unavailable pricing'}}:{json:bundle};
  if(['/api/quote_sessions','/api/quote_items'].includes(url.pathname)&&request.method()==='POST'){
   const body=request.postDataJSON();state.requests.push({path:url.pathname,method:'POST',body});
   if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
   const fail=(url.pathname==='/api/quote_sessions'&&state.failedSession)||(url.pathname==='/api/quote_items'&&((state.failedItem&&body.LineNumber===1)||(state.failedSetup&&body.LineNumber===2)));
   return fail?{status:503,json:{error:'Synthetic save failure'}}:{json:{success:true,QuoteID:body.QuoteID}};
  }
 }});
 events.mocked=state.requests;await page.waitForFunction(()=>!!window.calculator);return events;
}
async function configure(page,values={}) {
 const selection={quantity:24,frontColors:3,backColors:2,dark:true,stripes:true,...values};
 await page.locator('#quantity').fill(String(selection.quantity));
 await page.locator('#frontColors').selectOption(String(selection.frontColors));await page.locator('#backColors').selectOption(String(selection.backColors));
 for(const [id,value]of [['darkShirtToggle',selection.dark],['safetyStripesToggle',selection.stripes]]){if(await page.locator('#'+id).isChecked()!==value)await page.locator('label.switch').filter({has:page.locator('#'+id)}).click();}
 await page.evaluate(async()=>{clearTimeout(window.calculator.debounceTimer);await window.calculator.calculatePrice();});
 if(selection.quantity>=24)await page.waitForFunction(()=>!!window.calculator.currentCalculation||document.getElementById('priceDisplay').textContent==='Pricing unavailable');
 if(await page.evaluate(()=>!!window.calculator.currentCalculation))await page.locator('#tierLadder table').waitFor();
}
async function fill(page){await page.locator('#sendQuoteBtn').click();for(const [id,value]of Object.entries({customerName:'Example Customer',customerEmail:'example@example.invalid',customerPhone:'555-0100',companyName:'Example Company',projectName:'Example team shirts',notes:'Synthetic quote review; no email or live record.'}))await page.locator('#'+id).fill(value);await page.locator('#salesRep').selectOption('erik@nwcustomapparel.com');}
function normalizeRequests(requests){return requests.map(r=>({...r,body:{...r.body,...(r.body.SessionID?{SessionID:'<generated-session-id>'}:{})}}));}
module.exports={ready,configure,fill,normalizeRequests};
