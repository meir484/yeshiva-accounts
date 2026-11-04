/* Firebase over plain HTTPS (Auth + Firestore REST). No SDK, so it also works on filtered networks. */
(function(){
"use strict";
var C=window.APP_CONFIG||{};
var SESSION_KEY='yeshiva-accounts:session',REMEMBER_KEY='yeshiva-accounts:remember';
var remember=false;
var sess=null; // {email, refreshToken, idToken, exp}

function configured(){return !!(C.apiKey&&C.projectId&&(C.ownerHash||C.ownerEmail))}
function load(){
  try{localStorage.removeItem(SESSION_KEY)}catch(e){} // legacy: sessions that were kept forever without asking
  var s=null;
  try{s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(s){remember=false;return s}}catch(e){}
  try{s=JSON.parse(localStorage.getItem(REMEMBER_KEY)||'null');if(s){remember=true;return s}}catch(e){}
  return null;
}
function store(s){
  try{sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(REMEMBER_KEY)}catch(e){}
  if(!s)return;
  var d=JSON.stringify({email:s.email,refreshToken:s.refreshToken});
  try{if(remember)localStorage.setItem(REMEMBER_KEY,d);else sessionStorage.setItem(SESSION_KEY,d)}catch(e){}
}

function http(url,opt,ms){
  var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},ms||12000);
  opt=Object.assign({},opt||{},{signal:ctl.signal});
  return fetch(url,opt).catch(function(e){throw new Error(e&&e.name==='AbortError'?'השרת לא הגיב בזמן':'אין חיבור לשרת')}).finally(function(){clearTimeout(t)});
}
function authErr(code){
  var m={EMAIL_NOT_FOUND:'אימייל או סיסמה שגויים',INVALID_PASSWORD:'אימייל או סיסמה שגויים',INVALID_LOGIN_CREDENTIALS:'אימייל או סיסמה שגויים',
    INVALID_EMAIL:'כתובת אימייל לא תקינה',USER_DISABLED:'המשתמש חסום',TOO_MANY_ATTEMPTS_TRY_LATER:'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',MISSING_PASSWORD:'יש להקליד סיסמה'};
  code=String(code||'').split(' ')[0];return new Error(m[code]||'ההתחברות נכשלה ('+code+')');
}
function setTokens(email,idToken,refreshToken,expiresIn){
  sess={email:String(email||'').toLowerCase(),idToken:idToken,refreshToken:refreshToken,exp:Date.now()+(+expiresIn-60)*1000};store(sess);
}
function login(email,password,rem){
  return http('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+C.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:email.trim(),password:password,returnSecureToken:true})}).then(function(r){return r.json()}).then(function(j){
    if(j.error)throw authErr(j.error.message);remember=!!rem;setTokens(j.email,j.idToken,j.refreshToken,j.expiresIn);return sess.email});
}
function refresh(){
  var s=sess||load();if(!s||!s.refreshToken)return Promise.reject(new Error('נדרשת התחברות'));
  return http('https://securetoken.googleapis.com/v1/token?key='+C.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(s.refreshToken)}).then(function(r){return r.json()}).then(function(j){
    if(j.error)throw new Error('נדרשת התחברות מחדש');
    setTokens(s.email,j.id_token,j.refresh_token,j.expires_in);return sess.email});
}
function resume(){var s=load();if(!s)return Promise.resolve(null);sess={email:s.email,refreshToken:s.refreshToken,idToken:null,exp:0};
  return refresh().catch(function(e){if(/התחברות/.test(e.message)){sess=null;store(null)}return null})}
function logout(){sess=null;store(null)}
function resetPassword(email){
  return http('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+C.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestType:'PASSWORD_RESET',email:email.trim()})}).then(function(r){return r.json()}).then(function(j){if(j.error)throw authErr(j.error.message)});
}
function token(){
  if(!sess)return Promise.reject(new Error('נדרשת התחברות'));
  if(sess.idToken&&Date.now()<sess.exp)return Promise.resolve(sess.idToken);
  return refresh().then(function(){return sess.idToken});
}
var BASE=function(){return 'https://firestore.googleapis.com/v1/projects/'+C.projectId+'/databases/(default)/documents/'};
function call(path,opt,query){
  return token().then(function(t){
    opt=Object.assign({},opt||{});opt.headers=Object.assign({Authorization:'Bearer '+t},opt.headers||{});
    return http(BASE()+path+'?key='+C.apiKey+(query||''),opt)}).then(function(res){
    if(res.status===401||res.status===403)throw Object.assign(new Error('אין הרשאה'),{code:'permission-denied'});
    return res});
}
function getDoc(path){
  return call(path).then(function(res){
    if(res.status===404)return null;if(!res.ok)throw new Error('שגיאת שרת ('+res.status+')');
    return res.json()}).then(function(j){if(!j)return null;var p=j.fields&&j.fields.payload&&j.fields.payload.stringValue;
    return {data:p?JSON.parse(p):null,updatedAt:j.fields&&j.fields.updatedAt?+j.fields.updatedAt.integerValue:0}});
}
function setDoc(path,data){
  var now=Date.now();
  return call(path,{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({fields:{payload:{stringValue:JSON.stringify(data)},updatedAt:{integerValue:String(now)}}})}).then(function(res){
    if(!res.ok)throw new Error('השמירה נכשלה ('+res.status+')');return now});
}
function listNotes(){
  return call('notes',{},'&pageSize=300').then(function(res){if(!res.ok)throw new Error('שגיאת שרת ('+res.status+')');return res.json()}).then(function(j){
    return (j.documents||[]).map(function(d){var f=d.fields||{};return {_id:d.name.split('/').pop(),text:f.text&&f.text.stringValue||'',by:f.by&&f.by.stringValue||'',ts:f.ts?+f.ts.integerValue:0}})});
}
function addNote(text,by){
  return call('notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{text:{stringValue:text},by:{stringValue:by},ts:{integerValue:String(Date.now())}}})}).then(function(res){
    if(!res.ok)throw new Error('השמירה נכשלה ('+res.status+')')});
}
function delNote(id){return call('notes/'+encodeURIComponent(id),{method:'DELETE'}).then(function(res){if(!res.ok)throw new Error('המחיקה נכשלה ('+res.status+')')})}

function sha256(s){
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2)}).join('')});
}
function isOwner(){
  var e=sess&&sess.email;if(!e)return Promise.resolve(false);
  if(C.ownerEmail)return Promise.resolve(e===String(C.ownerEmail).toLowerCase());
  return sha256(e).then(function(h){return h===String(C.ownerHash||'').toLowerCase()});
}
window.API={isOwner:isOwner,configured:configured,login:login,logout:logout,resume:resume,resetPassword:resetPassword,getDoc:getDoc,setDoc:setDoc,listNotes:listNotes,addNote:addNote,delNote:delNote,
  email:function(){return sess&&sess.email||null}};
})();
