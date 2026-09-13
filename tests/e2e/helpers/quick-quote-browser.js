const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/quick-quote-original-content.json');
const pricing=name=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/pricing',name),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value)),dtg=clone(require('../../fixtures/custom-apparel-api-fixtures.json').tees);
const dtgCanonical=require('../../../shared_components/js/dtg-canonical-pricing');
dtg.allDtgCostsR=[];
for(const [location,base]of [['LC',7],['FF',10],['FB',10],['JF',12],['JB',12]])for(const [i,tier]of dtg.tiersR.entries())dtg.allDtgCostsR.push({PrintLocationCode:location,TierLabel:tier.TierLabel,PrintCost:base+4-i});
const image='/__core-fixture/garment.svg',garment='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="600" height="720" fill="white"/><path d="M175 80L235 60Q300 125 365 60L425 80L545 200L455 285L415 240L425 640L175 640L185 240L145 285L55 200Z" fill="#263b46"/></svg>';
const colors=[{name:'Jet Black',catalog:'JetBlack',hex:'#263b46'},{name:'Brilliant Orange',catalog:'BrillOrng',hex:'#c64f13'}];
function details(style='PC54'){return colors.map(c=>({STYLE:style,PRODUCT_TITLE:style==='C112'?'Structured Twill Cap':'Essential Cotton Tee',PRODUCT_DESCRIPTION:'Comfortable, durable cotton apparel for the whole team.',BRAND_NAME:style==='C112'?'Port Authority':'Port & Company',CATEGORY:style==='C112'?'Caps':'T-Shirts',CATEGORY_NAME:style==='C112'?'Caps':'T-Shirts',PRODUCT_STATUS:'Active',CATALOG_COLOR:c.catalog,COLOR_NAME:c.name,HEX_CODE:c.hex,COLOR_SQUARE_IMAGE:image,MAIN_IMAGE_URL:image,FRONT_MODEL:image,BACK_MODEL:image,FRONT_FLAT:image,BACK_FLAT:image,PRODUCT_IMAGE:image}));}
function sizePricing(style){const template=pricing('size-pricing-'+(style==='C112'?'C112':'PC61')+'.json')[0];return colors.map(c=>({...template,styleNumber:style,color:c.name}));}
function source(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],dialogs:[]};
 if(state.safetyBuilder)await page.context().addInitScript(()=>{window.APP_CONFIG={API:{BASE_URL:location.origin}};});
 await page.clock.setFixedTime(new Date('2026-09-12T18:30:00.000Z'));
 await page.context().addInitScript(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++;window.dispatchEvent(new Event('beforeprint'));};});
 page.on('pageerror',e=>events.errors.push(e.message));page.on('dialog',async d=>{events.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname,method=request.method(),style=u.searchParams.get('styleNumber')||'PC54';
  if(p==='/api/dtg/quote-pricing'&&method==='POST'){
   const body=request.postDataJSON();events.reads.push({path:p,method,body});
   const bundle={pricing:{tiers:dtg.tiersR,costs:dtg.allDtgCostsR,sizes:dtg.sizes,upcharges:dtg.sellingPriceDisplayAddOns}};
   return route.fulfill({status:state.pricingFailed?503:200,json:dtgCanonical.priceLines({...body,bundlesByStyle:Object.fromEntries(body.lines.map(l=>[l.styleNumber,bundle]))})});
  }
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({path:p,method});return route.fulfill({status:503});}
  if(p.startsWith('/api/'))events.reads.push({path:p,query:u.search});
  if(p==='/api/decoration-methods')return route.fulfill({json:{rules:['T-Shirts','Caps'].map(category=>({category,EMB:true,DTG:category==='T-Shirts',SCP:category==='T-Shirts',DTF:category==='T-Shirts'})),overrides:[]}});
  if(p==='/api/safety-stripes/top-sellers/styles')return route.fulfill({json:{records:state.safetyRecs?['PC54','PC61'].map((style,i)=>({style,brand:'Port & Company',product_title:'Example safety garment '+(i+1),style_rank:i+1,main_image_url:image,best_for:'Team workwear',colors:[{color_name:'Safety Yellow',catalog_color:'SafetyYellow',front_image_url:image},{color_name:'Safety Orange',catalog_color:'SafetyOrange',front_image_url:image}]})):[]}});
  if(p.startsWith('/__core-fixture/')||p==='/api/image-proxy')return route.fulfill({contentType:'image/svg+xml',body:garment});
  if(p==='/api/inventory')return route.fulfill({status:state.stockFailed?503:200,json:['S','M','L','XL','2XL','3XL','4XL'].map(SIZE=>({SIZE,QTY:state.out?0:125}))});
  if(p==='/api/product-details'||p==='/api/color-swatches')return route.fulfill({status:state.productFailed?503:200,json:state.productEmpty?[]:details(style)});
  if(p==='/api/product-colors')return route.fulfill({status:state.productFailed?503:200,json:{...details(style)[0],styleNumber:style,productTitle:details(style)[0].PRODUCT_TITLE,colors:state.productEmpty?[]:details(style)}});
  if(p==='/api/products/search'){const q=u.searchParams.get('q')||'PC54';return route.fulfill({json:{success:true,data:{products:[{styleNumber:q,productName:details(q)[0].PRODUCT_TITLE,images:{display:image}}]}}});}
  if(p==='/api/stylesearch')return route.fulfill({json:['PC54','C112'].filter(s=>s.toLowerCase().includes((u.searchParams.get('term')||'').toLowerCase())).map(s=>({style:s,value:s,label:details(s)[0].PRODUCT_TITLE,thumb:image}))});
  if(p==='/api/size-pricing')return route.fulfill({json:sizePricing(style)});
  if(p==='/api/base-item-costs')return route.fulfill({json:{baseCosts:sizePricing(style)[0].basePrices}});
  if(p==='/api/max-prices-by-style')return route.fulfill({json:{maxPrices:sizePricing(style)[0].basePrices,sizes:Object.entries(sizePricing(style)[0].basePrices).map(([size,maxPrice])=>({size,maxPrice})),sellingPriceDisplayAddOns:sizePricing(style)[0].sizeUpcharges}});
  if(p==='/api/dtg/product-bundle')return route.fulfill({status:state.pricingFailed?503:200,json:{product:{...details(style)[0],styleNumber:style,colors:details(style)},pricing:{tiers:dtg.tiersR,costs:dtg.allDtgCostsR,sizes:dtg.sizes,upcharges:dtg.sellingPriceDisplayAddOns}}});
  if(p==='/api/dtg/top-sellers/styles')return route.fulfill({json:{records:[{style:'PC54'}]}});
  if(p==='/api/service-codes')return route.fulfill({json:pricing('service-codes.json')});
  if(p==='/api/pricing-bundle'){
   const method=u.searchParams.get('method'),files={PATCH:'patch-bundle.json',BLANK:'blank-bundle-PC54.json',DTF:'dtf-bundle.json',EMB:'emb-bundle-PC54.json','EMB-AL':'emb-al-bundle.json',CAP:'cap-bundle-C112.json','CAP-AL':'cap-al-bundle.json','CAP-PUFF':'cap-puff-bundle.json',ScreenPrint:'scp-bundle-PC61.json'};
   if(method==='DTG'||files[method]){const data=method==='DTG'?clone(dtg):pricing(files[method]);if(method==='DTF')data.sizes=Object.entries(sizePricing(style)[0].basePrices).map(([size,price],i)=>({size,price,sortOrder:i+1}));return route.fulfill({status:state.pricingFailed?503:200,json:data});}
  }
  if(p==='/api/al-pricing'){
   const category=(file,stitches)=>({baseStitches:stitches,basePrices:Object.fromEntries(pricing(file).allEmbroideryCostsR.filter(r=>r.StitchCount===stitches).map(r=>[r.TierLabel,r.EmbroideryCost])),perThousandUpcharge:stitches===5000?1:1.25,ltmThreshold:7,ltmFee:50});
   return route.fulfill({json:{garments:category('emb-al-bundle.json',8000),caps:category('cap-al-bundle.json',5000)}});
  }
  if(p==='/api/decg-pricing')return route.fulfill({json:{fullBack:{minStitches:25000,ratesPerThousand:{'1-7':1.6,'8-23':1.4,'24-47':1.2,'48-71':1.1,'72+':1}}}});
  if(p.startsWith('/api/sanmar/inventory/')){const sizes=p.includes('C112')?['OSFA']:['S','M','L','XL','2XL','3XL','4XL'],qty=state.out?0:125;return route.fulfill({status:state.stockFailed?503:200,json:{grandTotal:sizes.length*qty,inventory:sizes.map(size=>({size,totalQty:qty,warehouses:[{id:1,name:'Synthetic warehouse',qty}]}))}});}
  // Axe fetches these same linked styles to evaluate contrast.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)||(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css')||(u.hostname==='cdn.jsdelivr.net'&&p==='/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css'))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(request.resourceType())){events.unknown.push(request.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const file=decodeURIComponent(p.slice(1)),absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   if(state.safetyBuilder&&p===state.url){
    // Exercise the component under each builder's actual stylesheet order without
    // booting order workflows. Keep the mount's ancestry and all body attributes.
    const {JSDOM}=require('jsdom'),dom=new JSDOM(fs.readFileSync(absolute,'utf8')),d=dom.window.document;
    d.querySelectorAll('script').forEach(n=>n.remove());
    let child=d.getElementById(state.safetyBuilder+'-safety-recs');
    if(!child)throw Error('Builder safety mount missing');
    while(child.parentElement){const parent=child.parentElement;parent.replaceChildren(child);if(parent===d.body)break;child=parent;}
    const script=d.createElement('script');script.src='/shared_components/js/safety-stripe-recs.js';d.body.appendChild(script);
    return route.fulfill({contentType:'text/html',body:dom.serialize()});
   }
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(absolute)]||'application/octet-stream',body:state.original&&original.hashes[file]?Buffer.from(source(file)):fs.readFileSync(absolute)});
  }
  const allowedScripts=['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js','https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'];
  if(['image','font','stylesheet'].includes(request.resourceType())||allowedScripts.includes(u.href))return route.continue();
  events.unknown.push(request.url());return route.fulfill({status:503});
 });
 await page.goto(state.url);await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('[id]'))if(visible(n)&&!n.querySelector('[id]')&&!['SCRIPT','STYLE'].includes(n.tagName)){ let text=n.innerText||n.textContent;for(const control of n.querySelectorAll('[data-quick-quote-control]'))text=text.replace(control.innerText,'');ids[n.id]=norm(text); }
 return{title:document.title,url:location.pathname+location.search,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,name:n.name,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),tables:[...document.querySelectorAll('table')].filter(visible).map(n=>norm(n.innerText)),overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
function check(expect,e){expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.missing).toEqual([]);}
module.exports={open,snapshot,source,check};
