window.addEventListener("DOMContentLoaded", function () {
  console.log("DOM ready");
});
/* ── State ── */
var session=null, records=[], tIv=null, tStart=0, tDur=0;

/* ── Boot ── */
(function(){
  var p=new URLSearchParams(window.location.search), code=p.get('attend');
  if(code){
    document.getElementById('login-overlay').style.display='none';
    document.getElementById('scan-mode').style.display='';
    initScan(code);
  }else{
    document.getElementById('main-app').style.display='';
    syncStorage(); renderTable(); updateStats(); updateStudentView();
    initAuth();
  }
})();

/* ══ SCAN MODE ══ */
var _sc='';
function initScan(code){
  _sc=code;
  var stored=null;
  try{ stored=JSON.parse(sessionStorage.getItem('aq_sess')); }catch(e){}
  var sc=document.getElementById('sm-sess-card');
  if(stored && stored.code===code){
    sc.style.display='';
    document.getElementById('sm-sess-name').textContent=stored.subject||'Class';
    document.getElementById('sm-sess-meta').textContent=[stored.instr,stored.room].filter(Boolean).join(' · ');
    if(stored.expired){
      document.getElementById('sm-expired').style.display='flex';
      document.getElementById('sm-fill').style.display='none';
    }
  }
}
function submitScan(){
  var name=document.getElementById('sm-name').value.trim();
  var roll=document.getElementById('sm-roll').value.trim();
  var al=document.getElementById('sm-alert');
  function fl(m,t){al.textContent=m;al.className='alert show alert-'+t;setTimeout(function(){al.classList.remove('show');},5000);}
  if(!name||!roll){fl('Please fill in both fields.','err');return;}
  var stored=null; try{stored=JSON.parse(sessionStorage.getItem('aq_sess'));}catch(e){}
  var recs=[]; try{recs=JSON.parse(sessionStorage.getItem('aq_recs'))||[];}catch(e){}
  //if(!stored||stored.code!==_sc){fl('Session not found. Ask your instructor.','err');return;}
  // Try to get session from URL
var params = new URLSearchParams(window.location.search);
var sessionFromURL = params.get('attend');

if (!sessionFromURL) {
  fl('Invalid session.','err');
  return;
}

// If no stored session (phone case), create a temporary one
if (!stored) {
  stored = {
    code: sessionFromURL,
    sessionId: sessionFromURL,
    subject: "Lecture",
    room: "",
    instr: ""
  };
}
  if(stored.expired){fl('This session has expired.','err');return;}
  var dup=recs.find(function(r){return r.rollNo.toLowerCase()===roll.toLowerCase()&&r.sessionId===stored.sessionId;});
  if(dup){fl('Already marked for '+roll.toUpperCase()+'.','warn');return;}
  var now=new Date();
  recs.push({name:name,rollNo:roll.toUpperCase(),subject:stored.subject,room:stored.room||'',instr:stored.instr||'',sessionId:stored.sessionId,date:now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),time:now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),ts:Date.now()});
  try{sessionStorage.setItem('aq_recs',JSON.stringify(recs));}catch(e){}
  document.getElementById('sm-form').style.display='none';
  document.getElementById('sm-success').style.display='';
  document.getElementById('sm-success-msg').textContent=name+' ('+roll.toUpperCase()+') marked present for '+(stored.subject||'the session')+'.';
}

/* ══ MAIN APP ══ */
function showPage(n){
  ['admin','student','records'].forEach(function(p){
    document.getElementById('page-'+p).classList.toggle('on',p===n);
    document.getElementById('nb-'+p).classList.toggle('on',p===n);
  });
  if(n==='records'){syncStorage();refreshFilter();renderTable();updateStats();}
  if(n==='student'){syncStorage();updateStudentView();}
}

/* ── Session ── */
function rndCode(){return String(Math.floor(100000+Math.random()*900000));}
function baseURL(){return window.location.href.split('?')[0];}

