const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const acorn=require('acorn');
function visit(node,fn){if(!node||typeof node!=='object')return;if(node.type)fn(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(n=>visit(n,fn));else if(value&&typeof value==='object')visit(value,fn);}}
const root=path.resolve(__dirname,'../../..');
const blog=require('../../../lib/blog'),templates=require('../../../lib/blog-templates');
const image='/__server-fixture/workshop.svg';
const posts=[
 {slug:'team-apparel-guide',title:'Made for your team. Built for everyday work.',category:'Guides',metaDescription:'A practical guide to choosing apparel, decoration and a fit your whole team will enjoy.',heroImageUrl:image,author:'Northwest Custom Apparel',publishedAt:'2026-09-01T18:00:00Z',updatedAt:'2026-09-02T18:00:00Z',
 bodyMarkdown:'## Start with the way you work\n\nChoose a comfortable garment for the workday, then make the details your own. **Embroidery** and printed designs each suit different fabrics.\n\n> A good team uniform should feel as good as it looks.\n\n### Details that make a difference\n\n- Choose a fabric for your working conditions.\n- Compare the whole size range.\n- Review artwork before production.\n\n| Method | Good for | Care |\n| --- | --- | --- |\n| Embroidery | Polos and jackets | Follow the garment label |\n| Screen printing | Team tees | Wash inside out |\n\nVisit [our catalog](/catalog) or read https://example.test/a-very-long-reference-that-should-wrap-without-cutting-off-content-on-a-small-phone-screen.\n\n```text\nAn example note that remains readable when a line is longer than the phone screen.\n```\n\n![Sample workshop]('+image+')\n\n@video https://youtu.be/abcdefghijk'},
 {slug:'shop-news',title:'From our Milton shop',category:'News',metaDescription:'Meet the people behind your custom apparel.',heroImageUrl:image,publishedAt:'2026-08-24T18:00:00Z'},
 {slug:'simple-guide',title:'Choosing the right fit',category:'Guides',metaDescription:'Simple details for a comfortable team uniform.',publishedAt:'2026-08-18T18:00:00Z',bodyMarkdown:'A short guide without a hero image or an author.'}
];
function response(){
 return {statusCode:200,headers:{},status(code){this.statusCode=code;return this;},type(type){this.headers['Content-Type']=type;return this;},set(key,value){this.headers[key]=value;return this;},send(html){this.html=html;return this;},json(data){this.data=data;return this;},redirect(url){this.statusCode=302;this.redirectTo=url;return this;}};
}
function serverFunctions(){
 const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script'});
 const snippets=ast.body.filter(n=>n.type==='FunctionDeclaration'&&['requireCrmRole','accessRestrictedPage'].includes(n.id.name)).map(n=>s.slice(n.start,n.end)).join('\n');
 const statusPath=path.join(root,'lib/status-page-templates.js');
 const statusPageTemplates=fs.existsSync(statusPath)?require(statusPath):{};
 return vm.runInNewContext(snippets+'\n({requireCrmRole,accessRestrictedPage})',{statusPageTemplates});
}
function retired(){
 const s=fs.readFileSync(path.join(root,'routes/blog.js'),'utf8'),ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script'});let handler;
 visit(ast,n=>{if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='get'&&n.arguments[0]?.type==='ArrayExpression'&&n.arguments[0].elements.some(e=>e.value==='/pricing/stickers'))handler=n.arguments.at(-1);});
 if(!handler)throw Error('Retirement route missing');
 const f=path.join(root,'lib/status-page-templates.js');
 const fn=vm.runInNewContext('('+s.slice(handler.start,handler.end)+')',{statusPageTemplates:fs.existsSync(f)?require(f):{}});
 const res=response();fn({},res);return res;
}
function denied(req,roles=['admin']){
 const res=response();serverFunctions().requireCrmRole(roles)(req,res,()=>{res.next=true;});return res;
}
function scenes(){
 const f=serverFunctions(),user={firstName:'Avery',permissions:['sales']};
 return {
  'role-denied':denied({originalUrl:'/dashboards/admin.html',session:{crmUser:user}}),
  restricted:{statusCode:403,html:f.accessRestrictedPage('Avery')},
  'restricted-no-name':{statusCode:403,html:f.accessRestrictedPage('')},
  retired:retired(),
  'blog-index':{statusCode:200,html:templates.renderIndex(posts)},
  'blog-category':{statusCode:200,html:templates.renderIndex(posts,{category:'Guides'})},
  'blog-empty':{statusCode:200,html:templates.renderIndex([])},
  'blog-post':{statusCode:200,html:templates.renderPost(posts[0],blog.renderMarkdown(posts[0].bodyMarkdown),posts.slice(1))},
  'blog-post-minimal':{statusCode:200,html:templates.renderPost(posts[2],blog.renderMarkdown(posts[2].bodyMarkdown))}
 };
}
module.exports={scenes,posts,denied,retired,serverFunctions};
