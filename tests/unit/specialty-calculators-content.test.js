const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),original=require('../fixtures/specialty-calculators-original-content.json'),root=path.resolve(__dirname,'../..');
describe('specialty calculators preserve original source',()=>{
 test.each(Object.entries(original.hashes))('%s changes only through reversible reviewed mappings',(file,hash)=>{
 let source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(source.split(c.after).length-1).toBe(c.count);source=source.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
 });
});

// Financial transformations are independently pinned, apart from the reviewed UI mappings.
test.each(['getTier','getSelectedEmbellishment','updateQuantityTier','updatePricing','getCapCategory'])('Richardson %s retains its exact financial body',name=>{
 const file='calculators/richardson-factory-direct.js',current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let prior=current;for(const c of original.changes.filter(c=>c.file===file).reverse())prior=prior.split(c.after).join(c.before);
 const body=source=>{const ast=require('acorn').parse(source,{ecmaVersion:'latest'}),cls=ast.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='RichardsonPricingLookup'),fn=cls.body.body.find(n=>n.key.name===name);return source.slice(fn.value.body.start,fn.value.body.end);};expect(body(current)).toBe(body(prior));
});
