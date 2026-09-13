const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const createService = require('../../lib/christmas-gift-box');
const { priceColor } = require('../../lib/christmas-pricing');
const { validateCampaign, inventorySizes, isClosed } = require('../../calculators/js/christmas-campaign');
const { ChristmasBundleQuoteService } = require('../../calculators/js/christmas-bundle-order');
const campaign = require('../../config/christmas-campaign.json');
const bundle = require('../fixtures/holiday-emb-CT104670.json');
const sizePricing = require('../fixtures/holiday-size-CT104670.json');
const reference = require('../fixtures/holiday-8-piece-contract.json');
const clone = value => JSON.parse(JSON.stringify(value));
const fixed = Date.parse('2026-09-13T19:00:00Z');
const code = 'SYNTHETIC-INVITATION';
function factory(flags = {}) {
 const state = { sessions: [], items: [], emails: [], writes: [] };
 let now = fixed;
 const ctx = {
  readCampaign: () => clone(campaign), now: () => now, signingSecret: 'synthetic-holiday-signing-secret',
  giftCodeHash: crypto.createHash('sha256').update(code).digest('hex'), giftCode: flags.displayCode === undefined ? code : flags.displayCode,
  mintShareToken: () => 'synthetic-share-token', quoteShareUrl: id => 'https://example.invalid/quote/' + id + '?k=synthetic-share-token',
  sendEmailJSTemplate: async (template, params) => { state.emails.push({ template, params }); if (flags.email) throw new Error(flags.email); },
  makeApiRequest: async (endpoint, method = 'GET', body) => {
   if (method !== 'GET') state.writes.push({ endpoint, method, body: clone(body) });
   if (endpoint.startsWith('/product-colors')) return { colors: [{ COLOR_NAME: 'Black', CATALOG_COLOR: 'Black' }] };
   if (endpoint.startsWith('/pricing-bundle')) return clone(bundle);
   if (endpoint.startsWith('/size-pricing')) return [{ styleNumber: new URL('https://example.invalid' + endpoint).searchParams.get('styleNumber'), color: 'Black', basePrices: { S: flags.cost || 10, L: flags.cost || 10, '2XL': flags.cost || 10, OSFA: flags.cost || 10 }, sizeUpcharges: { '2XL': 2 } }];
   if (endpoint.startsWith('/service-codes')) return { data: flags.feesMissing ? [] : [{ ServiceCode: campaign.boxServiceCode, IsActive: true, PricingMethod: 'FLAT', SellPrice: 9 }, { ServiceCode: campaign.shippingServiceCode, IsActive: true, PricingMethod: 'FLAT', SellPrice: 25 }] };
   if (endpoint.startsWith('/sanmar/inventory')) { const style = endpoint.split('/')[3].split('?')[0]; return { style, inventory: [{ partId: style, color: 'Black', size: style === 'CT104597' ? 'OSFA' : 'L', totalQty: flags.stock === undefined ? 30 : flags.stock }] }; }
   if (endpoint.startsWith('/quote_sessions?')) return clone(state.sessions);
   if (endpoint === '/quote_sessions' && method === 'POST') { state.sessions.push({ ...clone(body), PK_ID: 1 }); if (flags.lostSession) { flags.lostSession = false; throw new Error('Lost acknowledgement'); } return { PK_ID: 1 }; }
   if (endpoint === '/quote_sessions/1' && method === 'PUT') { if (flags.markerFailure && body.OrderSettingsJSON && JSON.parse(body.OrderSettingsJSON).customerEmailSent) throw new Error('Marker save failed'); Object.assign(state.sessions[0], clone(body)); return { success: true }; }
   if (endpoint.startsWith('/quote_items?')) return clone(state.items);
   if (endpoint === '/quote_items' && method === 'POST') { if (flags.failLine === body.LineNumber) throw new Error('Synthetic item write failure'); state.items.push({ ...clone(body), PK_ID: state.items.length + 1 }); if (flags.lostItem) { flags.lostItem = false; throw new Error('Lost item acknowledgement'); } return { success: true }; }
   throw new Error('Unexpected fixture endpoint ' + endpoint);
  },
 };
 const service = createService(ctx);
 const body = { requestKey: '00000000-0000-4000-8000-000000000001', deliveryMethod: 'Ship', items: [
  { type: 'jacket', style: 'CT104670', color: 'Black', size: 'L' }, { type: 'hoodie', style: 'CTK121', color: 'Black', size: 'L' },
  { type: 'beanie', style: 'CT104597', color: 'Black', size: 'OSFA' }, { type: 'gloves', style: 'CTGD0794', color: 'Black', size: 'L' }],
  customer: { firstName: 'Example', lastName: 'Customer', company: 'Example Co', email: 'customer@example.invalid', phone: '2535550100', dueDate: '2026-10-16',
   shippingAddress: '123 Example St', shippingCity: 'Example City', shippingState: 'WA', shippingZip: '98000', jacketEmbLocation: 'right-chest', hoodieEmbLocation: 'left-chest', holidayTeamSize: '40' },
 };
 const prepare = async (gift = false) => { if (gift) body.promotionToken = service.validateCode(code).promotionToken; body.estimateToken = (await service.estimate(body)).estimateToken; return body; };
 return { service, state, body, prepare, advance: ms => { now += ms; } };
}

