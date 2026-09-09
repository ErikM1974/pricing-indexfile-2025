const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/brand-guide-original-content.json');
const norm=s=>s.replace(/\s+/g,' ').trim();

test.each(fixture.pages)('$file retains original brand copy, products, search and SEO',entry=>{
    const d=new JSDOM(fs.readFileSync(path.join(root,entry.file),'utf8')).window.document;
    expect(d.title).toBe(entry.title);
    expect(norm(d.querySelector('main').textContent)).toBe(entry.mainText);
    expect([...d.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),label:norm(e.textContent)}))).toEqual(entry.links);
    expect([...d.images].map(e=>({src:e.getAttribute('src'),alt:e.alt}))).toEqual(entry.images);
    expect([...d.querySelectorAll('script[type="application/ld+json"]')].map(e=>JSON.parse(e.textContent))).toEqual(entry.jsonLd);
    expect([...d.querySelectorAll('meta[name],meta[property],link[rel=canonical]')].map(e=>({name:e.getAttribute('name'),property:e.getAttribute('property'),content:e.getAttribute('content'),href:e.getAttribute('href')}))).toEqual(entry.metadata);
    expect([...d.querySelectorAll('input')].map(e=>({id:e.id,type:e.type,name:e.name,placeholder:e.placeholder}))).toEqual(entry.fields);
    expect(d.querySelectorAll('style,script:not([src]):not([type="application/ld+json"]),[style],[onclick]')).toHaveLength(0);
    const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
    // The native dialog provides its own backdrop, replacing the old empty overlay.
    expect(ids).toEqual(entry.ids.filter(id=>id!=='sidebarOverlay'));
    expect(d.querySelector('#sidebar').tagName).toBe('DIALOG');
});
