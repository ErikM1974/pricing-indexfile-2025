const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),espree=require('espree');
const root=path.resolve(__dirname,'../..'),fixture=require('../fixtures/catalog-discovery-original-content.json'),norm=s=>s.replace(/\s+/g,' ').trim(),read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
test.each(fixture.pages)('$file retains original copy, product destinations and search contracts',entry=>{
    const d=new JSDOM(read(entry.file)).window.document;
    d.querySelectorAll('[data-catalog-added]').forEach(n=>n.remove());
    expect(d.title).toBe(entry.title);expect(norm(d.querySelector('main').textContent)).toBe(entry.mainText);
    const links=[...d.querySelectorAll('a[href]')].map(n=>({href:n.getAttribute('href'),label:norm(n.textContent)}));
    for(const link of entry.links){
        // The old loading-only Brands dropdown is replaced by the masthead's same native Brands destination.
        if(link.label==='View all brands →')expect(links.map(n=>n.href)).toContain(link.href);else expect(links).toContainEqual(link);
    }
    expect([...d.images].map(n=>({src:n.getAttribute('src'),alt:n.alt}))).toEqual(entry.images);
    expect([...d.querySelectorAll('input,select,textarea')].map(n=>({tag:n.tagName,id:n.id,name:n.name,type:n.type,value:n.value}))).toEqual(entry.fields);
    const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);expect(new Set(ids).size).toBe(ids.length);
    for(const id of entry.ids.filter(id=>!['sidebarOverlay','navDropdownSearch','navCategories','navBrandsGrid'].includes(id)))expect(ids).toContain(id);
    expect(d.querySelectorAll('style,script:not([src]),[style],[onclick],[onerror]')).toHaveLength(0);
    expect(d.querySelector('#sidebar').tagName).toBe('DIALOG');
});
test('all original curated Fall brands, descriptions, categories and 179 style records are unchanged',()=>{
    const source=read('pages/js/fall-catalog-2026.js'),found={};
    function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&Object.hasOwn(fixture.collections,n.id.name))found[n.id.name]=source.slice(...n.init.range);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
    walk(espree.parse(source,{ecmaVersion:'latest',range:true}));expect(found).toEqual(fixture.collections);
});
