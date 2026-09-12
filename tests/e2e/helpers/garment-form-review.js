const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'tests/e2e/screenshots/css-unification');
async function captureForm(page,name,expect){
 const phase=process.env.GARMENT_FORM_REVIEW_PHASE;if(!phase)return;
 if(!['original','current'].includes(phase))throw Error('Invalid form review phase');
 fs.mkdirSync(out,{recursive:true});const states=[];
 // AE's existing initial auth race produces either blank or Fixture; review
 // the same deliberately blank rep field captured in the original fixture.
 if(name==='ae'){
  await expect(page.locator('#gsf-sales-rep')).toHaveValue(/^(?:Fixture)?$/);
  await page.locator('#gsf-sales-rep').fill('');
 }
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const form=page.locator('.gsf-container');await expect(form).toBeVisible();
  states.push(await form.evaluate(n=>({fields:[...n.querySelectorAll('input,select,textarea')].map(f=>({id:f.id,name:f.name,type:f.type,value:f.value,checked:!!f.checked,disabled:!!f.disabled})),text:n.textContent.replace(/\s+/g,' ').trim()})));
  // Review each real section in its actual host, including sticky footers and modal scroll boundaries.
  const sections=form.locator('.gsf-section');
  for(let i=0;i<await sections.count();i++){
   if(!await sections.nth(i).isVisible())continue;
   await sections.nth(i).scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,`garment-form-${name}-section${i}-${phase}-${width}.png`)});
  }
 }
 const patch=page.locator('.gsf-decoration[value="Laser Leatherette Patch"]');
 const wasChecked=await patch.isChecked();await patch.check();
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  await page.locator('#gsf-patch-section').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,`garment-form-${name}-patch-${phase}-${width}.png`)});
 }
 await patch.setChecked(wasChecked);
 const file=`tests/fixtures/garment-form-${name}-original-browser.json`;
 if(phase==='original'){
  if(fs.existsSync(path.join(root,file)))expect(states).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
  else{fs.writeFileSync(path.join(root,file),JSON.stringify(states,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — original shared garment form fields and complete content in its real host.\n');}
 }else expect(states).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
 await page.setViewportSize({width:1440,height:1000});
 await page.pdf({path:path.join(out,`garment-form-${name}-${phase}.pdf`),format:'Letter',printBackground:true});
}
module.exports={captureForm};
