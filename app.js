(function(){
"use strict";
var DEF_EXP=['מזון ומכולת','משכורות ועובדים','תחזוקה ותיקונים','שיפוץ, ריהוט וציוד','אירועים, דרשנים וסעודות','ספקי מזון וקייטרינג','משרד, דפוס וספרים','טיולים ופעילות','הובלות ומוניות','שונות'];
var DEF_INC=['שמעון טויסיג','שכר לימוד','תשלומי בחורים','החזרי משכורת','תרומות ואחר'];
var METHODS=['צ׳ק','מזומן'];
var TABS=[['overview','סקירה'],['tx','תנועות'],['catering','קייטרינג'],['edu','חינוך'],['notes','הערות']];
var S={inc:null,exp:null,cat:null,edu:null,notes:null,canEdit:false,uid:null,names:{},
  tab:'overview',month:'all',txType:'all',txCat:'all',txMethod:'all',txQ:'',txNoDate:false,txLimit:80,
  year:'all',dialog:null,confirm:null,editS:null,loadFailed:false};
var saveChain={},pending={},stamp={},pollId=null;

var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function shekel(n){var v=Math.round(n*100)/100;return '<span class="num">'+v.toLocaleString('he-IL',{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2})+' ₪</span>'}
function plainNum(n){return (Math.round(n*100)/100).toLocaleString('he-IL',{maximumFractionDigits:2})}
function sum(a){return a.reduce(function(t,r){return t+(+r.amount||0)},0)}
var MON=['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
function monthLabel(m){var p=m.split('-');return MON[+p[1]-1]+' '+p[0]}
function fmtDate(r){
  if(r.date){var p=r.date.split('-');return '<span class="num">'+p[2]+'.'+p[1]+'.'+p[0].slice(2)+'</span>'}
  if(r.dateText)return esc(r.dateText);
  return '<span class="nodate" title="לא רשום תאריך בטבלה המקורית">ללא תאריך</span>';
}
function toast(t){var e=$('toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){e.hidden=true},2400)}

/* ---------- storage ---------- */
function save(name,data){
  pending[name]=(pending[name]||0)+1;
  var p=(saveChain[name]||Promise.resolve()).then(function(){return API.setDoc('ledger/'+name,data)}).then(function(ts){stamp[name]=ts});
  p.then(function(){pending[name]--},function(){pending[name]--});
  saveChain[name]=p.catch(function(){});
  return p.then(function(){toast('נשמר')},function(e){toast('השמירה נכשלה: '+(e&&e.message||'שגיאה'))});
}
function saveRows(kind,rows){S[kind==='income'?'inc':'exp']=rows;render();return save(kind,{rows:rows,updated:Date.now()})}

/* ---------- derived ---------- */
function cats(rows,defs){var s=defs.slice();rows.forEach(function(r){if(r.cat&&s.indexOf(r.cat)<0)s.push(r.cat)});return s}
function group(rows){var m={};rows.forEach(function(r){var k=r.cat||'ללא קטגוריה';m[k]=(m[k]||0)+(+r.amount||0)});
  return Object.keys(m).map(function(k){return{name:k,total:m[k]}}).sort(function(a,b){return b.total-a.total})}
function years(){var m={};(S.inc||[]).concat(S.exp||[]).forEach(function(r){if(r.year)m[r.year]=1});return Object.keys(m).sort().reverse()}
function curYear(){var y=years();return y[0]||''}
function inYear(r){return S.year==='all'||r.year===S.year}
function allMonths(){var s={};(S.inc||[]).concat(S.exp||[]).filter(inYear).forEach(function(r){if(r.date)s[r.date.slice(0,7)]=1});return Object.keys(s).sort()}
function inMonth(r){return S.month==='all'||(r.date&&r.date.slice(0,7)===S.month)}

/* ---------- render ---------- */
function render(){
  renderHead();renderTabs();
  var m=$('main');
  if(S.loadFailed&&!S.inc){m.innerHTML='<div class="panel empty">לא ניתן לטעון את הנתונים כרגע. נסו לרענן את הדף.</div>';return}
  if(!S.inc||!S.exp){m.innerHTML='<div class="panel empty">טוען נתונים…</div>';return}
  m.innerHTML=({overview:vOverview,tx:vTx,catering:vCatering,edu:vEdu,notes:vNotes})[S.tab]();
}
function renderHead(){
  var r=$('role');r.hidden=false;r.textContent=S.canEdit?'מצב עריכה':'מצב צפייה';
  var yi=S.inc?S.inc.filter(inYear):[],ye=S.exp?S.exp.filter(inYear):[],ti=sum(yi),te=sum(ye);
  if(S.inc&&S.exp){
    var u=Math.max(S.inc._u||0,S.exp._u||0);
    $('subline').textContent=(yi.length+ye.length)+' תנועות'+(u?' · עודכן '+new Date(u).toLocaleDateString('he-IL'):'');
    var ys=years();
    $('yearbar').innerHTML=ys.length?'<div class="seg" role="group" aria-label="שנה">'+[['all','כל השנים']].concat(ys.map(function(y){return [y,'שנת '+y]})).map(function(t){return '<button data-year="'+t[0]+'" aria-pressed="'+(S.year===t[0])+'">'+esc(t[1])+'</button>'}).join('')+'</div>':'';
    $('kpis').innerHTML='<div class="kpis"><div class="kpi inc"><div class="l">סה״כ הכנסות</div><div class="v">'+shekel(ti)+'</div><div class="s">'+yi.length+' תנועות</div></div>'+
    '<div class="kpi exp"><div class="l">סה״כ הוצאות</div><div class="v">'+shekel(te)+'</div><div class="s">'+ye.length+' תנועות</div></div>'+
    '<div class="kpi bal"><div class="l">נשאר בקופה</div><div class="v">'+shekel(ti-te)+'</div><div class="s">הכנסות פחות הוצאות</div></div></div>';
  }
}
function renderTabs(){
  $('tabs').innerHTML=TABS.map(function(t){return '<button role="tab" data-tab="'+t[0]+'" aria-selected="'+(S.tab===t[0])+'">'+t[1]+'</button>'}).join('');
}
function bars(items,total,cls){
  if(!items.length)return '<div class="empty">אין נתונים לתקופה זו</div>';
  var mx=items[0].total||1;
  return '<div class="bars">'+items.map(function(i){
    return '<div class="bar"><div class="name">'+esc(i.name)+'</div>'+
    '<div class="track"><div class="fill '+cls+'" style="width:'+Math.max(2,i.total/mx*100)+'%"></div></div>'+
    '<div class="amt">'+shekel(i.total)+'<small>'+Math.round(i.total/(total||1)*100)+'%</small></div></div>'}).join('')+'</div>';
}
function vOverview(){
  var ms=allMonths();if(S.month!=='all'&&ms.indexOf(S.month)<0)S.month='all';var inc=S.inc.filter(inYear).filter(inMonth),exp=S.exp.filter(inYear).filter(inMonth);
  var opts='<option value="all">כל התקופה</option>'+ms.map(function(m){return '<option value="'+m+'"'+(S.month===m?' selected':'')+'>'+monthLabel(m)+'</option>'}).join('');
  var undated=S.inc.concat(S.exp).filter(inYear).filter(function(r){return !r.date}).length;
  var h='<div class="row-tools"><div class="field" style="width:200px"><label for="monthSel">תקופה</label><select id="monthSel">'+opts+'</select></div>';
  if(S.month!=='all')h+='<div class="status">מוצגות רק תנועות עם תאריך בחודש זה. '+shekel(sum(inc))+' הכנסות · '+shekel(sum(exp))+' הוצאות</div>';
  h+='<div class="grow"></div>'+(S.canEdit?'<button class="btn" data-act="import">ייבוא מאקסל</button>':'')+'<button class="btn" data-act="csv">הורדה לאקסל (CSV)</button></div>';
  if(!S.inc.length&&!S.exp.length)h+='<div class="panel empty">עדיין אין הכנסות והוצאות. כדי להתחיל: לשונית תנועות ← תנועה חדשה.</div>';
  h+='<div class="grid2"><section class="panel"><h2>הוצאות לפי קטגוריה</h2>'+bars(group(exp),sum(exp),'exp-fill')+'</section>'+
     '<section class="panel"><h2>הכנסות לפי מקור</h2>'+bars(group(inc),sum(inc),'inc-fill')+'</section></div>';
  h+=yearTable()+methodTable(inc,exp);
  h+='<section class="panel"><h2>הכנסות והוצאות לפי חודש</h2>'+monthChart(ms)+
     (undated?'<div class="note-box">'+undated+' תנועות נרשמו בלי תאריך, ולכן אינן מופיעות בגרף החודשי (הן כלולות בכל הסכומים). אפשר להשלים תאריכים בלשונית "תנועות".</div>':'')+'</section>';
  return h;
}
function methodTable(inc,exp){
  if(!inc.length&&!exp.length)return '';
  var rows=METHODS.concat(['']).map(function(m){
    var i=sum(inc.filter(function(r){return (r.method||'')===m})),e=sum(exp.filter(function(r){return (r.method||'')===m}));
    if(!i&&!e)return '';
    return '<tr><td><b>'+(m||'לא צוין')+'</b></td><td class="amount inc">'+shekel(i)+'</td><td class="amount exp">'+shekel(e)+'</td></tr>'}).join('');
  return '<section class="panel tablewrap" style="margin-bottom:14px"><h2>לפי אופן תשלום</h2><table style="min-width:360px"><thead><tr><th>אופן תשלום</th><th>הכנסות</th><th>הוצאות</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
}
function yearTable(){
  var ys=years();if(ys.length<2)return '';
  var rows=ys.map(function(y){var i=sum(S.inc.filter(function(r){return r.year===y})),e=sum(S.exp.filter(function(r){return r.year===y}));
    return '<tr><td><b>שנת '+esc(y)+'</b></td><td class="amount inc">'+shekel(i)+'</td><td class="amount exp">'+shekel(e)+'</td><td class="amount" style="color:var(--ink)">'+shekel(i-e)+'</td></tr>'}).join('');
  var no=S.inc.concat(S.exp).filter(function(r){return !r.year}).length;
  return '<section class="panel tablewrap" style="margin-bottom:14px"><h2>סיכום לפי שנים</h2><table style="min-width:420px"><thead><tr><th>שנה</th><th>הכנסות</th><th>הוצאות</th><th>יתרה</th></tr></thead><tbody>'+rows+'</tbody></table>'+(no?'<div class="note-box">'+no+' תנועות ללא שנה אינן נכללות בטבלה. אפשר להשלים בעריכה.</div>':'')+'</section>';
}
function monthChart(ms){
  if(!ms.length)return '<div class="empty">אין תנועות עם תאריך</div>';
  var di={},de={};
  S.inc.filter(inYear).forEach(function(r){if(r.date){var k=r.date.slice(0,7);di[k]=(di[k]||0)+r.amount}});
  S.exp.filter(inYear).forEach(function(r){if(r.date){var k=r.date.slice(0,7);de[k]=(de[k]||0)+r.amount}});
  var mx=0;ms.forEach(function(m){mx=Math.max(mx,di[m]||0,de[m]||0)});
  var step=Math.pow(10,Math.floor(Math.log10(mx||1)));var top=Math.ceil(mx/step)*step;if(top/step<3)step/=2;
  var W=640,H=240,L=56,R=10,T=10,B=34,pw=W-L-R,ph=H-T-B,gw=pw/ms.length,bw=Math.min(22,gw/3);
  var y=function(v){return T+ph-v/top*ph};
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="הכנסות והוצאות לפי חודש" direction="ltr">';
  for(var v=0;v<=top+1;v+=step){s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)">'+(v>=1000?(v/1000)+'K':v)+'</text>'}
  ms.forEach(function(m,i){
    var cx=L+gw*i+gw/2,a=di[m]||0,b=de[m]||0,p=m.split('-');
    s+='<rect x="'+(cx-bw-1)+'" y="'+y(a)+'" width="'+bw+'" height="'+(T+ph-y(a))+'" rx="2" fill="var(--inc)"><title>'+monthLabel(m)+' הכנסות: '+plainNum(a)+'</title></rect>';
    s+='<rect x="'+(cx+1)+'" y="'+y(b)+'" width="'+bw+'" height="'+(T+ph-y(b))+'" rx="2" fill="var(--exp)"><title>'+monthLabel(m)+' הוצאות: '+plainNum(b)+'</title></rect>';
    s+='<text x="'+cx+'" y="'+(H-12)+'" text-anchor="middle" font-size="11" fill="var(--muted)">'+p[1]+'/'+p[0].slice(2)+'</text>';
  });
  return '<div class="legend"><span><i style="background:var(--inc)"></i>הכנסות</span><span><i style="background:var(--exp)"></i>הוצאות</span></div><div class="chart">'+s+'</svg></div>';
}
function txList(){
  var rows=[];
  if(S.txType!=='exp')S.inc.forEach(function(r){rows.push({r:r,t:'inc',n:+r.id.slice(1)||0})});
  if(S.txType!=='inc')S.exp.forEach(function(r){rows.push({r:r,t:'exp',n:+r.id.slice(1)||0})});
  var q=S.txQ.trim();
  rows=rows.filter(function(x){
    if(!inYear(x.r))return false;
    if(S.txCat!=='all'&&x.r.cat!==S.txCat)return false;
    if(S.txMethod!=='all'&&(x.r.method||'')!==(S.txMethod==='none'?'':S.txMethod))return false;
    if(S.txNoDate&&x.r.date)return false;
    if(q&&(x.r.desc+' '+(x.r.note||'')+' '+x.r.cat).indexOf(q)<0)return false;
    return true});
  rows.sort(function(a,b){var ka=a.r.createdAt||0,kb=b.r.createdAt||0;if(ka||kb)return kb-ka||b.n-a.n;return b.n-a.n});
  return rows;
}
function vTx(){
  var all=cats(S.exp,DEF_EXP).concat(cats(S.inc,DEF_INC)).filter(function(c,i,a){return a.indexOf(c)===i});
  var rows=txList(),shown=rows.slice(0,S.txLimit);
  var h='<div class="row-tools"><div class="seg" role="group" aria-label="סוג">'+[['all','הכל'],['exp','הוצאות'],['inc','הכנסות']].map(function(t){return '<button data-type="'+t[0]+'" aria-pressed="'+(S.txType===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>'+
  '<select id="txCat" aria-label="קטגוריה" style="width:auto"><option value="all">כל הקטגוריות</option>'+all.map(function(c){return '<option'+(S.txCat===c?' selected':'')+'>'+esc(c)+'</option>'}).join('')+'</select>'+
  '<select id="txMethod" aria-label="אופן תשלום" style="width:auto"><option value="all">כל אופני התשלום</option>'+METHODS.concat(['none']).map(function(m){return '<option value="'+m+'"'+(S.txMethod===m?' selected':'')+'>'+(m==='none'?'לא צוין':m)+'</option>'}).join('')+'</select>'+
  '<input type="search" id="txQ" placeholder="חיפוש בפירוט או בהערה" value="'+esc(S.txQ)+'" style="flex:1;min-width:150px;width:auto">'+
  '<label style="font-size:13px;color:var(--muted);white-space:nowrap"><input type="checkbox" id="txND"'+(S.txNoDate?' checked':'')+'> ללא תאריך</label>'+
  (S.canEdit?'<button class="btn primary" data-act="add">+ תנועה חדשה</button>':'')+'</div>';
  var ti=0,te=0;rows.forEach(function(x){if(x.t==='inc')ti+=+x.r.amount;else te+=+x.r.amount});
  h+='<div class="status">'+rows.length+' תנועות · הכנסות '+shekel(ti)+' · הוצאות '+shekel(te)+'</div>';
  if(!rows.length)return h+'<div class="panel empty">לא נמצאו תנועות</div>';
  h+='<div class="panel tablewrap" style="padding:6px 10px"><table><thead><tr><th>תאריך</th><th>פירוט</th><th>קטגוריה</th><th>תשלום</th><th>סכום</th>'+(S.canEdit?'<th></th>':'')+'</tr></thead><tbody>';
  shown.forEach(function(x){var r=x.r;
    h+='<tr><td class="date">'+fmtDate(r)+(S.year==='all'&&r.year?'<div class="rownote" style="margin:0;font-size:12px">'+esc(r.year)+'</div>':'')+'</td><td>'+esc(r.desc||'(ללא פירוט)')+(r.note?'<div class="rownote">'+esc(r.note)+'</div>':'')+'</td>'+
    '<td><span class="pill '+x.t+'">'+esc(r.cat||'ללא קטגוריה')+'</span></td><td class="date">'+esc(r.method||'—')+'</td><td class="amount '+x.t+'">'+shekel(r.amount)+'</td>'+
    (S.canEdit?'<td class="act"><button class="btn small" data-edit="'+x.t+':'+r.id+'">עריכה</button></td>':'')+'</tr>'});
  h+='</tbody></table></div>';
  if(rows.length>shown.length)h+='<div style="text-align:center;margin-top:12px"><button class="btn" data-act="more">הצג עוד ('+(rows.length-shown.length)+')</button></div>';
  return h;
}
/* ---------- dialog ---------- */
function renderDialog(){
  var d=S.dialog,o=$('overlay');
  if(!d){o.innerHTML='';return}
  var r=d.row,isNew=!d.row.id,t=d.type;
  var list=t==='inc'?cats(S.inc,DEF_INC):cats(S.exp,DEF_EXP);
  o.innerHTML='<div class="overlay" data-act="closeBg"><form class="dialog" id="txForm" role="dialog" aria-label="תנועה"><h2>'+(isNew?'תנועה חדשה':'עריכת תנועה')+'</h2><div class="form">'+
   '<div class="field full"><label>סוג</label><div class="seg" role="group"><button type="button" data-dtype="exp" aria-pressed="'+(t==='exp')+'">הוצאה</button><button type="button" data-dtype="inc" aria-pressed="'+(t==='inc')+'">הכנסה</button></div></div>'+
   '<div class="field"><label for="fDate">תאריך</label><input type="date" id="fDate" value="'+esc(r.date||'')+'"></div>'+
   '<div class="field"><label for="fAmt">סכום (₪)</label><input type="number" id="fAmt" step="0.01" min="0" required value="'+esc(r.amount==null?'':r.amount)+'"></div>'+
   '<div class="field full"><label for="fDesc">פירוט</label><input type="text" id="fDesc" required value="'+esc(r.desc||'')+'"></div>'+
   '<div class="field full"><label for="fCat">קטגוריה</label><input type="text" id="fCat" list="catList" required value="'+esc(r.cat||'')+'" placeholder="בחרו או הקלידו קטגוריה חדשה"><datalist id="catList">'+list.map(function(c){return '<option value="'+esc(c)+'">'}).join('')+'</datalist></div>'+
   '<div class="field"><label for="fMethod">אופן תשלום</label><select id="fMethod"><option value="">לא צוין</option>'+METHODS.map(function(m){return '<option'+(r.method===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select></div>'+
   '<div class="field"><label for="fYear">שנה</label><input type="text" id="fYear" list="yearList" value="'+esc(r.year||'')+'" placeholder="למשל '+esc(curYear()||'תשפ״ז')+'"><datalist id="yearList">'+years().map(function(y){return '<option value="'+esc(y)+'">'}).join('')+'</datalist></div>'+
   '<div class="field full"><label for="fNote">הערה</label><textarea id="fNote">'+esc(r.note||'')+'</textarea></div></div>'+
   '<div class="form-actions"><div style="display:flex;gap:8px"><button class="btn primary" type="submit">שמירה</button><button class="btn" type="button" data-act="close">ביטול</button></div>'+
   (isNew?'':(S.confirm==='del-tx'?'<button class="btn danger" type="button" data-act="delTx">בטוח? מחיקה סופית</button>':'<button class="btn danger" type="button" data-act="askDel">מחיקה</button>'))+'</div></form></div>';
  var f=$('fDate');if(isNew&&!d.focused){d.focused=1;$('fAmt').focus()}
}
function submitTx(e){
  e.preventDefault();var d=S.dialog,r=Object.assign({},d.row);
  r.date=$('fDate').value||null;if(r.date)delete r.dateText;delete r.dateFixed;
  r.amount=Math.round(parseFloat($('fAmt').value)*100)/100;r.desc=$('fDesc').value.trim();r.cat=$('fCat').value.trim();r.note=$('fNote').value.trim();r.year=$('fYear').value.trim();if(!r.year)delete r.year;r.method=$('fMethod').value;if(!r.method)delete r.method;
  if(!(r.amount>=0)||!r.desc||!r.cat){toast('יש למלא סכום, פירוט וקטגוריה');return}
  var from=d.orig,to=d.type;
  var inc=S.inc.slice(),exp=S.exp.slice();
  var arr=function(t){return t==='inc'?inc:exp};
  if(!r.id){r.id='n'+Date.now();r.createdAt=Date.now();arr(to).push(r);}
  else{
    if(from&&from!==to){var a=arr(from);a.splice(a.findIndex(function(x){return x.id===r.id}),1);arr(to).push(r)}
    else{var b=arr(to);b[b.findIndex(function(x){return x.id===r.id})]=r}
  }
  var p=[];
  var chInc=to==='inc'||from==='inc',chExp=to==='exp'||from==='exp';
  S.dialog=null;S.confirm=null;S.inc=inc;S.exp=exp;render();renderDialog();
  if(chInc)p.push(save('income',{rows:inc,updated:Date.now()}));
  if(chExp)p.push(save('expense',{rows:exp,updated:Date.now()}));
}
function delTx(){
  var d=S.dialog,t=d.orig;S.dialog=null;S.confirm=null;renderDialog();
  var rows=(t==='inc'?S.inc:S.exp).filter(function(x){return x.id!==d.row.id});
  saveRows(t==='inc'?'income':'expense',rows);
}
/* ---------- catering / education ---------- */
function vCatering(){
  var c=S.cat||{invoices:[],payments:[]};
  var ti=sum(c.invoices),tp=sum(c.payments),bal=ti-tp;
  var h='<div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><div class="l">סה״כ חיובים</div><div class="v" style="font-size:24px">'+shekel(ti)+'</div></div>'+
  '<div class="kpi"><div class="l">סה״כ שולם</div><div class="v" style="font-size:24px">'+shekel(tp)+'</div></div>'+
  '<div class="kpi"><div class="l">נשאר חייב</div><div class="v" style="font-size:24px;color:'+(bal>0?'var(--exp)':'var(--inc)')+'">'+shekel(bal)+'</div></div></div>';
  h+='<div class="grid2"><section class="panel"><h2>חיובים חודשיים</h2>'+
   (S.canEdit?miniForm('inv'):'')+
   simpleList(c.invoices.slice().sort(function(a,b){return b.month<a.month?-1:1}),function(r){return monthLabel(r.month)},'inv')+'</section>'+
  '<section class="panel"><h2>תשלומים</h2>'+
   (S.canEdit?miniForm('pay'):'')+
   simpleList(c.payments.slice().reverse(),function(r){return esc(r.from||'ללא שם')+(r.ref?' <span class="rownote" style="display:inline">· '+esc(r.ref)+'</span>':'')},'pay',true)+'</section></div>';
  return '<div class="status">חשבון הקייטרינג מנוהל בנפרד ואינו נכלל בסיכום ההכנסות וההוצאות למעלה.</div>'+h;
}
var EDIT_ARR={inv:function(){return (S.cat&&S.cat.invoices)||[]},pay:function(){return (S.cat&&S.cat.payments)||[]},edu:function(){return S.edu||[]}};
function editRec(kind){var e=S.editS;if(!e||e.kind!==kind)return null;return EDIT_ARR[kind]().find(function(x){return x.id===e.id})||null}
function miniForm(kind){
  var r=editRec(kind),v=function(k){return r&&r[k]!=null?esc(r[k]):''};
  var f={inv:'<div class="field"><label for="iM">חודש</label><input type="month" id="iM" required value="'+v('month')+'"></div><div class="field"><label for="iA">סכום</label><input type="number" id="iA" step="0.01" required value="'+v('amount')+'"></div>',
    pay:'<div class="field"><label for="pF">משלם</label><input type="text" id="pF" value="'+v('from')+'"></div><div class="field"><label for="pA">סכום</label><input type="number" id="pA" step="0.01" required value="'+v('amount')+'"></div><div class="field"><label for="pR">עבור חודש / תאריך</label><input type="text" id="pR" value="'+v('ref')+'"></div>',
    edu:'<div class="field"><label for="eM">חודש</label><input type="month" id="eM" required value="'+v('month')+'"></div><div class="field"><label for="eA">סכום</label><input type="number" id="eA" step="0.01" required value="'+v('amount')+'"></div>'}[kind];
  return '<form class="mini-form" data-form="'+kind+'">'+f+'<button class="btn primary">'+(r?'שמירה':'הוספה')+'</button>'+(r?'<button type="button" class="btn" data-act="cancelEdit">ביטול</button>':'')+'</form>';
}
function simpleList(rows,label,kind,raw){
  if(!rows.length)return '<div class="empty">אין רשומות</div>';
  return '<div class="tablewrap"><table style="min-width:0"><tbody>'+rows.map(function(r){
    var key=kind+':'+r.id;
    return '<tr><td>'+(raw?label(r):esc(label(r)))+'</td><td class="amount" style="color:var(--ink)">'+shekel(r.amount)+'</td>'+
    (S.canEdit?'<td class="act"><button class="btn small" data-editsimple="'+key+'">עריכה</button> '+(S.confirm===key?'<button class="btn danger small" data-del="'+key+'">בטוח?</button>':'<button class="btn small" data-askdel="'+key+'">מחיקה</button>')+'</td>':'')+'</tr>'}).join('')+'</tbody></table></div>';
}
function vEdu(){
  var rows=(S.edu||[]).slice().sort(function(a,b){return b.month<a.month?-1:1});
  return '<section class="panel"><h2>חינוך מאחנובקה</h2><div class="status">סה״כ '+shekel(sum(rows))+' · '+rows.length+' חודשים</div>'+
   (S.canEdit?miniForm('edu'):'')+
   simpleList(rows,function(r){return monthLabel(r.month)},'edu')+'</section>';
}
/* ---------- notes ---------- */
function vNotes(){
  var n=(S.notes||[]).slice().sort(function(a,b){return (b.ts||0)-(a.ts||0)});
  var h='<section class="panel"><h2>הערות</h2>';
  h+=true?'<form id="noteForm"><div class="field"><label for="noteT">הערה חדשה</label><textarea id="noteT" placeholder="כתבו כאן הערה או שאלה על החשבונות"></textarea></div><div style="margin:10px 0 18px"><button class="btn primary">פרסום</button></div></form>':'';
  if(!n.length)h+='<div class="empty">עדיין אין הערות</div>';
  n.forEach(function(x){var key='note:'+x._id;
    h+='<div class="note"><div class="meta"><span>'+esc(String(x.by||'').split('@')[0]||'משתמש')+' · '+new Date(x.ts||0).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})+'</span>'+
    (S.canEdit?(S.confirm===key?'<button class="btn danger small" data-del="'+key+'">בטוח?</button>':'<button class="btn small" data-askdel="'+key+'">מחיקה</button>'):'')+'</div><p>'+esc(x.text)+'</p></div>'});
  return h+'</section>';
}
/* ---------- csv ---------- */
function csv(){
  var q=function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  var lines=[['סוג','שנה','תאריך','סכום','פירוט','קטגוריה','אופן תשלום','הערה'].join(',')];
  S.exp.forEach(function(r){lines.push(['הוצאה',r.year,r.date||r.dateText||'',r.amount,r.desc,r.cat,r.method,r.note].map(q).join(','))});
  S.inc.forEach(function(r){lines.push(['הכנסה',r.year,r.date||r.dateText||'',r.amount,r.desc,r.cat,r.method,r.note].map(q).join(','))});
  var data='﻿'+lines.join('\r\n');
  try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));a.download='הוצאות-והכנסות.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){toast('ההורדה נכשלה')}
}
/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-tab],[data-type],[data-act],[data-edit],[data-dtype],[data-askdel],[data-del],[data-editsimple],[data-year]');if(!t)return;
  if(t.dataset.tab){S.editS=null;S.tab=t.dataset.tab;S.confirm=null;render();return}
  if(t.dataset.type){S.txType=t.dataset.type;S.txLimit=80;render();return}
  if(t.dataset.dtype){S.dialog.type=t.dataset.dtype;captureForm();renderDialog();return}
  if(t.dataset.edit){var p=t.dataset.edit.split(':'),arr=p[0]==='inc'?S.inc:S.exp;
    var row=arr.find(function(x){return x.id===p[1]});S.confirm=null;S.dialog={type:p[0],orig:p[0],row:Object.assign({},row)};renderDialog();return}
  if(t.dataset.editsimple){var q=t.dataset.editsimple.split(':');S.editS={kind:q[0],id:q.slice(1).join(':')};S.confirm=null;render();return}
  if(t.dataset.year){S.year=t.dataset.year;S.month='all';S.txLimit=80;render();return}
  if(t.dataset.askdel){S.confirm=t.dataset.askdel;render();return}
  if(t.dataset.del){delSimple(t.dataset.del);return}
  var a=t.dataset.act;
  if(a==='add'){S.confirm=null;S.dialog={type:'exp',orig:null,row:{date:new Date().toISOString().slice(0,10),year:S.year!=='all'?S.year:(curYear()||'תשפ״ז')}};renderDialog();return}
  if(a==='close'||(a==='closeBg'&&e.target===t)){S.dialog=null;S.confirm=null;renderDialog();return}
  if(a==='cancelEdit'){S.editS=null;render();return}
  if(a==='more'){S.txLimit+=120;render();return}
  if(a==='csv'){csv();return}
  if(a==='import'){openImport();return}
  if(a==='askDel'){captureForm();S.confirm='del-tx';renderDialog();return}
  if(a==='delTx'){delTx();return}
});
function captureForm(){var d=S.dialog;if(!d||!$('fAmt'))return;var r=d.row;
  r.date=$('fDate').value||null;r.amount=$('fAmt').value===''?null:parseFloat($('fAmt').value);r.desc=$('fDesc').value;r.cat=$('fCat').value;r.note=$('fNote').value;r.year=$('fYear').value;r.method=$('fMethod').value}
document.addEventListener('change',function(e){
  var id=e.target.id;
  if(id==='monthSel'){S.month=e.target.value;render()}
  else if(id==='txMethod'){S.txMethod=e.target.value;S.txLimit=80;render()}
  else if(id==='txCat'){S.txCat=e.target.value;S.txLimit=80;render()}
  else if(id==='txND'){S.txNoDate=e.target.checked;render()}
});
document.addEventListener('input',function(e){
  if(e.target.id==='txQ'){S.txQ=e.target.value;S.txLimit=80;var pos=e.target.selectionStart;render();var n=$('txQ');if(n){n.focus();n.setSelectionRange(pos,pos)}}
});
document.addEventListener('submit',function(e){
  e.preventDefault();var f=e.target;
  if(f.id==='txForm'){submitTx(e);return}
  if(f.id==='noteForm'){var tx=$('noteT').value.trim();if(!tx)return;
    API.addNote(tx,API.email()).then(function(){toast('ההערה נשמרה');return loadNotes().then(function(){if(S.tab==='notes')render()})},function(){toast('השמירה נכשלה')});$('noteT').value='';return}
  var k=f.dataset.form;if(!k)return;
  var c=S.cat||{invoices:[],payments:[]};
  var ed=S.editS&&S.editS.kind===k?S.editS.id:null;S.editS=null;
  var up=function(arr,o){return ed?arr.map(function(x){return x.id===ed?Object.assign({},x,o):x}):arr.concat([Object.assign({id:k[0]+Date.now()},o)])};
  if(k==='inv'){c=Object.assign({},c,{invoices:up(c.invoices,{month:$('iM').value,amount:parseFloat($('iA').value)})});S.cat=c;render();save('catering',c)}
  if(k==='pay'){c=Object.assign({},c,{payments:up(c.payments,{from:$('pF').value.trim(),amount:parseFloat($('pA').value),ref:$('pR').value.trim()})});S.cat=c;render();save('catering',c)}
  if(k==='edu'){S.edu=up(S.edu||[],{month:$('eM').value,amount:parseFloat($('eA').value)});render();save('edu',{rows:S.edu})}
});
function delSimple(key){
  var p=key.split(':'),k=p[0],id=p.slice(1).join(':');S.confirm=null;
  if(k==='note'){API.delNote(id).then(function(){toast('נמחק');return loadNotes().then(function(){if(S.tab==='notes')render()})},function(){toast('המחיקה נכשלה')});render();return}
  if(k==='inv'||k==='pay'){var c=Object.assign({},S.cat);var f=k==='inv'?'invoices':'payments';c[f]=c[f].filter(function(x){return x.id!==id});S.cat=c;render();save('catering',c);return}
  if(k==='edu'){S.edu=S.edu.filter(function(x){return x.id!==id});render();save('edu',{rows:S.edu});return}
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.dialog){S.dialog=null;S.confirm=null;renderDialog()}});

/* ---------- boot ---------- */

/* ---------- import from Excel (owner only) ---------- */
function loadXLSX(){
  if(window.XLSX)return Promise.resolve();
  return new Promise(function(res,rej){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=res;s.onerror=function(){rej(new Error('לא ניתן לטעון את רכיב קריאת האקסל. בדקו את החיבור לאינטרנט.'))};document.head.appendChild(s)});
}
function closeImport(){window.__importOpen=false;$('overlay2').innerHTML=''}
function openImport(){
  window.__importOpen=true;
  $('overlay2').innerHTML='<div class="overlay"><form class="dialog" id="impForm"><h2>ייבוא קייטרינג וחינוך מאקסל</h2>'+
   '<div class="note-box" style="margin:0 0 12px">מיובאים רק הגיליונות קייטרינג וחינוך, והם מחליפים את הנתונים הקיימים בשני הדפים האלה. ההכנסות וההוצאות לא נוגעות. הקובץ נקרא בדפדפן בלבד ואינו נשמר באתר.</div>'+
   '<div class="form"><div class="field full"><label for="impFile">קובץ האקסל (xlsx)</label><input type="file" id="impFile" accept=".xlsx,.xlsm" required></div></div>'+
   '<div id="impPrev" class="status" style="margin-top:12px"></div>'+
   '<div class="form-actions"><div style="display:flex;gap:8px"><button class="btn primary" type="submit" id="impGo">קריאה ובדיקה</button><button class="btn" type="button" id="impCancel">ביטול</button></div></div>'+
   '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0 12px"><div class="status">התחלה מחדש בהכנסות ובהוצאות:</div><button class="btn danger small" type="button" id="impClear">מחיקת כל ההכנסות וההוצאות</button></form></div>';
  var parsed=null,armed=false;
  $('impCancel').onclick=closeImport;
  $('impClear').onclick=function(){
    var b=$('impClear'),n=S.inc.length+S.exp.length;
    if(!armed){armed=true;b.textContent='בטוח? מחיקה סופית של '+n+' תנועות (לחיצה נוספת)';return}
    b.disabled=true;var now=Date.now();
    Promise.all([['income','inc'],['expense','exp']].map(function(p){var d={rows:[],updated:now};return API.setDoc('ledger/'+p[0],d).then(function(ts){stamp[p[0]]=ts;applyDoc(p[0],d)})})).then(function(){closeImport();render();toast('ההכנסות וההוצאות נמחקו')},function(err){b.disabled=false;$('impPrev').textContent='המחיקה נכשלה: '+err.message});
  };
  $('impForm').addEventListener('input',function(){parsed=null;$('impGo').textContent='קריאה ובדיקה';$('impPrev').innerHTML=''});
  $('impForm').addEventListener('submit',function(e){
    e.preventDefault();var prev=$('impPrev'),go=$('impGo');
    if(parsed){
      go.disabled=true;prev.textContent='שומר…';
      Promise.all(['catering','edu'].map(function(n){return API.setDoc('ledger/'+n,parsed[n]).then(function(ts){stamp[n]=ts;applyDoc(n,parsed[n])})})).then(function(){
        closeImport();render();toast('הקייטרינג והחינוך יובאו')},function(err){go.disabled=false;prev.textContent='השמירה נכשלה: '+err.message});
      return;
    }
    var f=$('impFile').files[0];if(!f)return;go.disabled=true;prev.textContent='קורא…';
    loadXLSX().then(function(){return f.arrayBuffer()}).then(function(buf){
      parsed=LedgerImport.parse(buf,{only:'catering-edu'});
      var c=parsed.catering;
      prev.innerHTML='נמצאו '+c.invoices.length+' חיובי קייטרינג ('+shekel(sum(c.invoices))+'), '+c.payments.length+' תשלומים לקייטרינג ('+shekel(sum(c.payments))+') ו-'+parsed.edu.rows.length+' חודשי חינוך ('+shekel(sum(parsed.edu.rows))+').';
      go.textContent='החלפת הנתונים באלה';go.disabled=false;
    }).catch(function(err){parsed=null;go.disabled=false;prev.textContent='שגיאה: '+err.message});
  });
}
function applyDoc(name,d){
  if(name==='income'){S.inc=(d&&d.rows)||[];S.inc._u=d&&d.updated}
  else if(name==='expense'){S.exp=(d&&d.rows)||[];S.exp._u=d&&d.updated}
  else if(name==='catering')S.cat=d||{invoices:[],payments:[]};
  else if(name==='edu')S.edu=(d&&d.rows)||[];
}
var notesSig='';
function loadNotes(){
  return API.listNotes().then(function(n){var sig=JSON.stringify(n.map(function(x){return x._id}));var ch=sig!==notesSig;notesSig=sig;S.notes=n;return ch},function(){return false});
}
function loadAll(first){
  var names=['income','expense','catering','edu'];
  return Promise.all(names.map(function(n){return API.getDoc('ledger/'+n).then(function(r){return [n,r]})})).then(function(rs){
    var ch=!!first;
    rs.forEach(function(x){var n=x[0],r=x[1],ts=r?r.updatedAt:-1;
      if(pending[n]>0)return;
      if(first||stamp[n]!==ts){stamp[n]=ts;applyDoc(n,r&&r.data);ch=true}});
    return loadNotes().then(function(c2){return ch||c2});
  });
}
function showOnly(id){['login','setup','app'].forEach(function(k){$(k).hidden=(k!==id)})}
function fail(e){
  if(e&&e.code==='permission-denied'){$('main').innerHTML='<div class="panel empty">לחשבון הזה אין הרשאה לצפות בנתונים. התנתקו והתחברו עם הכתובת הנכונה.</div>';return}
  S.loadFailed=true;render();
}
function start(){
  showOnly('app');
  S.canEdit=false;API.isOwner().then(function(v){if(v!==S.canEdit){S.canEdit=v;render()}});
  $('who').textContent=API.email();
  render();
  loadAll(true).then(function(){render()},fail);
  clearInterval(pollId);
  pollId=setInterval(function(){
    if(document.hidden||S.dialog||window.__importOpen)return;
    var a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&$('main').contains(a))return;
    loadAll(false).then(function(ch){if(ch)render()},function(){});
  },8000);
}
function loginUI(){
  showOnly('login');
  $('loginForm').addEventListener('submit',function(e){
    e.preventDefault();var b=$('loginBtn'),m=$('loginMsg');m.textContent='';b.disabled=true;
    API.login($('lEmail').value,$('lPass').value,$('lRemember').checked).then(function(){$('lPass').value='';start()},function(err){m.textContent=err.message}).then(function(){b.disabled=false});
  });
  $('forgot').addEventListener('click',function(){
    var m=$('loginMsg'),em=$('lEmail').value.trim();if(!em){m.textContent='הקלידו קודם את כתובת האימייל';return}
    API.resetPassword(em).then(function(){m.textContent='נשלח מייל לאיפוס הסיסמה'},function(err){m.textContent=err.message});
  });
}
$('logout').addEventListener('click',function(){API.logout();location.reload()});
function boot(){
  if(!API.configured()){showOnly('setup');return}
  API.resume().then(function(email){if(email)start();else loginUI()});
}
boot();
})();
