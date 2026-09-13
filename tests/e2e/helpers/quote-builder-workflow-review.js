const {expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),AxeBuilder=require('@axe-core/playwright').default;
const {snapshot,check}=require('./quote-builders-browser');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'../screenshots/css-unification');
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1',phase=original?'original':'current';
async function evidence(page,name,e){
 fs.mkdirSync(out,{recursive:true});const states=[];
 fs.writeFileSync(path.join(out,'quote-builder-'+name+'-network.json'),JSON.stringify(e,null,2)+'\n');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!original){expect.soft(state.overflow,name+' '+width+' overflow').toBe(false);expect.soft(states.at(-1).violations,name+' '+width+' accessibility').toEqual([]);}
  await page.screenshot({path:path.join(out,'quote-builders-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
  const scrolls=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+4&&/auto|scroll/.test(getComputedStyle(n).overflowY)).map((n,i)=>{n.setAttribute('data-capture-scroll',String(i));return{index:i,height:n.clientHeight,max:n.scrollHeight-n.clientHeight};}));
  for(const scroll of scrolls){const target=page.locator('[data-capture-scroll="'+scroll.index+'"]');for(let y=scroll.height;y<scroll.max+scroll.height;y+=scroll.height){await target.evaluate((n,y)=>{n.scrollTop=y;},Math.min(y,scroll.max));await page.screenshot({path:path.join(out,'quote-builders-'+name+'-panel'+scroll.index+'-y'+Math.min(y,scroll.max)+'-'+phase+'-'+width+'.png'),fullPage:true});}await target.evaluate(n=>{n.scrollTop=0;n.removeAttribute('data-capture-scroll');});}
 }
 check(expect,e);
 const file='tests/fixtures/quote-builders-'+name+'-original-browser.json',record={name,states,mutations:e.mutations||[]};
 if(original){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic populated builder workflow evidence.\n');}}
 else{
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const failedFastSave=name==='screenprint-fast-save-failure';
  const expected=failedFastSave?JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/quote-builders-screenprint-fast-contact-original-browser.json'),'utf8')):before;
  for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables']){
   const actual=key==='ids'?{...states[i][key]}:states[i][key];
   // The new persistent error replaces an alert (validation) or false success (save failure).
   if(key==='ids'&&name.startsWith('screenprint-fast-'))delete actual['fast-quote-error'];
   expect.soft(actual,name+' '+key).toEqual(expected.states[i][key]);
  }
  expect(e.mutations||[]).toEqual(failedFastSave?before.mutations.filter(m=>m.path!=='emailjs'):before.mutations);
  if(failedFastSave)await expect(page.locator('#fast-quote-error')).toContainText('could not be saved');
  if(name==='screenprint-fast-invalid')await expect(page.locator('#fast-quote-error')).toContainText('required fields');
 }
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'quote-builders-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}

module.exports={evidence};