test.each(reference.examples)('actual eight-piece calculator parity: $color $size', async row => {
 const result = await priceColor({ bundle, sizePricing, color: { COLOR_NAME: row.color, CATALOG_COLOR: row.color } });
 expect(result.bySize[row.size]).toBe(row.unitPrice);
 expect(result.tier).toBe(row.tier);
});
test('missing tier, color, cost and rounding never produce a guessed price', async () => {
 for (const change of [{ tiersR: [] }, { allEmbroideryCostsR: [] }, { rulesR: { RoundingMethod: 'unknown' } }]) await expect(priceColor({ bundle: { ...bundle, ...change }, sizePricing, color: { COLOR_NAME: 'Black' } })).rejects.toThrow();
 await expect(priceColor({ bundle, sizePricing, color: { COLOR_NAME: 'Unknown' } })).rejects.toThrow();
});
test('catalog placeholders, missing quantities and wrong colors remain unknown', () => {
 for (const data of [{ sizes: ['L'], sizeTotals: [0] }, { style: 'CT104670', inventory: [{ color: 'Navy', size: 'L', totalQty: 30 }] },
  ...[null, '', undefined, -1, 1.5].map(totalQty => ({ style: 'CT104670', inventory: [{ color: 'Black', size: 'L', totalQty }] }))]) {
  expect(() => inventorySizes(data, 'CT104670', { CATALOG_COLOR: 'Black' })).toThrow();
 }
 expect(inventorySizes({ style: 'CT104670', inventory: [{ color: 'Black', size: 'L', totalQty: 0 }] }, 'CT104670', { CATALOG_COLOR: 'Black' })).toEqual([{ size: 'L', quantity: 0 }]);
});
test('configuration supports a product swap and closes at midnight Pacific after October 15', () => {
 const changed = clone(campaign); changed.products.jackets[0].style = 'NEWSTYLE';
 expect(validateCampaign(changed).products.jackets[0].style).toBe('NEWSTYLE');
 expect(isClosed(campaign, Date.parse('2026-10-16T06:59:59Z'))).toBe(false);
 expect(isClosed(campaign, Date.parse('2026-10-16T07:00:00Z'))).toBe(true);
 changed.products.hoodies[0].style = 'NEWSTYLE'; expect(() => validateCampaign(changed)).toThrow();
});
test('shared invitation works repeatedly, but bad, expired and forged tokens fail', async () => {
 const f = factory(); expect(() => f.service.validateCode('wrong')).toThrow(/not recognized/);
 expect(f.service.validateCode(code.toLowerCase()).applied).toBe(true); expect(f.service.validateCode(code).applied).toBe(true);
 await f.prepare(true); const valid = f.body.promotionToken; f.body.promotionToken += 'x'; await expect(f.service.estimate(f.body)).rejects.toThrow();
 f.body.promotionToken = valid; f.advance(31 * 60000); await expect(f.service.estimate(f.body)).rejects.toThrow(/refreshed/);
});
test.each([false, true])('one box enters existing Quotes as an uncharged request; complimentary=%s', async gift => {
 const f = factory(); await f.prepare(gift); f.body.total = 0; f.body.complimentary = true; f.body.items.forEach(item => { item.unitPrice = 0; });
 const result = await f.service.submit(f.body), row = f.state.sessions[0];
 expect(result.saved).toBe(true); expect(result.quoteID).toMatch(/^XMAS-/); expect(row.Status).toBe('Open'); expect(row.TotalQuantity).toBe(4);
 expect(f.state.items).toHaveLength(6); expect(f.state.emails).toHaveLength(2); expect(row.PaidToDate).toBe(0); expect(row.PushedToShopWorks).toBeUndefined();
 expect(result.pricing.total === 0).toBe(gift); expect(row.TotalAmount + row.ShippingFee).toBe(result.pricing.total);
 expect(row.PaymentTerms).toContain('No payment is due'); expect(JSON.parse(row.Notes).share_token).toBeTruthy();
 expect(JSON.stringify(f.state.writes)).not.toContain(code); expect(JSON.stringify(f.state.writes)).not.toContain('promotionToken');
 await f.service.submit(f.body); expect(f.state.sessions).toHaveLength(1); expect(f.state.items).toHaveLength(6); expect(f.state.emails).toHaveLength(2);
});
test('pickup has no shipping charge and fees must come from the API', async () => {
 const f = factory(); const ship = await f.service.estimate(f.body); f.body.deliveryMethod = 'Pickup'; const pickup = await f.service.estimate(f.body);
 expect(ship.total - pickup.total).toBe(25); expect(pickup.shipping).toBe(0);
 await expect(factory({ feesMissing: true }).service.estimate(f.body)).rejects.toThrow(/charges/);
});
test('a changed price or zero stock stops before any write and permits revising the request', async () => {
 for (const flag of ['cost', 'stock']) { const flags = {}, f = factory(flags); await f.prepare(); flags[flag] = flag === 'cost' ? 100 : 0;
  await expect(f.service.submit(f.body)).rejects.toMatchObject({ canRevise: true, status: 409 }); expect(f.state.writes).toHaveLength(0);
 }
});
test.each(['2026-09-26', '2026-09-15', '2026-02-30'])('rejects weekend, premature and invalid date %s', async date => {
 const f = factory(); await f.prepare(); f.body.customer.dueDate = date; await expect(f.service.submit(f.body)).rejects.toThrow(); expect(f.state.writes).toHaveLength(0);
});
test.each(['lostSession', 'lostItem'])('lost acknowledgement %s resumes the durable request without new records', async key => {
 const f = factory({ [key]: true }); await f.prepare(); await expect(f.service.submit(f.body)).rejects.toThrow();
 const result = await f.service.submit(f.body); expect(result.complete).toBe(true); expect(f.state.sessions).toHaveLength(1); expect(f.state.items).toHaveLength(6);
});
test('partial item save stays Draft, then finishes missing lines and emails', async () => {
 const flags = { failLine: 3 }, f = factory(flags); await f.prepare(); await expect(f.service.submit(f.body)).rejects.toThrow();
 expect(f.state.sessions[0].Status).toBe('Draft'); expect(f.state.items).toHaveLength(2); expect(f.state.emails).toHaveLength(0);
 flags.failLine = null; await f.service.submit(f.body); expect(f.state.items).toHaveLength(6); expect(f.state.sessions[0].Status).toBe('Open');
});
test('changed data cannot overwrite a saved partial request', async () => {
 const f = factory({ failLine: 2 }); await f.prepare(); await expect(f.service.submit(f.body)).rejects.toThrow();
 f.body.customer.email = 'different@example.invalid'; await expect(f.service.submit(f.body)).rejects.toMatchObject({ status: 409 }); expect(f.state.sessions).toHaveLength(1);
});
test('concurrent retries share the same in-process save', async () => {
 const f = factory(); await f.prepare(); const results = await Promise.all([f.service.submit(f.body), f.service.submit(f.body)]);
 expect(results[0].quoteID).toBe(results[1].quoteID); expect(f.state.sessions).toHaveLength(1); expect(f.state.items).toHaveLength(6);
});
test('failed email retries only the provider-rejected sends; uncertain email is not blindly resent', async () => {
 const flags = { email: 'EmailJS HTTP 400: synthetic rejection' }, f = factory(flags); await f.prepare();
 expect((await f.service.submit(f.body)).emailRetryable).toBe(true); flags.email = null;
 expect((await f.service.submit(f.body)).complete).toBe(true); expect(f.state.sessions).toHaveLength(1);
 const u = factory({ email: 'request timeout' }); await u.prepare(); expect((await u.service.submit(u.body)).emailUncertain).toBe(true);
 await u.service.submit(u.body); expect(u.state.emails).toHaveLength(2);
});
test('email acknowledgement marker failure does not claim delivery or send again', async () => {
 const f = factory({ markerFailure: true }); await f.prepare(); const result = await f.service.submit(f.body);
 expect(result.complete).toBe(false); expect(result.emailUncertain).toBe(true); await f.service.submit(f.body); expect(f.state.emails).toHaveLength(2);
});
test('browser transport retains the exact request after uncertainty and reload', async () => {
 let saved; const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; }, removeItem: () => { saved = null; } };
 const bodies = []; let fail = true;
 const fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); if (fail) throw new Error('timeout'); return { ok: true, json: async () => ({ saved: true, quoteID: 'XMAS-example', quoteUrl: '/quote/XMAS-example', pricing: { total: 100 } }) }; };
 const service = new ChristmasBundleQuoteService({ storage, fetch }); await expect(service.submit(factory().body, null)).rejects.toThrow();
 fail = false; const restored = new ChristmasBundleQuoteService({ storage, fetch }); await restored.retry(); expect(bodies[1]).toEqual(bodies[0]);
 await expect(restored.submit(factory().body, null)).rejects.toThrow(/earlier request/);
});
test('page uses the new deadline, staff link, server pricing and no browser email sender', () => {
 const html = fs.readFileSync(path.resolve(__dirname, '../../calculators/christmas-bundles.html'), 'utf8');
 expect(html).toContain('October 15, 2026'); expect(html).toContain('2025 Freeman Road East'); expect(html).toContain('/staff-dashboard.html');
 expect(html).not.toMatch(/FREE!|@emailjs\/browser|<style[ >]|on(?:click|change)=/);
 expect(html).toContain('Have a gift code?'); expect(html).toContain('No payment is collected here');
});

