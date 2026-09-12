const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),original=require('../../fixtures/garment-designer-original-content.json');
function source(file,{baseline=false}={}){let text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');if(baseline)for(const c of original.changes.filter(c=>c.file===file).reverse()){if(text.split(c.after).length-1!==c.count)throw Error('Original mapping drift: '+file);text=text.split(c.after).join(c.before);}return text;}
async function open(page,state={}){
 const e={errors:[],unknown:[],missing:[],writes:[],reads:[],dialogs:[]};
 await page.clock.setFixedTime(new Date('2026-09-12T21:00:00Z'));
 await page.context().addInitScript(()=>{window.__prints=0;window.print=()=>{window.__prints++;window.dispatchEvent(new Event('beforeprint'));};window.__emails=[];sessionStorage.setItem('nwca_user_name','Example Rep');sessionStorage.setItem('nwca_user_email','rep@example.invalid');});
 page.on('pageerror',x=>e.errors.push(x.message));page.on('dialog',async d=>{e.dialogs.push(d.message());await d.dismiss();});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(!['GET','HEAD'].includes(req.method())){e.writes.push({path:p,method:req.method()});return route.fulfill({status:503,json:{error:'Example upload unavailable'}});}
  if(p==='/api/service-codes')return route.fulfill({status:state.feesFailed?503:200,json:[{ServiceCode:'GRT-50',DisplayName:'Example artwork',SellPrice:50,IsActive:true}]});
  if(p==='/api/staff-session'||p==='/api/auth/me')return route.fulfill({json:{authenticated:true,user:{name:'Example Rep',email:'rep@example.invalid'}}});
  if(p.startsWith('/api/')){e.reads.push(p);e.unknown.push(p);return route.fulfill({status:503,json:{error:'Unmocked read'}});}
  if(u.hostname==='cdn.jsdelivr.net'&&p.includes('@emailjs/browser'))return route.fulfill({contentType:'application/javascript',body:'window.emailjs={init(){},send:async(...args)=>{window.__emails.push(args);throw Error("Example email unavailable");}};'});
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const file=decodeURIComponent(p.slice(1)),abs=path.resolve(root,file);
   if(!abs.startsWith(root+path.sep)||!fs.existsSync(abs)||!fs.statSync(abs).isFile()){e.missing.push(p);return route.fulfill({status:404});}
   const ext=path.extname(file);
   return route.fulfill({contentType:{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'}[ext]||'application/octet-stream',body:Object.hasOwn(original.hashes,file)?source(file,{baseline:state.original}):fs.readFileSync(abs)});
  }
  if(['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net','cdnjs.cloudflare.com'].includes(u.hostname))return route.continue();
  e.unknown.push(req.url());return route.fulfill({status:503});
 });
 await page.goto('/pages/garment-designer.html');
 await page.waitForFunction(()=>typeof PHOTO!=='undefined'&&PHOTO.state==='ready');
 await page.evaluate(()=>document.fonts.ready);return e;
}
async function addArt(page,{side='front',multiple=false,dst=false}={}){
 if(dst){
  // Synthetic two-color square, parsed by the real Tajima DST decoder.
  const header=Buffer.alloc(512,0x20);header.write('LA:Example square\rST:     16\rCO:  1\r+X:  40\r-X:   0\r+Y:  40\r-Y:   0\rAX:+    0\rAY:+    0\rMX:+    0\rMY:+    0\rPD:******\r');header[511]=0x1a;
  const square=[0x01,0,3, 0x80,0,3, 0x02,0,3, 0x40,0,3];
  const stitches=Buffer.from([...square,...square,0,0,0xc3,...square,...square,0,0,0xf3]);
  await page.locator('#fileInput').setInputFiles({name:'example-square.dst',mimeType:'application/octet-stream',buffer:Buffer.concat([header,stitches])});
 }else{
  const buffer=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240"><rect width="480" height="240" fill="white"/><path d="M40 180V60h90v40H85v80z" fill="#153d2b"/><circle cx="240" cy="120" r="64" fill="#d59a32"/><path d="M350 50h60v140h-60z" fill="#153d2b"/></svg>');
  if(!multiple){await page.evaluate(side=>openPlacementChooser(side),side);await page.evaluate(loc=>{pendingPlacement=loc;$('placementChooser').classList.remove('visible');},side==='back'?'Full Back':'Left Chest');}
  await page.locator('#fileInput').setInputFiles({name:multiple?'example-secondary.svg':'example-logo.svg',mimeType:'image/svg+xml',buffer});
 }
 await page.waitForFunction(()=>current()?.status==='ready');
 await page.evaluate(()=>{const e=current();if(!e.mockOn)toggleMockup();});
 await page.waitForFunction(()=>!!current()?.mockCanvas);
}
async function snapshot(page){return page.evaluate(()=>{
 const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden',norm=s=>s.replace(/\s+/g,' ').trim(),ids={};
 for(const n of document.querySelectorAll('[id]'))if(visible(n)&&!n.querySelector('[id]')&&!['SCRIPT','STYLE','CANVAS','IMG'].includes(n.tagName)&&n.id!=='toast')ids[n.id]=norm(n.innerText||n.textContent);
 return{title:document.title,ids,fields:[...document.querySelectorAll('input,select,textarea')].filter(visible).map(n=>({id:n.id,type:n.type,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(n=>({href:n.getAttribute('href'),text:norm(n.textContent)})),headings:[...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(n=>norm(n.textContent)),entries:entries.map(e=>({name:e.name,kind:e.kind,status:e.status,printLoc:e.printLoc,printW:e.printW,onShirt:e.onShirt,textModel:e.textModel||null,dst:e.dst?{stitches:e.dst.stitchCount,threadStops:e.dst.threadStops,widthIn:e.dst.widthIn,heightIn:e.dst.heightIn}:null})),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });}
function check(expect,e,{uploadFailed=false}={}){for(const k of ['errors','unknown','missing'])expect(e[k],k).toEqual([]);expect(e.writes).toEqual(uploadFailed?[{path:'/api/files/upload',method:'POST'}]:[]);}
module.exports={source,open,addArt,snapshot,check};
