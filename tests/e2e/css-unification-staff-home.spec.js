const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const { open } = require('./helpers/staff-final-tools-browser');
const fixture = require('../fixtures/staff-final-tools-dashboard-synthetic.json');
const company = require('../fixtures/staff-workspaces-company-synthetic.json');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive:true });
test.use({ reducedMotion:'reduce', timezoneId:'America/Los_Angeles' });
function stateFor(original, role='admin', mode='populated') {
    const state = { original, role, mode, reads:[] };
    state.respond = async (req, u) => {
        if (req.method() !== 'GET') return null;
        if (u.hostname === 'example.test') return { contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#152c44"/><text x="40" y="150" fill="white" font-size="28">Synthetic work sample</text></svg>' };
        if (!u.pathname.startsWith('/api/')) return null;
        state.reads.push(u.pathname + u.search);
        const override=state.readOverride&&await state.readOverride(req,u);if(override)return override;
        if (u.pathname === '/api/crm-session/me') return { json: role ? { authenticated:true, firstName:'Cedar', name:'Cedar Example', email:'cedar@example.test', role, permissions:[role] } : { authenticated:false } };
        const known = ['/api/staff/employees','/api/staff/finished-photos/library','/api/staff/service-codes','/api/staff/daily-sales-by-rep-ytd','/api/mo/orders','/api/crm-proxy/ae-dashboard/due-dates-all'];
        if (!known.includes(u.pathname)) return null;
        if (mode === 'failure') return { status:503, json:{error:'Synthetic dashboard service unavailable'} };
        const empty = mode === 'empty';
        if (u.pathname === '/api/staff/employees') return { json:empty ? [] : fixture.employees };
        if (u.pathname === '/api/staff/finished-photos/library') return { json:{photos:empty ? [] : fixture.photos} };
        if (u.pathname === '/api/staff/service-codes') return { json:company.goal };
        if (u.pathname === '/api/staff/daily-sales-by-rep-ytd') return { json:empty ? {...company.archive,reps:[],totalRevenue:0,totalOrders:0} : company.archive };
        if (u.pathname === '/api/mo/orders') return { json:{result:empty ? [] : company.orders.filter(o=>o.date_Invoiced >= u.searchParams.get('date_Invoiced_start') && o.date_Invoiced <= u.searchParams.get('date_Invoiced_end'))} };
        if (u.pathname === '/api/crm-proxy/ae-dashboard/due-dates-all') return { json:empty ? {...company.due,counts:{late:0}} : company.due };
        return null;
    };
    return state;
}
function save(name, data) { fs.writeFileSync(path.join(output,'staff-final-tools-dashboard-'+name+'.json'),JSON.stringify(data,null,2)+'\n'); }
function clean(events) { for (const key of ['errors','unknown','missing','writes']) expect(events[key],key).toEqual([]); }
async function settled(page) { await expect(page.locator('#loadingOverlay')).toBeHidden(); await expect(page.locator('#goalCurrent')).not.toHaveText('Loading…'); await page.waitForLoadState('networkidle'); }
async function snapshot(page) { return page.evaluate(()=>({active:document.querySelector('.ws-panel.is-on')?.dataset.ws,tabs:[...document.querySelectorAll('.ws-tab')].map(n=>({id:n.dataset.ws,text:n.textContent.replace(/\s+/g,' ').trim(),selected:n.getAttribute('aria-selected')})),goal:['goalCurrent','goalPercent','goalOf'].map(id=>({id,text:document.getElementById(id).textContent})),counts:['teamActiveCount','teamBdayCount','teamAnnivCount'].map(id=>({id,text:document.getElementById(id).textContent})),links:[...document.querySelectorAll('.ws-panel a[href]')].map(n=>({href:n.getAttribute('href'),text:n.textContent.replace(/\s+/g,' ').trim()}))})); }
for (const original of [false]) {
    const edition=original?'original':'current';
    test('CSS final staff tools: Staff home '+edition+' workspaces search pins launcher and directory', async ({ page }) => {
        const state=stateFor(original);
        await page.addInitScript(()=>localStorage.setItem('nwca-mystuff-v1',JSON.stringify({pins:[],recents:[{href:'/pages/box-labels.html',label:'Box Labels',icon:'fas fa-box'}]})));
        const events=await open(page,'staff-dashboard-v3/index.html',state); await settled(page);
        await expect(page.locator('#teamActiveCount')).toHaveText('3');
        const initial=await snapshot(page), views=[], directories=[];
        const baseline=require('../fixtures/staff-final-tools-dashboard-original-browser.json');
        if (!original) expect(initial).toEqual(baseline.initial);
        for (const ws of ['sales','production','art','office','company','everything','admin']) {
            await page.locator('#ws-tab-'+ws).click(); await expect(page.locator('#ws-'+ws)).toHaveClass(/is-on/);
            for (const width of [1440,768,390,320]) {
                await page.setViewportSize({width,height:1000});
                views.push({ws,width,text:await page.locator('#ws-'+ws).innerText(),scrollWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
                if (!original) expect(views.at(-1).scrollWidth,ws+' '+width).toBeLessThanOrEqual(width);
                await page.screenshot({path:path.join(output,'staff-final-tools-dashboard-'+edition+'-'+ws+'-'+width+'.png'),fullPage:true});
            }
        }
        await page.setViewportSize({width:1440,height:1000}); await page.locator('#ws-tab-everything').click(); await page.locator('#wsEveryFilter').fill('Box Labels');
        const everything=await page.locator('#ws-everything').innerText();
        if (!original) {
            await expect(page.locator('#wsEveryTools a:visible')).toHaveCount(1);
            await expect(page.locator('#wsEveryTools a:visible')).toHaveAttribute('href','/pages/box-labels.html');
            await expect(page.locator('#wsEveryCount')).toHaveText('1 match');
            await page.locator('#wsEveryFilter').fill('');
            expect(await page.locator('#wsEveryTools a:visible').count()).toBeGreaterThan(100);
        }
        await page.keyboard.press('Control+k'); await page.locator('#cpInput').fill('Box Labels'); await expect(page.locator('#cpResults')).toContainText('Box Labels');
        const search=await page.locator('#cpResults').innerText(); await page.keyboard.press('Escape');
        await page.locator('[data-action="mystuff:toggle-pin"]').first().click(); const pins=await page.evaluate(()=>JSON.parse(localStorage.getItem('nwca-mystuff-v1')));
        await page.locator('#ws-tab-sales').click(); await page.locator('#quote-start-btn').click(); await expect(page.locator('#quote-launcher')).toBeVisible();
        const launcher=await page.locator('#quote-launcher').innerText(); await page.keyboard.press('Escape'); await expect(page.locator('#quote-launcher')).toBeHidden(); await expect(page.locator('#quote-start-btn')).toBeFocused();
        await page.locator('#teamBtn').click(); await page.locator('#teamDropdown [data-action="staff-directory:show"]').click(); await expect(page.locator('#staffDirectoryModal')).toBeVisible();
        for (const filter of ['all','active','birthdays','anniversaries']) { await page.locator('[data-action="staff-directory:filter"][data-filter="'+filter+'"]').click(); directories.push({filter,text:await page.locator('#staffDirectoryBody').innerText()}); }
        await page.locator('[data-action="staff-directory:filter"][data-filter="all"]').click(); await page.locator('#staffDirectorySearch').fill('Cedar'); directories.push({filter:'search',text:await page.locator('#staffDirectoryBody').innerText()});
        await page.locator('#staffDirectoryModal [data-modal-close]').click(); await expect(page.locator('#staffDirectoryModal')).toBeHidden();
        if (!original) {
            for (const [name,value] of Object.entries({search,pins,launcher,directories})) expect(typeof value==='string'?value.replace(/^Tools & pages/,'TOOLS & PAGES').replace(/\s+/g,' ').trim():value,name).toEqual(typeof baseline[name]==='string'?baseline[name].replace(/\s+/g,' ').trim():baseline[name]);
        }
        save(edition+'-browser',{initial,views,everything,search,pins,launcher,directories,reads:state.reads,events}); clean(events);
    });
    for (const [role,expected] of [['sales','sales'],['art','art'],['production','production'],['staff','office'],['','everything']]) test('CSS final staff tools: Staff home '+edition+' role '+(role||'anonymous'),async({page})=>{
        const state=stateFor(original,role),events=await open(page,'staff-dashboard-v3/index.html',state); await settled(page); await expect(page.locator('#ws-'+expected)).toHaveClass(/is-on/); await expect(page.locator('#ws-tab-admin')).toHaveCount(0);
        const data=await snapshot(page); if (!original) expect(data).toEqual(require('../fixtures/staff-final-tools-dashboard-original-'+(role||'anonymous')+'.json').data);
        save(edition+'-'+(role||'anonymous'),{data,events}); clean(events);
    });
    for (const mode of ['empty','failure']) test('CSS final staff tools: Staff home '+edition+' '+mode,async({page})=>{
        const state=stateFor(original,'admin',mode),events=await open(page,'staff-dashboard-v3/index.html',state); await settled(page);
        await expect(page.locator('#goalCurrent')).toContainText(mode==='failure'?'unavailable':'$0');
        await page.locator('#teamBtn').click(); const team=await page.locator('#teamDropdown').innerText();
        save(edition+'-'+mode,{data:await snapshot(page),team,text:await page.locator('body').innerText(),events});clean(events);
    });
}

async function audit(page,label) {
 const result=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),label).toEqual([]);
}
test('CSS final staff tools: Staff home accessible workspaces and readable phone directory',async({page})=>{
 const events=await open(page,'staff-dashboard-v3/index.html',stateFor(false));await settled(page);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const ws of ['sales','production','art','office','company','everything','admin']){
   await page.locator('#ws-tab-'+ws).click();await audit(page,ws+' '+width);
  }
 }
 await page.setViewportSize({width:320,height:1000});await page.locator('#teamBtn').click();
 await page.locator('#teamDropdown [data-action="staff-directory:show"]').click();
 await expect(page.locator('#staffDirectoryModal')).toBeVisible();await audit(page,'phone directory');
 await page.locator('#staffDirectoryModal').screenshot({path:path.join(output,'staff-final-tools-dashboard-current-directory-320.png')});
 expect(await page.locator('.staff-modal-content').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await page.locator('#staffDirectorySearch').fill('Cedar');await expect(page.locator('#staffDirectoryBody tr')).toHaveCount(1);
 await page.locator('#staffDirectoryModal [data-modal-close]').focus();await page.keyboard.press('Shift+Tab');await expect(page.locator('.staff-modal-content')).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.locator('#staffDirectoryModal [data-modal-close]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#staffDirectoryModal')).toBeHidden();
 if (!await page.locator('#teamDropdown').isVisible()) await page.locator('#teamBtn').click();await page.locator('#teamDropdown [data-action="staff-directory:show"]').click();
 await expect(page.locator('#staffDirectorySearch')).toHaveValue('');await expect(page.locator('#staffDirectoryBody tr')).toHaveCount(4);
 clean(events);
});
test('CSS final staff tools: Staff home keyboard tabs and quote launcher',async({page})=>{
 const events=await open(page,'staff-dashboard-v3/index.html',stateFor(false));await settled(page);
 await page.locator('#ws-tab-sales').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#ws-tab-production')).toBeFocused();await expect(page.locator('#ws-production')).toBeVisible();
 await page.keyboard.press('End');await expect(page.locator('#ws-tab-admin')).toBeFocused();await page.keyboard.press('Home');await expect(page.locator('#ws-tab-sales')).toBeFocused();
 await page.locator('#quote-start-btn').click();await audit(page,'quote launcher');
 await page.locator('#quote-launcher').screenshot({path:path.join(output,'staff-final-tools-dashboard-current-launcher-1440.png')});
 await page.setViewportSize({width:320,height:1000});await audit(page,'phone quote launcher');
 await page.locator('#quote-launcher').screenshot({path:path.join(output,'staff-final-tools-dashboard-current-launcher-320.png')});
 await page.keyboard.press('Escape');await expect(page.locator('#quote-start-btn')).toBeFocused();
 await page.locator('#teamBtn').click();await page.keyboard.press('Escape');await expect(page.locator('#teamDropdown')).toBeHidden();await expect(page.locator('#teamBtn')).toBeFocused();
 clean(events);
});

