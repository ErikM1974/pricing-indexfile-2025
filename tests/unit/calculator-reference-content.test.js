const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const original=require('../fixtures/calculator-reference-original-content.json'),root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
describe('calculator reference source and financial preservation',()=>{
 test.each(Object.entries(original.hashes))('%s retains its original source through explicit UI mappings',(file,hash)=>{
  let s=read(file);for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(s.split(c.after).length-1).toBe(c.count);s=s.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(hash);
 });
 test.each(['calculators/manual-pricing.js','calculators/service-price-cheat-sheet.js'])('%s preserves all financial and data transformations',file=>{
  expect(crypto.createHash('sha256').update(read(file)).digest('hex')).toBe(original.hashes[file]);
 });
});
