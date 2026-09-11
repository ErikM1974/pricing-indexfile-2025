const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const baseline=require('../fixtures/employee-bundles-original-content.json');
const root=path.resolve(__dirname,'../..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
test.each(Object.keys(baseline.hashes))('%s preserves its original source outside recorded UI changes',file=>{
 const retired=baseline.retiredStyles.find(r=>r.file===file);
 if(retired){expect(hash(retired.css)).toBe(baseline.hashes[file]);expect(fs.existsSync(path.join(root,file))).toBe(false);return;}
 let source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 for(const c of baseline.changes.filter(c=>c.file===file).reverse()){expect(source.split(c.after).length-1).toBe(c.count);source=source.split(c.after).join(c.before);}
 expect(hash(source)).toBe(baseline.hashes[file]);
});
