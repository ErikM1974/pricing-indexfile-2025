const restorePreHoliday = require('../helpers/holiday-source-mappings');
const restorePreWebQuotePush = require('../helpers/web-quote-push-source-mappings');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const {scenes,posts,denied,retired,serverFunctions}=require('../e2e/helpers/server-pages-scenes');
const templates=require('../../lib/blog-templates'),status=require('../../lib/status-page-templates');
const original=require('../fixtures/server-pages-original-content.json');
const root=path.resolve(__dirname,'../..');

test('server styles use defined tokens without important overrides',()=>{
 const tokens=fs.readFileSync(path.join(root,'shared_components/css/tokens.css'),'utf8');
 const names=new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
 for(const file of ['blog.css','status-pages.css']){
  const css=fs.readFileSync(path.join(root,'shared_components/css',file),'utf8');
  expect([...css.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]).filter(v=>!names.has(v))).toEqual([]);
  expect(css).not.toContain('!important');
 }
});

test.each(Object.keys(original.hashes))('%s preserves source outside documented response/style edits',file=>{
 let source=restorePreHoliday(file, restorePreWebQuotePush(file, fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')));
 for(const change of original.changes.filter(c=>c.file===file).reverse()){
  expect(source.split(change.after).length-1).toBe(change.count);
  source=source.split(change.after).join(change.before);
 }
 expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(original.hashes[file]);
});

test.each(Object.keys(scenes()))('%s uses explicit shared style ownership and semantic HTML',name=>{
 const d=new JSDOM(scenes()[name].html).window.document;
 expect(d.documentElement.lang).toBe('en');
 expect(d.querySelector('meta[name="viewport"]')).not.toBeNull();
 expect(d.querySelectorAll('main')).toHaveLength(1);
 expect(d.querySelectorAll('style,[style],script:not([type="application/ld+json"])')).toHaveLength(0);
 expect([...d.querySelectorAll('link[rel="stylesheet"]')].map(n=>n.getAttribute('href').split('?')[0]).filter(h=>h.startsWith('/'))).toEqual([
  '/shared_components/css/tokens.css','/shared_components/css/components.css',
  '/shared_components/css/'+(name.startsWith('blog-')?'blog.css':'status-pages.css')
 ]);
});

test('role gate preserves anonymous API, page redirects, forbidden JSON and successful access',()=>{
 expect(denied({originalUrl:'/api/admin'})).toMatchObject({statusCode:401,data:{error:'Unauthorized',message:'Session expired. Please log in again.'}});
 expect(denied({originalUrl:'/dashboards/admin.html?tab=users'})).toMatchObject({statusCode:302,redirectTo:'/dashboards/staff-login.html?redirect=%2Fdashboards%2Fadmin.html%3Ftab%3Dusers'});
 expect(denied({originalUrl:'/api/admin',session:{crmUser:{permissions:['sales']}}})).toMatchObject({statusCode:403,data:{error:'Forbidden',message:'You do not have permission to access this resource.'}});
 expect(denied({originalUrl:'/dashboards/admin.html',session:{crmUser:{permissions:['admin']}}}).next).toBe(true);
});

test.each([status.roleDenied,status.restricted,serverFunctions().accessRestrictedPage])('denial names remain text, including HTML and punctuation',render=>{
 const name='Avery & <img src=x onerror=alert(1)> "O’Neil"';
 const d=new JSDOM(render(name)).window.document;
 expect(d.querySelector('p').textContent).toContain(name);
 expect(d.querySelectorAll('[onerror],script')).toHaveLength(0);
 expect(d.querySelector('a').getAttribute('href')).toBe('/staff-dashboard.html');
});

test('retired aliases retain 410 and noindex with all replacement destinations',()=>{
 const r=retired(),d=new JSDOM(r.html).window.document;
 expect(r.statusCode).toBe(410);expect(r.headers['X-Robots-Tag']).toBe('noindex, nofollow');
 expect(d.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
 expect([...d.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['/custom-stickers','/custom-banners','/pricing/decals','/staff-dashboard.html']);
});

test('blog structured data cannot close its script or change its decoded headline',()=>{
 const title='A guide </script><img src=x onerror=alert(1)> & more';
 const d=new JSDOM(templates.renderPost({...posts[0],title},'<p>Article</p>')).window.document;
 expect(d.querySelectorAll('script')).toHaveLength(1);
 expect(d.querySelectorAll('[onerror]')).toHaveLength(0);
 expect(JSON.parse(d.querySelector('script').textContent).headline).toBe(title);
 expect(d.querySelector('h1').textContent).toBe(title);
});