test('conflicting duplicate inventory cannot silently reuse a stock count', () => {
 const row = { partId: 'SYNTHETIC', color: 'Black', size: 'L', totalQty: 30 };
 const parse = inventory => inventorySizes({ style: 'CT104670', inventory }, 'CT104670', { CATALOG_COLOR: 'Black' });
 expect(parse([row, {...row}])).toEqual([{size:'L',quantity:30}]);
 expect(() => parse([row, {...row,totalQty:0}])).toThrow(/conflicting/);
 expect(() => parse([row, {...row,size:'S'}])).toThrow(/conflicting/);
});

test('a changed color, size or decoration on a partial saved line requires review', async () => {
 for (const [key,value] of [['ColorCode','Navy'],['SizeBreakdown','{"S":1}'],['EmbroideryLocation','left-chest']]) {
  const flags={failLine:2},f=factory(flags); await f.prepare(); await expect(f.service.submit(f.body)).rejects.toThrow();
  f.state.items[0][key]=value; flags.failLine=null;
  await expect(f.service.submit(f.body)).rejects.toMatchObject({status:409}); expect(f.state.emails).toEqual([]);
 }
});

test('a concurrent request with different details cannot join the original save', async () => {
 const f=factory(); await f.prepare(); const saving=f.service.submit(f.body);
 await expect(f.service.submit({...f.body,customer:{...f.body.customer,email:'changed@example.invalid'}})).rejects.toMatchObject({status:409});
 await saving; expect(f.state.sessions).toHaveLength(1); expect(f.state.sessions[0].CustomerEmail).toBe(f.body.customer.email);
});

