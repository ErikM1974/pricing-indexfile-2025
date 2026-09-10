const fs=require('node:fs'),path=require('node:path');
const {originalFile}=require('./customer-invoice-browser'),{data:invoiceData}=require('./compact-invoice-browser');
const source=require('../../fixtures/customer-documents-original-content.json'),root=path.resolve(__dirname,'../../..'),now='2026-09-10T19:00:00Z';
function fixture(mode='open'){
 const prefix={mixed:'WQ',dtf:'DTF',dtg:'DTG',screenprint:'SPC',contract:'CEMB',sizeless:'STK'}[mode]||'EMB',id=prefix+'0910-7401';
 const session={QuoteID:id,Status:'Open',CustomerName:'River Sample',CompanyName:'Cedar Example Construction',CustomerEmail:'review@example.test',Phone:'2535550142',CreatedAt_Quote:'2026-09-09T00:00:00Z',ExpiresAt:'2026-10-09T00:00:00Z',SalesRepName:'Example Rep',SalesRepEmail:'rep@example.test',PurchaseOrderNumber:'PO-SYNTHETIC',ShipToAddress:'123 Example Street',ShipToCity:'Milton',ShipToState:'WA',ShipToZip:'98354',ShipMethod:'USPS Priority Mail',ReqShipDate:'2026-09-21',PaymentTerms:'Net 30',CustomerNumber:90210,TaxRate:10,TaxAmount:71.4,TotalAmount:704,SubtotalAmount:684,TotalQuantity:26,Notes:'Please use the approved design.'};
 const method={dtf:'dtf',dtg:'dtg',screenprint:'screenprint'}[mode]||'embroidery';
 const items=[{StyleNumber:'PC90H',ProductName:'Core fleece hoodie',Color:'Navy',Quantity:24,BaseUnitPrice:26,FinalUnitPrice:26,LineTotal:624,SizeBreakdown:JSON.stringify({S:6,M:6,L:6,XL:6}),EmbellishmentType:method},{StyleNumber:'PC90H_2X',ProductName:'Core fleece hoodie',Color:'Navy',Quantity:2,BaseUnitPrice:30,FinalUnitPrice:30,LineTotal:60,SizeBreakdown:JSON.stringify({'2XL':2}),EmbellishmentType:method},{StyleNumber:'SETUP',Description:'Embroidery setup',Quantity:1,BaseUnitPrice:25,FinalUnitPrice:25,LineTotal:25,EmbellishmentType:'fee'},{StyleNumber:'DISCOUNT',Description:'Discount',Quantity:1,LineTotal:-5,EmbellishmentType:'fee'},{StyleNumber:'SHIP',Description:'Shipping',Quantity:1,LineTotal:10,EmbellishmentType:'fee'}];
 const notes={acceptedAt:'2026-09-10T17:00:00Z',acceptedByName:'River Sample',acceptedByEmail:'review@example.test',acceptedDeliveryMethod:'ship'};
 const deposit={enabled:true,subtotal:704,shipping:10,taxRatePct:10,taxAmount:71.4,grandTotal:785.4,depositPct:50,depositAmount:392.7,balanceAmount:392.7,enabledAt:now};
 if(['accepted','deposit','paid','full-payment'].includes(mode)){session.Status='Accepted';session.Notes=JSON.stringify({...notes,...(mode==='accepted'?{}:{deposit:{...deposit,...(mode==='full-payment'?{depositPct:100,depositAmount:785.4,balanceAmount:0}:{})}}),...(mode==='paid'?{payments:[{kind:'deposit',amount:392.7,at:now}]}:{})});}
 if(mode==='expired')session.ExpiresAt='2026-09-01';
 if(mode==='empty')items.length=0;
 if(mode==='escaped'){session.CustomerName='<img src=x onerror=alert(1)>';session.CompanyName='Example & Sons <Construction>';items[0].ProductName='<b>Literal description</b>';}
 if(mode==='mixed'){items[1].EmbellishmentType='dtf';session.Notes=JSON.stringify({methods:['embroidery','dtf']});}
 if(mode==='contract'){session.ShippingAddress='456 Sample Ave';session.ShippingCity='Tacoma';session.ShippingState='WA';session.ShippingZip='98401';items[0].EmbellishmentType='customer-supplied';items[0].StyleNumber='DECG';}
 if(mode==='sizeless'){items[0].StyleNumber='STK';items[0].ProductName='Die-cut logo stickers';items[0].SizeBreakdown='{}';items.splice(1,1);}
 if(mode==='long'){items.splice(0,2,...Array.from({length:28},(_,i)=>({...items[0],StyleNumber:'SAMPLE-'+String(i+1).padStart(2,'0'),ProductName:'Detailed synthetic workwear description',Quantity:i+1,LineTotal:(i+1)*26,SizeBreakdown:JSON.stringify({XL:i+1})})));}
 let full={quoteId:id,status:session.Status,sessionRaw:session,quoteItems:items,shopWorks:null,originalSubmission:null,shipStation:null};
 if(['shopworks','cancelled','shipped','artwork'].includes(mode)){
  full=invoiceData(mode==='shipped'?'ups-shipped':'shopworks');full.quoteId=id;full.sessionRaw={...full.sessionRaw,...session};full.quoteItems=items;
  full.shopWorks.status='Imported';Object.assign(full.shopWorks.snapshot.order,{id_Order:740123,id_Customer:90210,id_Design:44012});full.shopWorks.snapshot.pushed.Designs=[{id_Design:44012}];full.shopWorks.snapshot.order.Designs=[];
  if(mode==='cancelled'){full.status='Cancelled_in_ShopWorks';session.Status=full.status;}
  if(mode==='artwork'){Object.assign(session,{CustomerDataJSON:invoiceData('storefront').sessionRaw.CustomerDataJSON,OrderSettingsJSON:invoiceData('storefront').sessionRaw.OrderSettingsJSON});Object.assign(full.sessionRaw,session);}
 }
 return{id,session,items,full,deposit};
}
async function open(page,state={}){
 const f=state.fixture||fixture(state.mode),events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[],beacons:[],lazy:[]};state.fixture=f;
 await page.clock.setFixedTime(new Date(now));page.on('pageerror',e=>events.errors.push(e.message));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied.push(text);}},configurable:true});});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method(),local=['localhost','127.0.0.1'].includes(u.hostname);
  if(local&&method==='POST'&&p==='/api/quote_analytics'){events.beacons.push(JSON.parse(req.postData()));return route.fulfill({json:{success:true}});}
  if(state.artForm&&method==='POST'&&p==='/api/files/import-from-url'){
   const payload=JSON.parse(req.postData());if(!/^(?:http:\/\/localhost:3400)?\/__invoice-fixture\//.test(payload.url)){events.writes.push({url:req.url(),method});return route.fulfill({status:503});}
   events.actions.push({operation:'art-reference',path:p,body:req.postData()});return route.fulfill({json:{success:true,fileName:'fixture-reference-'+events.actions.length+'.png'}});
  }
  const operation={['/api/public/quote/'+f.id+'/accept']:'accept',['/api/public/quote/'+f.id+'/deposit-checkout']:'checkout',['/api/quotes/'+f.id+'/enable-deposit']:'deposit',['/api/quote-sessions/'+f.id+'/sync-from-shopworks']:'sync',['/api/quote-sessions/'+f.id+'/send-to-shipstation']:'ship','/api/embroidery-push/push-quote':'push','/api/scp-push/push-quote':'push','/api/dtf-push/push-quote':'push'}[p];
  if(local&&method==='POST'&&operation){
   events.actions.push({operation,path:p,query:u.search,body:req.postData()});if(state.actionArrive)state.actionArrive();if(state.actionHold)await state.actionHold;
   const body=state.actionStatus?{error:'Synthetic operation failure'}:operation==='accept'?{success:true,acceptedAt:now,...(JSON.parse(req.postData()).deliveryMethod==='pickup'?{deposit:f.deposit}:{})}:operation==='checkout'?{url:'http://localhost:3400/__quote-fixture/checkout'}:operation==='deposit'?{success:true,deposit:f.deposit,payUrl:'http://localhost:3400/quote/'+f.id+'?k=review-token'}:operation==='ship'?{success:true,shipstationOrderId:55001}: {success:true};
   if(!state.actionStatus&&operation==='sync')Object.assign(body,state.syncResult||{shopWorksOrderNumber:740123,status:'Imported',lastSynced:now,snapshot:f.full.shopWorks?.snapshot||invoiceData().shopWorks.snapshot});
   if(!state.actionStatus&&operation==='push')Object.assign(body,{timestamp:now,extOrderId:'NWCA-TEST-'+f.id});
   if(!state.actionStatus&&operation==='ship')f.full.shipStation={orderId:55001,status:'awaiting_shipment'};
   return route.fulfill({status:state.actionStatus||200,json:body});
  }
  if(!['GET','HEAD'].includes(method)||p.startsWith('/api/quote-sequence/')||u.searchParams.get('autoAdd')==='true'){events.writes.push({url:req.url(),method});return route.fulfill({status:503});}
  if(p==='/api/crm-session/me')return route.fulfill({status:state.staff===false?401:200,json:state.staff===false?{authenticated:false}:{authenticated:true,name:'Review Staff',email:'staff@example.test',role:'admin'}});
  if(p==='/api/public/quote/'+f.id){events.reads.push({path:p,query:u.search});if(state.arrive)state.arrive();if(state.hold)await state.hold;return route.fulfill({status:state.status||200,json:state.status?{error:'Synthetic quote load failure'}:{session:f.session,items:f.items}});}
  if(p==='/api/quote-sessions/'+f.id+'/full'){events.reads.push({path:p,query:u.search});return route.fulfill({status:state.fullStatus||200,json:state.fullStatus?{error:'Synthetic order load failure'}:f.full});}
  if(p==='/api/quote-change-log/'+f.id)return route.fulfill({json:{records:[]}});
  if(p==='/api/quote_analytics')return route.fulfill({json:[]});
  if(p==='/api/product-details')return route.fulfill({json:[{COLOR_NAME:'Navy',CATALOG_COLOR:'Navy',FRONT_MODEL:'http://localhost:3400/__invoice-fixture/product.png',FRONT_FLAT:'http://localhost:3400/__invoice-fixture/product.png'}]});
  if(p==='/api/thumbnails/by-designs')return route.fulfill({json:[]});
  if(state.artForm&&p==='/api/service-codes')return route.fulfill({json:[{ServiceCode:'GRT-REVIEW',DisplayName:'Synthetic art fee',SellPrice:50,IsActive:true}]});
  if(state.artForm&&p==='/api/artrequests')return route.fulfill({json:[]});
  if(p.endsWith('/vendor-shipment'))return route.fulfill({json:{shipments:[],status:'pending'}});
  if(p.startsWith('/__invoice-fixture/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#dbeafe"/><text x="20" y="80" font-family="Arial" font-size="20">Fixture artwork</text></svg>'});
  if(p==='/__quote-fixture/checkout')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Intercepted checkout</title><h1>Synthetic checkout destination</h1>'});
  if(p==='/quote/'+f.id)return route.fulfill({contentType:'text/html',body:state.original?originalFile('pages/quote-view.html'):fs.readFileSync(path.join(root,'pages/quote-view.html'),'utf8')});
  if(u.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  if(state.artForm&&u.hostname==='cdn.jsdelivr.net'&&p==='/npm/@emailjs/browser@4/dist/email.min.js')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(local){
   const relative=decodeURIComponent(p.slice(1)),file=path.resolve(root,relative),retired=state.original&&(source.retiredStyles||[]).some(r=>r.file===relative);
   if(!file.startsWith(root+path.sep)||(!retired&&(!fs.existsSync(file)||!fs.statSync(file).isFile()))){events.missing.push(p);return route.fulfill({status:404});}
   let body=state.original&&source.hashes[relative]?Buffer.from(originalFile(relative)):fs.readFileSync(file);
   // Expose the existing instance only; its constructor and workflow methods run unchanged.
   if(relative==='pages/js/quote-view.js'){const code=body.toString();if(code.split('new QuoteViewPage();').length!==2)throw Error('Quote instance observer anchor changed');body=Buffer.from(code.split('new QuoteViewPage();').join('window.__quoteView = new QuoteViewPage();'));}
   return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream',body});
  }
  if(['font','image'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.abort();
 });
 const params=new URLSearchParams(state.query||{});if(state.token)params.set('k','review token / only');
 await page.goto('/quote/'+f.id+(params.size?'?'+params.toString():''));await page.evaluate(()=>document.fonts.ready);return events;
}
function check(expect,events){for(const key of ['errors','writes','unknown','missing'])expect(events[key],key).toEqual([]);}
module.exports={fixture,open,check,now};
