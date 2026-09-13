const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),AxeBuilder=require('@axe-core/playwright').default;
const scenes=require('./helpers/staff-print-scenes');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),fixture=path.join(root,'tests/fixtures/staff-print-original-browser.json');
const original=process.env.CAPTURE_STAFF_PRINT_ORIGINAL==='1',phase=original?'original':'current';
let server,origin,fault;test.use({reducedMotion:'reduce',locale:'en-US'});
test.beforeAll(async()=>{
 server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  if(u.pathname==='/__staff-parent'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><title>Print test</title><body><main><h1>Print test</h1></main><script src="/shared_components/js/staff-print.js"></script></body></html>');return;}
  if(fault&&u.pathname===fault.path){fault.requested=true;if(fault.wait)await fault.wait;if(fault.failed){res.writeHead(503).end();return;}}
  if(u.pathname.startsWith('/__staff-print/')){const [kind,mode]=u.pathname.split('/').slice(2);res.setHeader('Content-Type','text/html');res.end(scenes.render(kind,mode,original).html);return;}
  if(u.pathname==='/__print-fixture/mockup.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#203d59"/><path d="M120 80H280V220H120Z" fill="#f6f3eb"/><text x="200" y="146" text-anchor="middle" font-family="Arial" font-size="25" fill="#1d4430">CEDAR</text><text x="200" y="178" text-anchor="middle" font-family="Arial" font-size="15">CREW</text></svg>');return;}
  const f=path.resolve(root,'.'+u.pathname);if(f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){
   res.setHeader('Content-Type',{'.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));return;
  }
  res.writeHead(404).end();
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
for(const [kind,mode] of [['calls','normal'],['calls','long'],['labels','normal'],['labels','long'],['threads','normal'],['threads','long'],['threads','no-image']])test('CSS staff print: '+kind+' '+mode,async({page})=>{
 const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
 await page.addInitScript(()=>{window.print=()=>{};});
 await page.goto(origin+'/__staff-print/'+kind+'/'+mode);await page.evaluate(()=>document.fonts.ready);
 const key=kind+'-'+mode,name='staff-print-'+key;
 const value=await page.evaluate(()=>({title:document.title,text:document.body.innerText.replace(/\s+/g,' ').trim(),tables:[...document.querySelectorAll('table')].map(t=>[...t.rows].map(r=>[...r.cells].map(c=>c.textContent.trim())))}));
 if(original){const records=fs.existsSync(fixture)?JSON.parse(fs.readFileSync(fixture,'utf8')):{};if(records[key])expect(value).toEqual(records[key]);else{records[key]=value;fs.writeFileSync(fixture,JSON.stringify(records,null,2)+'\n');}}
 else expect(value).toEqual(JSON.parse(fs.readFileSync(fixture,'utf8'))[key]);
 fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  if(!original){expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
  await page.screenshot({path:path.join(out,name+'-'+phase+'-'+width+'.png'),fullPage:true});
  if(!original)for(const [i,el] of (await page.locator('[data-print-scroll]').all()).entries()){
   const max=await el.evaluate(n=>n.scrollWidth-n.clientWidth);if(max<=1)continue;
   await el.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>el.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
   const step=await el.evaluate(n=>n.clientWidth);for(let x=Math.min(step,max);;x=Math.min(x+step,max)){
    await el.evaluate((n,pos)=>{n.scrollLeft=pos;},x);await page.screenshot({path:path.join(out,name+'-horizontal'+i+'-x'+x+'-'+phase+'-'+width+'.png'),fullPage:true});if(x===max)break;
   }await el.evaluate(n=>{n.scrollLeft=0;});
  }
 }
 if(!original&&kind==='labels'){
  await page.setViewportSize({width:816,height:1056});await page.emulateMedia({media:'print'});
  const boxes=await page.locator('.lbl').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  expect(boxes).toHaveLength(mode==='long'?32:3);for(const b of boxes){expect(b.width).toBeCloseTo(252,1);expect(b.height).toBeCloseTo(96,1);}
  expect(boxes[1].x-boxes[0].x).toBeCloseTo(264,1);if(mode==='long')expect(boxes[3].y-boxes[0].y).toBeCloseTo(96,1);
 }
 await page.pdf({path:path.join(out,name+'-'+phase+'.pdf'),preferCSSPageSize:true,format:'Letter',printBackground:true});expect(errors).toEqual([]);expect(failed).toEqual([]);
});

if(!original)for(const kind of ['calls','labels','threads'])for(const mode of ['ready','blocked','failed-style'])test('CSS staff print real window: '+kind+' '+mode,async({page})=>{
 fault=mode==='failed-style'?{path:'/shared_components/css/staff-print.css',failed:true}:null;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/__staff-parent');await page.addScriptTag({content:scenes.setup(kind)});
 await page.evaluate(blocked=>{window.__printCalls=0;const nativeOpen=window.open;window.open=function(){if(blocked)return null;const w=nativeOpen.apply(window,arguments);w.print=()=>{window.__printCalls++;};return w;};},mode==='blocked');
 const popupPromise=mode==='blocked'?null:page.waitForEvent('popup');
 await page.evaluate(name=>window[name](),scenes.owners[kind][1]);
 const popup=popupPromise?await popupPromise:null;
 if(mode==='ready')await expect.poll(()=>page.evaluate(()=>window.__printCalls)).toBe(1);
 else {await expect.poll(()=>page.evaluate(()=>window.__error||''),{timeout:25000}).not.toBe('');expect(await page.evaluate(()=>window.__printCalls)).toBe(0);if(popup)await expect(popup.getByRole('alert')).toBeVisible();}
 expect(errors).toEqual([]);if(popup)await popup.close();fault=null;
});

if(!original)test('CSS staff print waits for delayed styles and refuses a missing artwork image',async({page})=>{
 let release;fault={path:'/shared_components/css/staff-print.css',wait:new Promise(r=>{release=r;})};
 await page.goto(origin+'/__staff-parent');await page.addScriptTag({content:scenes.setup('threads')});
 await page.evaluate(()=>{window.__printCalls=0;const nativeOpen=window.open;window.open=function(){const w=nativeOpen.apply(window,arguments);w.print=()=>{window.__printCalls++;};return w;};});
 const opened=page.waitForEvent('popup');await page.evaluate(()=>generateThreadSheet());const popup=await opened;
 await expect.poll(()=>Boolean(fault.requested)).toBe(true);expect(await page.evaluate(()=>window.__printCalls)).toBe(0);release();await expect.poll(()=>page.evaluate(()=>window.__printCalls)).toBe(1);await popup.close();
 fault={path:'/__print-fixture/mockup.svg',failed:true};
 const second=page.waitForEvent('popup');await page.evaluate(()=>generateThreadSheet());const failed=await second;
 await expect.poll(()=>page.evaluate(()=>window.__error||''),{timeout:25000}).not.toBe('');expect(await page.evaluate(()=>window.__printCalls)).toBe(1);await expect(failed.getByRole('alert')).toBeVisible();await failed.close();fault=null;
});

if(!original)for(const kind of ['calls','labels','threads'])test('CSS staff print missing helper: '+kind,async({page})=>{
 await page.goto(origin+'/__staff-parent');await page.addScriptTag({content:scenes.setup(kind)});
 await page.evaluate(()=>{delete window.NWCAStaffPrint;window.__opened=0;window.open=()=>{window.__opened++;throw Error('Unexpected popup');};});
 await page.evaluate(name=>window[name](),scenes.owners[kind][1]);expect(await page.evaluate(()=>window.__opened)).toBe(0);
 expect(await page.evaluate(()=>window.__error)).toContain('Please refresh');
});

if(!original)test('CSS staff thread sheet treats imported run and color values as data',async({page})=>{
 await page.goto(origin+'/__staff-parent');await page.addScriptTag({content:scenes.setup('threads')});
 await page.evaluate(()=>{storedEmbRecords['1'].Thread_Sequence_JSON=JSON.stringify([{run:'<img src=x onerror="window.__injected=true">',hex:'#fff;position:fixed;inset:0',name:'<script>unsafe</script>',catalog:'Color <sample>',element:'Trim & letters'}]);const nativeOpen=window.open;window.open=function(){const w=nativeOpen.apply(window,arguments);w.print=()=>{};return w;};});
 const opened=page.waitForEvent('popup');await page.evaluate(()=>generateThreadSheet());const popup=await opened;await popup.waitForLoadState('load');
 await expect(popup.locator('tr:has(td)')).toHaveCount(1);await expect(popup.locator('tbody td').first()).toHaveText('<img src=x onerror="window.__injected=true">');
 expect(await popup.locator('tbody script,tbody img').count()).toBe(0);expect(await popup.locator('.color-dot').getAttribute('style')).toBe('--thread-color:#888;');await popup.close();
});