function registered(moduleName, overrides={}) {
 const handlers=new Map(); const app=Object.fromEntries(['get','post','put','delete','use','patch'].map(method=>[method,(url,...stack)=>handlers.set(method+' '+url,stack)]));
 const pass=(_req,_res,next)=>next();
 const ctx={strictLimiter:pass,requireStaff:pass,requireStaffOrSync:pass,quotePlaneWriteLimiter:pass,quoteScopedOrStaff:pass,
  rateLimit:()=>pass,sanitizeFilterInput:value=>value,...overrides};
 require('../../routes/'+moduleName)(app,ctx);
 return {ctx,handlers};
}
function response() {return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},set(){return this;}};}

test.each(['accept','deposit-checkout','enable-deposit'])('holiday %s never charges, accepts or writes, even when terms are already enabled', async action => {
 const row={PK_ID:1,QuoteID:'XMAS-SYNTHETIC',Status:action==='accept'?'Open':'Accepted',Notes:JSON.stringify({deposit:{enabled:true}})};
 const api=jest.fn(async()=>[row]),stripe=jest.fn(),email=jest.fn(),autoEnable=jest.fn();
 const {handlers}=registered('quote-lifecycle',{makeApiRequest:api,fetchQuoteSessionRow:async()=>row,shareTokenOk:()=>true,stripe,sendQuoteAcceptedEmails:email,autoEnablePickupDeposit:autoEnable});
 const url=action==='enable-deposit'?'/api/quotes/:quoteId/enable-deposit':'/api/public/quote/:quoteId/'+action;
 const req={params:{quoteId:row.QuoteID},body:{name:'Example',email:'customer@example.invalid',deliveryMethod:'pickup',shipping:0,taxRatePct:0},is:()=>true,session:action==='enable-deposit'?{crmUser:{name:'Example Staff'}}:{}};
 const res=response(); await handlers.get('post '+url).at(-1)(req,res);
 expect(res.statusCode).toBe(409);expect(res.body.error).toMatch(/staff review/);
 expect(api.mock.calls.every(call=>!call[1]||call[1]==='GET')).toBe(true);expect(stripe).not.toHaveBeenCalled();expect(email).not.toHaveBeenCalled();expect(autoEnable).not.toHaveBeenCalled();
});

