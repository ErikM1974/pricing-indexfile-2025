const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),original=require('../fixtures/contract-calculators-original-content.json'),root=path.resolve(__dirname,'../..');
describe('contract calculators preserve original pricing and source content',()=>{
 test.each(Object.entries(original.hashes))('%s changes only through reversible reviewed mappings',(file,hash)=>{
 let source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(source.split(c.after).length-1).toBe(c.count);source=source.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
 });
 for(const file of ['pages/js/dst-parser.js','shared_components/js/dst-quote-math.js'])test(file+' stays byte-identical',()=>{expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')).toBe(original.hashes[file]);});
});
