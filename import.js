/* ייבוא מקובץ האקסל המקורי: הקובץ נקרא בדפדפן בלבד ואינו נשמר באתר. */
(function(){
"use strict";
var EXP=[
['משכורות ועובדים',['משכורת','יואל אשר','פאקער','ועקער','שעות נוספות','בחור אחראי','לייגער','בחור שפירק','מלצרים','ויינברגר','לייבי כהן','אוכל עובדים','ויינבערגר']],
['אירועים, דרשנים וסעודות',['דרשנים','דרשן','דרשה','בוקסה','בוקסות','סעודת','סעודה','אסיפת','מלוה מלכה','נר ','ליל א','שבע ברכות','כנס','הכנס','באטע','סדר מוצאי','בילקעס','לפידים','אפודים','הגברה','מנהל רוחני']],
['שיפוץ, ריהוט וציוד',['ריהוט','מיטות','אוקראיני','מקדמה','מזגנים','אורלנצ','צינוקל','צינוגל','קרמיקה','מכונת כביסה','ברזלים','שומשום','פרל','ברים','כיבוי אש','כריות','מנוף','פלורוסנטים']],
['תחזוקה ותיקונים',['מסגר','חשמלאי','אינסטל','טמבור','נגריית','טכנאי','תחזוקן','הדברה','פינוי','ברז','מצלמות','גז','צייטק','מעלית','תיקון','מילשטיין','דיקטים','נקודות לקו','יואלי גרויז','אינסטולטור','מעקה']],
['ספקי מזון וקייטרינג',['ליטו','קוגל','יוסי','שטרנפלד','כלים מטבח']],
['טיולים ופעילות',['טיול','קורקינטים','כובעי שמש','חברון']],
['משרד, דפוס וספרים',['ספירלה','שיכפול','עטים','ספרים','מפרשים','אוצר החכמה','הזמנות','מודעות','גניזה','חוברת','קובץ']],
['הובלות ומוניות',['מונית','מוניות','הובלה','משלוח','הלוך וחזור']],
['מזון ומכולת',['לחם','חלב','גבינה','ירקות','ביצים','מכולת','קורנפלקס','חסה','פיצוחים','פלאפל',"צ'יפס",'בלינצ','מיץ','קוטג','דג','צפראי','פערפיל','טונה','שמן','לחמניות','עוגות','שוקו','מזונות','ספוגניות','אבטיח','חלות','פיתות','יחידות','חרדל','שתיה','קניה','קנייה','קניית','מוצרי חלב','מזון','עשית','ארבעס','השלמ','לבן','פטל','קורניק','ארוחת','בקבוקי','יש ']]
];
var INC=[['שכר לימוד',['שכ"ל','שכ״ל']],['החזרי משכורת',['החזר','משכורת']],['תשלומי בחורים',['בחורים']],['שמעון טויסיג',['טויסיג']]];
var STRICT={'ברים':1};
function has(d,k){
  if(k.length>3&&!STRICT[k])return d.indexOf(k)>=0;
  var i=-1;while((i=d.indexOf(k,i+1))>=0){if(i===0||/[\s,.\-\/'"()]/.test(d.charAt(i-1)))return true}return false;
}
function cat(d,table,def){for(var i=0;i<table.length;i++){if(table[i][1].some(function(k){return has(d,k)}))return table[i][0]}return def}
function p2(n){return n<10?'0'+n:''+n}
function serial(v){return new Date(Math.round((v-25569)*86400000))}
function pdate(v){
  if(typeof v==='number'){var d=serial(v);return {date:d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate())}}
  if(typeof v==='string'){
    var m=/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(v.trim());
    if(m){var d2=+m[1],mo=+m[2],y=+m[3];if(y<100)y+=2000;var fx=false;if(y===2025&&mo<=6){y=2026;fx=true}
      var o={date:y+'-'+p2(mo)+'-'+p2(d2)};if(fx)o.dateFixed=true;return o}
    if(v.trim())return {dateText:v.trim()};
  }
  return {};
}
function ymd(v){var d=serial(v);return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)}
function ledgerRows(rows,table,def,prefix){
  var out=[],seq=0;
  rows.slice(1).forEach(function(r){
    if(typeof r[1]!=='number')return;
    seq++;var desc=String(r[2]==null?'':r[2]).trim();
    var o=Object.assign({id:prefix+seq,date:null,amount:Math.round(r[1]*100)/100,desc:desc,cat:cat(desc,table,def),note:r[3]==null?'':String(r[3])},pdate(r[0]));
    out.push(o);
  });
  return out;
}
function sheet(wb,name){
  var ws=wb.Sheets[name];if(!ws)throw new Error('בקובץ חסר גיליון בשם "'+name+'"');
  return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
}
function parse(buf,opt){
  var wb=XLSX.read(buf,{type:'array'});
  var inc=ledgerRows(sheet(wb,'הכנסות'),INC,'תרומות ואחר','i');
  var exp=ledgerRows(sheet(wb,'הוצאות'),EXP,'שונות','e');
  var ei=exp.findIndex(function(r){return opt.expMarker&&r.desc.indexOf(opt.expMarker)>=0});
  exp.forEach(function(r,k){r.year=ei>=0&&k>=ei?opt.year2:opt.year1});
  inc.forEach(function(r,k){r.year=(k+1)>=opt.incStart?opt.year2:opt.year1});
  var cat_={invoices:[],payments:[]};
  sheet(wb,'קייטרינג').slice(2).forEach(function(r){
    if(typeof r[0]==='number'&&typeof r[1]==='number')cat_.invoices.push({id:'c'+(cat_.invoices.length+1),month:ymd(r[0]),amount:r[1]});
    var e=r[4]==null?'':String(r[4]).trim();
    if(e!=='סה"כ'&&typeof r[5]==='number')cat_.payments.push({id:'p'+(cat_.payments.length+1),from:e,amount:r[5],ref:r[6]==null?'':String(r[6])});
  });
  var edu=[];
  sheet(wb,'חינוך').slice(2).forEach(function(r){if(typeof r[0]==='number'&&typeof r[1]==='number')edu.push({id:'u'+(edu.length+1),month:ymd(r[0]),amount:r[1]})});
  var now=Date.now();
  return {income:{rows:inc,updated:now},expense:{rows:exp,updated:now},catering:cat_,edu:{rows:edu},markerFound:ei>=0};
}
window.LedgerImport={parse:parse,EXP:EXP,INC:INC,cat:cat};
})();
