const fs=require('fs'),path=require('path'),crypto=require('crypto'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fixture=JSON.parse(read('tests/fixtures/policy-reference-original-content.json'));
const norm=s=>s.replace(/\s+/g,' ').trim();
test.each(fixture.pages)('$file preserves original policy prose, figures, destinations and field definitions',entry=>{
 const d=new JSDOM(read(entry.file)).window.document,text=norm(d.body.textContent);
 for(const p of [...entry.paragraphs,...entry.headings])expect(text).toContain(p);
 const links=[...d.querySelectorAll('a[href]')].map(e=>e.getAttribute('href'));for(const href of entry.links)expect(links).toContain(href==='/policies-hub.html'?'/pages/policies-hub.html':href);
 const fields=[...d.querySelectorAll('input,select,textarea')].map(e=>({id:e.id,type:e.type,name:e.name,options:e.options?[...e.options].map(o=>[o.value,norm(o.textContent)]):null}));expect(fields).toEqual(entry.fields);
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);for(const id of entry.ids)expect(ids).toContain(id);expect(new Set(ids).size).toBe(ids.length);
 expect(d.querySelectorAll('style,script:not([src]),[style],[onclick]')).toHaveLength(0);
});
test('migration snapshot keeps the exact original published records',()=>expect(crypto.createHash('sha256').update(read(fixture.data.file).replace(/\r\n/g,'\n')).digest('hex')).toBe(fixture.data.sha256));
