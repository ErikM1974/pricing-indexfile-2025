const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=require('../../fixtures/employee-bundles-original-content.json'),root=path.resolve(__dirname,'../../..');
const rows=[['Cedar Example','XL','Approved'],['River Sample','2XL','Pending'],['Morgan Demo','M','Approved'],['Casey Fixture','3XL','Pending'],['Aspen Review','S','Approved']];
function provider(state){
 if(state==='empty')return '<section aria-label="Employee list"><h2>Employees</h2><p role="status">No records found</p></section>';
 if(state==='login')return '<form aria-label="Employee list sign in"><h2>Employee list sign in</h2><label>Email <input type="email" name="email" autocomplete="username"></label><label>Password <input type="password" name="password" autocomplete="current-password"></label><button type="button">Sign in</button></form>';
 return '<section aria-label="Employee list"><h2>Employees</h2><table style="min-width:900px"><caption>Synthetic employee records</caption><thead><tr><th scope="col">Employee name</th><th scope="col">Size</th><th scope="col">Approval</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';
}
async function open(page,file,state={}){
 const events={errors:[],writes:[],unknown:[],missing:[],providers:[]},record=source.pages.find(r=>r.file===file);
 page.on('pageerror',e=>events.errors.push(e.message));
 await page.context().addInitScript(()=>{window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};});
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(!['GET','HEAD'].includes(req.method())||p.startsWith('/api/quote-sequence/')||u.searchParams.get('autoAdd')==='true'){events.writes.push(req.url());return route.fulfill({status:503,json:{error:'Synthetic writes only'}});}
  if(record.providers.includes(u.origin+p)){
   events.providers.push(u.origin+p);
   if(state.arrive)state.arrive();
   if(state.hold)await state.hold;
   if(state.mode==='failed')return route.abort('failed');
   return route.fulfill({contentType:'application/javascript',body:'document.write('+JSON.stringify(provider(state.mode))+');'});
  }
  if(p.startsWith('/api/')||['fetch','xhr'].includes(req.resourceType())){events.unknown.push(req.url());return route.fulfill({status:503});}
  if(['localhost','127.0.0.1'].includes(u.hostname)){
   const f=path.resolve(root,'.'+decodeURIComponent(p)),retired=state.original&&source.retiredStyles.find(r=>r.file===p.slice(1));
   if(retired)return route.fulfill({contentType:'text/css',body:retired.css});
   if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){events.missing.push(p);return route.fulfill({status:404});}
   let body=fs.readFileSync(f);
   if(state.original&&source.hashes[p.slice(1)]){
    const html=source.pages.find(r=>r.file===p.slice(1));let s=html?html.html:body.toString('utf8').replace(/\r\n/g,'\n');
    if(!html)for(const c of source.changes.filter(c=>c.file===p.slice(1)).reverse())s=s.split(c.after).join(c.before);
    if(crypto.createHash('sha256').update(s).digest('hex')!==source.hashes[p.slice(1)])throw Error('Original source changed: '+p);body=Buffer.from(s);
   }
   return route.fulfill({contentType:{'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream',body});
  }
  if((u.hostname==='fonts.googleapis.com'&&p==='/css2')||(u.hostname==='cdnjs.cloudflare.com'&&/^\/ajax\/libs\/font-awesome\/(6\.0\.0|6\.4\.0)\/css\/all.min.css$/.test(p))||(u.hostname==='cdn.jsdelivr.net'&&['/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css','/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'].includes(p)))return route.continue();
  if(['font','image'].includes(req.resourceType()))return route.continue();
  events.unknown.push(req.url());return route.abort();
 });
 await page.goto('/'+file);await page.evaluate(()=>document.fonts.ready);return events;
}
module.exports={open,rows};
