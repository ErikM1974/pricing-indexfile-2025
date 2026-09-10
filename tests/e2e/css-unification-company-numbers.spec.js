const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const { open } = require('./helpers/staff-workspaces-browser');
const data = require('../fixtures/staff-workspaces-company-synthetic.json');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive:true });
test.use({ reducedMotion:'reduce', timezoneId:'America/Los_Angeles' });

for (const original of [true,false]) {
const edition=original?'original':'current';
test('CSS staff workspaces: Company Numbers '+edition+' populated widgets and date ranges', async ({ page }) => {
    const state = companyState('populated', original), events = await open(page, 'company-numbers', state), views = [], ranges = [];
    await settled(page);
    for (const width of [1440,768,390,320]) {
        await page.setViewportSize({width,height:1000});
        views.push({width,text:await page.locator('body').innerText(),links:await page.locator('a[href]').evaluateAll(ns=>ns.map(n=>({href:n.getAttribute('href'),text:n.textContent.trim()})))});
        if (!original) {
            const baseline=require('../fixtures/staff-workspaces-company-original-browser.json');
            const norm=text=>text.replace(/Skip to Company Numbers/g,'').replace(/\s+/g,' ').trim().toLowerCase();
            // The new phone layout retains the amounts and blanks status visible on the original desktop.
            expect.soft(norm(views.at(-1).text),width+' original figures').toBe(norm(baseline.views[0].text));
            expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth),width+' width').toBeLessThanOrEqual(width);
            const result=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa']).analyze();
            expect.soft(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,why:n.failureSummary}))})),width+' accessibility').toEqual([]);
        }
        await page.screenshot({path:path.join(output,'staff-workspaces-company-'+edition+'-'+width+'.png'),fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
    if (!original) {
        await page.setViewportSize({width:1920,height:1000});
        const tops=await page.locator('.metrics-revenue-card,.metrics-team-card,#artAgingCard').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
        expect(tops).toHaveLength(3); expect(new Set(tops).size).toBe(1);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
        await page.screenshot({path:path.join(output,'staff-workspaces-company-current-1920.png'),fullPage:true});
        await page.setViewportSize({width:1440,height:1000});
    }
    for (const days of [30,60,90,7]) {
        await page.locator('[data-days="'+days+'"]').click();
        await expect(page.locator('#revenueTitle')).toContainText(String(days));
        await expect(page.locator('#ytdRevenue')).toContainText('$');
        await page.waitForLoadState('networkidle');
        ranges.push({days,text:await page.locator('.metrics-revenue-card').innerText()});
    }
    if (!original) {
        const normalizeRanges = entries => entries.map(({days,text}) => ({days,text:text.replace(/\s+/g,' ').trim().toLowerCase()}));
        expect(normalizeRanges(ranges)).toEqual(normalizeRanges(require('../fixtures/staff-workspaces-company-original-browser.json').ranges));
        const sparkline = await page.locator('#revenueSparkline polyline').evaluate(line => ({
            stroke: getComputedStyle(line).stroke,
            points: line.points.numberOfItems,
            width: line.getBoundingClientRect().width,
            height: line.getBoundingClientRect().height,
        }));
        expect(sparkline.stroke).not.toBe('none');
        expect(sparkline.points).toBeGreaterThan(1);
        expect(sparkline.width).toBeGreaterThan(0);
        expect(sparkline.height).toBeGreaterThan(0);
    }
    const beforeRefresh = await page.locator('body').innerText();
    await page.locator('#cn-refresh-all').click(); await settled(page);
    expect(await page.locator('body').innerText()).toBe(beforeRefresh);
    expect(state.reads.some(p=>p.includes('refresh=true'))).toBe(true);
    const paper = await page.locator('body').innerText();
    if (!original) {
        await page.emulateMedia({media:'print'});
        await expect(page.locator('.cn-due-value')).toHaveText(['$300','$600','$900','$1,200','$250','$500']);
        for (const selector of ['.cn-due-value','.cn-due-blanks','.aa-days','.rep-name','.rep-revenue']) {
            for (const node of await page.locator(selector).all()) await expect(node).toBeVisible();
        }
    }
    await page.pdf({path:path.join(output,'staff-workspaces-company-'+edition+'.pdf'),preferCSSPageSize:true,printBackground:true});
    fs.writeFileSync(path.join(output,'staff-workspaces-company-'+edition+'-browser.json'),JSON.stringify({views,ranges,paper,reads:state.reads,events},null,2)+'\n');
    for(const key of ['errors','unknown','missing','writes']) expect(events[key],key).toEqual([]);
});

