const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('acorn');
const root=path.resolve(__dirname,'../../..');
const owners={calls:['dashboards/js/ae-mission-control.js','printCallSheet','esc','money2','localDay'],labels:['dashboards/js/jim-mailing-list.js','printLabels','esc','splitName'],threads:['pages/js/mockup-detail.js','generateThreadSheet','resolveBoxUrl']};
function functions(file){const source=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),out={};const walk=n=>{if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')out[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(acorn.parse(source,{ecmaVersion:'latest'}));return out;}
function scripts(kind,original=false){const [file,...names]=owners[kind],f=original?require('../../fixtures/staff-print-original-content.json').functions[file]:functions(file);return names.map(n=>f[n]).join('\n');}
function state(kind,mode='normal'){
 const long=mode==='long',count=long?(kind==='labels'?32:36):3;
 const people=Array.from({length:count},(_,i)=>({First_Name:'River',Last_Name:'Sample '+(i+1),Company:'Cedar Example '+(i+1)+(long?' — Apparel & Industrial Services':''),Address:(100+i)+' Example Street',City:'Milton',State:'WA',Zip:'98354'}));
 const calls=people.map((p,i)=>({company:p.Company,contactName:p.First_Name+' '+p.Last_Name,phone:'253-555-0142',playLabel:'New team uniforms',why:long?'Review new embroidered uniforms for the autumn crew and confirm the size breakdown.':'New uniform opportunity',bounty:37.5+i}));
 const thread=(i)=>({run:i+1,hex:['#1d4430','#f6f3eb','#356797'][i%3],name:['Forest green','Warm white','Classic blue'][i%3],catalog:String(1200+i),element:i%2?'Lettering':'Outer border'});
 const image='/__print-fixture/mockup.svg';
 return {state:{busy:false,loaded:true,rep:{firstName:'Avery'}},callState:{items:mode==='empty'?[]:calls,rendered:calls.length},rows:mode==='empty'?[]:people,currentMockup:mode==='empty'?{}:{Company_Name:'Cedar Example & Team',Design_Number:'REVIEW-43012',Design_Name:'Crew emblem',Logo_Width:'3.5',Logo_Height:'2.4',Print_Location:'Left chest',Garment_Description:'Navy work polo',Box_Mockup_1:mode==='no-image'?'':image,Box_Mockup_2:long?image:'',Box_Mockup_3:long?image:''},storedEmbRecords:mode==='empty'?{}:Object.fromEntries((long?[1,2,3]:[1]).map(slot=>[String(slot),{Stitch_Count:6500,Hoop_Width:100,Hoop_Height:120,Colorway_Name:'Crew '+slot,Thread_Sequence_JSON:JSON.stringify(Array.from({length:long?22:3},(_,i)=>thread(i)))}]))};
}
function setup(kind,mode='normal',original=false){return 'Object.assign(window,'+JSON.stringify(state(kind,mode))+');\n'+`
function currentRows(){return rows;}
function showOk(message){window.__notice=message;}
function showToast(message){window.__error=message;}
var DashPage={showError:function(message){window.__error=message;}};
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
`+scripts(kind,original);}
function render(kind,mode='normal',original=false){let html='',prints=0,error;const ctx={...state(kind,mode),Date:class extends Date{constructor(...a){super(...(a.length?a:['2026-09-13T18:00:00Z']));}},setTimeout:()=>{},showOk:()=>{},showToast:m=>{error=m;},DashPage:{showError:m=>{error=m;}},NWCAStaffPrint:{printWhenReady:()=>Promise.resolve()},escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};ctx.currentRows=()=>ctx.rows;ctx.window={open:()=>({document:{write:s=>{html=s;},close:()=>{}},print:()=>{prints++;}})};vm.runInNewContext(scripts(kind,original)+'\n'+owners[kind][1]+'();',ctx);return {html,error,prints};}
function restore(file,source){for(const c of require('../../fixtures/staff-print-original-content.json').changes.filter(c=>c.file===file).reverse()){if(source.split(c.after).length-1!==c.count)throw Error('Staff print reversal drift '+file);source=source.split(c.after).join(c.before);}return source;}
module.exports={owners,functions,scripts,state,setup,render,restore};
