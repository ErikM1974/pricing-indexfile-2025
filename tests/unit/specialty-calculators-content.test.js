const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),original=require('../fixtures/specialty-calculators-original-content.json'),root=path.resolve(__dirname,'../..');
describe('specialty calculators preserve original source',()=>{
 test.each(Object.entries(original.hashes))('%s changes only through reversible reviewed mappings',(file,hash)=>{
 let source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(source.split(c.after).length-1).toBe(c.count);source=source.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
 });
});