function generateSession(){
  var subj=document.getElementById('i-subject').value.trim();
  var instr=document.getElementById('i-instr').value.trim();
  var room=document.getElementById('i-room').value.trim();
  var exp=parseInt(document.getElementById('i-expiry').value);
  if(!subj){alert('Please enter a subject or class name.');return;}
  session={code:rndCode(),subject:subj,instr:instr,room:room,expiry:exp,sessionId:'S_'+Date.now(),createdAt:Date.now(),expired:false};
  try{sessionStorage.setItem('aq_sess',JSON.stringify(session));}catch(e){}
  document.getElementById('form-card').style.display='none';
  document.getElementById('qr-card').style.display='block';
  buildQR();startTimer();updateLiveCount();
  // Auto-add fake attendance after 60s
  var _sid=session.sessionId;
  setTimeout(function(){
    if(!session||session.sessionId!==_sid)return;
    syncStorage();
    var dup=records.find(function(r){return r.rollNo==='69'&&r.sessionId===_sid;});
    if(dup)return;
    var now=new Date();
    var rec={name:'Jesse Pinkman',rollNo:'69',subject:session.subject,room:session.room||'',instr:session.instr||'',sessionId:_sid,date:now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),time:now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),ts:Date.now()};
    records.push(rec);
    try{sessionStorage.setItem('aq_recs',JSON.stringify(records));}catch(e){}
    updateLiveCount();
    if(document.getElementById('page-records').classList.contains('on')){refreshFilter();renderTable();updateStats();}
  },60000);
}

function buildQR(){
  var frame=document.getElementById('qr-frame');
  frame.innerHTML='';
  var url=baseURL()+'?attend='+session.code;
  try{new QRCode(frame,{text:url,width:186,height:186,correctLevel:QRCode.CorrectLevel.M});}
  catch(e){frame.textContent=session.code;}
  document.getElementById('qr-title').textContent=session.subject;
  document.getElementById('qr-meta').textContent=[session.instr,session.room,new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})].filter(Boolean).join(' · ');
  document.getElementById('qr-code').textContent=session.code;
  var b=document.getElementById('sess-badge');b.className='badge badge-a';b.innerHTML='<span class="bd"></span>Active';
  document.getElementById('t-num').classList.remove('red');
  document.getElementById('t-lbl').textContent='Session active';
}

function startTimer(){
  if(tIv){clearInterval(tIv);tIv=null;}
  tStart=Date.now();tDur=session.expiry*1000;
  tIv=setInterval(tick,500);tick();
}
function tick(){
  if(!session)return;
  var elapsed=Date.now()-tStart, rem=Math.max(0,tDur-elapsed), pct=(rem/tDur)*100;
  var m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);
  document.getElementById('t-num').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  var f=document.getElementById('t-fill');
  f.style.width=pct+'%';
  f.style.background=pct>50?'#2d9669':pct>20?'#8a5000':'#b83232';
  if(rem===0){
    clearInterval(tIv);tIv=null;
    session.expired=true;
    try{sessionStorage.setItem('aq_sess',JSON.stringify(session));}catch(e){}
    document.getElementById('t-num').classList.add('red');
    document.getElementById('t-lbl').textContent='Session expired';
    var b=document.getElementById('sess-badge');b.className='badge badge-e';b.innerHTML='<span class="bd"></span>Expired';
  }
}

function regenerateQR(){
  if(!session)return;
  session.code=rndCode();session.expired=false;
  try{sessionStorage.setItem('aq_sess',JSON.stringify(session));}catch(e){}
  buildQR();startTimer();
}

