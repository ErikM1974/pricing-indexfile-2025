const {test,expect}=require('@playwright/test'),fs=require('fs'),path=require('path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,addArt,snapshot,check}=require('./helpers/garment-designer-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_GARMENT_DESIGNER_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
async function evidence(page,name,e){
 fs.mkdirSync(out,{recursive:true});const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const s=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...s,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect.soft(s.overflow,name+' '+width+' overflow').toBe(false);expect.soft(states.at(-1).violations,name+' '+width+' accessibility').toEqual([]);}
  await page.screenshot({path:path.join(out,'garment-designer-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
  const scrolls=await page.evaluate(()=>{
   const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
   const modal=[...document.querySelectorAll('.ds-modal-overlay.open,.art-details-overlay.visible,.thread-modal-overlay.visible,.chooser-overlay.visible')].find(visible);
   return [...(modal||document.body).querySelectorAll('*')].filter(n=>visible(n)&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+4&&/auto|scroll/.test(getComputedStyle(n).overflowY)).map((n,i)=>{n.setAttribute('data-capture-scroll',String(i));return{index:i,height:n.clientHeight,max:n.scrollHeight-n.clientHeight};});
  });
  for(const scroll of scrolls){const target=page.locator('[data-capture-scroll="'+scroll.index+'"]');
   for(let y=scroll.height;y<scroll.max+scroll.height;y+=scroll.height){await target.evaluate((n,y)=>{n.scrollTop=y;},Math.min(y,scroll.max));await page.screenshot({path:path.join(out,'garment-designer-'+name+'-panel'+scroll.index+'-y'+Math.min(y,scroll.max)+'-'+phase+'-'+width+'.png'),fullPage:true});}
   await target.evaluate(n=>{n.scrollTop=0;n.removeAttribute('data-capture-scroll');});
  }
 }
 check(expect,e,{uploadFailed:name==='upload-failure'});
 const record={name,states,reads:e.reads,writes:e.writes,dialogs:e.dialogs},file='tests/fixtures/garment-designer-'+name+'-original-browser.json';
 if(capture){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — original garment designer synthetic workflow evidence.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const key of ['title','fields','links','headings','entries'])expect.soft(states[i][key],name+' '+key).toEqual(before.states[i][key]);}
 await page.setViewportSize({width:1440,height:1000});
 if(name==='proof'||name==='spec')await page.evaluate(name=>{if(name==='proof')buildProofSheet(current());else buildSpecSheet(current());document.body.classList.add('print-spec');},name);
 await page.pdf({path:path.join(out,'garment-designer-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
for(const name of ['landing','front-placement','back-placement','shirt-colors','front-art','back-art','multiple-art','polo','art-details','text-editor','thread-colors','unsupported-file','art-form','art-fees-failure','customer-dialog','customer-invalid','upload-failure','proof','spec'])test('CSS garment designer: '+name,async({page})=>{
 const e=await open(page,{original:capture,feesFailed:name==='art-fees-failure'});
 if(['front-placement','back-placement'].includes(name))await page.getByRole('button',{name:name==='front-placement'?'⬆ Add Front Logo':'⬆ Add Back Logo',exact:true}).click();
 else if(name==='shirt-colors')await page.locator('#palBtn').click();
 else if(name==='unsupported-file'){await page.locator('#fileInput').setInputFiles({name:'example-unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('Example unsupported artwork')});await page.waitForFunction(()=>current()?.status==='error');}
 else if(name!=='landing'){
  if(name==='text-editor'){await page.locator('#addTextBtn').click();await page.locator('#txt-text').fill('EXAMPLE TEAM\n2026');await page.locator('#txt-font').selectOption('Oswald');await page.locator('#txt-arc').fill('25');await page.locator('#txt-stroke-on').check();await page.evaluate(()=>document.fonts.ready);}
  else await addArt(page,{side:name==='back-art'?'back':'front',dst:name==='thread-colors'});
  if(name==='multiple-art')await addArt(page,{multiple:true});
  if(name==='polo'){await page.locator('#garmentStyleSelect').selectOption('polo');await page.waitForFunction(()=>PHOTO.state==='ready'&&currentGarmentStyle==='polo');}
  if(name==='art-details')await page.locator('#artDetailsBtn').click();
  if(name==='thread-colors')await page.locator('#threadColorsBtn').click();
  if(['art-form','art-fees-failure'].includes(name)){await page.locator('#sendSteveBtn').click();await expect(page.locator('#steveModal')).toHaveClass(/open/);await page.waitForLoadState('networkidle');}
  if(['customer-dialog','customer-invalid','upload-failure'].includes(name)){
   await page.evaluate(()=>{window.__artRequestSeed={designId:'990001',company:'Example Company',contactEmail:'customer@example.invalid'};});
   await page.locator('#sendCustomerBtn').click();
   if(name==='customer-invalid'){await page.locator('#custEmail').fill('invalid');await page.locator('#custModalSend').click();await expect(page.locator('#toast')).toContainText('valid customer email');}
   if(name==='upload-failure'){await page.locator('#custModalSend').click();await expect(page.locator('#custModalSend')).toBeEnabled();await expect(page.locator('#toast')).toContainText('Send failed');}
  }
 }
 await evidence(page,name,e);
});
