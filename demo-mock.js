(function(){
  // сдвиг всех дат демо-данных на сегодняшний день
  try {
    var t = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
    var off = Math.round((Date.parse(t+'T00:00:00Z') - Date.parse(window.__DEMO_BASE+'T00:00:00Z'))/864e5);
    if (off) {
      var re = /^(\d{4}-\d{2}-\d{2})/;
      var sh = function(v){ return v.replace(re, function(x){ var d=new Date(x+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+off); return d.toISOString().slice(0,10); }); };
      var walk = function(o){ if (Array.isArray(o)) { for (var i=0;i<o.length;i++) { if (typeof o[i]==='string') o[i]=sh(o[i]); else if (o[i]&&typeof o[i]==='object') walk(o[i]); } } else for (var k in o) { var v=o[k]; if (typeof v==='string' && re.test(v)) o[k]=sh(v); else if (v && typeof v==='object') walk(v); } };
      walk(window.__DB);
    }
  } catch (e) {}
  // демо: геолокация «в отеле»
  try { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: function(ok){ setTimeout(function(){ ok({ coords: { latitude: 41.2906, longitude: 69.2781, accuracy: 12 } }); }, 150); }, watchPosition: function(){ return 1; }, clearWatch: function(){} } }); } catch (e) {}
})();
(function(){
var DB = window.__DB; var seq = 1000; var listeners = [];
var session = null; (function(){ var a=/as=([a-z0-9._]+)/.exec(location.hash||''); if(a){ var e=DB.employees.filter(function(x){return x.login===a[1];})[0]; if(e){ session={user:{id:e.user_id}}; try{localStorage.setItem('mock-session',JSON.stringify(session));}catch(_){} } } else if (/signup/.test(location.hash||'')) { session=null; /* регистрация: никто не входит, поверх формы не всплывают знакомство и тревоги */ } else { try { session = JSON.parse(localStorage.getItem('mock-session')); } catch (e) {} } })();
function uid(){ return session && session.user.id; }
function meEmp(){ return DB.employees.filter(function(e){return e.user_id===uid();})[0]; }
function Q(t){ this.t=t; this.f=[]; this.op='select'; this.ord=null; this.lim=null; this.one=null; this.payload=null; this.ret=false; }
Q.prototype.select=function(){ if(this.op!=='select') this.ret=true; return this; };
Q.prototype.eq=function(c,v){ this.f.push(function(r){return r[c]===v;}); return this; };
Q.prototype.gte=function(c,v){ this.f.push(function(r){return r[c]>=v;}); return this; };
Q.prototype.lte=function(c,v){ this.f.push(function(r){return r[c]<=v;}); return this; };
Q.prototype.lt=function(c,v){ this.f.push(function(r){return r[c]<v;}); return this; };
Q.prototype.neq=function(c,v){ this.f.push(function(r){return r[c]!==v;}); return this; };
Q.prototype.is=function(c,v){ this.f.push(function(r){return (r[c]==null)===(v===null);}); return this; };
Q.prototype.not=function(c,op,v){ this.f.push(function(r){return r[c]!=null;}); return this; };
Q.prototype.or=function(expr){ var parts=expr.split(',').map(function(p){var a=p.split('.');return [a[0],a.slice(2).join('.')];}); this.f.push(function(r){return parts.some(function(p){return String(r[p[0]])===p[1];});}); return this; };
Q.prototype.like=function(c,v){ var p=v.replace('%',''); this.f.push(function(r){return String(r[c]).indexOf(p)===0;}); return this; };
Q.prototype.in=function(c,v){ this.f.push(function(r){return v.indexOf(r[c])>=0;}); return this; };
Q.prototype.order=function(c,o){ this.ord=[c,!(o&&o.ascending===false)]; return this; };
Q.prototype.limit=function(n){ this.lim=n; return this; };
Q.prototype.range=function(a,b){ this.rg=[a,b]; return this; };
Q.prototype.single=function(){ this.one='single'; return this; };
Q.prototype.maybeSingle=function(){ this.one='maybe'; return this; };
Q.prototype.insert=function(p){ this.op='insert'; this.payload=[].concat(p); return this; };
Q.prototype.update=function(p){ this.op='update'; this.payload=p; return this; };
Q.prototype.upsert=function(p,o){ this.op='upsert'; this.payload=[].concat(p); this.conf=(o&&o.onConflict||'id').split(','); return this; };
Q.prototype.delete=function(){ this.op='delete'; return this; };
Q.prototype.run=function(){
  var T=DB[this.t]=DB[this.t]||[], self=this, m=function(r){return self.f.every(function(fn){return fn(r);});};
  if(this.op==='insert'){ var ins=this.payload.map(function(p){ var r=Object.assign({id:++seq, created_at:new Date().toISOString(), status: (self.t==='schedule_requests'||self.t==='tasks'||self.t==='maint_requests')?'new':undefined, weekdays:self.t==='task_templates'?[1,2,3,4,5,6,7]:undefined, active:self.t==='task_templates'?true:undefined},p); T.push(r); return r;}); return {data:self.one?ins[0]:ins,error:null}; }
  if(this.op==='upsert'){ this.payload.forEach(function(p){ var ex=T.filter(function(r){return self.conf.every(function(c){return r[c]===p[c];});})[0]; if(ex) Object.assign(ex,p); else T.push(Object.assign({},p)); }); return {data:null,error:null}; }
  if(this.op==='update'){ var up=T.filter(m); up.forEach(function(r){Object.assign(r,self.payload);}); return {data:up,error:null}; }
  if(this.op==='delete'){ DB[this.t]=T.filter(function(r){return !m(r);}); return {data:null,error:null}; }
  var out=T.filter(m).slice(); if(this.ord){ var c=this.ord[0],a=this.ord[1]; out.sort(function(x,y){return (x[c]>y[c]?1:x[c]<y[c]?-1:0)*(a?1:-1);}); }
  if(this.rg) out=out.slice(this.rg[0],this.rg[1]+1);
  if(this.lim) out=out.slice(0,this.lim);
  out=JSON.parse(JSON.stringify(out));
  if(this.one) return {data: out[0]||null, error: (!out[0]&&this.one==='single')?{message:'not found'}:null};
  return {data:out,error:null};
};
Q.prototype.then=function(res,rej){ try{ var r=this.run(); return Promise.resolve(r).then(res,rej);}catch(e){ return Promise.reject(e).then(res,rej);} };
function tz(){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date()); }
var client={
  from:function(t){ return new Q(t); },
  rpc:function(n,a){ var me=meEmp();
    if(n==='quiz_today'||n==='quiz_submit'){ var qd=tz(); DB.quiz_attempts=DB.quiz_attempts||[]; var bank=(DB.quiz_questions||[]).filter(function(q){return q.active!==false;});
      /* волна 1: вопросы по службе сотрудника и типу заведения, количество — prefs.quiz_count, сдвиг по дню и по сотруднику */
      var qpf=(((DB.hotel_settings||[])[0]||{}).prefs)||{}, qty=qpf.org_type||'hotel', qn=Math.max(1,+qpf.quiz_count||10);
      var QC={hk:['hk','service','safety'],lobby:['hk','service','safety'],fo:['fo','service','safety'],fnb:['fnb','service','safety'],dlv:['fnb','service','safety'],kitchen:['fnb','safety'],sec:['safety','service'],eng:['safety'],adm:['service','safety'],sales:['service','safety'],dir:['service','safety']};
      var qlod=['hotel','hostel','guest'].indexOf(qty)>=0; var qcats=(QC[me.dept_id]||['service','safety']).concat(['city','app']); if(qty==='hotel'&&!qpf.venue_profile) qcats.push('hotel');
      var qhw=/номер|отел|гостиниц|заезд|выезд|горничн|ресепшен|завтрак|Fidelio|check-?in|check-?out|лобби|хаускипинг|Mir Luxe|лифт|сейф|Booking|ключ-карт|мини-бар|отзыв/i; /* волна 3 (Б3): шире фильтр гостиничного */
      var mine=bank.filter(function(q){ return qcats.indexOf(q.cat)>=0 && (qlod || !qhw.test(q.q_ru+' '+(q.opts_ru||[]).join(' '))); });
      var qh=0; for(var qi=0;qi<String(me.id).length;qi++) qh=(qh*31+String(me.id).charCodeAt(qi))%9973;
      var off=(+qd.slice(8,10)*7+qh*13)%Math.max(1,mine.length); var qs=mine.slice(off).concat(mine.slice(0,off)).slice(0,qn);
      /* волна 3 (Б3): бариста и бармены — половина вопросов из «Кофе и бар» */ var pn=(DB.positions||[]).filter(function(p){ return p.id===me.position_id||(me.extra_pos||[]).indexOf(p.id)>=0; }).map(function(p){return p.name;}).join(' ');
      if(/Бариста|Бармен/.test(pn)){ var bq=bank.filter(function(q){return q.cat==='bar';}), oth=mine.filter(function(q){return q.cat!=='bar';}), nb=Math.ceil(qn/2), ob=(+qd.slice(8,10)*5+qh)%Math.max(1,bq.length), oo=off%Math.max(1,oth.length); qs=bq.slice(ob).concat(bq.slice(0,ob)).slice(0,nb).concat(oth.slice(oo).concat(oth.slice(0,oo)).slice(0,qn-nb)); }
      var qa=DB.quiz_attempts.filter(function(x){return x.employee_id===me.id&&x.day===qd;})[0];
      if(n==='quiz_submit'){ if(qa) return Promise.resolve({data:null,error:{message:'Сегодня тест уже пройден'}}); var qc=0; a.p_qids.forEach(function(id,i){ var q=bank.filter(function(z){return z.id===id;})[0]; if(q&&q.correct===a.p_answers[i]) qc++; }); qa={id:++seq,employee_id:me.id,day:qd,qids:a.p_qids,answers:a.p_answers,correct:qc,total:a.p_qids.length,score:qc*10,sec:a.p_sec}; DB.quiz_attempts.push(qa); }
      if(qa) return Promise.resolve({data:{day:qd,done:true,correct:qa.correct,total:qa.total,score:qa.score,sec:qa.sec,questions:qa.qids.map(function(id,i){ var q=JSON.parse(JSON.stringify(bank.filter(function(z){return z.id===id;})[0])); q.ans=qa.answers[i]; return q; })},error:null});
      return Promise.resolve({data:{day:qd,done:false,questions:qs.map(function(q){ return {id:q.id,cat:q.cat,q_ru:q.q_ru,q_uz:q.q_uz,opts_ru:q.opts_ru,opts_uz:q.opts_uz}; })},error:null}); }
    if(n==='staff_rating'){ var mins=+(((DB.hotel_settings||[])[0]||{}).prefs||{}).rating_min_shifts||5; var out=DB.employees.filter(function(e){return e.active!==false&&e.role!=='director';}).map(function(e,i){ var hsh=0; for(var k=0;k<e.id.length;k++) hsh=(hsh*31+e.id.charCodeAt(k))%997; var sh=(hsh%18)+2; var disc=60+(hsh%41), tp=45+((hsh*7)%56), qq=DB.quiz_attempts&&DB.quiz_attempts.filter(function(x){return x.employee_id===e.id;}).length? 100*DB.quiz_attempts.filter(function(x){return x.employee_id===e.id;})[0].correct/10/Math.max(1,sh)*sh/sh : (hsh%3? 30+((hsh*13)%60):null);
        var w=0.8+(qq==null?0:0.2), sc=(disc*0.4+tp*0.4+(qq||0)*0.2)/w; return {id:e.id,name:e.first_name+' '+(e.last_name||''),dept_id:e.dept_id,position_id:e.position_id,shifts:sh,disc:disc,tpct:tp,qpct:qq,eligible:sh>=mins,score:Math.round(sc*10)/10}; });
      out.sort(function(x,y){ return (y.eligible-x.eligible)||(y.score-x.score); }); return Promise.resolve({data:out,error:null}); }
    if(n==='mgr_brief'){ var bd=tz(), yd=new Date(Date.parse(bd+'T00:00:00Z')-864e5).toISOString().slice(0,10); var emps=DB.employees.filter(function(e){return e.active!==false;}); var nm=function(id){ var e=DB.employees.filter(function(x){return x.id===id;})[0]; return e?(e.first_name+' '+(e.last_name||'')).trim():'—'; };
      var act={}; DB.employees.forEach(function(e){ if(e.active!==false&&e.role!=='director') act[e.id]=1; }); var uq=function(l){ var sn={}; return l.filter(function(x){ if(!act[x.employee_id]||sn[x.employee_id]) return false; sn[x.employee_id]=1; return true; }); }; /* волна 3: люди, а не строки отметок */ var att=DB.attendance||[], tk=DB.tasks||[], aT=uq(att.filter(function(x){return x.day===bd;})), aY=uq(att.filter(function(x){return x.day===yd;})), tT=tk.filter(function(x){return x.day===bd;}), tY=tk.filter(function(x){return x.day===yd;}), ov=tk.filter(function(x){return x.day<bd&&x.status!=='done'&&x.status!=='review'&&x.status!=='cancel';});
      return Promise.resolve({data:{scope:'Весь отель',day:bd,staff:{total:emps.length,came:aT.length,late_today:aT.filter(function(x){return x.is_late;}).map(function(x){return {n:nm(x.employee_id),m:x.late_min};}),came_y:aY.length,late_y:aY.filter(function(x){return x.is_late;}).length,early_y:0,noout_y:[]},tasks:{today:tT.length,today_done:tT.filter(function(x){return x.status==='done';}).length,overdue:ov.length,overdue_top:ov.slice(0,5).map(function(x){return {t:x.title,n:nm(x.assignee_id),d:x.day};}),y:tY.length,y_done:tY.filter(function(x){return x.status==='done';}).length,missed_y:0},money:{},bdays:[]},error:null}); }
    if(n==='photo_set'){ me.photo=a.p_photo; return Promise.resolve({data:null,error:null}); }
    if(n==='staff_guest_request'){ DB.guest_requests=DB.guest_requests||[]; var gr={id:++seq,room_no:a.p_room||null,kind:a.p_kind,dept_id:({towels:'hk',cleaning:'hk',amenities:'hk',food:'fnb',repair:'eng',late_checkout:'fo',taxi:'fo',wakeup:'fo'})[a.p_kind]||'fo',text:a.p_text,lang:'staff',status:'new',due_at:a.p_due||null,created_at:new Date().toISOString()}; DB.guest_requests.push(gr); return Promise.resolve({data:{ok:true,id:gr.id},error:null}); }
    if(n==='quiz_import'){ DB.quiz_questions=DB.quiz_questions||[]; var ni=0; a.p.forEach(function(q){ if(DB.quiz_questions.some(function(z){return z.q_ru===q.q_ru;})) return; DB.quiz_questions.push(Object.assign({id:++seq,active:true},q)); ni++; }); return Promise.resolve({data:ni,error:null}); }
 if(n==='prefs_save'){ var hs=DB.hotel_settings[0]; hs.prefs=Object.assign({},hs.prefs||{},a.p); if(a.p.radius_m) hs.radius_m=a.p.radius_m; return Promise.resolve({data:Object.assign({radius_m:hs.radius_m,late_grace_min:hs.late_grace_min,require_geo:hs.require_geo},hs.prefs),error:null}); }
    if(n==='generate_daily_tasks'){ var d0=tz(); DB.task_templates.forEach(function(t){ DB.employees.forEach(function(e){ if(!e.active) return; if(!(e.id===t.employee_id||(!t.employee_id&&e.position_id===t.position_id))) return; if(DB.tasks.some(function(x){return x.template_id===t.id&&x.assignee_id===e.id&&x.day===d0;})) return; DB.tasks.push({id:++seq,title:t.title,assignee_id:e.id,day:d0,due_time:t.due_time,needs_photo:t.needs_photo,template_id:t.id,status:'new',created_by:null}); }); }); }
    if(n==='task_status'){ var t=DB.tasks.filter(function(x){return x.id===a.p_id;})[0]; var ns=a.p_status; if(ns==='done'&&t.needs_photo&&t.assignee_id===me.id&&me.role==='staff') ns='review'; t.status=ns; if(a.p_photo) t.photo_path=a.p_photo; DB.task_events.push({id:++seq,task_id:t.id,at:new Date().toISOString(),actor_id:me.id,action:'status:'+ns}); return Promise.resolve({data:JSON.parse(JSON.stringify(t)),error:null}); }
    if(n==='face_submit'){ DB.face_profiles=DB.face_profiles||[]; DB.face_profiles=DB.face_profiles.filter(function(f){return f.employee_id!==me.id;}); DB.face_profiles.push({employee_id:me.id,photo_path:a.p_path,descriptor:a.p_desc,status:me.role==='director'?'approved':'pending',created_at:new Date().toISOString()}); return Promise.resolve({data:me.role==='director'?'approved':'pending',error:null}); }
    if(n==='face_decide'){ var fp=(DB.face_profiles||[]).filter(function(f){return f.employee_id===a.p_emp;})[0]; if(fp) fp.status=a.p_ok?'approved':'rejected'; }
    if(n==='face_verdict'){ var at=DB.attendance.filter(function(x){return x.id===a.p_att;})[0]; if(at) at.face_verdict=a.p_ok?'ok':'bad'; }
    if(n==='set_bio_exempt'){ var ex=DB.employees.filter(function(x){return x.id===a.p_emp;})[0]; ex.bio_exempt=a.p_on; }
    if(n==='password_changed'){ me.must_change_password=false; }
    if(n==='staff_update'){ var e=DB.employees.filter(function(x){return x.id===a.p_id;})[0]; e.last_name=a.p_last; e.first_name=a.p_first; e.phone=a.p_phone; e.hire_date=a.p_hire; DB.audit_log.push({id:++seq,at:new Date().toISOString(),actor_id:me.id,target_id:e.id,action:'update',details:{old:{last:'x',first:'y'},new:{last:a.p_last,first:a.p_first}}}); }
    if(n==='staff_transfer'){ var e2=DB.employees.filter(function(x){return x.id===a.p_id;})[0]; var p=DB.positions.filter(function(x){return x.id===a.p_position;})[0]; DB.audit_log.push({id:++seq,at:new Date().toISOString(),actor_id:me.id,target_id:e2.id,action:'transfer',details:{from:'old',to:p.name,date:a.p_date,reason:a.p_reason}}); e2.position_id=p.id; e2.dept_id=p.dept_id; e2.role=p.access; e2.manager_id=a.p_manager; }
    return Promise.resolve({data:null,error:null}); },
  storage:{ from:function(){ return { upload:function(p){ return Promise.resolve({data:{path:p},error:null}); }, createSignedUrl:function(){ return Promise.resolve({data:{signedUrl:'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22240%22><rect width=%22400%22 height=%22240%22 fill=%22%23ccd%22/></svg>'},error:null}); } }; } },
  functions:{ invoke:function(n,o){ var b=o.body, me=meEmp();
    if(n==='clock'){ if(b.action==='whoami') return Promise.resolve({data:{ok:true,ip:'84.54.70.12'},error:null});
      DB.bio_credentials=DB.bio_credentials||[]; var myc=DB.bio_credentials.filter(function(c){return c.employee_id===me.id&&!c.revoked_at;});
      function chal(){var a=new Uint8Array(32);crypto.getRandomValues(a);var s2='';for(var i=0;i<32;i++)s2+=String.fromCharCode(a[i]);return btoa(s2).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
      if(b.action==='bio-reg-options') return Promise.resolve({data:{ok:true,options:{challenge:chal(),rp:{id:'localhost',name:String(window.PRODUCT_NAME||'')},user:{id:btoa(me.id),name:me.login,displayName:me.first_name},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none',authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},excludeCredentials:myc.map(function(c){return {type:'public-key',id:c.cred_id};})}},error:null});
      if(b.action==='bio-reg-verify'){ DB.bio_credentials.push({id:++seq,employee_id:me.id,cred_id:b.credential.rawId,device_name:'iPhone (тест)',created_at:new Date().toISOString(),revoked_at:null}); return Promise.resolve({data:{ok:true,device_name:'iPhone (тест)'},error:null}); }
      if(b.action==='bio-auth-options'){ if(!myc.length) return Promise.resolve({data:{ok:false,reason:'bio_enroll'},error:null}); return Promise.resolve({data:{ok:true,options:{challenge:chal(),rpId:'localhost',timeout:60000,userVerification:'required',allowCredentials:myc.map(function(c){return {type:'public-key',id:c.cred_id};})}},error:null}); }
      if(b.action==='probe') return Promise.resolve({data:{ok:true,in_hotel:true,dist:12},error:null});
      if(false){ if(!myc.length) return Promise.resolve({data:{ok:false,reason:'bio_enroll'},error:null}); if(!b.assertion) return Promise.resolve({data:{ok:false,reason:'bio'},error:null}); if(!myc.some(function(c){return c.cred_id===b.assertion.rawId;})) return Promise.resolve({data:{ok:false,reason:'bio_fail',message:'ключ не зарегистрирован'},error:null}); }
      DB.staff_devices=DB.staff_devices||[];
      if((b.action==='in'||b.action==='out')&&b.device_id){ var oth=DB.staff_devices.filter(function(x){return x.device_id===b.device_id&&!x.revoked_at&&x.employee_id!==me.id;})[0]; if(oth) return Promise.resolve({data:{ok:false,reason:'device_other'},error:null});
        if(!DB.staff_devices.some(function(x){return x.device_id===b.device_id&&x.employee_id===me.id&&!x.revoked_at;})) DB.staff_devices.push({id:++seq,employee_id:me.id,device_id:b.device_id,label:'iPhone · '+b.screen,first_seen:new Date().toISOString(),last_seen:new Date().toISOString(),revoked_at:null,blocked:false}); }
      var d=tz();
      if(b.action==='in'){ var a={id:++seq,employee_id:me.id,day:d,clock_in:new Date().toISOString(),clock_out:null,late_min:14,is_late:true,in_bio:(b.assertion?1:-1),in_photo:b.selfie||null,face_flag:!b.assertion,face_reason:b.assertion?null:'приход: Face ID не сработал — отметка по селфи',shift_kind:'u',shift_start:'08:00:00',shift_end:'17:00:00'}; DB.attendance.push(a); return Promise.resolve({data:{ok:true,action:'in',late_min:14,is_late:true,face:{flagged:!b.assertion,dist:0.31}},error:null}); }
      var op=DB.attendance.filter(function(x){return x.employee_id===me.id&&!x.clock_out;})[0]; op.clock_out=new Date().toISOString(); op.worked_min=480; return Promise.resolve({data:{ok:true,action:'out',worked_min:480},error:null}); }
    if(n==='staff-admin'){ if(b.action==='create'){ var p=DB.positions.filter(function(x){return x.id===b.position_id;})[0]; var e={id:'n'+(++seq),user_id:'nu'+seq,last_name:b.last_name,first_name:b.first_name,dept_id:p.dept_id,position_id:p.id,manager_id:b.manager_id,role:p.access,login:'new.'+seq,active:true}; DB.employees.push(e); return Promise.resolve({data:{ok:true,id:e.id,login:e.login,password:'123456'},error:null}); }
      if(b.action==='reset_password') return Promise.resolve({data:{ok:true,password:'654321'},error:null});
      var t=DB.employees.filter(function(x){return x.id===b.id;})[0]; t.active=b.action==='restore'; return Promise.resolve({data:{ok:true},error:null}); }
  } },
  auth:{
    onAuthStateChange:function(cb){ listeners.push(cb); setTimeout(function(){cb('INITIAL_SESSION',session);},10); return {data:{subscription:{unsubscribe:function(){}}}}; },
    signInWithPassword:function(c){ var login=c.email.split('@')[0]; var e=DB.employees.filter(function(x){return x.login===login;})[0]; if(!e||c.password!=='pass123') return Promise.resolve({error:{message:'Invalid login credentials'}}); session={user:{id:e.user_id}}; try{localStorage.setItem('mock-session',JSON.stringify(session));}catch(e){} setTimeout(function(){listeners.forEach(function(l){l('SIGNED_IN',session);});},5); return Promise.resolve({data:{session:session},error:null}); },
    updateUser:function(){ return Promise.resolve({data:{},error:null}); },
    signOut:function(){ session=null; try{localStorage.removeItem('mock-session');}catch(e){} listeners.forEach(function(l){l('SIGNED_OUT',null);}); return Promise.resolve({}); }
  }
};
window.supabase={createClient:function(){return client;}};
})();
