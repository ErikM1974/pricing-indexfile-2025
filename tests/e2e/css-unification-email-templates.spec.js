const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const fixture=require('../fixtures/email-templates-original-content.json'),root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification');
const original=process.env.CAPTURE_EMAIL_TEMPLATES_ORIGINAL==='1',phase=original?'original':'current';
const data={customer_name:'Alex Example',to_name:'Alex',company_name:'Example Team',customer_email:'alex@example.invalid',to_email:'alex@example.invalid',email:'alex@example.invalid',customer_phone:'555-0100',phone:'555-0100',company_phone:'253-922-5793',sales_phone:'253-922-5793',sales_email:'sales@example.invalid',quote_number:'XMAS0913-1',quote_id:'GOLF0913-1',quote_date:'September 13, 2026',design_number:'12345',design_size:'4 by 3 inches',placement:'Left chest',work_order:'123456',sales_rep_name:'Example Rep',mockup_count:'',approval_link:'https://example.invalid/review/example',from_name:'Example Rep',jacket_details:'Black jacket, size M',hoodie_details:'Navy hoodie, size M',beanie_details:'Navy beanie',gloves_details:'Black gloves, size M',delivery_type:'Delivery',delivery_date:'October 10, 2026',address_1:'123 Example Avenue',city:'Milton',state:'WA',zip:'98354',quantity:'4',company_year:'1977',tournament_date:'July 2026',player_count:'144',interests:'Polos, caps and event prizes',notes:'Please include individual names and a second delivery contact.',lead_score:'HOT',lead_score_emoji:'🔥',submitted_at:'September 13, 2026, 10:00 AM',utm_source:'example',utm_campaign:'golf-2026',utm_medium:'form',talking_points:'Review the tournament date and logo placement with the customer.'};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function render(source,long=false){return source.replace(/\{\{\{mockup_images_html\}\}\}/g,'<p>Front view</p><img src="https://example.invalid/mockup.png" width="500" style="max-width:100%;height:auto;" alt="Example chest embroidery proof">').replace(/\{\{([^{}]+)\}\}/g,(_,name)=>esc(long&&['company_name','customer_name','to_name','notes'].includes(name)?'ExampleWithALongNameAndNoSpacesForWrapping '+(data[name]??name):data[name]??name));}
for(const [index,entry] of fixture.entries.entries())test('CSS email template local preview '+index,async({page})=>{
 const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{requests.push(route.request().method());if(route.request().resourceType()!=='image')return route.abort();return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110"><rect width="300" height="110" fill="#ffffff"/><text x="12" y="48" fill="#215432" font-size="22">NORTHWEST</text><text x="12" y="77" fill="#215432" font-size="16">CUSTOM APPAREL</text></svg>'});});
 const source=original?entry.source:fs.readFileSync(path.join(root,entry.file),'utf8');
 fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.setContent(render(source));await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode()));});
  if(!original)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:path.join(out,'email-template-'+index+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'email-template-'+index+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
 if(!original){
  await page.setViewportSize({width:320,height:1000});await page.setContent(render(source,true));await page.evaluate(async()=>{await Promise.all([...document.images].map(n=>n.decode()));});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:path.join(out,'email-template-'+index+'-long-'+phase+'-320.png'),fullPage:true});
  await page.unroute('**/*');await page.route('**/*',r=>r.abort());await page.setContent(render(source));await expect(page.locator('body')).toContainText('Example');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:path.join(out,'email-template-'+index+'-blocked-images-'+phase+'-320.png'),fullPage:true});
 }
 expect(errors).toEqual([]);expect(requests.every(m=>m==='GET')).toBe(true);
});
