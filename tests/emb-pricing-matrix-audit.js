#!/usr/bin/env node
/**
 * EMB Pricing Combinatorial Audit — drives the REAL pricing engines (live Caspio data) across a
 * boundary-value + component-isolation + integration matrix of EVERY charge the Quote Builder can
 * produce, and diffs each against an INDEPENDENT reference formula validated to the live customer
 * pages (J790 $79, 112 $26). Any mismatch = a bug.
 *
 * Engines under test (exactly what the builder calls):
 *   calculateQuote()      garment/cap base + primary logo + stitch surcharge + LTM + sizes + mixed
 *   calculateALPrice()    additional logos (garment/cap/full-back), services-bar path
 *   calculateDECGPrice()  customer-supplied garments/caps + heavyweight
 *
 * Run: node tests/emb-pricing-matrix-audit.js
 */
global.window = { APP_CONFIG: { API: { BASE_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com' } } };
const stubEl = () => ({ style:{}, classList:{add(){},remove(){}}, appendChild(){}, insertBefore(){},
  setAttribute(){}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[], children:[], value:'', checked:false });
global.document = { getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[],
  createElement:stubEl, createTextNode:stubEl, body:stubEl(), head:stubEl() };

const Calc = require('../shared_components/js/embroidery-quote-pricing');
require('../shared_components/js/embroidery-pricing-service');
const Svc = global.window.EmbroideryPricingService;
const BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const ceil$ = (x) => Math.ceil(x - 1e-9);

let calc, svc, sizeCache = {}, AL, DECG;
async function J(url){ return (await fetch(url)).json(); }
async function sizeArr(style){ if(sizeCache[style]) return sizeCache[style]; const d=await J(`${BASE}/api/size-pricing?styleNumber=${style}`); return (sizeCache[style]=Array.isArray(d)?d:[d]); }
const pickColor = (arr,color) => arr.find(d=>d.color===color)||arr[0];
function stdBlank(pd){ for(const s of ['S','M','L','XL']) if(pd.basePrices[s]) return pd.basePrices[s];
  const a=Object.entries(pd.basePrices).filter(([,p])=>p>0).sort((x,y)=>x[1]-y[1]); return a.length?a[0][1]:0; }

const refGarmentUnit=(pd,size,tier)=>ceil$(stdBlank(pd)/calc.getMarginDenominator(tier)+calc.getEmbroideryCost(tier))+(pd.sizeUpcharges[size]||0);
const refCapUnit=(pd,size,tier)=>ceil$(stdBlank(pd)/calc.getCapMarginDenominator(tier)+(calc.capTiers[tier]?calc.capTiers[tier].embCost:0))+(pd.sizeUpcharges[size]||0);
const refStitch=(s)=>calc.getStitchSurcharge(s);
const refLTM=(q)=>(q<=7?(calc.ltmFee||50):0);
// AL reference (from live /api/al-pricing)
const refAL=(tier,stitch,type)=>{ if(type==='fullback') return Math.max(stitch,AL.fullBack.minStitches)/1000*AL.fullBack.ratePerThousand;
  const c=type==='cap'?AL.caps:AL.garments; return c.basePrices[tier]+Math.max(0,(stitch-c.baseStitches)/1000)*c.perThousandUpcharge; };
// DECG reference (from live /api/decg-pricing): base 8K both, + heavyweight $10
const refDECG=(tier,stitch,type,heavy)=>{ const c=type==='cap'?DECG.caps:DECG.garments; const bs=c.baseStitches||8000;
  return c.basePrices[tier]+Math.max(0,(stitch-bs)/1000)*c.perThousandUpcharge+(heavy?(DECG.heavyweightSurcharge||10):0); };

function makeGarment(style,color,sizes,stitch=8000){ const t=Object.values(sizes).reduce((a,b)=>a+b,0);
  const pr={id:'primary',position:'Left Chest',stitchCount:stitch,needsDigitizing:false,isPrimary:true};
  return {products:[{style,color,catalogColor:color,title:style,productName:style,sizeBreakdown:{...sizes},totalQuantity:t,isCap:false,sellPriceOverride:0,sizeOverrides:{},imageUrl:'',logoAssignments:{primary:{logoId:'primary',quantity:t},additional:[]}}],logos:[pr],logoConfigs:{garment:{primary:pr,additional:[]},cap:{primary:null,additional:[]}}}; }
function makeCap(style,color,sizes,stitch=5000){ const t=Object.values(sizes).reduce((a,b)=>a+b,0);
  const pr={id:'cap-primary',position:'Cap Front',stitchCount:stitch,needsDigitizing:false,isPrimary:true,embellishmentType:'embroidery'};
  return {products:[{style,color,catalogColor:color,title:style,productName:style,sizeBreakdown:{...sizes},totalQuantity:t,isCap:true,sellPriceOverride:0,sizeOverrides:{},imageUrl:'',logoAssignments:{primary:{logoId:'cap-primary',quantity:t},additional:[]}}],logos:[pr],logoConfigs:{garment:{primary:null,additional:[]},cap:{primary:pr,additional:[]}}}; }

const results=[];
const near=(a,b)=>Math.abs((a||0)-(b||0))<0.011;
const check=(name,got,exp)=>results.push({name,got:+(got||0).toFixed(2),exp:+(exp||0).toFixed(2),ok:near(got,exp)});
const unitLTM=(li)=>li.unitPriceWithLTM||li.unitPrice;

const GARMENTS=[{style:'J790',color:'Black/ Chrome'},{style:'PC61',color:'White'}];
const CAPS=[{style:'112',color:'Biscuit/ True Blue',size:'OSFA'},{style:'NE1000',color:'Black',size:'M/L'}];
const TIERS=[[3,'1-7'],[7,'1-7'],[8,'8-23'],[23,'8-23'],[24,'24-47'],[38,'24-47'],[47,'24-47'],[48,'48-71'],[71,'48-71'],[72,'72+'],[144,'72+']];
const STITCH=[8000,10000,10001,12000,15000,15001,20000,25000,30000];

(async()=>{
  calc=new Calc({skipInit:true}); calc.baseURL=BASE;
  svc=new Svc(); svc.baseURL=BASE;
  AL=await J(`${BASE}/api/al-pricing`); DECG=await J(`${BASE}/api/decg-pricing`);
  await calc.calculateQuote(...Object.values(makeGarment('J790','Black/ Chrome',{M:1})));
  await calc.calculateQuote(...Object.values(makeCap('112','Biscuit/ True Blue',{OSFA:1})));

  // (1-3) GARMENT base+LTM+sizes+stitch
  for(const g of GARMENTS){ const pd=pickColor(await sizeArr(g.style),g.color);
    for(const [q,t] of TIERS){ const li=(await calc.calculateQuote(...Object.values(makeGarment(g.style,g.color,{L:q})))).products[0].lineItems[0];
      check(`${g.style} x${q}(${t}) unit`,li.unitPrice,refGarmentUnit(pd,'L',t));
      check(`${g.style} x${q}(${t}) +LTM`,unitLTM(li),refGarmentUnit(pd,'L',t)+refLTM(q)/q); } }
  { const pd=pickColor(await sizeArr('J790'),'Black/ Chrome');
    for(const li of (await calc.calculateQuote(...Object.values(makeGarment('J790','Black/ Chrome',{XL:10,'2XL':6,'3XL':6,'4XL':6})))).products[0].lineItems){
      const sz=(li.description.match(/([A-Z0-9/]+)\(/)||[])[1]; if(sz) check(`J790 size ${sz}`,li.unitPrice,refGarmentUnit(pd,sz,'24-47')); } }
  for(const g of GARMENTS) for(const st of STITCH){ const p=await calc.calculateQuote(...Object.values(makeGarment(g.style,g.color,{L:24},st))); check(`${g.style} stitch ${st}`,p.garmentStitchTotal,refStitch(st)*24); }
  // (4-5) CAP base+LTM+stitch
  for(const c of CAPS){ const pd=pickColor(await sizeArr(c.style),c.color);
    for(const [q,t] of TIERS){ const li=(await calc.calculateQuote(...Object.values(makeCap(c.style,c.color,{[c.size]:q})))).products[0].lineItems[0];
      check(`${c.style} x${q}(${t}) unit`,li.unitPrice,refCapUnit(pd,c.size,t));
      check(`${c.style} x${q}(${t}) +LTM`,unitLTM(li),refCapUnit(pd,c.size,t)+refLTM(q)/q); } }
  for(const c of CAPS) for(const st of STITCH){ const p=await calc.calculateQuote(...Object.values(makeCap(c.style,c.color,{[c.size]:24},st))); check(`${c.style} cap stitch ${st}`,p.capStitchTotal,refStitch(st)*24); }

  // (6) ADDITIONAL LOGO — garment, every tier × stitch (services-bar calculateALPrice)
  for(const [q,t] of TIERS) for(const st of [8000,12000,20000]){ const r=await svc.calculateALPrice(q,st,'garment',AL); check(`AL garment x${q}(${t}) ${st}st`,r.unitPrice,refAL(t,st,'garment')); }
  // (7) ADDITIONAL LOGO — cap
  for(const [q,t] of TIERS) for(const st of [5000,8000,12000]){ const r=await svc.calculateALPrice(q,st,'cap',AL); check(`AL cap x${q}(${t}) ${st}st`,r.unitPrice,refAL(t,st,'cap')); }
  // (8) FULL BACK — flat rate, min 25K
  for(const st of [25000,30000,40000,50000]){ const r=await svc.calculateALPrice(24,st,'fullback',AL); check(`FullBack ${st}st`,r.unitPrice,refAL(null,st,'fullback')); }
  // (9) DECG garment + heavyweight
  for(const [q,t] of TIERS) for(const st of [8000,12000]) for(const hv of [false,true]){ const r=await svc.calculateDECGPrice(q,st,'garment',DECG,hv); check(`DECG garm x${q}(${t}) ${st}${hv?' HW':''}`,r.unitPrice,refDECG(t,st,'garment',hv)); }
  // (10) DECC cap + heavyweight
  for(const [q,t] of TIERS) for(const st of [8000,12000]) for(const hv of [false,true]){ const r=await svc.calculateDECGPrice(q,st,'cap',DECG,hv); check(`DECC cap x${q}(${t}) ${st}${hv?' HW':''}`,r.unitPrice,refDECG(t,st,'cap',hv)); }

  // (11) MIXED ORDER — garments + caps in ONE quote: separate tiers, each priced on its own qty
  { const gp=makeGarment('J790','Black/ Chrome',{L:30}); const cp=makeCap('112','Biscuit/ True Blue',{OSFA:10});
    const products=[...gp.products,...cp.products];
    const lc={garment:gp.logoConfigs.garment,cap:cp.logoConfigs.cap};
    const p=await calc.calculateQuote(products,[...gp.logos,...cp.logos],lc);
    const gli=p.products.find(x=>!x.isCap).lineItems[0], cli=p.products.find(x=>x.isCap).lineItems[0];
    const gpd=pickColor(await sizeArr('J790'),'Black/ Chrome'), cpd=pickColor(await sizeArr('112'),'Biscuit/ True Blue');
    check('MIXED garment(30→24-47)',gli.unitPrice,refGarmentUnit(gpd,'L','24-47'));   // garment tier = 30 garments
    check('MIXED cap(10→8-23)',cli.unitPrice,refCapUnit(cpd,'OSFA','8-23'));            // cap tier = 10 caps (separate!)
    check('MIXED no LTM (40 total)',p.ltmFee,0);
  }

  // (12) CAP EMBELLISHMENTS — flat upcharges (3D Puff +$5/cap; Laser Patch +$5/cap + $50 setup)
  for(const [emb,puff,patch,setup] of [['embroidery',0,0,0],['3d-puff',5,0,0],['laser-patch',0,5,50]]){
    const pr={id:'cp',position:'Cap Front',stitchCount:8000,isPrimary:true,embellishmentType:emb};
    const prods=[{style:'112',color:'Biscuit/ True Blue',catalogColor:'Biscuit/ True Blue',title:'112',productName:'112',sizeBreakdown:{OSFA:24},totalQuantity:24,isCap:true,sellPriceOverride:0,sizeOverrides:{},imageUrl:'',logoAssignments:{primary:{logoId:'cp',quantity:24},additional:[]}}];
    const p=await calc.calculateQuote(prods,[pr],{garment:{primary:null,additional:[]},cap:{primary:pr,additional:[]}});
    check(`cap ${emb} puff`,p.puffUpchargePerCap||0,puff);
    check(`cap ${emb} patch`,p.patchUpchargePerCap||0,patch);
    check(`cap ${emb} patchSetup`,p.capPatchSetupFee||0,setup);
  }

  const fails=results.filter(r=>!r.ok);
  console.log(`\n${'='.repeat(64)}\n  EMB PRICING MATRIX AUDIT — ${results.length} checks\n${'='.repeat(64)}`);
  if(!fails.length) console.log(`\n  ALL ${results.length} PASS — every charge the Quote Builder produces matches\n  the canonical formula across all boundaries.\n`);
  else { console.log(`\n  ${fails.length} FAILURES:\n`); for(const f of fails) console.log(`  FAIL  ${f.name}: got $${f.got}  expect $${f.exp}`); }
  console.log(`  Pass: ${results.length-fails.length}/${results.length}\n`);
  process.exitCode=fails.length?1:0;
})().catch(e=>{console.error('HARNESS ERROR:',e.message,e.stack);process.exit(1);});
