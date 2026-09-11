const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/contract-calculators-original-content.json');
const tiers=['1-7','8-23','24-47','48-71','72+'],dtgTiers=['1-23','24-47','48-71','72+'];
function prices(fee=false){return Object.fromEntries([['garments',1.23],['caps',1.47],['fullBack',1.67]].map(([key,base])=>[key,{perThousandRates:Object.fromEntries(tiers.map((t,i)=>[t,Math.round((base-i*.11)*100)/100])),minStitches:key==='fullBack'?25000:8000,ltmFee:fee?37:0,ltmThreshold:23}]));}
const dtg={tiers:dtgTiers,locations:['LC','FF','FB','JF','JB'],costs:['LC','FF','FB','JF','JB'].flatMap((loc,j)=>dtgTiers.map((t,i)=>({PrintLocationCode:loc,TierLabel:t,PrintCost:6.25+j*2-i*.75}))),ltm:{fee:37,threshold:23},heavyweight:{upcharge:1.75}};
function source(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
async function open(page,state={}){
 const events={errors:[],unknown:[],writes:[],mocked:[],missing:[],dialogs:[]};
 await page.clock.setFixedTime(new Date('2026-09-11T18:30:00.000Z'));
 await page.context().addInitScript(()=>{window.__prints=[];window.print=()=>window.__prints.push(document.body.className);window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied.push(t);}}});});
 page.on('pageerror',e=>events.errors.push(e.message));page.on('dialog',async d=>{events.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method();
  if(state.chat&&/^\/api\/quote-sequence\/(?:CEMB|CDTG)$/.test(p)){events.mocked.push({path:p,method});return route.fulfill({json:{quoteID:p.endsWith('CEMB')?'CEMB-2026-EXAMPLE':'CDTG-2026-EXAMPLE'}});}
  if(state.chat&&/^\/api\/contract-(?:dtg|embroidery)-ai\/chat$/.test(p)&&method==='POST'){
   events.mocked.push({path:p,method,body:req.postDataJSON()});
   return route.fulfill(state.chatFailed?{status:503}:{contentType:'text/event-stream',body:'event: delta\ndata: '+JSON.stringify({text:'Synthetic quote assistant. Please provide the customer details.'})+'\n\nevent: done\ndata: {}\n\n'});
  }
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({path:p,method});return route.fulfill({status:503});}
  if(p==='/api/contract-pricing')return route.fulfill({status:state.failed?503:200,json:prices(state.fee)});
  if(p==='/api/contract-dtg/print-costs')return route.fulfill({status:state.failed?503:200,json:dtg});
  if(p==='/api/service-codes'&&u.searchParams.get('code')==='CTR-MIN-ORDER')return route.fulfill({status:state.failedMin?503:200,json:[{ServiceCode:'CTR-MIN-ORDER',SellPrice:state.minimum??250,IsActive:true}]});
  if(p==='/api/contract-embroidery/cost-model')return route.fulfill(state.staff?{json:{productionHourRate:63,orderPool:47,asOf:'synthetic'}}:{status:401});
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const file=decodeURIComponent(p.slice(1)),abs=path.resolve(root,file);if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||!fs.statSync(abs).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(abs)]||'application/octet-stream',body:state.original&&original.hashes[file]?Buffer.from(source(file)):fs.readFileSync(abs)});
  }
  if(['image','font','stylesheet'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto(state.url);await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('[id]'))if(visible(n)&&!n.querySelector('[id]')&&!['SCRIPT','STYLE'].includes(n.tagName))ids[n.id]=norm(n.innerText||n.textContent);
 return{title:document.title,url:location.pathname+location.search,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),tables:[...document.querySelectorAll('table')].filter(visible).map(n=>norm(n.innerText)),headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(n=>norm(n.textContent)),overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
function check(expect,e){for(const k of ['errors','unknown','writes','missing'])expect(e[k],k).toEqual([]);}
module.exports={open,snapshot,source,check};
