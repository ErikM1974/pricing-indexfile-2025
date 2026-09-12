const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/webstore-calculator-original-content.json');
const customer={name:'Example Customer',email:'example@example.invalid',company:'Example Company',phone:'555-0100'};
const setup=(type='Open/Close')=>({productType:'webstore-setup',partNumber:'WEB-SETUP',lineItems:[{partNumber:'WEB-SETUP',description:'Example branded store setup',quantity:1,pricePerUnit:300,totalPrice:300},{partNumber:'DIG-100',description:'Example logo digitization',quantity:2,pricePerUnit:100,totalPrice:200}],storeConfig:{storeType:type,surchargePerItem:type==='Open/Close'?2:6,expectedAnnualVolume:500,minimumAnnualGuarantee:2000},appliedRules:{minimumRisk:'Example annual sales minimum warning.'}});
const fundraiser={productType:'fundraiser-item',pricing:{blankCost:8,donation:5,margin:0.43,ccFee:0.03,embellishment:7,sellPrice:32.11},appliedRules:{note:'Example fundraiser policy.'}};
function source(file){let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
async function open(page,state={}){
 const events={errors:[],unknown:[],writes:[],missing:[],mocked:[],dialogs:[]};
 await page.clock.setFixedTime(new Date('2026-09-12T18:30:00.000Z'));
 await page.context().addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async s=>window.__copied.push(s)}});window.print=()=>{};});
 page.on('pageerror',e=>events.errors.push(e.message));page.on('dialog',async d=>{events.dialogs.push(d.message());await d.dismiss();});
 let itemFailure=false, sequence=900, replies=0;
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method();
  if(p==='/api/quote-sequence/WEB'&&method==='GET'){events.mocked.push({path:p,method});return route.fulfill({json:{prefix:'WEB',year:2026,sequence:++sequence}});}
  if(p==='/api/contract-webstore-ai/chat'&&method==='POST'){
   events.mocked.push({path:p,method,body:req.postDataJSON()});
   const price=state.fundraiser?fundraiser:setup(state.onDemand?'On-Demand':'Open/Close');
   replies++; if(state.changedQuote&&replies>2){price.lineItems[0].pricePerUnit=600;price.lineItems[0].totalPrice=600;}
   const reply='Example webstore quote ready.\nPRICE_QUOTE START\n'+JSON.stringify(price)+'\nPRICE_QUOTE END\nCUSTOMER_FINAL START\n'+JSON.stringify(customer)+'\nCUSTOMER_FINAL END\nEMAIL DRAFT START\nTo: example@example.invalid\nSubject: Example webstore quote\n\nExample store and fundraiser quote for your review.\nEMAIL DRAFT END';
   const search={tool:'web_search',result:{results:[{title:'Example store reference',url:'https://example.invalid/store',content:'Synthetic reference for storefront planning.'}]}};
   return route.fulfill(state.chatFailed?{status:503}:{contentType:'text/event-stream',body:(state.search?'event: tool_result\ndata: '+JSON.stringify(search)+'\n\n':'')+'event: delta\ndata: '+JSON.stringify({text:reply})+'\n\nevent: done\ndata: {}\n\n'});
  }
  if(['/api/quote_sessions','/api/quote_items'].includes(p)&&method==='POST'){
   const body=req.postDataJSON();events.mocked.push({path:p,method,body});
   if(state.holdSession&&p==='/api/quote_sessions')await state.holdSession;
   if(state.sessionFailed&&p==='/api/quote_sessions')return route.fulfill({status:503});
   if(state.itemFailed&&p==='/api/quote_items'&&(!state.itemFailedLine||body.LineNumber===state.itemFailedLine)&&!itemFailure){itemFailure=true;return route.fulfill({status:503});}
   return route.fulfill({json:{success:true}});
  }
  if(!['GET','HEAD'].includes(method)||/quote-sequence|logout/.test(p)){events.writes.push({path:p,method});return route.fulfill({status:503});}
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)||(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css'))return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const file=decodeURIComponent(p.slice(1)),absolute=path.resolve(root,file);
   if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream',body:state.original&&original.hashes[file]?Buffer.from(source(file)):fs.readFileSync(absolute)});
  }
  if(['image','font','stylesheet'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto('/calculators/webstores.html');await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const norm=s=>s.replace(/\s+/g,' ').trim(),visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',ids={};
 for(const n of document.querySelectorAll('[id]'))if(visible(n)&&!n.querySelector('[id]')&&!['SCRIPT','STYLE'].includes(n.tagName))ids[n.id]=norm(n.innerText||n.textContent);
 return{title:document.title,url:location.pathname,ids,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(n=>norm(n.textContent)),fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,value:n.value,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),cards:[...document.querySelectorAll('.webstore-quote-card,.fundraiser-quote-card,.email-draft-card')].map(n=>norm(n.textContent)),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });}
function check(expect,e){for(const key of ['errors','unknown','writes','missing'])expect(e[key],key).toEqual([]);}
module.exports={open,snapshot,source,check};
