const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const original=require('../fixtures/calculator-reference-original-content.json'),root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
describe('calculator reference source and financial preservation',()=>{
 test.each(Object.entries(original.hashes))('%s retains its original source through explicit UI mappings',(file,hash)=>{
  let s=read(file);for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(s.split(c.after).length-1).toBe(c.count);s=s.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(hash);
 });
 test.each(['calculators/manual-pricing.js','calculators/service-price-cheat-sheet.js'])('%s preserves all financial and data transformations',file=>{
  let s=read(file);
  // Only these two literal accessibility additions may differ. All API,
  // calculation, fee, rounding, row and view-restoration code stays byte-identical.
  if(file==='calculators/manual-pricing.js'){
   s=s.replace(' tabindex="0" role="region" aria-label="Prices by quantity and size"','');
   s=s.replace("\n            btn.setAttribute('aria-pressed', String(btn.dataset.type === type));",'');
  }
  expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(original.hashes[file]);
 });
});
