const {open}=require('./specialty-calculators-browser');
const variants=[['LTM752','Black',12,250,80,'#262a2c'],['LTM763','Maroon',0,0,0,'#6b2639'],['LTM765','Green',5,75,20,'#19583e'],['LTM761','Navy',24,400,120,'#273950']];
function products(){return variants.map(([sku,color,stock,availableQuantity,localQuantity])=>({sku,name:'Polar Camel '+color+' 16 oz Pint',description:'16 oz. stainless steel vacuum insulated pint with clear slider lid. Synthetic product data for browser checks.',caseQuantity:24,lessThanCasePrice:8.5,oneCase:8,fiveCases:7.5,tenCases:7,twentyCases:6.5,fortyCases:6,availableQuantity,localQuantity,images:{full:'/synthetic-tumbler/'+sku+'.svg',thumbnail:'/synthetic-tumbler/'+sku+'.svg'}}));}
function image(sku){const color=variants.find(v=>v[0]===sku)?.[5]||'#262a2c';return '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1800" viewBox="0 0 1800 1800"><defs><linearGradient id="shine"><stop stop-color="white" stop-opacity=".18"/><stop offset=".45" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity=".18"/></linearGradient></defs><ellipse cx="900" cy="1540" rx="380" ry="30" fill="#222" opacity=".12"/><path d="M470 360H1330L1240 1480Q900 1570 560 1480Z" fill="'+color+'"/><path d="M470 360H1330L1240 1480Q900 1570 560 1480Z" fill="url(#shine)"/><ellipse cx="900" cy="360" rx="430" ry="75" fill="#c9cfd2"/><ellipse cx="900" cy="350" rx="375" ry="46" fill="#919ca2"/><rect x="800" y="320" width="210" height="45" rx="16" fill="#30383b"/></svg>';}
async function ready(page,state={}){
 await page.setViewportSize({width:1440,height:1000});
 const events=await open(page,{...state,url:'/calculators/laser-tumbler-polarcamel.html'+(state.color?'?color='+state.color:''),route:async(route)=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,m=req.method();
  if(p.startsWith('/synthetic-tumbler/')){if(state.failedImage)return {status:503};if(state.slowImage&&p.includes(state.slowImage))await new Promise(r=>setTimeout(r,350));return {contentType:'image/svg+xml',body:image(p.split('/').pop().split('.')[0])};}
  if(p.endsWith('/files/9171981'))return {contentType:'image/svg+xml',body:image('LTM752')};
  if(!['/api/jds/products','/api/service-codes','/api/manageorders/inventorylevels','/api/jds-catalog'].includes(p))return null;
  state.requests??=[];state.requests.push({path:p+url.search,method:m,...(m==='POST'?{body:req.postDataJSON()}:{} )});
  if((p==='/api/jds/products'&&state.failedProduct)||(p==='/api/service-codes'&&state.failedPolicy)||(p.includes('inventorylevels')&&state.failedInventory)||(p==='/api/jds-catalog'&&state.failedMetadata))return {status:503};
  if(p==='/api/jds/products'){if(m!=='POST')throw Error('Unexpected product method');return {json:{result:products().map(p=>state.missingWholesale?{...p,oneCase:null}:p)}};}
  if(p==='/api/service-codes'){if(state.slowPolicy)await new Promise(r=>setTimeout(r,300));return {json:{data:state.incompletePolicy?[]:[['JDS-MARGIN',state.alternate?0.57:0.53],['JDS-LABOR',state.alternate?3.75:2.99],['JDS-SETUP',state.alternate?90:75],['JDS-LOGO2',state.alternate?4.5:3.16],['JDS-LTM',state.alternate?65:50]].map(([ServiceCode,SellPrice])=>({ServiceCode,SellPrice,IsActive:true}))}};}
  if(p.includes('inventorylevels')){const sku=url.searchParams.get('PartNumber'),v=variants.find(v=>v[0]===sku);if(state.slowInventory===sku)await new Promise(r=>setTimeout(r,350));return {json:{result:[{Color:'Wrong color',Size01:999},{PartNumber:sku,Color:v[1],Size01:v[2],Size02:0,Size03:0,Size04:0,Size05:0,Size06:0}]}};}
  return {json:{result:variants.map(v=>({SKU:v[0],EngraveColor:''}))}};
 }});
 if(state.failedProduct||state.missingWholesale)await page.locator('#error-message').waitFor({state:'visible'});
 else {await page.locator('#mockup-section').waitFor({state:'visible'});await page.locator('#ltmk-preview-loading').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('#pricing-table-body tr').length===6);}
 events.mocked=state.requests||[];return events;
}
const logo=(color=false)=>({name:color?'sample-color.svg':'sample-mark.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><circle cx="160" cy="160" r="110" fill="'+(color?'#d82739':'black')+'"/>'+(color?'<rect x="130" y="60" width="60" height="200" fill="#255bd8"/>':'')+'</svg>')});
module.exports={ready,logo,products,variants};
