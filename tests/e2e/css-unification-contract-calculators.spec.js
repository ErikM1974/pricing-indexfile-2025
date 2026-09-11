const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check}=require('./helpers/contract-calculators-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CONTRACT_CALCULATORS_ORIGINAL==='1',phase=capture?'original':'current';
test.use({timezoneId:'America/Los_Angeles',locale:'en-US',reducedMotion:'reduce'});
const urls={dtg:'/calculators/dtg-contract/index.html',emb:'/calculators/embroidery-contract/index.html',sheet:'/pages/embroidery-contract-pricing.html'};
function fixture(name,record){const file='tests/fixtures/contract-calculators-'+name+'-original-browser.json',abs=path.join(root,file);
 if(capture&&!fs.existsSync(abs)){fs.writeFileSync(abs,JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable synthetic contract-pricing browser evidence.\n');}
 else {const prior=JSON.parse(fs.readFileSync(abs,'utf8'));if(name==='dtg-tiers')for(const row of prior.records)for(const value of row.values)if(value[0]==='tableLtmNote'&&value[1].includes('on orders'))value[1]='LTM fee $37.00 on orders 1–23 pcs · adds $37.00 ÷ qty per piece';expect(record).toEqual(prior);}
}
// CSS text-transform is presentation only. Original fixtures stay immutable.
function presentationContract(state,name,prior=false){const copy=structuredClone(state);
 if(prior&&name.startsWith('dtg')){if(name==='dtg-failed')copy.ids.tableLtmNote='Small-order fee unavailable until pricing loads.';else if(copy.ids.tableLtmNote.includes('on orders'))copy.ids.tableLtmNote='LTM fee $37.00 on orders 1–23 pcs · adds $37.00 ÷ qty per piece';if(copy.ids.unitSub)copy.ids.unitSub=copy.ids.unitSub.replace('+ HW $1.00','+ HW $1.75');if(copy.ids.ppBreakdownList)copy.ids.ppBreakdownList=copy.ids.ppBreakdownList.replace('hoodies, fleece, etc. $1.00','hoodies, fleece, etc. $1.75');}
 if(!name.startsWith('sheet')){
  delete copy.ids.shareToastText; // Original opacity-only toast was wrongly exposed while idle.
  if(name.startsWith('emb')){
   // Existing controllers already set hidden; canonical utilities now enforce it.
   if(name==='emb-fee')delete copy.ids.factNoFee;
   else for(const id of ['factLtmFee','factLtmBand','factFbLtm','factFbBand'])delete copy.ids[id];
  }
  for(const id of Object.keys(copy.ids))copy.ids[id]=copy.ids[id].toLowerCase();
  copy.tables=copy.tables.map(t=>t.toLowerCase());
 }
 return copy;
}
async function evidence(page,name,e){const states=[];fs.mkdirSync(out,{recursive:true});
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(n=>n.decode().catch(()=>{})));});
 const s=await snapshot(page),axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();states.push({width,...s,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
 if(!capture){expect(s.overflow).toBe(false);expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
 await page.screenshot({path:path.join(out,'contract-calculators-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});}
 check(expect,e);const file='tests/fixtures/contract-calculators-'+name+'-original-browser.json';
 if(capture)fixture(name,{name,states,dialogs:e.dialogs});
 else {const old=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++){const current=presentationContract(states[i],name),prior=presentationContract(old.states[i],name,true);for(const k of ['title','url','ids','fields','links','tables','headings'])expect(current[k],name+' '+k).toEqual(prior[k]);}expect(e.dialogs).toEqual(old.dialogs);if(!name.startsWith('sheet'))await expect(page.locator('#shareToast')).toBeHidden();if(name.startsWith('emb')&&!name.includes('failed')){await expect(page.locator('#factNoFee'))[name==='emb-fee'?'toBeHidden':'toBeVisible']();for(const id of ['factLtm','factFb'])await expect(page.locator('#'+id))[name==='emb-fee'?'toBeVisible':'toBeHidden']();}}
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await page.evaluate(async()=>{window.scrollTo(0,0);await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.pdf({path:path.join(out,'contract-calculators-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
}
async function ready(page,kind,state={}){const e=await open(page,{...state,url:urls[kind]+(state.query||''),original:capture});
 if(state.failed)await expect(page.locator(kind==='sheet'?'#errorBanner':'#pricingError')).toBeVisible();
 else if(kind==='sheet')await expect(page.locator('#garmentsTableBody tr')).toHaveCount(14);
 else await expect(page.locator('#priceTable tbody tr').first()).toContainText('$');
 return e;
}
for(const kind of ['dtg','emb','sheet'])for(const failed of [false,true])test('CSS contract calculators: '+kind+(failed?' failed':' normal'),async({page})=>{const e=await ready(page,kind,{failed});await evidence(page,kind+(failed?'-failed':'-normal'),e);});
for(const [kind,query]of [['dtg','?qty=12&locs=LC,FF,JB&hw=1'],['emb','?type=cap&qty=12&stitches=9412'],['emb','?type=fullback&qty=72&stitches=42000']])test('CSS contract calculators: shared URL '+kind+query,async({page})=>{const e=await ready(page,kind,{query});await evidence(page,kind+'-url-'+(query.includes('cap')?'cap':query.includes('fullback')?'fullback':'options'),e);});
for(const kind of ['emb','sheet'])for(const mode of ['fee','failedMin'])test('CSS contract calculators: '+kind+' '+mode,async({page})=>{const e=await ready(page,kind,{[mode]:true});await evidence(page,kind+'-'+mode,e);});
for(const kind of ['dtg','emb'])test('CSS contract calculators: '+kind+' tier boundaries',async({page})=>{
 const e=await ready(page,kind,{query:kind==='dtg'?'?locs=LC,FF':''}),records=[];
 for(const qty of [1,7,8,12,23,24,47,48,71,72,144]){await page.locator('#qty').fill(String(qty));await page.locator('#qty').dispatchEvent('input');
 const values=await page.locator('#unitPrice,#unitSub,#orderTotal,#orderTotalNote,#resTier,#tableLtmNote').evaluateAll(ns=>ns.map(n=>[n.id,n.textContent.replace(/\s+/g,' ').trim()]));records.push({qty,values});}
 fixture(kind+'-tiers',{records});check(expect,e);
});
for(const kind of ['dtg','emb'])test('CSS contract calculators: '+kind+' assistant panel',async({page})=>{
 const e=await ready(page,kind,{chat:true,query:kind==='dtg'?'?locs=LC&qty=24':''});await page.locator('#aiDraftBtn').click();await expect(page.locator('#aiChatMessages')).toContainText('Synthetic quote assistant.');await expect(page.locator('#aiChatSend')).toBeEnabled();await evidence(page,kind+'-assistant',e);expect(e.mocked.filter(r=>r.method==='POST')).toHaveLength(1);
 await page.keyboard.press('Escape');await expect(page.locator('#aiChatPanel')).toHaveAttribute('aria-hidden','true');check(expect,e);
});


function dstFile(name,stitches=9000){const header=Buffer.alloc(512,32);header.write('LA:EXAMPLE\rST:'+String(stitches).padStart(7)+'\rCO:  1\r+X:  1\r-X:  0\r+Y:  1\r-Y:  0\r',0,'ascii');const records=[[1,0,3],[128,0,3],[2,0,3],[64,0,3]],bytes=[];for(let i=0;i<stitches;i++)bytes.push(...records[i%4]);bytes.push(0,0,243);return{name,mimeType:'application/octet-stream',buffer:Buffer.concat([header,Buffer.from(bytes)])};}
for(const staff of [false,true])test('CSS contract calculators: local stitch files '+(staff?'staff':'public'),async({page})=>{
 const e=await ready(page,'emb',{staff});await page.locator('#dstFileInput').setInputFiles(staff?[dstFile('Example-front.dst'),dstFile('Example-back.dst',10200)]:[dstFile('Example-front.dst')]);await expect(page.locator('#dstLines .dst-card')).toHaveCount(staff?2:1);await expect(page.locator('#dstError')).toBeHidden();
 if(staff)await expect(page.locator('#dstMargin')).toContainText('Revenue');else await expect(page.locator('#dstMargin')).toBeHidden();
 await evidence(page,staff?'emb-dst-staff':'emb-dst-public',e);await page.emulateMedia({media:'print'});await expect(page.locator('#dstMargin')).toBeHidden();check(expect,e);
});
test('CSS contract calculators: invalid stitch file stays local and announced',async({page})=>{
 const e=await ready(page,'emb');await page.locator('#dstFileInput').setInputFiles({name:'corrupt.dst',mimeType:'application/octet-stream',buffer:Buffer.alloc(515)});await expect(page.locator('#dstError')).toBeVisible();await evidence(page,'emb-dst-invalid',e);check(expect,e);
});
