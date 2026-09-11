const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/catalog-storefront-original-content.json');
const pricing=name=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/pricing',name),'utf8'));
const dtgCanonical=require('../../../shared_components/js/dtg-canonical-pricing');
const tees=require('../../fixtures/custom-apparel-api-fixtures.json').tees;
// Declared synthetic API data: real canonical totals and browser ladder,
// without sending a real quote request. FF/FB use the fixture's jumbo costs.
const dtgBundle={product:{styleNumber:'PC61',title:'Core Cotton Tee'},pricing:{tiers:tees.tiersR,costs:[...tees.allDtgCostsR,...tees.allDtgCostsR.filter(r=>['JF','JB'].includes(r.PrintLocationCode)).map(r=>({...r,PrintLocationCode:r.PrintLocationCode==='JF'?'FF':'FB'}))],sizes:tees.sizes,upcharges:tees.sellingPriceDisplayAddOns}};
// An additional complete synthetic ladder covers the low-quantity costs missing
// from the inherited apparel fixture, without changing its immutable contracts.
const completeDtgBundle=JSON.parse(JSON.stringify(dtgBundle));
completeDtgBundle.pricing.costs=completeDtgBundle.pricing.costs.filter(r=>!['FF','FB'].includes(r.PrintLocationCode));
for(const PrintLocationCode of ['FF','FB'])for(const [TierLabel,PrintCost]of [['1-11',12],['12-23',11],['24-47',10],['48-71',9],['72+',8]])completeDtgBundle.pricing.costs.push({PrintLocationCode,TierLabel,PrintCost});
const colors=[{name:'Jet Black',catalog:'JetBlack'},{name:'Brilliant Orange',catalog:'BrillOrng'}],sizes=['S','M','L','XL','2XL','3XL'];
const garment='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="600" height="720" fill="white"/><path d="M175 80L235 60Q300 125 365 60L425 80L545 200L455 285L415 240L425 640L175 640L185 240L145 285L55 200Z" fill="#263b46"/></svg>';
const image='/__catalog-fixture/garment.svg';
function source(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
function products(){return ['PC61','PC54','K500','C112'].map((styleNumber,i)=>({styleNumber,productName:['Core Cotton Tee','Essential Cotton Tee','Silk Touch Polo','Embroidered Cap'][i],brand:i===2?'Port Authority':'Port & Company',category:i===3?'Caps':i===2?'Polos/Knits':'T-Shirts',subcategory:'100% Cotton',description:'Comfortable, durable 100% cotton apparel for the whole team.',displayPriceLabel:['$19.25 with embroidery','$18.75 with embroidery','$25.50 with embroidery','$22.50 with embroidery'][i],images:{main:image,display:image,thumbnail:image},colors:colors.map(c=>({name:c.name,catalogColor:c.catalog,swatchUrl:image,productImageUrl:image})),sizes:i===3?['OSFA']:sizes,features:{isTopSeller:i<2,isNew:i===2}}));}
function details(style){const p=products().find(p=>p.styleNumber===style)||products()[0];return colors.map(c=>({STYLE:style,PRODUCT_TITLE:p.productName,BRAND_NAME:p.brand,CATEGORY_NAME:p.category,SUBCATEGORY_NAME:p.subcategory,PRODUCT_DESCRIPTION:p.description,PRODUCT_STATUS:'Active',CATALOG_COLOR:c.catalog,COLOR_NAME:c.name,COLOR_SQUARE_IMAGE:image,FRONT_MODEL:image,BACK_MODEL:image,FRONT_FLAT:image,BACK_FLAT:image,PRODUCT_IMAGE:image}));}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[],dialogs:[]};
 const dtgData=state.completeDtg?completeDtgBundle:dtgBundle;
 await page.clock.setFixedTime(new Date('2026-09-11T18:30:00.000Z'));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};Math.random=()=>0.375;});
 page.on('pageerror',e=>events.errors.push(e.message));
 page.on('dialog',async d=>{events.dialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method(),local=['localhost','127.0.0.1'].includes(u.hostname);
  if(p==='/api/dtg/quote-pricing'&&method==='POST'){
   const body=req.postDataJSON();events.reads.push({path:p,method,body});
   return route.fulfill({status:state.pricingFailed?503:200,json:dtgCanonical.priceLines({...body,bundlesByStyle:Object.fromEntries(body.lines.map(l=>[l.styleNumber,dtgData]))})});
  }
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({path:p,method});return route.fulfill({status:503});}
  if(p.startsWith('/api/'))events.reads.push({path:p,query:u.search});
  if(p.startsWith('/__catalog-fixture/')||p==='/api/image-proxy')return route.fulfill({contentType:'image/svg+xml',body:garment});
  if(p==='/api/all-brands')return route.fulfill({json:{brands:[{name:'Port & Company',logo:image},{name:'Port Authority',logo:image},{name:'Carhartt',logo:image}]}});
  if(p==='/api/blog-posts')return route.fulfill({json:{posts:state.blogEmpty?[]:[{slug:'example-team-guide',title:'Choosing apparel for your team',category:'Apparel guides',metaDescription:'A synthetic article preview for the original layout review.',publishedAt:'2026-09-01',heroImageUrl:image}]}});
  if(p==='/api/blog-product-map')return route.fulfill({json:{}});
  if(p==='/api/safety-stripes/top-sellers/styles')return route.fulfill({json:{records:[]}});
  if(p==='/api/dtg/top-sellers/styles')return route.fulfill({json:{records:[{style:'PC54'},{style:'PC61'}]}});
  if(p==='/api/caps/catalog')return route.fulfill({json:[{style:'C112'}]});
  if(p==='/api/decoration-methods')return route.fulfill({status:state.rulesFailed?503:200,json:{rules:['T-Shirts','Polos/Knits','Caps'].map(category=>({category,EMB:true,DTG:!!state.allMethods,SCP:!!state.allMethods,DTF:!!state.allMethods})),overrides:[]}});
  if(p==='/api/products/search'){
   if(state.searchFailed)return route.fulfill({status:503,json:{error:'Synthetic catalog unavailable'}});
   const q=(u.searchParams.get('q')||'').toLowerCase(),brand=u.searchParams.get('brand'),category=u.searchParams.get('category');
   let list=state.empty?[]:products().filter(r=>(!q||(r.styleNumber+' '+r.productName).toLowerCase().includes(q))&&(!brand||r.brand===brand)&&(!category||category.split(',').includes(r.category)));
   const sort=u.searchParams.get('sort');if(sort==='name_asc')list.sort((a,b)=>a.productName.localeCompare(b.productName));if(sort==='name_desc')list.sort((a,b)=>b.productName.localeCompare(a.productName));
   const pageNumber=Number(u.searchParams.get('page')||1),total=state.pages?52:list.length;
   if(state.pages&&pageNumber===1)list=Array.from({length:48},(_,i)=>({...products()[i%4],styleNumber:'TEST'+String(i+1).padStart(2,'0')}));
   return route.fulfill({json:{success:true,data:{products:list,pagination:{page:pageNumber,limit:48,total,totalPages:state.pages?2:1},facets:{categories:['T-Shirts','Caps','Polos/Knits'].map(name=>({name,count:2})),brands:[{name:'Port & Company',count:3},{name:'Port Authority',count:1}],priceRanges:[]}}}});
  }
  if(p==='/api/stylesearch')return route.fulfill({json:products().filter(r=>r.styleNumber.toLowerCase().includes((u.searchParams.get('term')||'').toLowerCase())).map(r=>({value:r.styleNumber,label:r.productName,thumb:image}))});
  if(p==='/api/product-details')return route.fulfill({status:state.productFailed?503:200,json:state.productEmpty?[]:details(u.searchParams.get('styleNumber')||'PC61')});
  if(p.startsWith('/api/sanmar/inventory/'))return route.fulfill({status:state.stockFailed?503:200,json:{inventory:colors.flatMap(c=>(p.includes('C112')?['OSFA']:sizes).map(size=>({color:c.catalog,size,totalQty:state.out?0:500}))) }});
  if(p==='/api/dtg/product-bundle')return route.fulfill({status:state.pricingFailed?503:200,json:dtgData});
  if(p==='/api/service-codes')return route.fulfill({json:pricing('service-codes.json')});
  if(p==='/api/al-pricing'){
   const category=(file,stitches)=>({baseStitches:stitches,basePrices:Object.fromEntries(pricing(file).allEmbroideryCostsR.filter(r=>r.StitchCount===stitches).map(r=>[r.TierLabel,r.EmbroideryCost])),perThousandUpcharge:stitches===5000?1:1.25,ltmThreshold:7,ltmFee:50});
   return route.fulfill({json:{garments:category('emb-al-bundle.json',8000),caps:category('cap-al-bundle.json',5000)}});
  }
  if(p==='/api/decg-pricing')return route.fulfill({json:{fullBack:{minStitches:25000,ratesPerThousand:{'1-7':1.6,'8-23':1.4,'24-47':1.2,'48-71':1.1,'72+':1}}}});
  if(p==='/api/size-pricing')return route.fulfill({json:pricing('size-pricing-'+(u.searchParams.get('styleNumber')==='C112'?'C112':'PC61')+'.json')});
  if(p==='/api/pricing-bundle'){
   if(u.searchParams.get('method')==='PATCH')return route.fulfill({json:pricing('patch-bundle.json')});
   const files={'EMB':'emb-bundle-PC54.json','EMB-AL':'emb-al-bundle.json','CAP':'cap-bundle-C112.json','CAP-AL':'cap-al-bundle.json','CAP-PUFF':'cap-puff-bundle.json','BLANK':'blank-bundle-PC61.json','DTF':'dtf-bundle.json','ScreenPrint':'scp-bundle-PC61.json'};
   const f=files[u.searchParams.get('method')];if(f){const data=pricing(f);if(u.searchParams.get('method')==='DTF')data.sizes=Object.entries(pricing('size-pricing-PC61.json')[0].basePrices).map(([size,price],i)=>({size,price,sortOrder:i+1}));return route.fulfill({status:state.pricingFailed?503:200,json:data});}
  }
  if(p==='/api/color-swatches')return route.fulfill({json:details(u.searchParams.get('styleNumber'))});
  if(p==='/api/sizes-by-style-color')return route.fulfill({status:state.stockFailed?503:200,json:{style:u.searchParams.get('styleNumber'),color:u.searchParams.get('color'),sizes,warehouses:[{name:'Synthetic warehouse',inventory:sizes.map(()=>state.out?0:500)}]}});
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')return route.continue();
  if(u.hostname==='cdnjs.cloudflare.com'&&req.resourceType()==='stylesheet')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(local){
   const alias={'/':'index.html','/catalog':'pages/catalog.html','/catalog.html':'pages/catalog.html'},file=alias[p]||decodeURIComponent(p.slice(1)),resolved=path.resolve(root,file);
   if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   const body=state.original&&original.hashes[file]?Buffer.from(source(file)):fs.readFileSync(resolved);
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'}[path.extname(resolved)]||'application/octet-stream',body});
  }
  if(['image','font','stylesheet'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto(state.url||'/');await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('main [id],#quoteCartBadge,#sampleCartBadge,#qvBody,#sidebar'))if(visible(n)&&n.id&&!n.querySelector('[id]'))ids[n.id]=norm(n.innerText||n.textContent);
 return {title:document.title,url:location.pathname+location.search+location.hash,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,name:n.name,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),selection:window.PdpConfigurator?JSON.parse(JSON.stringify(window.PdpConfigurator.getSelection())):null,overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
function check(expect,e){expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.missing).toEqual([]);}
module.exports={open,snapshot,check,source};
