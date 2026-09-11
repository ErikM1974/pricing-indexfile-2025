const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),original=require('../fixtures/contract-calculators-original-content.json'),root=path.resolve(__dirname,'../..');
describe('contract calculators preserve original pricing and source content',()=>{
 test.each(Object.entries(original.hashes))('%s changes only through reversible reviewed mappings',(file,hash)=>{
 let source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(source.split(c.after).length-1).toBe(c.count);source=source.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(hash);
 });
 for(const file of ['pages/js/dst-parser.js','shared_components/js/dst-quote-math.js'])test(file+' stays byte-identical',()=>{expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')).toBe(original.hashes[file]);});
});

const parser=require('@babel/parser');
function bodies(source){const found=new Map();function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)found.set(n.id.name,source.slice(n.start,n.end));for(const [key,value]of Object.entries(n)){if(['loc','start','end','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}visit(parser.parse(source,{sourceType:'script'}));return found;}
for(const [file,names]of Object.entries({
 'calculators/dtg-contract/dtg-contract.js':['tierIndexForQty','calculateUnitPriceWithLTM','rateFor','fetchContractDtgPricing','computeBaseUnit','renderEffectiveRateRow'],
 'pages/embroidery-contract-pricing.js':['loadContractPricing','buildGarmentsTable','buildCapsTable','buildLaserPatchTable','formatPrice']
}))test(file+' retains exact pricing and table calculations',()=>{const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let before=current;for(const c of original.changes.filter(c=>c.file===file).reverse())before=before.split(c.after).join(c.before);const a=bodies(before),b=bodies(current);for(const name of names){expect(a.has(name)).toBe(true);expect(b.get(name)).toBe(a.get(name));}});
test('the embroidery controller is byte-identical',()=>{const file='calculators/embroidery-contract/embroidery-contract.js';expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')).toBe(original.hashes[file]);});
