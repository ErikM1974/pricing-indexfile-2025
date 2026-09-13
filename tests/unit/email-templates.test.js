const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const {FILES,compile}=require('../../scripts/css/build-email-templates');
const {entries}=require('../fixtures/email-templates-original-content.json');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),norm=s=>s.replace(/\s+/g,' ').trim();
test.each(entries)('$file preserves original email content, bindings and links',entry=>{
 expect(crypto.createHash('sha256').update(entry.source).digest('hex')).toBe(entry.sha256);
 const source=read(entry.file),dom=new JSDOM(source),d=dom.window.document;
 expect(norm(d.body.textContent)).toBe(entry.text.replace('OCTOBER 20TH, 2025','OCTOBER 20TH, 2026'));
 expect([...source.matchAll(/\{\{\{?[^{}]+\}\}\}?/g)].map(m=>m[0]).sort()).toEqual(entry.variables);
 expect([...d.querySelectorAll('a')].map(n=>[n.getAttribute('href'),norm(n.textContent)])).toEqual(entry.links);
 expect([...d.querySelectorAll('pre')].map(n=>n.textContent)).toEqual(entry.plainText);
 expect(d.querySelectorAll('script,style,link[rel="stylesheet"]')).toHaveLength(0);
 expect(source).not.toMatch(/var\(--|linear-gradient|!important/);
 expect(d.querySelector('[data-email="card"]').style.width).toBe('100%');
 expect(d.querySelector('[data-email="card"]').style.maxWidth).toBe('640px');
 expect(d.querySelectorAll('table:not([role="presentation"])')).toHaveLength(0);
 // Root-section spacing must never spread into nested customer/product cells.
 const card=d.querySelector('[data-email="card"]');
 for(const section of d.querySelectorAll('[data-email="section"], [data-email="header"]')) {
  expect(section.tagName).toBe('TD');
  expect(section.parentElement.parentElement.parentElement).toBe(card);
 }
 dom.window.close();
});
test.each(FILES)('%s carries current shared-theme output and a second compile is stable',file=>{
 const source=read(file);expect(compile(source)).toBe(source);expect(compile(compile(source))).toBe(source);
});
test('Christmas campaign year changes only the holiday deadline, retaining the street number',()=>{
 const source=read(FILES[0]);expect(source).toContain('OCTOBER 20TH, 2026');expect(source).toContain('2025 Freeman Road East');
});
