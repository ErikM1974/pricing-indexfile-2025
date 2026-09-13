const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {scenes}=require('./helpers/server-pages-scenes');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification');
const original=process.env.CAPTURE_SERVER_PAGES_ORIGINAL==='1',phase=original?'original':'current';
const all=scenes(),fixture=path.join(root,'tests/fixtures/server-pages-original-browser.json');
const normalize=s=>s.replace(/\s+/g,' ').trim();
test.use({reducedMotion:'reduce',locale:'en-US'});
for(const [name,scene] of Object.entries(all))test('CSS server pages: '+name,async({page})=>{
 const errors=[],missing=[];
 await page.context().route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname;
  if(!['GET','HEAD'].includes(req.method())){missing.push(req.method()+' '+p);return route.abort();}
  if(p==='/__server-page/'+name)return route.fulfill({status:scene.statusCode,headers:scene.headers||{},contentType:'text/html',body:scene.html});
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return route.continue();
  if(u.hostname==='www.youtube-nocookie.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Video preview</title><body>Video preview</body></html>'});
  if(p=== '/__server-fixture/workshop.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#e3f1e4"/><path d="M260 140L410 80Q600 220 790 80L940 140L1080 300L925 395L850 330V595H350V330L275 395L120 300Z" fill="#2f7d3b"/></svg>'});
  if(u.hostname==='cdn.caspio.com'){
   const logo=path.join(root,'images/nwca-logo.png');
   if(fs.existsSync(logo))return route.fulfill({path:logo});
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="190" height="70"><text x="12" y="32" font-size="30" fill="#1b4424">NWCA</text><text x="12" y="55" font-size="12">Northwest Custom Apparel</text></svg>'});
  }
  const file=path.resolve(root,'.'+decodeURIComponent(p));
  if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  missing.push(req.url());return route.fulfill({status:404,body:'Missing synthetic resource'});
 });
 page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('/__server-page/'+name);
 expect(response.status()).toBe(scene.statusCode);
 await page.evaluate(()=>document.fonts.ready);
 fs.mkdirSync(out,{recursive:true});
 const content=await page.evaluate(()=>{
  const norm=s=>s.replace(/\s+/g,' ').trim();
  const body=document.body.cloneNode(true);body.querySelectorAll('.skip-link').forEach(n=>n.remove());
  return {title:document.title,text:norm(body.textContent),links:[...body.querySelectorAll('a')].map(a=>[a.getAttribute('href'),norm(a.textContent)]),seo:[...document.head.querySelectorAll('meta:not([name="viewport"]),link[rel="canonical"],script[type="application/ld+json"]')].map(n=>n.outerHTML)};
 });
 if(original){
  let records=fs.existsSync(fixture)?JSON.parse(fs.readFileSync(fixture,'utf8')):{};
  if(records[name])expect(content).toEqual(records[name]);else{records[name]=content;fs.writeFileSync(fixture,JSON.stringify(records,null,2)+'\n');}
 }else {
  // Former status fragments lacked a charset/viewport. Their new document
  // metadata is checked explicitly; the original SEO fields stay exact.
  const metadata=record=>({...record,seo:record.seo.filter(s=>!s.startsWith('<meta charset='))});
  expect(metadata(content)).toEqual(metadata(JSON.parse(fs.readFileSync(fixture,'utf8'))[name]));
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  expect(await page.locator('meta[charset]').count()).toBe(1);
 }
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  if(!original){
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  }
  await page.screenshot({path:path.join(out,'server-pages-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 await page.pdf({path:path.join(out,'server-pages-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
 expect(errors).toEqual([]);expect(missing).toEqual([]);
 if(!original){
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement.tagName)).toBe('A');
  expect(normalize(await page.locator('h1').innerText())).not.toBe('');
 }
});

if(!original)for(const stylesAvailable of [true,false])test('CSS server notices: escaped names and keyboard exit, styles '+stylesAvailable,async({page})=>{
 const {restricted}=require('../../lib/status-page-templates');
 const name='Avery-'+ 'LongName'.repeat(12)+' & <img src=x onerror=alert(1)>';
 const failedStyles=[];
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()!=='GET')throw Error('Unexpected request '+req.method());
  if(u.pathname==='/__notice')return route.fulfill({status:403,contentType:'text/html',body:restricted(name)});
  if(u.pathname==='/staff-dashboard.html')return route.fulfill({contentType:'text/html',body:'<h1>Synthetic dashboard</h1>'});
  if(req.resourceType()==='stylesheet'){
   if(!stylesAvailable){failedStyles.push(u.pathname);return route.abort('failed');}
   return route.fulfill({path:path.join(root,u.pathname)});
  }
  return route.abort();
 });
 await page.setViewportSize({width:320,height:1000});
 await page.goto('/__notice');
 await expect(page.locator('p').first()).toContainText(name);
 expect(await page.locator('[onerror],script').count()).toBe(0);
 if(stylesAvailable)expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 else expect(failedStyles).toHaveLength(3);
 await page.keyboard.press('Tab');
 await expect(page.locator('a')).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Synthetic dashboard'})).toBeVisible();
});
