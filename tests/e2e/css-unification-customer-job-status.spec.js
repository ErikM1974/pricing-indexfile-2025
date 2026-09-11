const {test,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),AxeBuilder=require('@axe-core/playwright').default;
const {open,snapshot,check,quoteId,jobId}=require('./helpers/customer-job-status-browser');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'screenshots/css-unification'),capture=process.env.CAPTURE_CUSTOMER_JOB_STATUS_ORIGINAL==='1',phase=capture?'original':'current';
const widths=[1440,768,390,320];

test.describe('CSS customer status: recovery and pending interactions',()=>{
 test('Job Portal keeps usable cards and download links when previews fail',async({page})=>{
  const e=await open(page,{page:'vendor',imageFailure:true});await expect(page.locator('#vp-loading')).toBeHidden();
  await expect(page.locator('.vp-job-thumb--placeholder')).toHaveCount(2);
  await page.locator('[data-job="'+jobId+'"]').click();await expect(page.locator('#vp-detail-main')).toBeVisible();
  await expect(page.locator('#vp-d-mockup')).toContainText('Mockup preview unavailable');
  await expect(page.getByRole('link',{name:'Download Approved mockup.png',exact:true})).toHaveAttribute('href','https://files.example.test/approved-mockup.png');
  await evidence(page,'vendor-image-failure',e,{compare:false});
 });
 for(const status of [429,500])test('Order Status retries '+status+' with the same credential',async({page})=>{
  const state={status};const e=await open(page,state);
  await expect(page.locator('#st-error-title')).toHaveText('Order status is temporarily unavailable');
  let release;state.hold=new Promise(r=>{release=r;});state.status=undefined;
  await page.locator('#st-retry').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#st-loading')).toBeVisible();await expect.poll(()=>e.reads.length).toBe(2);
  await page.keyboard.press('Enter');expect(e.reads).toHaveLength(2);release();
  await expect(page.locator('#st-order')).toBeVisible();
  expect(e.reads[1]).toEqual(e.reads[0]);check(expect,e);
 });
 test('Job Portal preserves a different job draft after a late successful note',async({page})=>{
  let release;const state={page:'vendor',actionHold:new Promise(r=>{release=r;})};const e=await open(page,state);
  await expect(page.locator('#vp-loading')).toBeHidden();
  await page.locator('[data-job="LNP-7404"]').click();await expect(page.locator('#vp-detail-main')).toBeVisible();
  await page.locator('#vp-comment-input').fill('Draft for job 7404');
  await page.locator('#vp-back-btn').click();await page.locator('[data-job="'+jobId+'"]').click();
  await expect(page.locator('#vp-detail-main')).toBeVisible();await expect(page.locator('#vp-comment-input')).toHaveValue('');
  await page.locator('#vp-comment-input').fill('Note for job 7401');await page.locator('#vp-comment-btn').click();
  try{
   await expect.poll(()=>e.actions.length).toBe(1);
   await page.locator('#vp-back-btn').click();await page.locator('[data-job="LNP-7404"]').click();
   await expect(page.locator('#vp-d-id')).toHaveText('LNP-7404');
   await expect(page.locator('#vp-comment-input')).toHaveValue('Draft for job 7404');
  }finally{release();}
  await expect(page.locator('#vp-comment-input')).not.toHaveAttribute('readonly','');
  await expect(page.locator('#vp-d-id')).toHaveText('LNP-7404');
  await expect(page.locator('#vp-comment-input')).toHaveValue('Draft for job 7404');
  await expect(page).toHaveURL(/#job=LNP-7404$/);expect(e.actions).toHaveLength(1);check(expect,e);
 });
 test('Job Portal retains the note after a pending failure and retries its exact body',async({page})=>{
  let release;const state={page:'vendor',deepLink:true,postStatus:500,actionHold:new Promise(r=>{release=r;})};const e=await open(page,state);
  await expect(page.locator('#vp-detail-main')).toBeVisible();await page.locator('#vp-comment-input').fill('  Keep this note  ');
  await page.locator('#vp-comment-input').press('Control+Enter');
  await expect(page.locator('#vp-comment-btn')).toBeDisabled();release();
  await expect(page.locator('#vp-error')).toBeVisible();await expect(page.locator('#vp-comment-input')).toHaveValue('  Keep this note  ');
  state.postStatus=undefined;await page.locator('#vp-error-retry').click();await expect(page.locator('#vp-comment-status')).toBeVisible();
  expect(e.actions).toHaveLength(2);expect(e.actions[1]).toEqual(e.actions[0]);check(expect,e);
 });
 test('Job Portal native job button opens once with Space and restores focus on Escape',async({page})=>{
  const e=await open(page,{page:'vendor'});await expect(page.locator('#vp-loading')).toBeHidden();
  const card=page.locator('[data-job="'+jobId+'"]');await expect(card).toHaveJSProperty('tagName','BUTTON');await card.focus();await page.keyboard.press('Space');
  await expect(page.locator('#vp-detail-main')).toBeVisible();expect(e.reads.filter(r=>r.path==='/api/vendor/jobs/'+jobId)).toHaveLength(1);
  await page.keyboard.press('Escape');await expect(card).toBeFocused();check(expect,e);
 });
});

function expectedPresentation(id,text) {
 // Only these fixed interface labels lost the old CSS uppercase transform.
 // Customer values, money, dates and original fixture JSON remain untouched.
 if(id==='vp-d-meta')for(const [before,after] of [['REQUESTED','Requested'],['NEEDED BY','Needed by'],['EST. SHIP','Est. ship'],['TRANSFER TYPE','Transfer type'],['FABRIC','Fabric'],['# COLORS','# Colors'],['PRIMARY COLOR','Primary color'],['ADDITIONAL COLORS','Additional colors']])text=text.replace(before,after);
 if(id==='vp-d-files')text=text.replace(/\bMOCKUP\b/g,'mockup').replace(/\bARTWORK\b/g,'artwork');
 return text;
}
test('Job Portal prevents duplicate notes while the first request is pending',async({page})=>{
 let release;const state={page:'vendor',deepLink:true,actionHold:new Promise(r=>{release=r;})};
 const e=await open(page,state);
 try{
  await expect(page.locator('#vp-detail-main')).toBeVisible();
  await page.locator('#vp-comment-input').fill('One synthetic note');
  await page.locator('#vp-comment-btn').click();
  await expect.poll(()=>e.actions.length).toBe(1);
  await page.locator('#vp-comment-input').press('Control+Enter');
  await expect(page.locator('#vp-comment-input')).toHaveAttribute('readonly','');
  expect(e.actions).toHaveLength(1);
 }finally{release();}
 await expect(page.locator('#vp-comment-status')).toBeVisible();
 check(expect,e);
});
test('Job Portal ignores a late detail error after returning to the list',async({page})=>{
 let release;const state={page:'vendor',deepLink:true,detailStatus:500,detailHold:new Promise(r=>{release=r;})};
 const e=await open(page,state);
 await expect(page.locator('#vp-detail-loading')).toBeVisible();
 await page.locator('#vp-back-btn').click();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/vendor/jobs/'+jobId));
 release();await response;
 await expect(page.locator('#vp-list-view')).toBeVisible();
 // Allow the response body and rejection handler to finish before checking the list.
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await expect(page.locator('#vp-error')).toBeHidden();
 check(expect,e);
});
async function evidence(page,name,events,{paper=false,compare=true}={}){
 fs.mkdirSync(out,{recursive:true});const views=[];
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
  const view=await snapshot(page),a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  if(!capture){expect(view.overflow,name+' overflow '+width).toBe(false);expect(a11y.violations,name+' axe '+width).toEqual([]);}
  views.push({width,...view,axe:a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  if([1440,320].includes(width))await page.screenshot({path:path.join(out,'customer-job-status-'+name+'-'+phase+'-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 if(paper)await page.pdf({path:path.join(out,'customer-job-status-'+name+'-'+phase+'.pdf'),format:'Letter',printBackground:true});
 const result={views,actions:events.actions,reads:events.reads},fixture='tests/fixtures/customer-job-status-'+name+'-original-browser.json',file=path.join(root,fixture);
 check(expect,events);
 if(capture){if(fs.existsSync(file))throw Error('Refusing to overwrite original '+fixture);fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');fs.appendFileSync(path.join(root,'ACTIVE_FILES.md'),'\n- '+fixture+' — immutable synthetic original browser contract for customer/job status CSS migration.\n');}
 else if(compare){const baseline=JSON.parse(fs.readFileSync(file,'utf8'));expect(result.actions).toEqual(baseline.actions);expect(result.reads).toEqual(baseline.reads);for(let i=0;i<views.length;i++){expect(views[i].rows).toEqual(baseline.views[i].rows);expect(views[i].links).toEqual(baseline.views[i].links.map(link=>link.href==='/'&&link.text==='Northwest Custom Apparel CUSTOM T-SHIRTS · FULL-COLOR DTG'?{...link,text:'Northwest Custom Apparel Custom T-Shirts · Full-Color DTG'}:link));for(const[id,text]of Object.entries(baseline.views[i].ids))expect(views[i].ids[id],id).toBe(expectedPresentation(id,text));}}
 return result;
}
test.describe('CSS customer status: original data and browser contracts',()=>{
 for(const mode of ['paid','pending-payment','in-production','shipped','pickup-ready-soon','rush','free-shipping','no-fee-tax','empty','escaped','long'])test('Order Status '+mode,async({page})=>{
  const e=await open(page,{mode,original:capture});await expect(page.locator('#st-order')).toBeVisible();await expect(page.locator('#st-order-num')).toHaveText(quoteId);
  expect(e.reads[0]).toEqual({path:'/api/order-status/'+quoteId,query:'?t=review%20token%20%2F%20only'});
  await evidence(page,'order-'+mode,e,{paper:['paid','pickup-ready-soon','long'].includes(mode)});
 });
 for(const mode of ['missing','404','429','500','network'])test('Order Status error '+mode,async({page})=>{
  const e=await open(page,{missing:mode==='missing',status:/^\d+$/.test(mode)?Number(mode):undefined,networkError:mode==='network',original:capture});await expect(page.locator('#st-error')).toBeVisible();await expect(page.locator('#st-order')).toBeHidden();await evidence(page,'order-error-'+mode,e);
 });
 for(const mode of ['normal','empty','escaped','dated'])test('Job Portal list '+mode,async({page})=>{
  const e=await open(page,{page:'vendor',mode,original:capture});await expect(page.locator('#vp-loading')).toBeHidden();await expect(page.locator('#vp-vendor-name')).toHaveText('Example Screen Printing — Job Portal');await evidence(page,'vendor-list-'+mode,e,{paper:mode==='normal'});
 });
 for(const mode of ['normal','minimal','escaped','long','received','cancelled','dated'])test('Job Portal detail '+mode,async({page})=>{
  const e=await open(page,{page:'vendor',mode,deepLink:true,original:capture});await expect(page.locator('#vp-detail-main')).toBeVisible();await expect(page.locator('#vp-loading')).toBeHidden();if(mode==='dated')await expect(page.locator('#vp-d-meta')).toContainText('past due');await evidence(page,'vendor-detail-'+mode,e,{paper:['normal','long','dated'].includes(mode)});
 });
 for(const kind of ['list','detail'])for(const status of [401,404,429,500])test('Job Portal '+kind+' error '+status,async({page})=>{
  const state={page:'vendor',original:capture};state[kind+'Status']=status;if(kind==='detail')state.deepLink=true;
  const e=await open(page,state);if(status===401)await expect(page.getByRole('heading',{name:'Vendor sign in'})).toBeVisible();else await expect(page.locator('#vp-error')).toBeVisible();
  await evidence(page,'vendor-'+kind+'-error-'+status,e);
 });
 test('Job Portal filters, search, keyboard and back preserve destinations',async({page})=>{
  const e=await open(page,{page:'vendor',original:capture});await expect(page.locator('#vp-loading')).toBeHidden();await expect(page.locator('[data-count=active]')).toHaveText('2');
  await page.locator('[data-filter=completed]').click();await expect(page.locator('.vp-job-card')).toHaveCount(1);
  await page.locator('[data-filter=all]').click();await expect(page.locator('.vp-job-card')).toHaveCount(4);
  await page.locator('#vp-search').fill('44012');await expect(page.locator('.vp-job-card')).toHaveCount(4);
  await page.locator('#vp-search').fill('nothing matches');await expect(page.locator('#vp-empty')).toBeVisible();
  await page.locator('#vp-search').fill('Cedar');await expect(page.locator('.vp-job-card')).toHaveCount(1);const card=page.locator('.vp-job-card');await card.focus();await page.keyboard.press('Enter');await expect(page.locator('#vp-detail-main')).toBeVisible();await expect(page).toHaveURL(new RegExp('#job='+jobId+'$'));await page.locator('#vp-back-btn').click();await expect(card).toBeFocused();await evidence(page,'vendor-search-back',e);
 });
 for(const status of [200,500])test('Job Portal note '+status+' retains original body and feedback',async({page})=>{
  const e=await open(page,{page:'vendor',deepLink:true,postStatus:status===200?undefined:status,original:capture});await expect(page.locator('#vp-detail-main')).toBeVisible();await page.locator('#vp-comment-input').fill('  Synthetic note: preserve 11 × 12 inches & 24 pieces.  ');await page.locator('#vp-comment-btn').click();
  if(status===200){await expect(page.locator('#vp-comment-status')).toBeVisible();await expect(page.locator('#vp-comment-input')).toHaveValue('');await expect(page.locator('#vp-detail-main')).toBeVisible();}else{await expect(page.locator('#vp-error')).toBeVisible();await expect(page.locator('#vp-comment-input')).toHaveValue('  Synthetic note: preserve 11 × 12 inches & 24 pieces.  ');}
  expect(e.actions).toEqual([{path:'/api/vendor/jobs/'+jobId+'/notes',method:'POST',body:JSON.stringify({note:'Synthetic note: preserve 11 × 12 inches & 24 pieces.'})}]);await evidence(page,'vendor-note-'+status,e);
 });
});
