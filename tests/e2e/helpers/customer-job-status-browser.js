const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),source=require('../../fixtures/customer-job-status-original-content.json'),quoteId='OF0910-7401',jobId='LNP-7401',now='2026-09-10T19:00:00Z';
function originalFile(file){const retired=source.retiredStyles.find(r=>r.file===file);if(retired)return retired.css;let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of source.changes.filter(c=>c.file===file).reverse()){if(s.split(c.after).length-1!==c.count)throw Error('Original mapping drift '+file);s=s.split(c.after).join(c.before);}return s;}
function order(mode='paid'){
 const d={quoteID:quoteId,status:'paid',deliveryMethod:'ship',styleName:'Core Cotton Tee',orderDate:'2026-09-08T19:00:00Z',rush:false,shipPromise:{mode:'standard-7to10',rangeLabel:'September 17–22, 2026'},trackingNumber:'',items:[{color:'Navy',size:'XL',qty:2,unitPrice:20},{color:'Navy',size:'3XL',qty:1,unitPrice:25}],totals:{subtotal:65,ltmFee:15,shipping:10,tax:9,grandTotal:99},mockups:[{url:'/__job-fixture/front.png',color:'Navy',view:'Front'},{url:'/__job-fixture/back.png',color:'Navy',view:'Back'}]};
 if(['pending-payment','in-production','shipped','pickup-ready-soon'].includes(mode))d.status=mode;
 if(mode==='shipped')d.trackingNumber='REVIEW-UPS-7401 / ONLY';
 if(mode==='pickup-ready-soon'){d.deliveryMethod='pickup';d.shipPromise={label:'September 18, 2026'};d.totals.shipping=0;d.totals.grandTotal=89;}
 if(mode==='rush'){d.rush=true;d.shipPromise={label:'September 15, 2026'};}
 if(mode==='free-shipping'){d.totals.shipping=0;d.totals.grandTotal=89;}
 if(mode==='no-fee-tax'){d.totals={subtotal:65,ltmFee:0,shipping:10,tax:0,grandTotal:75};}
 if(mode==='empty'){d.items=[];d.mockups=[];d.totals={subtotal:0,ltmFee:0,shipping:0,tax:0,grandTotal:0};d.shipPromise={};}
 if(mode==='escaped'){d.styleName='<img src=x onerror=alert(1)> & Sample';d.items[0].color='Navy <sample> & White';d.items[0].size='4XL / Extended';d.shipPromise.rangeLabel='September <17> & 22';}
 if(mode==='long'){d.items=Array.from({length:28},(_,i)=>({color:'Synthetic long color name '+(i+1),size:i%2?'4XL':'XS',qty:i+1,unitPrice:20}));d.totals={subtotal:8120,ltmFee:0,shipping:0,tax:812,grandTotal:8932};}
 return d;
}
function vendor(mode='normal'){
 const vendor={name:'Example Screen Printing',contactName:'River Sample',email:'vendor@example.test'};
 const first={id:jobId,companyName:'Cedar Example Construction',customerName:'Customer Example',designNumber:'44012',status:'Requested',requestedAt:'2026-09-08T12:00:00',neededBy:'2026-09-09',estimatedShipDate:'2026-09-14',isRush:true,fileCount:2,mockupThumbnailUrl:'/__job-fixture/thumb.png',shopworksPO:'PO-SYNTHETIC',salesRepName:'Example Rep',transferType:'Screen Print',fabricTarget:'Cotton',colorCount:2,primaryColor:'White',additionalColors:'Forest Green',specialInstructions:'Keep the approved size and placement.',fileNotes:'Use the supplied vector artwork.'};
 const jobs=[first,{...first,id:'LNP-7402',companyName:'Milton Example Team',status:'Received',isRush:false,neededBy:'2026-09-08',fileCount:0,mockupThumbnailUrl:''},{...first,id:'LNP-7403',companyName:'Cancelled Example',status:'Cancelled',isRush:false,neededBy:'2026-09-25',fileCount:1,mockupThumbnailUrl:''},{...first,id:'LNP-7404',companyName:'Future Example',status:'In_Production',isRush:false,neededBy:'2026-09-25'}];
 const detail={job:first,lines:[{quantity:24,transferSize:'Full front',widthIn:11,heightIn:12,pressCount:1,notes:'Adult XS–4XL'},{quantity:12,transferSize:'Left chest',widthIn:4,heightIn:3,pressCount:2,notes:'White underbase'}],files:[{fileName:'Approved mockup.png',fileType:'mockup',mime:'image/png',widthPx:1200,heightPx:800,thumbnailUrl:'/__job-fixture/mockup.png',fileUrl:'https://files.example.test/approved-mockup.png',notes:'Approved placement'},{fileName:'Cedar-Example-Print-Ready-Artwork-Long-Filename.ai',fileType:'artwork',mime:'application/postscript',widthIn:11,heightIn:12,fileUrl:'https://files.example.test/print-ready.ai'}],notes:[{authorName:'Example Rep',createdAt:'2026-09-08T12:00:00',text:'Please confirm receipt.',type:'comment'},{authorName:'River Sample (Example Screen Printing)',createdAt:'2026-09-09T12:00:00',text:'Files received. Checking placement.',type:'comment'},{authorName:'NWCA',createdAt:'2026-09-10T12:00:00',text:'Job requested',type:'status'}]};
 if(mode==='empty')jobs.length=0;
 if(mode==='minimal'){detail.lines=[];detail.files=[];detail.notes=[];Object.assign(first,{companyName:'',designNumber:'',shopworksPO:'',salesRepName:'',neededBy:'',estimatedShipDate:'',transferType:'',fabricTarget:'',colorCount:null,primaryColor:'',additionalColors:'',specialInstructions:'',fileNotes:''});}
 if(mode==='dated')for(const job of jobs)for(const field of ['neededBy','estimatedShipDate'])if(job[field])job[field]+='T00:00:00';
 if(mode==='escaped'){first.companyName='<img src=x onerror=alert(1)> & Example';first.specialInstructions='<script>alert(1)</script> & preserve';detail.lines[0].notes='XS < M & 4XL';detail.notes[0].text='<img src=x> & literal note';}
 if(mode==='long'){detail.lines=Array.from({length:28},(_,i)=>({quantity:i+1,transferSize:'Large front print '+(i+1),widthIn:11.25,heightIn:12.5,pressCount:2,notes:'Synthetic production instructions, preserve every line and dimension.'}));}
 if(mode==='received')first.status='Received';
 if(mode==='cancelled')first.status='Cancelled';
 return {vendor,jobs,detail};
}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[],actions:[]},isVendor=state.page==='vendor',fixture=vendor(state.mode);
 await page.clock.setFixedTime(new Date(now));page.on('pageerror',e=>events.errors.push(e.message));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,local=['localhost','127.0.0.1'].includes(u.hostname),method=req.method();
  if(local&&method==='POST'&&/^\/api\/vendor\/jobs\/[^/]+\/notes$/.test(p)){
   events.actions.push({path:p,method,body:req.postData()});if(state.actionArrive)state.actionArrive();if(state.actionHold)await state.actionHold;
   return route.fulfill({status:state.postStatus||200,json:state.postStatus?{error:'Synthetic note failure'}:{success:true}});
  }
  if(!['GET','HEAD'].includes(method)||p.startsWith('/api/quote-sequence/')||u.searchParams.get('autoAdd')==='true'){events.writes.push(req.url());return route.fulfill({status:503});}
  if(local&&p==='/api/order-status/'+quoteId){events.reads.push({path:p,query:u.search});if(state.arrive)state.arrive();if(state.hold)await state.hold;if(state.networkError)return route.abort('failed');return route.fulfill({status:state.status||200,json:state.status?{error:'Synthetic status failure'}:order(state.mode)});}
  if(local&&p==='/api/vendor/jobs'){
   events.reads.push({path:p,query:u.search});if(state.listArrive)state.listArrive();if(state.listHold)await state.listHold;
   return route.fulfill({status:state.listStatus||200,json:state.listStatus?{error:'Synthetic jobs unavailable',loginUrl:'/vendor/login?next=%2Fvendor'}:{vendor:fixture.vendor,jobs:fixture.jobs}});
  }
  if(local&&/^\/api\/vendor\/jobs\/[^/]+$/.test(p)){
   events.reads.push({path:p,query:u.search});if(state.detailArrive)state.detailArrive();if(state.detailHold)await state.detailHold;
   const selected=fixture.jobs.find(j=>j.id===decodeURIComponent(p.split('/').pop()))||fixture.detail.job;
   return route.fulfill({status:state.detailStatus||200,json:state.detailStatus?{error:'Synthetic detail unavailable',loginUrl:'/vendor/login?next=%2Fvendor'}:{...fixture.detail,job:selected}});
  }
  if(local&&['/order-status','/vendor'].includes(p)){const file=isVendor?'pages/vendor-portal.html':'pages/order-status.html';return route.fulfill({contentType:'text/html',body:state.original?originalFile(file):fs.readFileSync(path.join(root,file),'utf8')});}
  if(local&&p==='/vendor/login')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><title>Fixture sign in</title></head><body><main><h1>Vendor sign in</h1></main></body></html>'});
  if(p.startsWith('/__job-fixture/'))return route.fulfill(state.imageFailure?{status:404}:{contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#edf2f7"/><text x="20" y="85" font-family="Arial" font-size="22">Example artwork</text></svg>'});
  if(u.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  // Axe re-fetches cross-origin CSS to inspect contrast. Allow this exact public stylesheet read.
  if(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/font-awesome/6.4.0/css/all.min.css')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(local){
   const file=path.resolve(root,'.'+decodeURIComponent(p)),relative=p.slice(1),retired=state.original&&source.retiredStyles.some(r=>r.file===relative);
   if(!file.startsWith(root+path.sep)||(!retired&&(!fs.existsSync(file)||!fs.statSync(file).isFile()))){events.missing.push(p);return route.fulfill({status:404});}
   const body=state.original&&source.hashes[relative]?Buffer.from(originalFile(relative)):fs.readFileSync(file);
   return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'}[path.extname(file)]||'application/octet-stream',body});
  }
  if(['font','image'].includes(req.resourceType())||req.resourceType()==='stylesheet')return route.continue();
  events.unknown.push(req.url());return route.abort();
 });
 const url=isVendor?'/vendor'+(state.deepLink?'#job='+jobId:''):'/order-status'+(state.missing?'':'?id='+quoteId+'&t='+encodeURIComponent('review token / only'));
 await page.goto(url);
 if(isVendor&&(state.listStatus===401||state.detailStatus===401))await page.waitForURL(/\/vendor\/login(?:\?|$)/);
 await page.evaluate(()=>document.fonts.ready);return events;
}
async function snapshot(page){return page.evaluate(()=>{
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim(),visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
 return {title:document.title,text:norm(document.body.innerText),ids:Object.fromEntries([...document.querySelectorAll('[id]')].filter(n=>visible(n)&&!n.querySelector('[id]')).map(n=>[n.id,norm(n.innerText)])),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.innerText),label:n.getAttribute('aria-label')})),rows:[...document.querySelectorAll('tbody tr')].filter(visible).map(n=>[...n.children].map(c=>norm(c.innerText))),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });}
function check(expect,e){for(const k of ['errors','writes','unknown','missing'])expect(e[k],k).toEqual([]);}
module.exports={open,order,vendor,snapshot,check,originalFile,quoteId,jobId,now};
