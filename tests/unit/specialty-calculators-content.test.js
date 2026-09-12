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

test.each(['calculatePrice','getWholesalePriceForQuantity','halfDollarUp','getPricingTiers'])('Polar Camel %s retains its exact financial body',name=>{
 const file='shared_components/js/jds-api-service.js',current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let prior=current;for(const c of original.changes.filter(c=>c.file===file).reverse())prior=prior.split(c.after).join(c.before);
 const body=source=>{const ast=require('acorn').parse(source,{ecmaVersion:'latest'}),cls=ast.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='JDSApiService'),fn=cls.body.body.find(n=>n.key.name===name);return source.slice(fn.value.body.start,fn.value.body.end);};expect(body(current)).toBe(body(prior));
});
test('Polar Camel quote arithmetic and engraving template stay exact',()=>{
 const file='shared_components/js/laser-tumbler-mockup.js',current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let prior=current;for(const c of original.changes.filter(c=>c.file===file).reverse())prior=prior.split(c.after).join(c.before);
 const tail=source=>source.slice(source.indexOf('        var svc = page.apiService;'),source.indexOf('    // ── Misc helpers'));expect(tail(current)).toBe(tail(prior));
 expect(original.changes.filter(c=>c.file==='shared_components/js/jds-tumbler-template.js')).toEqual([]);
});

test('Safety Stripe image mappings and quote identifiers remain exact',()=>{
 const sourceFile='calculators/safety-stripe-calculator.js',serviceFile='calculators/safety-stripe-creator-service.js';
 const prior=file=>{let text=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');for(const c of original.changes.filter(c=>c.file===file).reverse())text=text.split(c.after).join(c.before);return text;};
 const now=fs.readFileSync(path.join(root,sourceFile),'utf8').replace(/\r\n/g,'\n'),then=prior(sourceFile),imageMap=s=>s.slice(s.indexOf('const STRIPE_IMAGES ='),s.indexOf('// Current design state'));
 expect(imageMap(now)).toBe(imageMap(then));
 const method=(text,name)=>{const ast=require('acorn').parse(text,{ecmaVersion:'latest'}),cls=ast.body.find(n=>n.type==='ClassDeclaration'),fn=cls.body.body.find(n=>n.key.name===name);return text.slice(fn.value.body.start,fn.value.body.end);};
 const service=fs.readFileSync(path.join(root,serviceFile),'utf8').replace(/\r\n/g,'\n');for(const name of ['generateQuoteID','generateSessionID','cleanupOldSequences','getDesign'])expect(method(service,name)).toBe(method(prior(serviceFile),name));
});

// Customer-supplied screen-print amounts remain owned by the original shared engine.
test('customer screen print priceOrder and result arithmetic remain exact',()=>{
 const file='calculators/screenprint-customer/screenprint-customer-calculator.js',current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');let prior=current;for(const c of original.changes.filter(c=>c.file===file).reverse())prior=prior.split(c.after).join(c.before);
 const method=(source,name)=>{const cls=require('acorn').parse(source,{ecmaVersion:'latest'}).body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='CustomerScreenPrintCalculator'),fn=cls.body.body.find(n=>n.key.name===name);return source.slice(fn.value.body.start,fn.value.body.end);};
 expect(method(current,'priceOrder')).toBe(method(prior,'priceOrder'));expect(method(current,'renderResult').split('// Update display')[0]).toBe(method(prior,'renderResult').split('// Update display')[0]);
 expect(original.changes.filter(c=>['shared_components/js/screenprint-pricing-service.js','shared_components/js/quote-cart-engine.js'].includes(c.file))).toEqual([]);
});
