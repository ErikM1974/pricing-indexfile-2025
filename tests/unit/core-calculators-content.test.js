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

// Controllers also contain financial logic. Preserve these function bodies
// exactly, beyond the whole-file reversible presentation ledger above.
const parser = require('@babel/parser');
function functionsIn(source) {
 const result = new Map();
 function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassMethod') {
   const name = node.id?.name || node.key?.name;
   if (name) result.set(name, source.slice(node.start, node.end));
  }
  for (const [key, value] of Object.entries(node)) {
   if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue;
   if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
 }
 visit(parser.parse(source, {sourceType:'script'})); return result;
}
const financialFunctions = {
 'calculators/js/dtg-pricing-page.js': ['getDTGPrice','apiTiers','tierByLabel','tierRangeText','fmtFee','currentQuantity','getDTGPriceForComboLocation','getDTGPriceForSingleLocation','getLTMFeeFromBundle','handleLTMQuantityInput','validateLTMQuantityInput'],
 'shared_components/js/dtf-pricing-calculator.js': ['loadApiData','mergeApiDataIntoConfig','getTransferPrice','getFreightPerTransfer','getTierDataForQuantity','parseQuantityRange','calculatePricing','roundHalfDollarCeil','updateGarmentCost','updateQuantity'],
 'shared_components/js/screenprint-pricing-v2.js': ['calculatePricing','calculateCurrentPrice','updateQuantity','updateFrontColors','updateDarkGarment','updateFrontSafetyStripes','updateLocationSafetyStripes','getAvailableLocationOptions','addLocation','removeLocation']
};
for (const [file,names] of Object.entries(financialFunctions)) {
 test(file+' retains exact original financial function bodies',()=>{
  const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let before=current;
  for(const c of original.changes.filter(c=>c.file===file).reverse())before=before.split(c.after).join(c.before);
  const a=functionsIn(before),b=functionsIn(current);
  for(const name of names){expect(a.has(name)).toBe(true);expect(b.get(name)).toBe(a.get(name));}
 });
}