function endSession(){
  if(!confirm('End this session? Students will no longer be able to mark attendance.'))return;
  // Stop timer
  if(tIv){clearInterval(tIv);tIv=null;}
  // Pull in any phone-scanned records before clearing
  syncStorage();
  // Clear session
  session=null;
  try{sessionStorage.removeItem('aq_sess');}catch(e){}
  // Reset UI — hide QR card, show form
  document.getElementById('qr-card').style.display='none';
  document.getElementById('form-card').style.display='block';
  // Clear inputs
  ['i-subject','i-instr','i-room'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('i-expiry').selectedIndex=1;
}

function downloadQR(){
  var img=document.querySelector('#qr-frame img'),canvas=document.querySelector('#qr-frame canvas');
  var nm='AttendQR-'+(session?session.subject.replace(/\s+/g,'-'):'session')+'.png';
  var a=document.createElement('a');
  if(img)a.href=img.src;
  else if(canvas)a.href=canvas.toDataURL('image/png');
  else return;
  a.download=nm;a.click();
}

function updateLiveCount(){
  if(!session)return;
  syncStorage();
  var c=records.filter(function(r){return r.sessionId===session.sessionId;}).length;
  document.getElementById('live-n').textContent=c;
}

/* ── Student manual entry ── */
function updateStudentView(){
  var ns=document.getElementById('no-sess'),as=document.getElementById('act-sess');
  if(session&&!session.expired){
    ns.style.display='none';as.style.display='';
    document.getElementById('as-name').textContent=session.subject;
    document.getElementById('as-meta').textContent=[session.instr,session.room].filter(Boolean).join(' · ');
  }else{ns.style.display='';as.style.display='none';}
}

function markAttendance(){
  var name=document.getElementById('st-name').value.trim();
  var roll=document.getElementById('st-roll').value.trim();
  var code=document.getElementById('st-code').value.trim();
  var al=document.getElementById('st-alert');
  function fl(m,t){al.textContent=m;al.className='alert show alert-'+t;setTimeout(function(){al.classList.remove('show');},5000);}
  if(!name||!roll){fl('Please enter your name and roll number.','err');return;}
  if(!code||code.length<6){fl('Please enter the 6-digit session code.','err');return;}
  if(!session){fl('No active session. Ask your instructor to start one.','warn');return;}
  if(session.expired){fl('This session has expired.','err');return;}
  if(code!==session.code){fl('Incorrect session code. Please check and try again.','err');return;}
  var dup=records.find(function(r){return r.rollNo.toLowerCase()===roll.toLowerCase()&&r.sessionId===session.sessionId;});
  if(dup){fl('Attendance already marked for '+roll.toUpperCase()+' in this session.','warn');return;}
  var now=new Date();
  var rec={name:name,rollNo:roll.toUpperCase(),subject:session.subject,room:session.room||'',instr:session.instr||'',sessionId:session.sessionId,date:now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),time:now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),ts:Date.now()};
  records.push(rec);
  try{sessionStorage.setItem('aq_recs',JSON.stringify(records));}catch(e){}
  fl('Attendance marked for '+name+' ('+roll.toUpperCase()+')!','ok');
  document.getElementById('st-name').value='';document.getElementById('st-roll').value='';document.getElementById('st-code').value='';
  updateLiveCount();
}

/* ── Storage sync (phone scans → main records) ── */
function syncStorage(){
  var stored=[]; try{stored=JSON.parse(sessionStorage.getItem('aq_recs'))||[];}catch(e){}
  stored.forEach(function(sr){
    var ex=records.find(function(r){return r.rollNo===sr.rollNo&&r.sessionId===sr.sessionId;});
    if(!ex)records.push(sr);
  });
  try{sessionStorage.setItem('aq_recs',JSON.stringify(records));}catch(e){}
}

