const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/staff-reference-original-content.json');
const norm=s=>s.replace(/\s+/g,' ').trim();
test.each(fixture.pages)('$file preserves published reference text, links, fields and images',entry=>{
    const d=new JSDOM(fs.readFileSync(path.join(root,entry.file),'utf8')).window.document;
    expect(d.title).toBe(entry.title);expect(norm(d.querySelector('main').textContent)).toBe(entry.mainText);
    const links=[...d.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),label:norm(e.textContent)}));
    for(const link of entry.links)expect(links).toContainEqual(link);
    expect([...d.images].map(e=>({src:e.getAttribute('src'),alt:e.alt}))).toEqual(entry.images);
    expect([...d.querySelectorAll('input,select,textarea')].map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,value:e.value}))).toEqual(entry.fields);
    const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);for(const id of entry.ids)expect(ids).toContain(id);
    expect(d.querySelectorAll('style,script:not([src]),[style],[onclick]')).toHaveLength(0);
});