test.each([['quote-plane','/api/quote_sessions'],['quote-delete','/api/quote_items']])('anonymous holiday creates cannot bypass validation through %s',async(moduleName,url)=>{
 const api=jest.fn();const {handlers}=registered(moduleName,{makeApiRequest:api});
 for(const body of [{QuoteID:'XMAS-SYNTHETIC'},{quoteid:'xmas-synthetic'},{QuoteID:'EMB-123',qUoTeId:' XMAS-SYNTHETIC'}]){
  const res=response();await handlers.get('post '+url).at(-1)({body,session:{}},res);expect(res.statusCode).toBe(403);
 }expect(api).not.toHaveBeenCalled();
});

test('slow request returns pending before the hosting deadline without cancelling the saved request',async()=>{
 jest.useFakeTimers(); let finish; const saved=new Promise(resolve=>{finish=resolve;});const submit=jest.fn(()=>saved);
 try {
  jest.doMock('../../lib/christmas-gift-box',()=>()=>({submit}));let handlers;
  jest.isolateModules(()=>{handlers=registered('christmas-gift-box').handlers;});
  const res=response(); const handling=handlers.get('post /api/christmas-gift-box/requests').at(-1)({body:{requestKey:'synthetic'}},res);
  await jest.advanceTimersByTimeAsync(15000);await handling;expect(res.body).toEqual({pending:true});
  finish({saved:true});await saved;expect(submit).toHaveBeenCalledTimes(1);
 } finally {jest.dontMock('../../lib/christmas-gift-box');jest.useRealTimers();}
});

test('browser pending polls retain one body and pre-save rejections permit a refreshed estimate',async()=>{
 jest.useFakeTimers();
 try {
  const bodies=[];let count=0; const service=new ChristmasBundleQuoteService({storage:{getItem:()=>null,setItem:()=>{}},fetch:async(_url,opts)=>{
   bodies.push(opts.body);return {ok:true,json:async()=>++count===1?{pending:true}:{saved:true,quoteID:'XMAS-synthetic',quoteUrl:'/quote/XMAS-synthetic',pricing:{total:1}}};
  }});
  const saving=service.submit(factory().body,null);await jest.advanceTimersByTimeAsync(1501);await saving;
  expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
  const rejected=new ChristmasBundleQuoteService({storage:{getItem:()=>null,setItem:()=>{}},fetch:async()=>({ok:false,json:async()=>({error:'Pricing changed',canRevise:true})})});
  await expect(rejected.submit(factory().body,null)).rejects.toMatchObject({canRevise:true});expect(rejected.record.attempted).toBe(false);
 }finally {jest.useRealTimers();}
});