for(const fail of [false,true]) test('CSS final staff tools: Staff home pending roster '+(fail?'failure':'success')+' stays explicit',async({page})=>{
 const state=stateFor(false);let release;
 state.readOverride=(_req,u)=>u.pathname==='/api/staff/employees'?new Promise(r=>{release=r;}):null;
 const events=await open(page,'staff-dashboard-v3/index.html',state);
 await expect(page.locator('#loadingOverlay')).toBeHidden();await expect.poll(()=>typeof release).toBe('function');
 await page.locator('#teamBtn').click();await expect(page.locator('#teamDropdown')).toContainText('Loading staff roster');
 await page.locator('#teamDropdown [data-action="staff-directory:show"]').click();await expect(page.locator('#staffDirectoryBody')).toContainText('Loading staff roster');
 release(fail?{status:503,json:{error:'Synthetic staff failure'}}:{json:fixture.employees});
 if(fail){await expect(page.locator('#staffDirectoryBody')).toContainText('Couldn’t load');await expect(page.locator('#teamActiveCount')).toHaveText('!');}
 else {await expect(page.locator('#staffDirectoryBody tr')).toHaveCount(4);await expect(page.locator('#teamActiveCount')).toHaveText('3');}
 await audit(page,'settled roster');
 await page.keyboard.press('Escape');
 await page.locator('#teamBtn').click();await expect(page.locator('#teamDropdown')).toContainText(fail?'unavailable':'Birch');
 clean(events);
});
test('CSS final staff tools: Staff home remembers workspace pins and Pride Wall without hiding its library link',async({page})=>{
 await page.addInitScript(()=>{if (!localStorage.getItem('nwca-mystuff-v1')) localStorage.setItem('nwca-mystuff-v1',JSON.stringify({pins:[],recents:[{href:'/pages/box-labels.html',label:'Box Labels',icon:'fas fa-box'}]}));});
 const events=await open(page,'staff-dashboard-v3/index.html',stateFor(false));await settled(page);await expect(page.locator('#userWelcome')).toContainText('Cedar');
 await page.getByRole('button',{name:'Pin Box Labels',exact:true}).click();await expect(page.getByRole('button',{name:'Unpin Box Labels',exact:true})).toBeVisible();
 await page.locator('#ws-tab-production').click();
 await page.locator('.pw-head').click();await expect(page.locator('#pwTrack')).toBeHidden();await expect(page.locator('.pw-link')).toBeVisible();
 await page.reload();await settled(page);await expect(page.getByRole('button',{name:'Unpin Box Labels',exact:true})).toBeVisible();await expect(page.locator('#ws-production')).toBeVisible();await expect(page.locator('#pwTrack')).toBeHidden();await expect(page.locator('.pw-link')).toBeVisible();
 await page.locator('.pw-head').click();await expect(page.locator('#pwTrack')).toBeVisible();clean(events);
});

test('CSS final staff tools: Staff home keyboard search is accessible at every width',async({page})=>{
 const events=await open(page,'staff-dashboard-v3/index.html',stateFor(false));await settled(page);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.keyboard.press('Control+k');await page.locator('#cpInput').fill('Box Labels');await expect(page.locator('#cpResults')).toContainText('Box Labels');await audit(page,'search '+width);
  await page.locator('.hero-search-wrap').screenshot({path:path.join(output,'staff-final-tools-dashboard-current-search-'+width+'.png')});
  await page.keyboard.press('ArrowDown');await expect(page.locator('#cpInput')).toHaveAttribute('aria-activedescendant',/cp-item-/);
  await page.keyboard.press('Escape');await expect(page.locator('#cpPanel')).toBeHidden();await expect(page.locator('#cpInput')).toHaveValue('');
 }
 clean(events);
});
