const fs=require('fs'),path=require('path'),crypto=require('crypto'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fixture=JSON.parse(read('tests/fixtures/policy-cms-original-content.json'));
const norm=s=>s.replace(/\s+/g,' ').trim();
test.each(fixture.pages)('$file preserves original policy navigation, fields and static content',entry=>{
 const d=new JSDOM(read(entry.file)).window.document,text=norm(d.body.textContent);
 for(const p of [...entry.paragraphs,...entry.headings])expect(text).toContain(p);
 const links=[...d.querySelectorAll('a[href]')].map(e=>e.getAttribute('href'));for(const href of entry.links)expect(links).toContain(href);
 const fields=[...d.querySelectorAll('input,select,textarea')].map(e=>({id:e.id,type:e.type,name:e.name,options:e.options?[...e.options].map(o=>[o.value,norm(o.textContent)]):null}));expect(fields).toEqual(entry.fields);
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);for(const id of entry.ids)expect(ids).toContain(id);expect(new Set(ids).size).toBe(ids.length);
 expect(d.querySelectorAll('style,script:not([src]),[style],[onclick]')).toHaveLength(0);
});
test.each(fixture.dataFiles)('$file preserves API payload/authentication',entry=>expect(crypto.createHash('sha256').update(read(entry.file).replace(/\r\n/g,'\n')).digest('hex')).toBe(entry.sha256));