test.each(['/quote/:quoteId','/invoice/:quoteId'])('generated holiday reference is supported by the real %s page route',async url=>{
 const f=factory();await f.prepare();const result=await f.service.submit(f.body);
 const {handlers}=registered('public-quote',{path,SERVER_DIR:'/synthetic',SOFT_DELETE_RETENTION_DAYS:30});
 const res={...response(),send:jest.fn(),sendFile:jest.fn(),redirect:jest.fn()};handlers.get('get '+url).at(-1)({params:{quoteId:result.quoteID},query:{k:'synthetic token'}},res);
 if(url.startsWith('/invoice')){expect(res.redirect).toHaveBeenCalledWith(302,'/quote/'+result.quoteID+'?k=synthetic%20token');expect(res.sendFile).not.toHaveBeenCalled();}
 else {expect(res.statusCode).toBe(200);expect(res.sendFile).toHaveBeenCalledTimes(1);}
 expect(f.state.items.find(i=>i.StyleNumber==='SHIP').EmbellishmentType).toBe('fee');
});

test('contact rejection permits correction, while saved requests can finish after the lead-time window moves',async()=>{
 const f=factory();await f.prepare();f.body.customer.phone='123';await expect(f.service.submit(f.body)).rejects.toMatchObject({canRevise:true});expect(f.state.writes).toEqual([]);
 const flags={failLine:2},g=factory(flags);await g.prepare();await expect(g.service.submit(g.body)).rejects.toThrow();flags.failLine=null;g.advance(30*86400000);
 await expect(g.service.submit(g.body)).resolves.toMatchObject({saved:true});expect(g.state.sessions).toHaveLength(1);
});

test('combined name and shipping fields stay inside the saved quote column limits',async()=>{
 const f=factory();await f.prepare();f.body.customer.firstName='A'.repeat(101);
 await expect(f.service.submit(f.body)).rejects.toMatchObject({canRevise:true});expect(f.state.writes).toEqual([]);
 f.body.customer.firstName='Example';f.body.customer.shippingAddress='B'.repeat(121);
 await expect(f.service.submit(f.body)).rejects.toMatchObject({canRevise:true});expect(f.state.writes).toEqual([]);
});


test('staff invitation matches redemption and never changes the public campaign', () => {
 const f=factory(); const result=f.service.staffInvitation();
 expect(result).toEqual({code,closed:false,closesAt:campaign.closesAt,deadlineLabel:campaign.deadlineLabel});
 expect(f.service.validateCode(result.code).applied).toBe(true);
 expect(JSON.stringify(f.service.readCampaign())).not.toContain(code);
 expect(result.promotionToken).toBeUndefined();
});
test('staff invitation with a mismatched code is withheld', () => {
 expect(()=>factory({displayCode:'SYNTHETIC-STALE'}).service.staffInvitation()).toThrow('invitation code is unavailable');
});
test('expired staff invitations withhold the code', () => {
 const f=factory(); f.advance(Date.parse(campaign.closesAt)-fixed);
 expect(f.service.staffInvitation()).toEqual({closed:true,closesAt:campaign.closesAt,deadlineLabel:campaign.deadlineLabel});
});
test('the invitation display route requires staff authentication and cannot be cached', async () => {
 const gate=jest.fn();const {handlers}=registered('christmas-gift-box',{requireStaff:gate,readCampaign:()=>clone(campaign),now:()=>fixed,giftCode:code,giftCodeHash:crypto.createHash('sha256').update(code).digest('hex'),signingSecret:'synthetic'});
 const stack=handlers.get('get /api/christmas-gift-box/staff-invitation');expect(stack[0]).toBe(gate);
 const res=response();res.set=jest.fn().mockReturnValue(res);await stack.at(-1)({},res);
 expect(res.statusCode).toBe(200);expect(res.body.code).toBe(code);expect(res.set).toHaveBeenCalledWith('Cache-Control','no-store');
});
