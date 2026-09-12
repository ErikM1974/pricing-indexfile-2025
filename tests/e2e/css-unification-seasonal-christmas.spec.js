const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const AxeBuilder=require('@axe-core/playwright').default;
const {root,openChristmas,goToChristmasState}=require('./helpers/seasonal-christmas-browser');
const capture=process.env.CAPTURE_CHRISTMAS_ORIGINAL==='1',phase=capture?'original':'current';
const out=path.join(__dirname,'screenshots/css-unification');
for(const mode of ['products','hoodie','beanie','gloves','bonus','customize','delivery','review-ship','review-pickup','success','failed-session','failed-item','failed-email'])test('CSS Christmas gift box: '+mode,async({page})=>{
 const events=await openChristmas(page,{failSession:mode==='failed-session',failItem:mode==='failed-item',failEmail:mode==='failed-email'});
 await goToChristmasState(page,events,mode);
 const states=[];
 for(const width of[1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(n=>n.getAttribute('src')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>{n.loading='eager';return n.decode().catch(()=>{});}));window.scrollTo(0,0);});
  const result=await page.evaluate(()=>{
   const shown=n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
   return {text:document.querySelector('main').innerText.replace(/\s+/g,' ').trim(),
    fields:[...document.querySelectorAll('input,select,textarea')].filter(shown).map(n=>({id:n.id,value:n.value,checked:n.checked})),
    totals:{quantity:calculateTotalQuantity(),retail:calculateTotalPrice(),unit:calculateUnitPrice()},
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    missingImages:[...document.images].filter(n=>shown(n)&&n.getAttribute('src')&&!n.naturalWidth).map(n=>n.src)};
  });
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  states.push({width,...result,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if(!capture){expect(result.overflow).toBe(false);expect(result.missingImages).toEqual([]);expect(axe.violations).toEqual([]);}
  await page.screenshot({path:path.join(out,'specialty-calculators-christmas-'+mode+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 const record={mode,states,events:{...events,advance:undefined},emails:await page.evaluate(()=>window.__emails)};
 if(capture&&mode!=='products')record.diagnostic='Original swatch pointer interception is preserved in christmas-original-flow.log. Dispatch swatch click and use native keyboard buttons to inspect the original deeper flow without changing CSS.';
 if(capture&&mode==='review-pickup')record.pickupDiagnostic='Original hidden pickup radio could not receive pointer input; checked/change is dispatched without modifying original CSS.';
 const rel='tests/fixtures/seasonal-christmas-'+mode+'-original-browser.json',file=path.join(root,rel);
 if(capture){if(fs.existsSync(file))expect(record).toEqual(JSON.parse(fs.readFileSync(file,'utf8')));else{fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+rel+' — immutable synthetic Christmas gift-box browser and request evidence.\n');}}
 else{
  const before=JSON.parse(fs.readFileSync(file,'utf8'));
  // The old success path erased the draft after three seconds, including on
  // failed writes. The renewed page keeps it until Done; use the captured order
  // value, not that transient reset, for the financial comparison.
  if(['success','failed-session','failed-item','failed-email'].includes(mode)){
   const session=before.events.writes.find(r=>r.path==='/api/quote_sessions');
   expect(states.map(s=>s.totals)).toEqual(states.map(()=>({quantity:4,retail:session.body.TotalAmount,unit:session.body.TotalAmount})));
  }else expect(states.map(s=>s.totals)).toEqual(before.states.map(s=>s.totals));
  expect(events.errors).toEqual([]);expect(events.unknown).toEqual([]);
  fs.writeFileSync(path.join(out,'seasonal-christmas-'+mode+'-current-browser.json'),JSON.stringify(record,null,2)+'\n');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({media:'print'});
 await page.pdf({path:path.join(out,'specialty-calculators-christmas-'+mode+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
});
