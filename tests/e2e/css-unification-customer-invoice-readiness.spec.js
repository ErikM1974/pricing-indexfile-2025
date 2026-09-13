const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {functions}=require('./helpers/staff-print-scenes');
const calculation=require('../fixtures/specialty-calculators-screenprint-customer-success-original-browser.json').calculation;
const root=path.resolve(__dirname,'../..');let server,origin,fault;
test.beforeAll(async()=>{
 server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/__parent'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><title>Quote print fixture</title><body><main><h1>Quote print fixture</h1><p id="status" role="alert"></p></main><script src="/shared_components/js/staff-print.js"></script></body></html>');return;}
  if(fault&&p===fault.path){fault.requested=true;if(fault.wait)await fault.wait;if(fault.failed){res.writeHead(503).end();return;}}
  if(p==='/__logo.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64"><rect width="160" height="64" fill="#1d4430"/><text x="10" y="40" fill="white">NWCA fixture</text></svg>');return;}
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',{'.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});

for(const mode of ['ready','delayed-style','failed-style','failed-image','blocked','missing-helper'])test('CSS customer invoice real window: '+mode,async({page})=>{
 let release;fault=mode==='failed-style'?{path:'/calculators/screenprint-customer/screenprint-customer-invoice.css',failed:true}:mode==='failed-image'?{path:'/__logo.svg',failed:true}:mode==='delayed-style'?{path:'/calculators/screenprint-customer/screenprint-customer-invoice.css',wait:new Promise(resolve=>{release=resolve;})}:null;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/__parent');
 await page.addScriptTag({content:functions('shared_components/js/calculator-utilities.js').escapeHTML+'\n'+functions('calculators/screenprint-customer/screenprint-customer-calculator.js').printQuote});
 await page.evaluate(({calculation,mode})=>{
  window.calculator={lastQuoteData:{calculation,quoteId:'SPC0911-1',createdAt:Date.parse('2026-09-11T18:30:00Z'),customerName:'Example Customer',companyName:'Example Company',customerEmail:'example@example.invalid',customerPhone:'555-0100',projectName:'Example team shirts',notes:'Synthetic quote; no live record.'},setFeedback:(id,text)=>{document.querySelector('#status').textContent=text;}};
  window.__prints=0;window.__opened=0;const nativeOpen=window.open;window.open=function(){window.__opened++;if(mode==='blocked')return null;const w=nativeOpen.apply(window,arguments);w.print=()=>{window.__prints++;};
   // Use a deterministic local logo response; leave the actual generator and stylesheet URLs intact.
   // Protocol interception can stall document.write stylesheet loads in Chromium.
   const write=w.document.write.bind(w.document);w.document.write=html=>write(html.replace('https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1',location.origin+'/__logo.svg'));return w;};if(mode==='missing-helper')delete window.NWCAStaffPrint;
 },{calculation,mode});
 const opened=['blocked','missing-helper'].includes(mode)?null:page.waitForEvent('popup');await page.evaluate(()=>printQuote());const popup=opened?await opened:null;
 if(mode==='delayed-style'){await expect.poll(()=>Boolean(fault.requested)).toBe(true);expect(await page.evaluate(()=>window.__prints)).toBe(0);release();}
 if(['ready','delayed-style'].includes(mode)){await expect.poll(()=>page.evaluate(()=>window.__prints)).toBe(1);await expect(popup.locator('.grand-total')).toContainText('$728.00');}
 else{await expect(page.locator('#status')).not.toHaveText('',{timeout:25000});expect(await page.evaluate(()=>window.__prints)).toBe(0);if(popup)await expect(popup.getByRole('alert')).toBeVisible();if(mode==='missing-helper')expect(await page.evaluate(()=>window.__opened)).toBe(0);}
 expect(errors).toEqual([]);if(popup)await popup.close();fault=null;
});
