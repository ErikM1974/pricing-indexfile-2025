const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/calculator-reference-original-content.json');
const pricing=name=>JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/pricing',name),'utf8'));
const dtg=JSON.parse(JSON.stringify(require('../../fixtures/custom-apparel-api-fixtures.json').tees));
// Complete, explicitly synthetic cost ladders exercise the actual canonical math.
dtg.allDtgCostsR=[];
for(const [location,base]of [['LC',7],['FF',10],['FB',10],['JF',12],['JB',12]])for(const [i,tier]of dtg.tiersR.entries())dtg.allDtgCostsR.push({PrintLocationCode:location,TierLabel:tier.TierLabel,PrintCost:base+4-i});
const categories=['Sewing','Embroidery on your goods','DTF (Direct-to-Film)','Finishing','Laser engraving on your items','Special work'];
function menuRows(long=false){const rows=pricing('service-codes.json').data;
for(const[ServiceCode,SellPrice]of [['SHOP-JOB-MIN',75],['SHOP-BENCH-QH',25],['SHOP-MACHINE-QH',37.5],['SHOP-MATERIAL-DENOM',0.53]])rows.push({ServiceCode,SellPrice,ServiceType:'SHOP',Position:'RULE',IsActive:true});
for(const[categoryIndex,Category]of categories.entries())for(let i=0;i<(long?7:2);i++)rows.push({ServiceCode:'SHOP-EXAMPLE-'+categoryIndex+'-'+i,ServiceType:'SHOP',Category,DisplayName:(long?'Synthetic service with a long descriptive title for wrapping ':'Example service ')+(i+1),SellPrice:categoryIndex*2+3.75+i,AliasFor:'EX-'+categoryIndex+'-'+i,PerUnit:i===1?'upcharge each':'each',UnitCost:8+i,Position:categoryIndex%2?'MACHINE':'BENCH',SortOrder:categoryIndex*10+i,IsActive:true});
rows.push({ServiceCode:'SHOP-PUFF-EXAMPLE',ServiceType:'SHOP',Category:'Embroidery on your goods',DisplayName:'Example 3D puff',SellPrice:5,PerUnit:'add-on',AliasFor:'PUFF',UnitCost:4,IsActive:true});
rows.push({ServiceCode:'EX-0-0',SellPrice:8,IsActive:true});
return rows;}
function source(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],dialogs:[]};
 await page.clock.setFixedTime(new Date('2026-09-11T18:30:00.000Z'));
 await page.context().addInitScript(()=>{window.__printViews=[];window.print=()=>window.__printViews.push(document.body.className);});
 page.on('pageerror',e=>events.errors.push(e.message));page.on('dialog',async d=>{events.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname,method=request.method();
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({path:p,method});return route.fulfill({status:503});}
  if(p.startsWith('/api/'))events.reads.push({path:p,query:u.search});
  if(p==='/api/service-codes')return route.fulfill({status:state.failed?503:200,json:state.empty?[]:menuRows(state.long)});
  if(p==='/api/pricing-bundle'){
   const method=u.searchParams.get('method'),files={DTF:'dtf-bundle.json',EMB:'emb-bundle-PC54.json',CAP:'cap-bundle-C112.json',ScreenPrint:'scp-bundle-PC61.json'};
   if(method==='DTG'||files[method])return route.fulfill({status:state.failed||state.failedMethod===method?503:200,json:method==='DTG'?dtg:pricing(files[method])});
  }
  // Axe reads cross-origin styles with fetch to evaluate contrast rules.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)||(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css'))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(request.resourceType())){events.unknown.push(request.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const file=decodeURIComponent(p.slice(1)),absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   const body=state.original&&original.hashes[file]?Buffer.from(source(file)):fs.readFileSync(absolute);
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(absolute)]||'application/octet-stream',body});
  }
  if(['image','font','stylesheet'].includes(request.resourceType()))return route.continue();
  events.unknown.push(request.url());return route.fulfill({status:503});
 });
 await page.goto(state.url||'/calculators/manual-pricing.html');await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('[id]'))if(visible(n)&&!n.querySelector('[id]')&&!['SCRIPT','STYLE'].includes(n.tagName))ids[n.id]=norm(n.innerText||n.textContent);
 return{title:document.title,url:location.pathname+location.search,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),tables:[...document.querySelectorAll('table')].filter(visible).map(n=>norm(n.innerText)),menu:[...document.querySelectorAll('.course')].filter(visible).map(n=>norm(n.innerText)),rules:[...document.querySelectorAll('[data-rule]')].map(n=>[n.dataset.rule,n.textContent]),itemType:window.manualCalc?.currentItemType||null,cost:window.manualCalc?.currentCost||null,overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
function check(expect,e){expect(e.errors).toEqual([]);expect(e.writes).toEqual([]);expect(e.unknown).toEqual([]);expect(e.missing).toEqual([]);}
module.exports={open,snapshot,source,check};