for (const mode of ['empty','failure']) {
    test('CSS staff workspaces: Company Numbers '+edition+' '+mode+' and recovery', async ({page})=>{
        const state=companyState(mode,original),events=await open(page,'company-numbers',state);
        await settled(page);
        const before=await page.locator('body').innerText();
        if (!original && mode==='failure') {
            await expect(page.locator('.cn-stamp.is-failed')).toHaveCount(8);
            await expect(page.locator('#cn-updated')).toContainText('some reports unavailable');
        }
        await page.screenshot({path:path.join(output,'staff-workspaces-company-'+edition+'-'+mode+'.png'),fullPage:true});
        state.mode='populated';
        await page.locator('#cn-refresh-all').click();await settled(page);
        const after=await page.locator('body').innerText();
        await expect(page.locator('#payMonth')).toHaveText('$1,842');
        if (!original) {
            await expect(page.locator('.cn-stamp.is-failed')).toHaveCount(0);
            await expect(page.locator('#samplePipelineAlerts')).toBeEmpty();
        }
        fs.writeFileSync(path.join(output,'staff-workspaces-company-'+edition+'-'+mode+'.json'),JSON.stringify({before,after,reads:state.reads,events},null,2)+'\n');
        for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
    });
}

}

async function settled(page) {
    await expect(page.locator('#cn-updated')).toContainText(/updated|checked/);
    await expect(page.locator('#cn-refresh-all')).toBeEnabled();
    await expect(page.locator('#artAgingBody')).not.toContainText('Loading');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
}

test('CSS staff workspaces: Company Numbers current failed refresh clears old figures and retries accurately', async ({page}) => {
    const state=companyState('populated',false),events=await open(page,'company-numbers',state);
    await settled(page);
    state.mode='failure';
    await page.locator('#cn-refresh-all').click(); await settled(page);
    expect.soft(await page.locator('.cn-stamp.is-failed').count()).toBe(8);
    await expect.soft(page.locator('#cn-updated')).toContainText('some reports unavailable');
    for (const id of ['payToday','payWeek','payMonth','production-late','production-risk','production-nopo','production-ontrack']) await expect.soft(page.locator('#'+id)).toHaveText('—');
    for (const selector of ['#inboxPaidList li','#inboxAcceptedList li','#revenueSparkline svg','#revenueStats .stat','#salesTeamList .rep-card','#production-due-list .cn-due-row','#embroideryBonusContent .eb-team']) await expect.soft(page.locator(selector)).toHaveCount(0);
    await expect.soft(page.locator('#revenueYtd')).toBeHidden();
    for (const id of ['dateRangeDisplay','ytdGrowth','comparisonLabel','production-asof','teamDateRange','embroideryBonusDateRange']) await expect.soft(page.locator('#'+id)).toHaveText('');
    await page.setViewportSize({width:390,height:1000});
    const axe=await new (require('@axe-core/playwright').default)({page}).withTags(['wcag2a','wcag2aa']).analyze(); expect.soft(axe.violations).toEqual([]);
    await page.screenshot({path:path.join(output,'staff-workspaces-company-current-refresh-failure.png'),fullPage:true});
    state.mode='populated';
    // Per-card Retry must update freshness without requiring a full-page refresh.
    await page.locator('[data-area="production"]').click();
    await expect(page.locator('[data-stamp="production"]')).toContainText('Updated');
    await expect(page.locator('#production-late')).toHaveText('4');
    await expect(page.locator('.cn-stamp.is-failed')).toHaveCount(7);
    await page.locator('#cn-refresh-all').click(); await settled(page);
    await expect(page.locator('.cn-stamp.is-failed')).toHaveCount(0);
    await expect(page.locator('#samplePipelineAlerts')).toBeEmpty();
    await expect(page.locator('#payMonth')).toHaveText('$1,842');
    await expect(page.locator('#revenueYtd')).toBeVisible();
    for(const key of ['errors','unknown','missing','writes']) expect(events[key],key).toEqual([]);
});

