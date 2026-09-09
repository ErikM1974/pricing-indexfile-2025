const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/entry-status-original-content.json');
const norm=s=>s.replace(/\s+/g,' ').trim(),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test.each(fixture.pages)('$file preserves original text, links, imagery, fields and state IDs',entry=>{
    const d=new JSDOM(read(entry.file)).window.document;
    expect(d.title).toBe(entry.title);expect(norm(d.querySelector('main').textContent)).toBe(entry.mainText);
    const links=[...d.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),label:norm(e.textContent)}));for(const link of entry.links)expect(links).toContainEqual(link);
    expect([...d.images].map(e=>({src:e.getAttribute('src'),alt:e.alt}))).toEqual(entry.images);
    expect([...d.querySelectorAll('input,select,textarea')].map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,value:e.value}))).toEqual(entry.fields);
    const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);for(const id of entry.ids)expect(ids).toContain(id);
    expect(d.querySelectorAll('style,script:not([src]),[style],[onclick]')).toHaveLength(0);
});
test.each(fixture.pages.filter(p=>p.file.includes('success')))('$file keeps fulfillment, email and amount controllers unchanged',entry=>{
    for(const script of entry.scripts)expect(crypto.createHash('sha256').update(read(script.file).replace(/\r\n/g,'\n')).digest('hex')).toBe(script.hash);
});
