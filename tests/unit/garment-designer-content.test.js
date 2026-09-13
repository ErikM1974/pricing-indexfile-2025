const fs=require('fs'),path=require('path'),crypto=require('crypto'),original=require('../fixtures/garment-designer-original-content.json');
const root=path.resolve(__dirname,'../..');
test.each(Object.entries(original.artworkFunctions.hashes))('Garment artwork and export function is unchanged: %s',(name,hash)=>{
 const text=fs.readFileSync(path.join(root,original.artworkFunctions.owner),'utf8').replace(/\r\n/g,'\n');
 const n=require('@babel/parser').parse(text).program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);
 expect(n).toBeDefined();expect(crypto.createHash('sha256').update(text.slice(n.start,n.end)).digest('hex')).toBe(hash);
});
test.each(Object.entries(original.hashes))('Garment designer original source remains recoverable: %s',(file,hash)=>{
 let text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 for(const c of original.changes.filter(c=>c.file===file).reverse()){expect(text.split(c.after).length-1).toBe(c.count);text=text.split(c.after).join(c.before);}
 expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(hash);
});
