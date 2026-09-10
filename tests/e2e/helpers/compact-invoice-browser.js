const fs=require('node:fs'),path=require('node:path'),{originalFile}=require('./customer-invoice-browser');
const source=require('../../fixtures/customer-documents-original-content.json'),root=path.resolve(__dirname,'../../..'),quoteId='EMB0910-7401',now='2026-09-10T19:00:00Z';
function data(mode='shopworks'){
 const d={quoteId,status:'Processed',sessionRaw:{ShopWorks_Order_Number:740123,PushedToShopWorks:'2026-09-10T12:00:00Z',CompanyName:'Cedar Example Construction',CustomerName:'River Sample',CustomerEmail:'review@example.test',Phone:'2535550142',PaymentTerms:'Net 30',TotalAmount:653,TaxAmount:66.3},
 billingContact:{companyName:'Cedar Example Construction',contactName:'River Sample',address1:'123 Example Street',address2:'Suite 2',city:'Milton',state:'WA',zip:'98354',isTaxExempt:false,phone:'2535550142'},
 originalSubmission:{info:{company:'Cedar Example Construction',name:'River Sample',email:'review@example.test',phone:'2535550142',po:'PO-SYNTHETIC',salesRep:'Example Rep',requestedShipDate:'2026-09-21T00:00:00Z',paymentTerms:'Net 30'},ship:{method:'USPS Priority Mail',company:'Cedar Example Receiving',address1:'456 Sample Ave',address2:'Dock 2',city:'Milton',state:'WA',zip:'98354'},decoConfig:{method:'emb'},rows:[{style:'PC90H',color:'Navy',description:'Core fleece hoodie',sizes:{S:2,M:3,L:3,XL:2},unitPrice:40,locations:['Left chest']},{style:'PC90H_2X',color:'Navy',description:'Core fleece hoodie',sizes:{'2XL':2},unitPrice:45},{style:'PC90H_3XL',color:'Navy',description:'Core fleece hoodie',sizes:{'3XL':1},unitPrice:48},{style:'SETUP',description:'Embroidery setup',qty:1,unitPrice:115}],totals:{subtotal:653,tax:66.3,shipping:10,total:729.3}},
 quoteItems:[],shopWorks:{orderNumber:740123,lastSynced:now,snapshot:{order:{CustomerName:'Cedar Example Construction',ContactFirstName:'River',ContactLastName:'Sample',ContactEmail:'review@example.test',ContactPhone:'2535550142',CustomerPurchaseOrder:'PO-SYNTHETIC',CustomerServiceRep:'Example Rep',date_RequestedToShip:'2026-09-21T00:00:00Z',TermsName:'Net 30',sts_Produced:1,cur_SubTotal:653,cur_SalesTaxTotal:66.3,cur_Shipping:10,cur_TotalInvoice:729.3,cur_Payments:200,cur_Balance:529.3,Designs:[{Locations:[{Name:'Left chest'}]}]},lineItems:[{PartNumber:'PC90H',PartColor:'Navy',PartDescription:'Core fleece hoodie',LineQuantity:10,LineUnitPrice:40,cur_TotalPrice:400,Size01:2,Size02:3,Size03:3,Size04:2},{PartNumber:'PC90H_2X',PartColor:'Navy',PartDescription:'Core fleece hoodie',LineQuantity:2,LineUnitPrice:45,cur_TotalPrice:90,Size01:2},{PartNumber:'PC90H_3XL',PartColor:'Navy',PartDescription:'Core fleece hoodie',LineQuantity:1,LineUnitPrice:48,cur_TotalPrice:48,Size01:1},{PartNumber:'SETUP',PartDescription:'Embroidery setup',LineQuantity:1,LineUnitPrice:115,cur_TotalPrice:115}],pushed:{ShippingAddresses:[{ShipMethod:'USPS Priority Mail',ShipCompany:'Cedar Example Receiving',ShipAddress01:'456 Sample Ave',ShipAddress02:'Dock 2',ShipCity:'Milton',ShipState:'WA',ShipZip:'98354'}]}}},shipStation:null};
 if(['original','quote-items','storefront','wholesale','empty'].includes(mode)){d.shopWorks=null;d.status='Open';delete d.sessionRaw.PushedToShopWorks;delete d.sessionRaw.ShopWorks_Order_Number;}
 if(['quote-items','storefront'].includes(mode)){d.originalSubmission=null;d.sessionRaw.TotalAmount=86;d.sessionRaw.TaxAmount=9.6;d.quoteItems=[{StyleNumber:'PC54',ProductName:'Core Cotton Tee',Color:'Navy',Quantity:2,FinalUnitPrice:29.5,LineTotal:61,SizeBreakdown:JSON.stringify({XL:1,'2XL':1})},{StyleNumber:'SETUP',Description:'Setup',Quantity:1,UnitPrice:30,LineTotal:30},{StyleNumber:'DISCOUNT',EmbellishmentType:'fee',LineTotal:-5},{StyleNumber:'SHIP',EmbellishmentType:'fee',LineTotal:10},{StyleNumber:'TAX',EmbellishmentType:'fee',LineTotal:9.6}];}
 if(mode==='storefront'){d.sessionRaw.CustomerDataJSON=JSON.stringify({firstName:'Aspen',lastName:'Example',company:'Fixture Store Buyer',address1:'1 Customer Lane',address2:'Unit 8',city:'Milton',state:'WA',zip:'98354',billingAddress1:'2 Billing Street',billingCity:'Tacoma',billingState:'WA',billingZip:'98401',deliveryMethod:'ship'});d.sessionRaw.OrderSettingsJSON=JSON.stringify({shipPromise:{iso:'2026-09-21'},frontLogo:{fileUrl:'/__invoice-fixture/front.png',fileName:'front.png'},backLogo:{fileUrl:'/__invoice-fixture/back.pdf',fileName:'back.pdf'},mockups:[{view:'front',color:'Navy',url:'/__invoice-fixture/mockup.png'}]});}
 if(mode==='empty'){d.originalSubmission.rows=[];d.originalSubmission.totals={subtotal:0,tax:0,shipping:0,total:0};}
 if(mode==='tax-exempt'){d.billingContact.isTaxExempt=true;d.billingContact.taxExemptNumber='EXAMPLE-123';Object.assign(d.shopWorks.snapshot.order,{cur_SalesTaxTotal:0,cur_TotalInvoice:663,cur_Balance:463});}
 if(mode==='wholesale'){d.sessionRaw.IsWholesale='Yes';d.originalSubmission.totals.tax=0;d.originalSubmission.totals.total=663;}
 if(mode==='cancelled'){d.status='Cancelled_in_ShopWorks';d.sessionRaw.ShopWorks_Last_Synced=now;}
 if(mode==='rush')d.originalSubmission.info.isRush=true;
 if(mode==='pickup')d.shopWorks.snapshot.pushed.ShippingAddresses[0].ShipMethod='Customer Pickup';
 if(mode==='waiting')d.shopWorks.snapshot.order.sts_Produced=0;
 if(mode==='override'||mode==='ups-shipped')d.shopWorks.snapshot.pushed.ShippingAddresses[0].ShipMethod='UPS Ground';
 if(mode==='sent')d.shipStation={orderId:55001,status:'awaiting_shipment'};
 if(mode==='shipped'||mode==='ups-shipped')d.shipStation={orderId:55001,status:'shipped',trackingNumber:'REVIEW-TRACK-001',trackingCarrier:'USPS',trackingURL:'https://tools.usps.com/go/TrackConfirmAction?tLabels=REVIEW-TRACK-001'};
 if(mode==='stale')d.shopWorks.lastSynced='2026-09-08T19:00:00Z';
 if(mode==='long'){d.shopWorks.snapshot.lineItems=Array.from({length:28},(_,i)=>({PartNumber:'SAMPLE-'+String(i+1).padStart(2,'0'),PartColor:'Navy',PartDescription:'Synthetic detailed garment description, crew workwear with an extended name',LineQuantity:i+1,LineUnitPrice:23.5,cur_TotalPrice:(i+1)*23.5,Size04:i+1}));}
 return d;
}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[]};
 await page.clock.setFixedTime(new Date(now));
 page.on('pageerror',e=>events.errors.push(e.message));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method();
  if(['localhost','127.0.0.1'].includes(u.hostname)&&method==='POST'&&p.startsWith('/api/quote-sessions/'+quoteId+'/')&&['sync-from-shopworks','send-to-shipstation'].includes(p.split('/').pop())){
   events.actions.push({path:p,query:u.search,method,body:req.postData()});if(state.actionArrive)state.actionArrive();if(state.actionHold)await state.actionHold;
   if(p.endsWith('sync-from-shopworks'))return route.fulfill({status:state.syncStatus||200,json:{success:!state.syncStatus}});
   return route.fulfill({status:state.sendStatus||200,json:state.sendResult||{success:!state.sendStatus,shipstationOrderId:55001,status:'awaiting_shipment',lastSynced:now}});
  }
  if(!['GET','HEAD'].includes(method)||p.startsWith('/api/quote-sequence/')||u.searchParams.get('autoAdd')==='true'){events.writes.push(req.url());return route.fulfill({status:503});}
  if(p==='/api/crm-session/me')return route.fulfill({status:state.staff===false?401:200,json:state.staff===false?{authenticated:false}:{authenticated:true,name:'Review Staff',email:'staff@example.test',role:'admin'}});
  if(p==='/api/quote-sessions/'+quoteId+'/full'){
   events.reads.push({path:p,query:u.search});if(state.arrive)state.arrive();if(state.hold)await state.hold;
   const denied=state.protected&&u.searchParams.get('k')!=='review token / only';
   return route.fulfill({status:denied?404:state.status||200,json:denied||state.status?{error:'Synthetic load failure'}:(state.afterSync&&events.reads.length>1?state.afterSync:state.initialData||data(state.mode))});
  }
  if(p.startsWith('/__invoice-fixture/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#dbeafe"/><text x="20" y="80" font-family="Arial" font-size="20">Fixture artwork</text></svg>'});
  if(p==='/invoice/'+quoteId)return route.fulfill({contentType:'text/html',body:state.original?originalFile('pages/invoice.html'):fs.readFileSync(path.join(root,'pages/invoice.html'),'utf8')});
  if(u.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const f=path.resolve(root,'.'+decodeURIComponent(p)),retired=state.original&&(source.retiredStyles||[]).some(r=>r.file===p.slice(1));
   if(!f.startsWith(root+path.sep)||(!retired&&(!fs.existsSync(f)||!fs.statSync(f).isFile()))){events.missing.push(p);return route.fulfill({status:404});}
   const body=state.original&&source.hashes[p.slice(1)]?Buffer.from(originalFile(p.slice(1))):fs.readFileSync(f);
   return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream',body});
  }
  if(['font','image'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.abort();
 });
 await page.goto('/invoice/'+quoteId+(state.protected?'?k='+encodeURIComponent('review token / only'):state.fakeStaff?'?staff=true':''));await page.evaluate(()=>document.fonts.ready);return events;
}
function check(expect,events){for(const k of ['errors','writes','unknown','missing'])expect(events[k],k).toEqual([]);}
module.exports={open,data,check,quoteId,now};
