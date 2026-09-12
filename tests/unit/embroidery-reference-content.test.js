const fs=require('fs'),path=require('path'),crypto=require('crypto'),parser=require('@babel/parser'),original=require('../fixtures/embroidery-reference-original-content.json');
const {sanitize,synthetic}=require('../e2e/helpers/embroidery-reference-browser'),root=path.resolve(__dirname,'../..');
test.each(Object.entries(original.financialFunctions.hashes))('Embroidery reference financial function is unchanged: %s',(name,hash)=>{
 const text=fs.readFileSync(path.join(root,original.financialFunctions.owner),'utf8').replace(/\r\n/g,'\n');
 const node=parser.parse(text).program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);expect(node).toBeDefined();
 expect(crypto.createHash('sha256').update(text.slice(node.start,node.end)).digest('hex')).toBe(hash);
});
test.each(Object.entries(original.hashes))('Embroidery reference original remains recoverable: %s',(file,hash)=>{
 let text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(text.split(c.after).length-1).toBe(c.count);text=text.split(c.after).join(c.before);}
 expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(hash);
});
test('Embroidery previews replace complete private initializers with synthetic records',()=>{
 const text=sanitize(fs.readFileSync(path.join(root,'calculators/embroidery-pricing-all/embroidery-pricing-all.js'),'utf8'));
 const found=[];function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&Object.hasOwn(synthetic,n.id?.name)){expect(JSON.parse(text.slice(n.init.start,n.init.end))).toEqual(synthetic[n.id.name]);found.push(n.id.name);}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}
 visit(parser.parse(text));expect(found.sort()).toEqual([...original.privateInitializerNames].sort());
 expect(()=>sanitize('const KEY_ACCOUNT_SURCHARGES=[];')).toThrow('Both private account initializers');
 for(const c of original.changes.filter(c=>c.file.endsWith('/embroidery-pricing-all.js')))expect(c.before).not.toMatch(/const (?:KEY_ACCOUNT_SURCHARGES|SURCHARGE_CUSTOMERS)\s*=/);
});
