const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const original=require('../fixtures/core-calculators-original-content.json'),root=path.resolve(__dirname,'../..');
describe('public core calculators preserve their original sources',()=>{
 test.each(Object.entries(original.hashes))('%s changes only through reversible presentation mappings',(file,hash)=>{
  let s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(s.split(c.after).length-1).toBe(c.count);s=s.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(hash);
 });
 test.each(Object.keys(original.hashes).filter(f=>/-pricing-service\.js$|dtg-canonical-pricing\.js$/.test(f)))('%s keeps its financial implementation byte-identical',file=>{
  const s=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(original.hashes[file]);
 });
});
