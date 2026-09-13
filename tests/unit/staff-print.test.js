const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const {render,restore,owners}=require('../e2e/helpers/staff-print-scenes');
const original=require('../fixtures/staff-print-original-content.json'),root=path.resolve(__dirname,'../..');
test.each(Object.keys(original.hashes))('%s preserves non-print code and data',file=>{
 const source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
 expect(crypto.createHash('sha256').update(restore(file,source)).digest('hex')).toBe(original.hashes[file]);
});
test.each(Object.keys(owners))('%s has semantic print ownership and preserves every source value',kind=>{
 const d=new JSDOM(render(kind).html).window.document,before=new JSDOM(render(kind,'normal',true).html).window.document;
 const text=d=>{const b=d.body.cloneNode(true);b.querySelectorAll('script').forEach(n=>n.remove());return b.textContent.replace(/\s+/g,' ').trim();};
 expect(text(d)).toBe(text(before));expect(d.documentElement.lang).toBe('en');expect(d.querySelector('main')).not.toBeNull();
 expect(d.querySelector('meta[name="viewport"]')).not.toBeNull();expect(d.querySelectorAll('style,script')).toHaveLength(0);
 expect([...d.querySelectorAll('[style]')].every(n=>/^--thread-color:#[0-9a-f]+;$/i.test(n.getAttribute('style')))).toBe(true);
 expect([...d.querySelectorAll('link[rel="stylesheet"]')].map(n=>n.href.split('?')[0])).toEqual(['tokens','components','staff-print'].map(n=>'/shared_components/css/'+n+'.css'));
 const host={calls:'dashboards/ae-mission-control.html',labels:'dashboards/jim-mailing-list.html',threads:'pages/mockup-detail.html'}[kind],h=new JSDOM(fs.readFileSync(path.join(root,host),'utf8')).window.document;
 const scripts=[...h.querySelectorAll('script[src]')].map(n=>n.src.split('?')[0]);expect(scripts.indexOf('/shared_components/js/staff-print.js')).toBeLessThan(scripts.indexOf('/'+owners[kind][0]));
});
test('labels and empty thread data keep their original no-document notices',()=>{
 expect(render('labels','empty')).toMatchObject({html:'',error:'No mailing addresses to print in this view.'});
 expect(render('threads','empty')).toMatchObject({html:'',error:'No thread data to print'});
});
test('staff print styles resolve canonical and declared data tokens',()=>{
 const css=fs.readFileSync(path.join(root,'shared_components/css/staff-print.css'),'utf8'),tokens=fs.readFileSync(path.join(root,'shared_components/css/tokens.css'),'utf8');
 const names=new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));names.add('--thread-color');
 expect([...css.matchAll(/var\((--[\w-]+)/g)].map(m=>m[1]).filter(v=>!names.has(v))).toEqual([]);expect(css).not.toContain('!important');
});
