const restorePreQuickQuote = require('../helpers/quick-quote-source-mappings');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),original=require('../fixtures/quick-quote-original-content.json');
const root=path.resolve(__dirname,'../..');
test.each(Object.entries(original.hashes))('Quick Quote original source remains recoverable: %s',(file,hash)=>{let text=restorePreQuickQuote(file, fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'));for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(text.split(c.after).length-1).toBe(c.count);text=text.split(c.after).join(c.before);}expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(hash);});
test.each(['dtf-prints-prototype.js'])('Quick Quote financial controller remains unchanged: %s',name=>{const file='calculators/quick-quote/'+name;expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')).toBe(original.hashes[file]);});

test('Quick Quote historical financial ownership is preserved before approved workflow changes',()=>{
 const parser=require('@babel/parser'),owner=original.financialOwnership;
 let text=restorePreQuickQuote(owner.file, fs.readFileSync(path.join(root,owner.file),'utf8').replace(/\r\n/g,'\n'));
 const ranges=[];function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&owner.excludedFunctions.includes(node.id.name))ranges.push(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
 visit(parser.parse(text));expect(ranges.map(n=>n.id.name).sort()).toEqual(['loadInventory','renderInventory']);
 for(const n of ranges.sort((a,b)=>b.start-a.start))text=text.slice(0,n.start)+'/* '+n.id.name+' presentation */'+text.slice(n.end);
 expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(owner.sha256);
});

test('current Quick Quote retains canonical monetary calculations and method group wiring',()=>{
 const parser=require('@babel/parser'),file=original.financialOwnership.file;
 const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),prior=restorePreQuickQuote(file,current);
 const names=['METHODS','r2','hdc','num','engineDeps','dtgCode','dtfLocations','frontOnlyGroups','currentSizes','stdSizeFor','buildItemFor','buildItem','summarize','priceMethod'];
 function financial(source){const result={};function visit(n){if(!n||typeof n!=='object')return;if(['FunctionDeclaration','VariableDeclarator'].includes(n.type)&&names.includes(n.id?.name))result[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}visit(parser.parse(source));expect(Object.keys(result).sort()).toEqual([...names].sort());return result;}
 expect(financial(current)).toEqual(financial(prior));
});
