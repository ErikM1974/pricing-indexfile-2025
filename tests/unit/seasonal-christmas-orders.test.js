const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const legacy=require('../fixtures/seasonal-christmas-financial-source.json').parts;
const {ChristmasBundleQuoteService}=require('../../calculators/js/christmas-bundle-order');
const pricing={jackets:{CT100617:92,CT103828:137,CT104670:174},hoodies:58,beanies:35,gloves:19,giftBox:9,shipping:25};
const fixed=Date.parse('2026-09-12T18:30:10.000Z');
function input(jacket='CT104670',hoodie='CTK121',size='L',delivery='Ship'){
 const extra=size==='2XL'?2:0;
 const items={
  jacket:{id:jacket,name:'Example Jacket',selectedSize:size,selectedColor:'Black',retailPrice:pricing.jackets[jacket]+extra},
  hoodie:{id:hoodie,name:'Example Hoodie',selectedSize:size,selectedColor:'Navy',retailPrice:58+extra},
  beanie:{id:'CT104597',name:'Example Beanie',selectedSize:'OSFA',selectedColor:'Black',retailPrice:35},
  gloves:{id:'CTGD0794',name:'Example Gloves',selectedSize:'L',selectedColor:'Black Barley',retailPrice:19}
 };
 const total=Object.values(items).reduce((s,i)=>s+i.retailPrice,0)+34;
 const data={firstName:'Example',lastName:'Customer',email:'example@example.invalid',phone:'(253) 555-0100',company:'Example Company',deliveryMethod:delivery,
  shippingAddress:'123 Example Street',shippingCity:'Example City',shippingState:'WA',shippingZip:'98000',
  jacketEmbLocation:'Left Chest',hoodieEmbLocation:'Left Chest',threadColors:'Green, White',specialInstructions:'Synthetic test only',imageUpload:null,
  jacketStyle:jacket,jacketSize:size,jacketColor:'Black',hoodieStyle:hoodie,hoodieSize:size,hoodieColor:'Navy',
  beanieStyle:'CT104597',beanieColor:'Black',glovesStyle:'CTGD0794',glovesSize:'L',glovesColor:'Black Barley',
  rushOrder:false,dueDate:'2026-10-16',totalQuantity:4,totalPrice:total,unitPrice:total,
  description:'Jacket: '+jacket+', Hoodie: '+hoodie+', Beanie: CT104597, Gloves: CTGD0794'};
 return {items,data};
}
function original(data,items){
 const writes=[],emails=[];
 const context={Date,Math,JSON,AbortController,console:{error(){},warn(){},log(){}},cbLog(){},window:{},setTimeout:()=>1,clearTimeout(){},
  document:{getElementById:id=>({value:id==='specialInstructions'?data.specialInstructions:''})},
  fetch:async(url,options)=>{writes.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({success:true})};},
  emailjs:{send:async(service,template,payload)=>{emails.push({service,template,data:JSON.parse(JSON.stringify(payload))});return{status:200};}}
 };
 vm.createContext(context);
 vm.runInContext(legacy.RETAIL_PRICES+'\nlet selectedItems='+JSON.stringify(items)+';\n'+
  legacy.calculateTotalQuantity+'\n'+legacy.calculateTotalPrice+'\n'+legacy.ChristmasBundleQuoteService+'\n'+legacy.sendConfirmationEmail+
  '\nglobalThis.perform=async function(data){const result=await new ChristmasBundleQuoteService().submitQuote(data);await sendConfirmationEmail(data,result.quoteID);return result;};',context);
 return {writes,emails,run:()=>context.perform(data)};
}
function current(flags={}){
 const writes=[],emails=[];
 const service=new ChristmasBundleQuoteService({
  fetch:async(url,options)=>{
   writes.push({url,body:JSON.parse(options.body)});
   if(flags.hold)await flags.hold;
   return{ok:!(flags.session&&url.endsWith('sessions')||flags.item&&url.endsWith('items')),status:503};
  },
  email:()=>({send:async(service,template,data)=>{
   emails.push({service,template,data:JSON.parse(JSON.stringify(data))});
   if(flags.customer&&template==='template_v80ysfp'||flags.sales&&template==='template_sales_xmas')throw new Error('Synthetic email failure');
   return{status:200};
  }})
 });
 return{service,writes,emails};
}
beforeEach(()=>{jest.useFakeTimers();jest.setSystemTime(fixed);jest.spyOn(Math,'random').mockReturnValue(0.1);});
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
const cases=[];
for(const jacket of Object.keys(pricing.jackets))for(const hoodie of['CTK121','F281'])for(const size of['L','2XL'])for(const delivery of['Ship','Pickup'])cases.push([jacket,hoodie,size,delivery]);

