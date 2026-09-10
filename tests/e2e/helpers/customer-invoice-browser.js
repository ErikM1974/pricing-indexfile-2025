const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=require('../../fixtures/customer-documents-original-content.json'),root=path.resolve(__dirname,'../../..');
const invoice={
 invoiceNumber:740123,dateOrdered:'2026-09-01T00:00:00Z',dateInvoiced:'2026-09-09T00:00:00Z',dueDate:'2026-10-09T00:00:00Z',
 customerName:'Cedar Example Construction',contactName:'River Sample',contactPhone:'253-555-0142',contactEmail:'review@example.test',customerNumber:90210,poNumber:'PO-REVIEW-2026',terms:'Net 30',salesperson:'Example Rep',designId:43012,designName:'Cedar crew chest embroidery',
 items:[
 {quantity:24,partNumber:'PC54',color:'Navy',description:'Core Cotton Tee · Left chest embroidery',sizes:[2,4,6,6,4,2],unitPrice:18.75,lineTotal:450},
 {quantity:6,partNumber:'J317_3X',color:'Black',description:'Core Soft Shell Jacket · Large sizes',sizes:[0,0,0,0,2,4],unitPrice:64.5,lineTotal:387},
 {quantity:1,partNumber:'SETUP',description:'Complimentary setup',sizes:[],unitPrice:0,lineTotal:0}
 ],subtotal:837,salesTax:85.37,shipping:18.5,total:940.87,paid:300,balance:640.87
};
function data(mode){
 const d=JSON.parse(JSON.stringify(invoice));
 if(mode==='paid'){d.paid=d.total;d.balance=0;}
 if(mode==='empty'){d.items=[];d.subtotal=d.salesTax=d.shipping=d.total=d.paid=d.balance=0;}
 if(mode==='long'){
  d.customerName='Cedar Example Construction & Industrial Services Northwest';d.poNumber='PO-2026-EXTENDED-REFERENCE-REVIEW-ONLY';d.designName='Long embroidered company name — front, sleeve and full back';d.contactEmail='invoice-review-for-northwest-team@example.test';
  d.items=Array.from({length:31},(_,i)=>({...d.items[i%3],partNumber:'SAMPLE-'+String(i+1).padStart(2,'0'),description:'Synthetic invoice line '+(i+1)+' — cotton and performance garment with a detailed decoration description'}));
 }
 if(mode==='escaped'){d.customerName='<img src=x onerror="window.__bad=true">';d.designName='Sample <script>alert(1)</script>';d.items[0].description='Cotton <b>not markup</b> & crew';}
 return d;
}
function originalFile(file){
 const record=source.pages.find(p=>p.file===file),retired=(source.retiredStyles||[]).find(p=>p.file===file);
 let s=record?record.html:retired?retired.css:fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 if(!record&&!retired)for(const c of source.changes.filter(c=>c.file===file).reverse())s=s.split(c.after).join(c.before);
 if(crypto.createHash('sha256').update(s).digest('hex')!==source.hashes[file])throw Error('Original mismatch '+file);
 return s;
}
async function open(page,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],reads:[]},url=state.preview?'/portal-admin/preview/90210/invoice/740123':'/portal/invoice/'+(state.invalid?'invalid':'740123');
 const api=state.preview?'/api/portal-admin/preview/90210/invoice/740123':'/api/portal/invoice/740123';
 page.on('pageerror',e=>events.errors.push(e.message));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(!['GET','HEAD'].includes(req.method())||p.startsWith('/api/quote-sequence/')||u.searchParams.get('autoAdd')==='true'){events.writes.push(req.url());return route.fulfill({status:503});}
  if(p===api){events.reads.push(p);if(state.arrive)state.arrive();if(state.hold)await state.hold;return route.fulfill({status:state.status||200,json:state.status?{error:'Synthetic invoice failure'}:data(state.mode)});}
  if(['localhost','127.0.0.1'].includes(u.hostname)&&[url,'/customer/login','/auth/saml/login'].includes(p)){
   const html=p===url?(state.original?originalFile('pages/customer-invoice.html'):fs.readFileSync(path.join(root,'pages/customer-invoice.html'),'utf8')):'<!doctype html><html lang="en"><title>Sign in</title><main><h1>Sign in</h1></main></html>';
   return route.fulfill({contentType:'text/html',body:html});
  }
  if(u.hostname==='cdnjs.cloudflare.com'&&p==='/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'){
   if(state.pdf==='real')return route.continue();
   if(state.pdf==='missing')return route.abort('failed');
   return route.fulfill({contentType:'application/javascript',body:'window.html2pdf=function(){var record={};window.__pdfCalls=window.__pdfCalls||[];window.__pdfCalls.push(record);return {set:function(opt){record.options=opt;return this;},from:function(el){record.text=el.innerText;record.width=el.getBoundingClientRect().width;return this;},save:function(){return new Promise(function(resolve,reject){window.__pdfResolve=resolve;window.__pdfReject=reject;});}};};'});
  }
  if(u.hostname==='fonts.googleapis.com'&&p==='/css2')return route.continue();
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const f=path.resolve(root,'.'+decodeURIComponent(p)),retired=state.original&&(source.retiredStyles||[]).some(r=>r.file===p.slice(1));
   if(!f.startsWith(root+path.sep)||(!retired&&(!fs.existsSync(f)||!fs.statSync(f).isFile()))){events.missing.push(p);return route.fulfill({status:404});}
   const body=state.original&&source.hashes[p.slice(1)]?Buffer.from(originalFile(p.slice(1))):fs.readFileSync(f);
   return route.fulfill({contentType:{'.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream',body});
  }
  if(['font','image'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.abort();
 });
 await page.goto(url);if(state.status===401)await page.waitForURL(new RegExp(state.preview?'/auth/saml/login$':'/customer/login$'));await page.evaluate(()=>document.fonts.ready);return events;
}
function check(expect,events){for(const k of ['errors','writes','unknown','missing'])expect(events[k],k).toEqual([]);}
module.exports={open,data,check,originalFile};
