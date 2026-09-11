const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),source=require('../../fixtures/customer-cart-original-content.json');
const now='2026-09-10T18:30:00.000Z',sizes=['XS','S','M','L','XL','2XL','3XL','4XL'];
function originalFile(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of source.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
function sampleItems(mode){
 if(mode==='empty')return [];
 const one={style:'PC54',name:'Core Cotton Tee',color:'Brilliant Orange',catalogColor:'BrillOrng',sizes:{M:1,'2XL':2},price:8.75,sampleType:mode==='free'?'free':'paid',upcharges:{'2XL':2,'3XL':3},imageUrl:'/__cart-fixture/tee.svg'};
 let items=[one];
 if(['mixed','long','escaped'].includes(mode))items.push({...one,style:'K500',name:'Silk Touch Polo',color:'Navy',catalogColor:'Navy',sizes:{S:1,XL:1},sampleType:'free',price:19.25});
 if(mode==='long')items=Array.from({length:12},(_,i)=>({...items[i%2],style:'TEST'+(i+1),name:'Example apparel with a long descriptive name for a customer team '+(i+1)}));
 if(mode==='escaped')items[0]={...one,name:'Example <b>company</b> & "team"',color:'Orange <script>window.__cartInjection=true</script>'};
 if(mode==='legacy')delete items[0].upcharges;
 return items;
}
function quoteItems(mode){
 if(mode==='empty')return [];
 const methods=['EMB','CAP','DTG','SCP','DTF'];
 const list=methods.includes(mode)?[mode]:methods;
 let items=list.map((method,i)=>({id:'item-'+method,style:method==='CAP'?'C112':'PC54'+i,productTitle:'Example '+method+' garment',color:'Brilliant Orange',catalogColor:'BrillOrng',qty:6,sizes:method==='CAP'?{OSFA:6}:{M:4,'2XL':2},method,placement:'frontBack',placementLabel:'Front & back',methodLabel:method,inkColors:2,safetyStripes:method==='SCP',isCap:method==='CAP',addedAt:Date.parse(now)}));
 if(mode==='long')items=Array.from({length:15},(_,i)=>({...items[i%5],id:'item-long-'+i,style:'TEST'+i,productTitle:'Example apparel with a long descriptive name for a customer team '+i}));
 if(mode==='escaped')items[0].productTitle='Example <b>company</b> & "team"';
 return items;
}
// Presentation-only fixture results. The real engines are source-hash locked and covered
// independently by money-path/parity tests. This seam records the real controller's inputs.
function installEngine(state){
 window.__cartEngineCalls=[];
 const groupId=i=>i.method==='CAP'||(i.method==='EMB'&&i.isCap)?'emb:cap':({EMB:'emb:garment',DTG:'dtg:main',SCP:'scp:design-1',DTF:'dtf:main'})[i.method];
 window.QuoteCartEngine={priceCart:async(cart,opts)=>{
  window.__cartEngineCalls.push({cart:JSON.parse(JSON.stringify(cart)),nudge:!!opts.nudge,forceRefresh:!!opts.forceRefresh});
  const groups=[],errors=[];
  for(const groupIdValue of Object.keys(cart.groups)){
   const items=cart.items.filter(i=>groupId(i)===groupIdValue),method=items[0].method;
   if(state.mode==='failed'&&method==='DTG'){errors.push({groupId:groupIdValue,method,code:'FIXTURE_FAILURE',message:'Synthetic pricing unavailable'});continue;}
   const pooledQty=items.reduce((s,i)=>s+Object.values(i.sizes).reduce((a,b)=>a+b,0),0);
   const lines=items.flatMap(i=>Object.entries(i.sizes).map(([size,qty])=>({itemId:i.id,styleNumber:i.styleNumber,color:i.colorName,size,label:size,qty,baseUnit:18.75,effectiveUnit:18.75,lineTotal:18.75*qty})));
   groups.push({groupId:groupIdValue,method,pooledQty,tierLabel:'1-7',groupTotal:pooledQty*18.75,lines,serviceLines:[],fees:[],ltm:{fee:0,perUnit:0,mode:method==='SCP'?'itemized':'baked'},trace:{tierTable:[{minQty:1,label:'1-7'},{minQty:8,label:'8-23'}]},nudge:{addQty:2,nextTierMinQty:8,nextTierLabel:'8-23',nextPerPiece:17.25,perPieceSavings:1.5,ltmDisappears:false}});
  }
  return {groups,grandTotal:errors.length?null:groups.reduce((s,g)=>s+g.groupTotal,0),warnings:state.mode==='warning'?[{message:'Synthetic fee information needs confirmation'}]:[],errors};
 }};
}
async function open(page,state={}){
 const kind=state.kind||'sample',items=kind==='sample'?sampleItems(state.mode):quoteItems(state.mode);
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[],dialogs:[]};
 await page.clock.setFixedTime(new Date(now));
 page.on('pageerror',e=>events.errors.push(e.message));
 page.on('dialog',async d=>{events.dialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
 await page.context().addInitScript(({kind,items,now,legacy})=>{
  window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};
  window.__cartEmails=[];window.__cartInjection=false;
  Math.random=()=>0.375;
  if(!sessionStorage.getItem('__cartFixtureSeeded')){
   if(kind==='sample')sessionStorage.setItem('sampleCart',JSON.stringify(legacy?items:{samples:items,timestamp:Date.parse(now)}));
   else localStorage.setItem('nwca.quoteCart.v1',JSON.stringify({v:1,createdAt:Date.parse(now),items}));
   sessionStorage.setItem('__cartFixtureSeeded','yes');
  }
 },{kind,items,now,legacy:state.mode==='legacy'});
 await page.context().route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname,local=['localhost','127.0.0.1'].includes(url.hostname),method=request.method();
  const posts={
   '/api/manageorders/orders/create':{success:true,extOrderId:'SAMPLE-TEST-1042'},
   '/api/form-submissions':{success:true,ID_Submission:7401},
   '/api/crm-proxy/lead-activity':{success:true},
   '/api/samples/create-checkout-session':{url:'http://localhost:3400/__cart-fixture/checkout'},
   '/api/quote_sessions':{success:true,Result:[{PK_ID:7401}]},
   '/api/quote_items':{success:true,Result:[{PK_ID:7402}]}
  };
  if(method==='POST'&&Object.hasOwn(posts,p)){
   events.actions.push({path:p,method,body:request.postData()});if(state.arrive)state.arrive(p);if(state.hold)await state.hold;
   return route.fulfill({status:state.postStatus||200,json:state.postStatus?{error:'Synthetic save failed'}:posts[p]});
  }
  if(p==='/api/quote-sequence/WQ'){events.actions.push({path:p,method});return route.fulfill({json:{prefix:'WQ',year:2026,sequence:1042}});}
  if(!['GET','HEAD'].includes(method)||p.includes('/quote-sequence')||p.includes('/logout')||url.searchParams.get('autoAdd')==='true'){events.writes.push(request.url());return route.fulfill({status:503});}
  if(p==='/__cart-fixture/checkout')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic checkout</title><main><h1>Synthetic checkout reached</h1></main></html>'});
  if(p.startsWith('/__cart-fixture/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#e5e7eb"/><text x="20" y="95" font-size="18">Sample garment</text></svg>'});
  if(p==='/api/sizes-by-style-color'){
   events.reads.push({path:p,query:url.search});const stock=state.mode==='out'?0:state.mode==='low'?1:100;
   return route.fulfill({status:state.mode==='missing'?503:200,json:{style:url.searchParams.get('styleNumber'),color:url.searchParams.get('color'),sizes,warehouses:[{name:'Seattle, WA',inventory:sizes.map(()=>stock),total:stock*sizes.length}]}});
  }
  if(p==='/api/pricing-bundle'){events.reads.push({path:p,query:url.search});return route.fulfill({json:{sellingPriceDisplayAddOns:{'2XL':2,'3XL':3}}});}
  if(p==='/api/service-codes'){events.reads.push({path:p,query:url.search});return route.fulfill({json:{data:['EMB','CAP','DTG','SCP','DTF'].map(method=>({ServiceCode:'LEAD-DAYS-'+method,SellPrice:10,IsActive:true}))}});}
  if(request.resourceType()==='script'&&/emailjs/.test(url.href))return route.fulfill({contentType:'application/javascript',body:'window.emailjs={init:function(){},send:async function(service,template,body){window.__cartEmails.push({service,template,body});return {status:200,text:"Synthetic email captured"};}};'});
  if(local&&p==='/pages/'+kind+'-cart.html')return route.fulfill({contentType:'text/html',body:state.original?originalFile('pages/'+kind+'-cart.html'):fs.readFileSync(path.join(root,'pages/'+kind+'-cart.html'),'utf8')});
  if(url.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  if(url.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css')return route.continue();
  if(url.hostname==='cdn.caspio.com'&&/web%20northwest%20custom%20apparel%20logo.png/.test(p))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(request.resourceType())){events.unknown.push(request.url());return route.fulfill({status:503});}
  if(local){
   const file=path.resolve(root,'.'+decodeURIComponent(p)),relative=p.slice(1);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   let body=state.original&&source.hashes[relative]?Buffer.from(originalFile(relative)):fs.readFileSync(file);
   if(relative==='pages/js/quote-cart-page.js')body=Buffer.from('('+installEngine.toString()+')('+JSON.stringify({mode:state.mode})+');\n'+body.toString('utf8'));
   return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'}[path.extname(file)]||'application/octet-stream',body});
  }
  if(['font','image','stylesheet'].includes(request.resourceType()))return route.continue();
  events.unknown.push(request.url());return route.abort();
 });
 await page.goto('/pages/'+kind+'-cart.html'+(state.query||''));await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim(),visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
 return {title:document.title,text:norm(document.querySelector('main').innerText),ids:Object.fromEntries([...document.querySelectorAll('main [id]')].filter(n=>visible(n)&&!n.querySelector('[id]')).map(n=>[n.id,norm(n.innerText)])),
 // The original offscreen drawer contributed links; retain its destinations even
 // when the native dialog now correctly removes them from screen/keyboard order.
 links:[...document.querySelectorAll('a[href]')].filter(n=>visible(n)||n.closest('#sidebar')).map(n=>({href:n.getAttribute('href'),text:norm(n.innerText).replace(n.closest('#sidebar')&&n.querySelector('.flag-new')?/\bNew$/:/(?!)/,'NEW'),label:n.getAttribute('aria-label')})),
 fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,name:n.name,size:n.dataset.size,value:n.value,checked:n.type==='checkbox'?n.checked:undefined})),
 engineCalls:window.__cartEngineCalls||[],emails:window.__cartEmails||[],injection:window.__cartInjection,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });}
function check(expect,events){for(const key of ['errors','writes','unknown','missing'])expect(events[key],key).toEqual([]);}
module.exports={open,snapshot,check,originalFile,now,sampleItems,quoteItems};