test.each(cases)('renewed page uses the original financial results: %s %s %s %s',(jacket,hoodie,size,delivery)=>{
 const {items}=input(jacket,hoodie,size,delivery);
 const run=(source,setup='')=>{
  const context={window:{APP_CONFIG:{},addEventListener(){}},document:{addEventListener(){}},Date,Map,URL};
  vm.createContext(context);vm.runInContext(source+'\n'+setup+'\nglobalThis.measure=function(items){selectedItems=items;return [calculateTotalQuantity(),calculateTotalPrice(),calculateUnitPrice(),calculateRetailValue(),generateBundleDescription()];};',context);
  return JSON.parse(JSON.stringify(context.measure(items)));
 };
 const before=legacy.RETAIL_PRICES+'\nlet selectedItems={};\n'+['calculateTotalQuantity','calculateTotalPrice','calculateUnitPrice','calculateRetailValue','generateBundleDescription'].map(name=>legacy[name]).join('\n');
 const after=fs.readFileSync(path.resolve(__dirname,'../../calculators/js/christmas-bundles.js'),'utf8');
 expect(run(after)).toEqual(run(before));
});
test('2026 campaign keeps the physical street number and gives staff links both ways',()=>{
 const {JSDOM}=require('jsdom');
 const root=path.resolve(__dirname,'../..');
 const page=new JSDOM(fs.readFileSync(path.join(root,'calculators/christmas-bundles.html'),'utf8')).window.document;
 const dashboard=new JSDOM(fs.readFileSync(path.join(root,'staff-dashboard-v3/index.html'),'utf8')).window.document;
 expect(page.title).toContain('2026');expect(page.querySelector('.deadline-date').textContent).toBe('October 24, 2026 at 12:00 PM PST');
 expect(page.querySelector('#pickupInfo').textContent).toContain('2025 Freeman Road East');
 expect(page.querySelector('a[href="/staff-dashboard.html"]').textContent).toBe('Staff dashboard');
 const links=[...dashboard.querySelectorAll('a[href="/christmas-bundles.html"]')];expect(links).toHaveLength(1);
 expect(links[0].textContent).toContain('Christmas Gift Boxes 2026');
 expect(page.querySelector('style,[style],script:not([src]),[onclick],[onchange]')).toBeNull();
 expect([...page.querySelectorAll('link[rel="stylesheet"]')].map(n=>n.getAttribute('href').split('?')[0]).filter(url=>url.startsWith('/'))).toEqual(['/shared_components/css/tokens.css','/shared_components/css/components.css','/calculators/css/christmas-bundles.css']);
});

test.each(cases)('original order values preserved: %s %s %s %s',async(jacket,hoodie,size,delivery)=>{
 const {data,items}=input(jacket,hoodie,size,delivery),before=original(data,items),after=current();
 await before.run();await after.service.submit(data,items,pricing,null);
 expect(after.writes).toEqual(before.writes);
 const corrected=JSON.parse(JSON.stringify(before.emails));
 corrected[0].data.thread_color_1='Green';corrected[0].data.thread_color_2='White';
 expect(after.emails).toEqual(corrected);
});
test('a failed session blocks items and emails and retries the same reference',async()=>{
 const flags={session:true},run=current(flags),{data,items}=input();
 await expect(run.service.submit(data,items,pricing,null)).rejects.toThrow('not accepted');
 expect(run.writes).toHaveLength(1);expect(run.emails).toHaveLength(0);
 flags.session=false;await run.service.submit(data,items,pricing,null);
 expect(run.writes).toHaveLength(3);expect(run.writes[1].body.QuoteID).toBe(run.writes[0].body.QuoteID);
});
test('a failed item retains its accepted session and sends no premature email',async()=>{
 const flags={item:true},run=current(flags),{data,items}=input();
 await expect(run.service.submit(data,items,pricing,null)).rejects.toThrow('not accepted');
 expect(run.emails).toHaveLength(0);
 flags.item=false;await run.service.submit(data,items,pricing,null);
 expect(run.writes.filter(r=>r.url.endsWith('sessions'))).toHaveLength(1);
 expect(run.writes[2]).toEqual(run.writes[1]);
});
test.each(['customer','sales'])('retry only the unfinished %s email',async flag=>{
 const flags={[flag]:true},run=current(flags),{data,items}=input();
 const result=await run.service.submit(data,items,pricing,null);expect(result.saved).toBe(true);expect(result.complete).toBe(false);
 flags[flag]=false;expect((await run.service.retryEmails()).complete).toBe(true);
 expect(run.writes).toHaveLength(2);expect(run.emails).toHaveLength(3);
 expect(run.emails[2].template).toBe(flag==='customer'?'template_v80ysfp':'template_sales_xmas');
});
test('pending submissions share one captured order despite later draft edits',async()=>{
 let release;const flags={hold:new Promise(resolve=>{release=resolve;})},run=current(flags),{data,items}=input();
 const first=run.service.submit(data,items,pricing,null);
 data.firstName='Later edit';items.jacket.selectedSize='2XL';
 expect(run.service.submit(data,items,pricing,null)).toBe(first);
 release();await first;
 expect(run.writes).toHaveLength(2);expect(run.writes[1].body.First).toBe('Example');
 expect(run.writes[1].body.BundleConfiguration).toContain('CT104670 - L - Black');
});
test('address line two survives persistence and confirmation',async()=>{
 const run=current(),{data,items}=input();data.shippingAddress2='Suite 2';
 await run.service.submit(data,items,pricing,null);
 expect(run.writes[1].body.Shipping_Address).toBe('123 Example Street\nSuite 2');
 expect(run.emails[0].data.address_2).toBe('Suite 2');
});
test('a confirmed logo upload is reused when the item needs retry',async()=>{
 const flags={item:true},run=current(flags),{data,items}=input();
 run.service.upload=jest.fn().mockResolvedValue('SYNTHETIC-LOGO');
 const file={name:'synthetic.pdf',size:20,lastModified:fixed};
 await expect(run.service.submit(data,items,pricing,file)).rejects.toThrow('not accepted');
 flags.item=false;await run.service.submit(data,items,pricing,file);
 expect(run.service.upload).toHaveBeenCalledTimes(1);
 expect(run.writes[2].body.Image_Upload).toBe('SYNTHETIC-LOGO');
});
test('failed uploads prevent any quote or email writes',async()=>{
 const run=current(),{data,items}=input();
 run.service.upload=jest.fn().mockRejectedValue(new Error('Synthetic upload failure'));
 await expect(run.service.submit(data,items,pricing,{name:'synthetic.pdf',size:20,lastModified:fixed})).rejects.toThrow('upload failure');
 expect(run.writes).toHaveLength(0);expect(run.emails).toHaveLength(0);
});
