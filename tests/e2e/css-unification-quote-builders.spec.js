const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),{open,snapshot,check}=require('./helpers/quote-builders-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),original=process.env.CAPTURE_QUOTE_BUILDERS_ORIGINAL==='1',phase=original?'original':'current';
test.setTimeout(120000);
for(const method of ['embroidery','screenprint','dtf','dtg','screenprint-fast'])test('CSS quote builders: '+method+' initial',async({page})=>{
 const url='/quote-builders/'+(method==='screenprint-fast'?'screenprint-fast-quote':method+'-quote-builder')+'.html';
 const e=await open(page,{original,url});
 await page.waitForLoadState('networkidle');
 fs.mkdirSync(out,{recursive:true});
 // This discovery record remains local until every observed request is mapped.
 fs.writeFileSync(path.join(out,'quote-builder-'+method+'-network.json'),JSON.stringify(e,null,2)+'\n');
 const states=[];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  states.push({width,...await snapshot(page)});
  await page.screenshot({path:path.join(out,'quote-builders-'+method+'-initial-'+phase+'-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.pdf({path:path.join(out,'quote-builders-'+method+'-initial-'+phase+'.pdf'),format:'Letter',printBackground:true});
 check(expect,e);
 const file='tests/fixtures/quote-builders-'+method+'-initial-original-browser.json',record={method,states};
 if(original){if(fs.existsSync(path.join(root,file)))expect(record).toEqual(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));else{fs.writeFileSync(path.join(root,file),JSON.stringify(record,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+file+' — immutable original synthetic quote-builder initial browser evidence.\n');}}
 else{const before=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));for(let i=0;i<states.length;i++)for(const key of ['title','url','ids','fields','links','tables'])expect(states[i][key],method+' '+key).toEqual(before.states[i][key]);}
});
