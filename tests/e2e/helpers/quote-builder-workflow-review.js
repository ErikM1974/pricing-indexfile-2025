const {expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),AxeBuilder=require('@axe-core/playwright').default;
const {snapshot,check}=require('./quote-builders-browser');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'../screenshots/css-unification');
const original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1',phase=original?'original':'current';
// Artwork widget IDs use Math.random. Preserve distinct widgets and field suffixes while
// comparing stable identities; never normalize customer values, amounts or quote IDs.
function stableArtwork(value,key){
 const ids=new Map();
 const identity=value=>value.replace(/^artwork-upload-[a-z0-9]{6}-/,id=>{if(!ids.has(id))ids.set(id,'artwork-upload-widget'+ids.size+'-');return ids.get(id);});
 const copy=JSON.parse(JSON.stringify(value));
 if(key==='ids')return Object.fromEntries(Object.entries(copy).map(([id,text])=>[identity(id),text]));
 if(key==='fields')return copy.map(field=>({...field,id:identity(field.id)}));
 return copy;
}
async function evidence(page,name,e){
 fs.mkdirSync(out,{recursive:true});const states=[];
 const previewOrigin=await page.evaluate(()=>location.origin);
 // A repaired layout can remove a scroll panel. Keep the current artifact set
 // exact so obsolete screenshots from a failed run cannot enter visual review.
 if(!original){
  const prefix='quote-builders-'+name+'-';
  for(const file of fs.readdirSync(out))if(file.startsWith(prefix)&&/^(?:(?:panel\d+-y\d+|horizontal\d+-x\d+)-)?current-(1440|768|390|320)\.png$/.test(file.slice(prefix.length)))fs.unlinkSync(path.join(out,file));
 }
 fs.writeFileSync(path.join(out,'quote-builder-'+name+'-network.json'),JSON.stringify(e,null,2)+'\n');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const state=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...state,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!original){expect.soft(state.overflow,name+' '+width+' overflow').toBe(false);expect.soft(states.at(-1).violations,name+' '+width+' accessibility').toEqual([]);}
  await page.screenshot({path:path.join(out,'quote-builders-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
  const scrolls=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&n.clientHeight>100&&n.scrollHeight>n.clientHeight+4&&/auto|scroll/.test(getComputedStyle(n).overflowY)).map((n,i)=>{n.setAttribute('data-capture-scroll',String(i));return{index:i,height:n.clientHeight,max:n.scrollHeight-n.clientHeight};}));
  for(const scroll of scrolls){const target=page.locator('[data-capture-scroll="'+scroll.index+'"]');for(let y=scroll.height;y<scroll.max+scroll.height;y+=scroll.height){await target.evaluate((n,y)=>{n.scrollTop=y;},Math.min(y,scroll.max));await page.screenshot({path:path.join(out,'quote-builders-'+name+'-panel'+scroll.index+'-y'+Math.min(y,scroll.max)+'-'+phase+'-'+width+'.png'),fullPage:true});}await target.evaluate(n=>{n.scrollTop=0;n.removeAttribute('data-capture-scroll');});}
  const horizontal=await page.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&n.clientWidth>100&&n.scrollWidth>n.clientWidth+4&&/auto|scroll/.test(getComputedStyle(n).overflowX)).map((n,i)=>{n.setAttribute('data-capture-horizontal',String(i));return{index:i,width:n.clientWidth,max:n.scrollWidth-n.clientWidth};}));
  for(const scroll of horizontal){const target=page.locator('[data-capture-horizontal="'+scroll.index+'"]');for(let x=scroll.width;x<scroll.max+scroll.width;x+=scroll.width){await target.evaluate((n,x)=>{n.scrollLeft=x;},Math.min(x,scroll.max));await page.screenshot({path:path.join(out,'quote-builders-'+name+'-horizontal'+scroll.index+'-x'+Math.min(x,scroll.max)+'-'+phase+'-'+width+'.png'),fullPage:true});}await target.evaluate(n=>{n.scrollLeft=0;n.removeAttribute('data-capture-horizontal');});}
 }
 check(expect,e);
 const file='tests/fixtures/quote-builders-'+name+'-original-browser.json',record={name,states,mutations:e.mutations||[]};
 if(original){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic populated builder workflow evidence.\n');}}
 else{
  const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const failedFastSave=name==='screenprint-fast-save-failure';
  const expected=failedFastSave?JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/quote-builders-screenprint-fast-contact-original-browser.json'),'utf8')):before;
  for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables']){
   let actual=key==='ids'?{...states[i][key]}:states[i][key];
   let expectedValue=key==='ids'?{...expected.states[i][key]}:expected.states[i][key];
   if(key==='fields')actual=actual.map(field=>{
    if(field.id!=='quote-share-url'||!field.value)return field;
    const saved=expectedValue.find(item=>item.id===field.id);
    if(!saved?.value)return field;
    const currentURL=new URL(field.value),originalURL=new URL(saved.value);
    // Preview ports differ between local capture and CI. The share link must
    // still use this page's origin; its exact quote ID, path and query stay checked.
    expect(currentURL.origin,name+' share link uses the current app origin').toBe(previewOrigin);
    return {...field,value:originalURL.origin+currentURL.pathname+currentURL.search+currentURL.hash};
   });
   if(name.startsWith('embroidery-')&&key==='ids'){
    // The resized layout keeps thumbnails on phones and offers its drag handle only beside the content.
    // These empty presentation nodes may change visibility; all values and form controls stay exact.
    for(const id of ['thumb-1','sidebar-resize-handle']){if(actual[id]==='')delete actual[id];if(expectedValue[id]==='')delete expectedValue[id];}
    // These informational notices expire on real timers during four-width capture.
    // Never normalize failure/success messages or calculated cap pricing.
    for(const state of [actual,expectedValue])if(typeof state['toast-container']==='string'){
     state['toast-container']=state['toast-container'].replace('Ready to build quotes!','').trim();
     if(name.startsWith('embroidery-caps'))state['toast-container']=state['toast-container'].replace('Cap detected - using cap embroidery pricing','').trim();
    }
   }
   if(name.startsWith('embroidery-')&&key==='tables'){
    // Restore the description column heading formerly hidden by the phone breakpoint.
    actual=actual.map((table,j)=>expectedValue[j]?.startsWith('Style Product image Color ')?table.replace(/^Style Product image Description Color /,'Style Product image Color '):table);
   }
   // The new persistent error replaces an alert (validation) or false success (save failure).
   if(key==='ids'&&name.startsWith('screenprint-fast-'))delete actual['fast-quote-error'];
   expect.soft(stableArtwork(actual,key),name+' '+key).toEqual(stableArtwork(expectedValue,key));
  }
  expect(e.mutations||[]).toEqual(failedFastSave?before.mutations.filter(m=>m.path!=='emailjs'):(before.mutations||[]));
  if(failedFastSave)await expect(page.locator('#fast-quote-error')).toContainText('could not be saved');
  if(name==='screenprint-fast-invalid')await expect(page.locator('#fast-quote-error')).toContainText('required fields');
 }
 if(!original&&name.endsWith('-invoice')){
  // Letter width minus the document's two 0.4-inch margins. Assert actual ink
  // stays inside currency cells; DOM text checks alone miss clipped cents.
  await page.setViewportSize({width:739,height:1000});await page.emulateMedia({media:'print'});
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('.size-matrix td.unit-cell,.products-table td[data-invoice-style="right"]')].flatMap(cell=>{
   const range=document.createRange();range.selectNodeContents(cell);const ink=range.getBoundingClientRect(),box=cell.getBoundingClientRect();
   return ink.left<box.left-1||ink.right>box.right+1?[cell.textContent.trim()]:[];
  }));
  expect(clipped,name+' printed amounts fit their columns').toEqual([]);
 }
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'quote-builders-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}

module.exports={evidence};
