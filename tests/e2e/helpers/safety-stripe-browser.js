const {open}=require('./specialty-calculators-browser');
async function ready(page,state={}) {
 state.requests ||= [];
 const events=await open(page,{original:state.original,url:'/calculators/safety-stripe-creator.html',route:async route=>{
  const request=route.request(),url=new URL(request.url());
  if(state.failedPreview&&url.hostname==='northwestcustomapparel.box.com'&&url.pathname.endsWith('/lvqvm0ucwz8zm2yvi4d4qbr3wayozmi0'))return {status:503,body:'Synthetic unavailable image'};
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/@emailjs/browser@3/'))return {contentType:'application/javascript',body:'window.emailjs={init:function(){}};'};
  if(['/api/quote_sessions','/api/quote_items'].includes(url.pathname)&&request.method()==='POST'){
   const body=request.postDataJSON();state.requests.push({path:url.pathname,method:'POST',body});
   if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
   const fail=(url.pathname==='/api/quote_sessions'&&state.failedSession)||(url.pathname==='/api/quote_items'&&state.failedItem);
   return fail?{status:503,json:{error:'Synthetic save failure'}}:{json:{success:true,QuoteID:body.QuoteID}};
  }
 }});
 events.mocked=state.requests;await page.locator('.stripe-option').first().waitFor();
 return events;
}
async function select(page,style='Standard',front='LeftChestLogo',back='BackBetweenLinesText'){
 await page.locator('.stripe-option[data-style="'+style+'"]').click();
 await page.locator('#frontOptions [data-option="'+front+'"]').click();
 await page.locator('#backOptions [data-option="'+back+'"]').click();
}
async function fill(page){
 await page.locator('[data-call="openSendModal"]').click();
 if(await page.locator('body').getAttribute('data-ui')!=='unified'){
  // Original .show does not match the stylesheet's .active selector: the native opener leaves the form hidden.
  // Populate unreachable fields only to diagnose the existing submit handler; do not alter its CSS.
  await page.evaluate(()=>{for(const[id,value]of Object.entries({customerName:'Example Customer',customerEmail:'example@example.invalid',customerPhone:'555-0100',companyName:'Example Company',salesRep:'erik@nwcustomapparel.com',customMessage:'Synthetic design review; no email or live record.'}))document.getElementById(id).value=value;});
  return;
 }
 await page.locator('#customerName').fill('Example Customer');
 await page.locator('#customerEmail').fill('example@example.invalid');
 await page.locator('#customerPhone').fill('555-0100');
 await page.locator('#companyName').fill('Example Company');
 await page.locator('#salesRep').selectOption('erik@nwcustomapparel.com');
 await page.locator('#customMessage').fill('Synthetic design review; no email or live record.');
}
function normalizeRequests(requests){return requests.map(r=>({...r,body:{...r.body,...(r.body.SessionID?{SessionID:'<generated-session-id>'}:{})}}));}
module.exports={ready,select,fill,normalizeRequests};
