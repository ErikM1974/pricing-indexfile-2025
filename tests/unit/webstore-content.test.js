const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/webstore-original-content.json');
const norm=s=>s.replace(/\s+/g,' ').trim();
test.each(fixture.pages)('$file retains original copy, offer terms, images and SEO',entry=>{
    const d=new JSDOM(fs.readFileSync(path.join(root,entry.file),'utf8')).window.document;
    expect(d.title).toBe(entry.title);
    const copy=norm(d.querySelector('main').textContent);
    expect(copy).toBe(entry.mainText);
    for(const s of [...entry.paragraphs,...entry.headings])expect(copy).toContain(s);
    const links=[...d.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),label:norm(e.textContent)}));
    for(const link of entry.links)expect(links).toContainEqual(link);
    expect([...d.images].map(e=>({src:e.getAttribute('src'),alt:e.alt}))).toEqual(entry.images);
    expect([...d.querySelectorAll('script[type="application/ld+json"]')].map(e=>JSON.parse(e.textContent))).toEqual(entry.jsonLd);
    expect([...d.querySelectorAll('meta[name],meta[property],link[rel=canonical]')].map(e=>({name:e.getAttribute('name'),property:e.getAttribute('property'),content:e.getAttribute('content'),href:e.getAttribute('href')}))).toEqual(entry.metadata);
    expect(d.querySelectorAll('style,script:not([src]):not([type="application/ld+json"]),[style],[onclick]')).toHaveLength(0);
    const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
    for(const id of entry.ids)expect(ids).toContain(id);
});