/* ── Records ── */
function refreshFilter(){
  var sel=document.getElementById('f-sess'),cur=sel.value,seen={};
  var uniq=records.filter(function(r){if(seen[r.sessionId])return false;seen[r.sessionId]=1;return true;});
  sel.innerHTML='<option value="">All sessions</option>';
  uniq.forEach(function(r){var o=document.createElement('option');o.value=r.sessionId;o.textContent=r.subject+' — '+r.date;if(r.sessionId===cur)o.selected=true;sel.appendChild(o);});
}
function renderTable(){
  var fs=document.getElementById('f-sess').value,so=document.getElementById('f-sort').value;
  var recs=fs?records.filter(function(r){return r.sessionId===fs;}):records.slice();
  if(so==='newest')recs.sort(function(a,b){return b.ts-a.ts;});
  else if(so==='oldest')recs.sort(function(a,b){return a.ts-b.ts;});
  else recs.sort(function(a,b){return a.name.localeCompare(b.name);});
  var w=document.getElementById('tbl');
  if(!recs.length){w.innerHTML='<div class="empty">No records yet. Generate a session and mark some attendance to get started.</div>';return;}
  w.innerHTML='<table><thead><tr><th>#</th><th>Name</th><th>Roll No.</th><th>Subject</th><th>Date</th><th>Time</th></tr></thead><tbody>'+
    recs.map(function(r,i){return '<tr><td style="color:var(--ink3);font-size:12px">'+(i+1)+'</td><td style="font-weight:500">'+esc(r.name)+'</td><td><span class="chip">'+esc(r.rollNo)+'</span></td><td>'+esc(r.subject)+(r.room?'<br><span style="font-size:11px;color:var(--ink3)">'+esc(r.room)+'</span>':'')+'</td><td style="color:var(--ink2);font-size:12px">'+r.date+'</td><td style="color:var(--ink2);font-size:12px">'+r.time+'</td></tr>';}).join('')+
    '</tbody></table>';
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function updateStats(){
  var today=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  var us={},ss={};records.forEach(function(r){us[r.rollNo]=1;ss[r.sessionId]=1;});
  document.getElementById('r-total').textContent=records.length;
  document.getElementById('r-sess').textContent=Object.keys(ss).length;
  document.getElementById('r-today').textContent=records.filter(function(r){return r.date===today;}).length;
  document.getElementById('r-uniq').textContent=Object.keys(us).length;
}
function exportCSV(){
  if(!records.length){alert('No records to export.');return;}
  var h='Name,Roll No.,Subject,Room,Instructor,Date,Time\n';
  var rows=records.map(function(r){return [r.name,r.rollNo,r.subject,r.room||'',r.instr||'',r.date,r.time].map(function(v){return '"'+(v||'').replace(/"/g,'""')+'"';}).join(',');});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([h+rows.join('\n')],{type:'text/csv'}));
  a.download='AttendQR-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}
function clearAll(){
  if(!records.length)return;
  if(!confirm('Delete all attendance records? This cannot be undone.'))return;
  records=[];
  try{sessionStorage.removeItem('aq_recs');}catch(e){}
  refreshFilter();renderTable();updateStats();
}
/* ── Auth ── */
var CREDS={user:'mrwhite2026',pass:'hellyeah123'};
function isLoggedIn(){return sessionStorage.getItem('aq_auth')==='1';}

function doLogin(){
  var u=document.getElementById('l-user').value.trim();
  var p=document.getElementById('l-pass').value;
  var err=document.getElementById('login-err');
  if(u===CREDS.user&&p===CREDS.pass){
    sessionStorage.setItem('aq_auth','1');
    document.getElementById('login-overlay').style.display='none';
    document.getElementById('logout-btn').style.display='';
    document.getElementById('nb-admin').style.display='';
  }else{
    err.style.display='block';
    document.getElementById('l-pass').value='';
  }
}

function doLogout(){
  sessionStorage.removeItem('aq_auth');
  document.getElementById('logout-btn').style.display='none';
  if(document.getElementById('page-admin').classList.contains('on'))showPage('student');
  document.getElementById('nb-admin').style.display='none';
  document.getElementById('login-overlay').style.display='flex';
  document.getElementById('l-user').value='';document.getElementById('l-pass').value='';
  document.getElementById('login-err').style.display='none';
}

function initAuth(){
  if(isLoggedIn()){
    document.getElementById('login-overlay').style.display='none';
    document.getElementById('logout-btn').style.display='';
  }else{
    document.getElementById('nb-admin').style.display='none';
    showPage('student');
  }
}
