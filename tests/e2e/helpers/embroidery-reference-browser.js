const fs=require('node:fs'),path=require('node:path'),parser=require('@babel/parser');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/embroidery-reference-original-content.json');
const tiers=['1-7','8-23','24-47','48-71','72+'],ladder=values=>Object.fromEntries(tiers.map((t,i)=>[t,values[i]]));
const keyAccounts=['Example Alpine Team','Example Harbor Team','Example Summit Team'].map((name,i)=>({name,rep:['Nika Lao','Taneisha Clark','House'][i],designs:[{name:'Example crest '+(i+1),designNo:9901+i,stitches:14000,over:4000,part:'AS-Garm',charge:4},{name:'Example jacket-back '+(i+1),designNo:9911+i,stitches:23000,over:13000,part:'AS-Garm',charge:10}]}));
const customers=['Mid','Large','Both','Mid'].map((tier,i)=>({id:900001+i,company:'Example Company '+String.fromCharCode(65+i),first:'Example',last:'Contact '+String.fromCharCode(65+i),email:'customer-'+i+'@example.invalid',phone:'555-010'+i,rep:['Nika Lao','Taneisha Clark','House','House'][i],tier,designs:[{name:'Example stitched crest '+i,stitches:tier==='Mid'?14000:23000,tier:tier==='Mid'?'Mid':'Large',charge:tier==='Mid'?'+$4.00 / piece':'+$10.00 / piece',design_number:99001+i}]}));
const synthetic={KEY_ACCOUNT_SURCHARGES:keyAccounts,SURCHARGE_CUSTOMERS:customers};
function sanitize(text){
 const declarations=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&Object.hasOwn(synthetic,n.id?.name))declarations.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
 visit(parser.parse(text));if(declarations.length!==2)throw Error('Both private account initializers must be replaced');
 for(const n of declarations.sort((a,b)=>b.init.start-a.init.start))text=text.slice(0,n.init.start)+JSON.stringify(synthetic[n.id.name])+text.slice(n.init.end);
 return text;
}
function source(file,{baseline=false}={}){
 let text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 if(baseline)for(const c of original.changes.filter(c=>c.file===file).reverse()){if(text.split(c.after).length-1!==c.count)throw Error('Source mapping drift: '+file);text=text.split(c.after).join(c.before);}
 return file==='calculators/embroidery-pricing-all/embroidery-pricing-all.js'?sanitize(text):text;
}
async function open(page,state={}){
 const e={errors:[],unknown:[],writes:[],missing:[],reads:[],dialogs:[]};
 await page.clock.setFixedTime(new Date('2026-09-12T21:00:00Z'));
 await page.context().addInitScript(()=>{window.__prints=0;window.print=()=>{window.__prints++;window.dispatchEvent(new Event('beforeprint'));};window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied.push(text);}}});});
 page.on('pageerror',err=>e.errors.push(err.message));page.on('dialog',async d=>{e.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(!['GET','HEAD'].includes(req.method())||/quote-sequence|logout/.test(p)){e.writes.push(p);return route.fulfill({status:503});}
  if(p.startsWith('/api/'))e.reads.push(p+u.search);
  if(p==='/api/contract-pricing')return route.fulfill({status:state.failed?503:200,json:Object.fromEntries([['garments',1.8],['caps',2],['fullBack',2.2]].map(([k,rate])=>[k,{perThousandRates:ladder(tiers.map((_,i)=>rate-i*.2)),minStitches:k==='fullBack'?25000:8000,ltmFee:50,ltmThreshold:7}]))});
  if(p==='/api/al-pricing'||p==='/api/decg-pricing')return route.fulfill({json:{garments:{basePrices:ladder(p==='/api/al-pricing'?[16,14.25,12.75,11.75,11.25]:[22,19,17,16,15]),baseStitches:8000,perThousandUpcharge:1.25,ltmFee:50,ltmThreshold:7},caps:{basePrices:ladder([15,13,11,10,9]),baseStitches:5000,perThousandUpcharge:1,ltmFee:50,ltmThreshold:7},heavyweightSurcharge:10}});
  if(p==='/api/embroidery-costs')return route.fulfill({status:state.upgradesFailed?503:200,json:[{EmbroideryCost:5}]});
  if(p==='/api/pricing-bundle')return route.fulfill({status:state.stitchesFailed?503:200,json:{allEmbroideryCostsR:[{ItemType:'AS-Garm',StitchCount:15000,EmbroideryCost:4},{ItemType:'AS-Garm',StitchCount:18000,EmbroideryCost:10}]}});
  // Axe re-fetches the page's linked font/icon stylesheets for contrast checks.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)||(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css'))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){e.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   let file=decodeURIComponent(p.slice(1));if(file.endsWith('/'))file+='index.html';const absolute=path.resolve(root,file);
   if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){e.missing.push(p);return route.fulfill({status:404});}
   const isSource=Object.hasOwn(original.hashes,file);
   return route.fulfill({contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream',body:isSource?source(file,{baseline:state.original}):fs.readFileSync(absolute)});
  }
  if(['stylesheet','font','image'].includes(req.resourceType()))return route.continue();
  e.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto(state.url||'/calculators/embroidery-pricing-all/index.html');await page.evaluate(()=>document.fonts.ready);return e;
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('[id]'))if(!n.id.startsWith('embroidery-account-')&&visible(n)&&!n.querySelector('[id]:not([id^="embroidery-account-"])')&&!['SCRIPT','STYLE'].includes(n.tagName))ids[n.id]=norm(n.innerText||n.textContent);
 return{title:document.title,url:location.pathname+location.search,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),tables:[...document.querySelectorAll('table')].filter(visible).map(n=>norm(n.innerText)),headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(n=>norm(n.textContent)),overflow:document.documentElement.scrollWidth>innerWidth+1};
});}
function check(expect,e){for(const k of ['errors','unknown','writes','missing'])expect(e[k],k).toEqual([]);}
module.exports={open,source,sanitize,synthetic,snapshot,check};
