const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),source=require('../../fixtures/custom-apparel-original-content.json'),fixtures=require('../../fixtures/custom-apparel-api-fixtures.json');
const now='2026-09-11T18:30:00.000Z',sizes=['S','M','L','XL','2XL','3XL'],colors=[{cc:'JetBlack',name:'Jet Black'},{cc:'BrillOrng',name:'Brilliant Orange'}];
function originalFile(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of source.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
const garment='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="600" height="720" fill="white"/><path d="M175 80L235 60Q300 125 365 60L425 80L545 200L455 285L415 240L425 640L175 640L185 240L145 285L55 200Z" fill="#263b46"/></svg>';
const art='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect x="10" y="10" width="1180" height="580" rx="40" fill="#ffffff"/><text x="600" y="360" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="180" fill="#2e5827">Example Team</text></svg>';
function products(kind){const list=kind==='caps'?['112','C402','C914']:['PC54','PC61LS','PC90H'];return list.map((style,i)=>({style,style_rank:i+1,product_title:(kind==='caps'?'Example Embroidered Cap ':'Port & Company Example Shirt ')+style,category:['T-Shirt','Long Sleeve Tee','Hoodie'][i],total_units_sold:300-i*80,main_image_url:'/__apparel-fixture/garment.svg',top_colors:colors.map((c,j)=>({catalog_color:c.cc,color_name:c.name,color_rank:j+1,front_image_url:'/__apparel-fixture/garment.svg',swatch_image_url:'/__apparel-fixture/garment.svg'}))}));}
async function open(page,state={}){
 const kind=state.kind||'tees',events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[],dialogs:[]},catalog=products(kind);
 await page.clock.setFixedTime(new Date(now));
 page.on('pageerror',e=>events.errors.push(e.message));
 page.on('dialog',async d=>{events.dialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};Math.random=()=>0.375;});
 await page.context().route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname,local=['localhost','127.0.0.1'].includes(u.hostname),method=request.method();
  if(method==='POST'&&p==='/api/tax-rates/lookup'){events.actions.push({path:p,method,body:JSON.parse(request.postData())});return route.fulfill({status:state.taxFailure?503:200,json:state.taxFailure?{error:'Synthetic tax unavailable'}:{success:true,rate:0.101,account:'2717',accountName:'MILTON'}});}
  if(method==='POST'&&p==='/api/files/upload'){const body=request.postData()||'',name=/filename="([^"]+)"/.exec(body)?.[1]||'example-art.svg';events.actions.push({path:p,method,fileName:name});return route.fulfill({status:state.uploadFailure?503:200,json:state.uploadFailure?{error:'Synthetic upload failed'}:{externalKey:'fixture-art-1042',fileName:name}});}
  if(method==='POST'&&p==='/api/create-checkout-session'){events.actions.push({path:p,method,body:JSON.parse(request.postData())});if(state.onCheckout)state.onCheckout();if(state.hold)await state.hold;return route.fulfill({status:state.checkoutStatus||200,json:state.checkoutStatus?{error:'Synthetic checkout unavailable'}:{url:'http://localhost:3400/__apparel-fixture/checkout'}});}
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({url:request.url(),method});return route.fulfill({status:503});}
  if(p==='/__apparel-fixture/checkout')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Synthetic checkout</title><main><h1>Synthetic checkout reached</h1></main></html>'});
  if(p==='/api/image-proxy'||p==='/__apparel-fixture/garment.svg')return route.fulfill({contentType:'image/svg+xml',body:garment});
  if(p.startsWith('/api/'))events.reads.push({path:p,query:u.search});
  if(p==='/api/service-codes'){
   if(u.searchParams.has('category'))return route.fulfill({json:{data:[]}});
   const code=u.searchParams.get('code'),price={'3DT-RUSH':25,'3DT-SHIP':30,'CTS-SHIP-FLAT':7.99,'CTS-SHIP-FREE-OVER':100,'CAPS-SHIP-FLAT':7.99,'CAPS-SHIP-FREE-OVER':100}[code];
   if(price===undefined){events.unknown.push(request.url());return route.fulfill({status:503});}
   return route.fulfill({status:state.mode==='fatal'?503:200,json:{data:[{ServiceCode:code,SellPrice:price,IsActive:true}]}});
  }
  if(p==='/api/caps/catalog')return route.fulfill({json:state.mode==='empty'?[]:catalog.flatMap((it,i)=>colors.map((c,j)=>({style:it.style,style_rank:i+1,product_title:it.product_title,brand:'Example Caps',role:'Everyday cap',catalog_color:c.cc,color_name:c.name,color_rank:j+1,is_active:true})))});
  if(p==='/api/dtg/top-sellers/styles')return route.fulfill({json:{records:state.mode==='empty'?[]:catalog}});
  if(p==='/api/dtg/top-sellers')return route.fulfill({json:{records:colors.map(c=>({catalog_color:c.cc,color_name:c.name,swatch_image_url:'/__apparel-fixture/garment.svg'}))}});
  if(p==='/api/cts/gallery-extras')return route.fulfill({status:state.mode==='extras-failed'?503:200,json:{styles:Object.fromEntries(catalog.map(it=>[it.style,{blurb:'Soft everyday apparel for your team.',fabric:'Cotton',prices:{12:20.58,24:16,48:15,72:14}}]))}});
  if(p==='/api/pricing-bundle'){const m=u.searchParams.get('method'),bundle=m==='CAP-AL'?fixtures.caps.additional:m==='CAP'?fixtures.caps.bundle:fixtures.tees;return route.fulfill({status:state.mode==='pricing-failed'&&m!=='CAP-AL'?503:200,json:bundle});}
  if(p==='/api/product-details')return route.fulfill({json:colors.map(c=>({CATALOG_COLOR:c.cc,COLOR_NAME:c.name,PRODUCT_DESCRIPTION:'Soft, durable apparel for our synthetic team fixture.',COLOR_SQUARE_IMAGE:'/__apparel-fixture/garment.svg',FRONT_MODEL:'/__apparel-fixture/garment.svg',FRONT_FLAT:'/__apparel-fixture/garment.svg',BACK_FLAT:'/__apparel-fixture/garment.svg',PRODUCT_IMAGE:'/__apparel-fixture/garment.svg'}))});
  if(p==='/api/dtg-calibration')return route.fulfill({json:{data:[]}});
  const stock=state.mode==='out'?0:state.mode==='low'?2:500;
  if(p.startsWith('/api/sanmar/inventory/'))return route.fulfill({status:state.mode==='inventory-failed'?503:200,json:{inventory:colors.flatMap(c=>(kind==='caps'?['OSFA']:sizes).map(size=>({color:c.cc,size,totalQty:stock}))) }});
  if(p==='/api/manageorders/pc54-inventory')return route.fulfill({status:state.mode==='inventory-failed'?503:200,json:{colors:Object.fromEntries(colors.map(c=>[c.cc,{total:stock*sizes.length,sizes:Object.fromEntries(sizes.map(size=>[size,stock]))}]))}});
  if(local&&(p==='/pages/custom-'+kind+'.html'||p==='/custom-'+kind))return route.fulfill({contentType:'text/html',body:state.original?originalFile('pages/custom-'+kind+'.html'):fs.readFileSync(path.join(root,'pages/custom-'+kind+'.html'),'utf8')});
  if(u.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  if(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(request.resourceType())){events.unknown.push(request.url());return route.fulfill({status:503});}
  if(local){const file=path.resolve(root,'.'+decodeURIComponent(p)),relative=p.slice(1);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){events.missing.push(p);return route.fulfill({status:404});}const body=state.original&&source.hashes[relative]?Buffer.from(originalFile(relative)):fs.readFileSync(file);return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'}[path.extname(file)]||'application/octet-stream',body});}
  if(['font','image','stylesheet'].includes(request.resourceType()))return route.continue();
  events.unknown.push(request.url());return route.fulfill({status:503});
 });
 const query=state.selected?'?style='+(kind==='caps'?'112':'PC54'):'';
 await page.goto('/pages/custom-'+kind+'.html'+query);
 await page.evaluate(()=>document.fonts.ready);
 return events;
}
async function snapshot(page){
 return page.evaluate(()=>{
  const norm=s=>s.replace(/\s+/g,' ').trim(),visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
  const hook=window.__CAPS||window.__TDT,s=hook?.S,ids={};
  for(const id of ['gallery-grid','gallery-empty','tdt-fatal','caps-fatal','current-product-name','current-product-style','color-chips','color-cards','tier-ladder','review-lines','review-totals','review-promise','review-ack','pay-reasons','pay-btn-label','tax-stamp','inventory-note','sheet-lines','sheet-totals','pipeline-error','front-file-name','back-file-name','art-file-name','art-size-label']){
   const n=document.getElementById(id);if(n&&visible(n))ids[id]=norm(n.innerText);
  }
  // currentQuote displays a fatal error before a cap is selected; an observer
  // must not call it until the actual studio is ready.
  let quote=null;try{if(s?.boot.ready)quote=hook.quote()||null;}catch(e){quote={error:e.message};}
  return {title:document.title,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,name:n.name,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),cart:s?JSON.parse(JSON.stringify(s.cart)):null,quote,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
}
function check(expect,events){expect(events.errors).toEqual([]);expect(events.writes).toEqual([]);expect(events.unknown).toEqual([]);expect(events.missing).toEqual([]);}
module.exports={open,snapshot,check,art,originalFile};