function companyState(mode='populated', original=true) {
    const state={mode,original,reads:[]};
    state.respond=async(req,url)=>{
        if(req.method()!=='GET'||!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.startsWith('/api/'))return null;
        const known=['/api/staff/quote-sessions','/api/staff/payments/recent','/api/mo/orders','/api/staff/daily-sales-by-rep-ytd','/api/staff/service-codes','/api/crm-proxy/ae-dashboard/due-dates-all','/api/crm-proxy/embroidery-bonus/team','/api/staff/artrequests'];
        if(!known.includes(url.pathname))return null;
        state.reads.push(url.pathname+url.search);
        if (state.holdRevenue && url.pathname==='/api/mo/orders' && url.searchParams.get('date_Invoiced_start')==='2026-08-12') {
            state.pending=true;
            await state.holdRevenue;
            if (state.rejectHeld) return {status:503,json:{error:'Synthetic delayed report unavailable'}};
        }
        if (state.failYear && url.pathname==='/api/mo/orders' && url.searchParams.get('date_Invoiced_start')?.startsWith('2025')) return {status:503,json:{error:'Synthetic comparison unavailable'}};
        if(state.mode==='failure')return {status:503,json:{error:'Synthetic report unavailable'}};
        if(state.fallbackGoals && url.pathname==='/api/staff/service-codes')return {status:503,json:{error:'Synthetic annual goal unavailable'}};
        const empty=state.mode==='empty';
        if(url.pathname==='/api/staff/quote-sessions')return {json:empty?[]:data.quotes};
        if(url.pathname==='/api/staff/payments/recent')return {json:{entries:empty?[]:data.payments}};
        if(url.pathname==='/api/mo/orders') {
            const start=url.searchParams.get('date_Invoiced_start'),end=url.searchParams.get('date_Invoiced_end');
            const previous=start.startsWith('2025');
            const orders=data.orders.map(o=>previous?{...o,date_Invoiced:o.date_Invoiced.replace('2026','2025'),cur_SubTotal:o.cur_SubTotal*0.8}:o);
            return {json:{result:empty?[]:orders.filter(o=>o.date_Invoiced>=start&&o.date_Invoiced<=end)}};
        }
        if(url.pathname==='/api/staff/daily-sales-by-rep-ytd')return {json:empty?{...data.archive,reps:[],totalRevenue:0,totalOrders:0}:data.archive};
        if(url.pathname==='/api/staff/service-codes')return {json:data.goal};
        if(url.pathname==='/api/crm-proxy/ae-dashboard/due-dates-all')return {json:empty?{...data.due,late:[],atRisk:[],counts:{late:0,atRisk:0,dueSoonOnTrack:0}}:data.due};
        if(url.pathname==='/api/crm-proxy/embroidery-bonus/team')return {json:state.fallbackGoals?{...data.team,configSource:'fallback'}:empty?{...data.team,teamKicker:{tiers:[]}}:data.team};
        if(url.pathname==='/api/staff/artrequests')return {json:empty?[]:data.art};
        return null;
    };
    return state;
}

for (const rejectHeld of [false,true]) {
    test('CSS staff workspaces: Company Numbers current delayed revenue '+(rejectHeld?'error':'success')+' cannot replace the chosen window', async ({page}) => {
        const state=companyState('populated',false),events=await open(page,'company-numbers',state);
        await settled(page);
        let release; state.holdRevenue=new Promise(resolve=>{release=resolve;}); state.rejectHeld=rejectHeld;
        await page.locator('[data-days="30"]').click();
        await expect.poll(()=>state.pending).toBe(true);
        await page.locator('[data-days="90"]').click();
        await expect(page.locator('#ytdRevenue')).toHaveText('$6,765');
        await expect(page.locator('#revenueTitle')).toHaveText('Revenue: Last 90 Days');
        release(); await page.waitForLoadState('networkidle');
        await expect(page.locator('#ytdRevenue')).toHaveText('$6,765');
        await expect(page.locator('#dateRangeDisplay')).toHaveText('Jun 13 - Sep 10, 2026');
        await expect(page.locator('#revenueStats')).toContainText('$676.50');
        await expect(page.locator('[data-stamp="revenue"]')).toContainText('Updated');
        await expect(page.locator('[data-days="90"]')).toHaveAttribute('aria-pressed','true');
        for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
    });
}

test('CSS staff workspaces: Company Numbers current missing comparison keeps current revenue with a clear warning', async ({page}) => {
    const state=companyState('populated',false); state.failYear=true;
    const events=await open(page,'company-numbers',state); await settled(page);
    await expect(page.locator('#ytdRevenue')).toHaveText('$2,090');
    await expect(page.locator('#ytdGrowth')).toHaveText('YoY unavailable');
    await expect(page.locator('[data-stamp="revenue"]')).toContainText('Failed');
    await expect(page.locator('#cn-updated')).toContainText('some reports unavailable');
    state.failYear=false;
    await page.locator('[data-days="30"]').click();
    await expect(page.locator('#ytdRevenue')).toHaveText('$5,190');
    await expect(page.locator('#ytdGrowth')).toHaveText('25.0%');
    await expect(page.locator('[data-stamp="revenue"]')).toContainText('Updated');
    await expect(page.locator('#cn-updated')).not.toContainText('unavailable');
    for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});

test('CSS staff workspaces: Company Numbers current fallback goals are visible and never labelled fresh', async ({page})=>{
    const state=companyState('populated',false);state.fallbackGoals=true;
    const events=await open(page,'company-numbers',state);await settled(page);
    await expect(page.locator('[data-stamp="team"]')).toContainText('Failed');
    await expect(page.locator('[data-stamp="bonus"]')).toContainText('Failed');
    await expect(page.locator('.rep-goal-note')).toContainText('could not');
    await expect(page.locator('.eb-warning')).toContainText('built-in defaults');
    await expect(page.locator('.eb-team-value')).toHaveText('$220,000');
    await expect(page.locator('#cn-updated')).toContainText('some reports unavailable');
    for(const key of ['errors','unknown','missing','writes'])expect(events[key],key).toEqual([]);
});
