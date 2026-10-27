(function(){
'use strict';
try{var $=function(s){return document.querySelector(s)}, $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};}catch(e){}
try{window.$=$;window.$$=$$;}catch(e){}
function hex2(n){return (n<16?'0':'')+n.toString(16).toUpperCase()+'H'}
function bin8(n){var s=n.toString(2);while(s.length<8)s='0'+s;return s.slice(0,4)+' '+s.slice(4)+'B'}

/* ---------- 页签：一级课次 + 二级小节（每课 ≤8） ---------- */
try{var LESSONS={
  a:[1,2,3,4,5,6,7,8],
  b:[9,10,11,12,20,13],
  c:[14,19,15,16,17,18]
};}catch(e){}
try{var LESSON_LABEL={
  a:'第 1 次课 · 中断入门',
  b:'第 2 次课 · 案例与练习',
  c:'第 3 次课 · 定时与收口'
};}catch(e){}
try{var LESSON_PAGE={a:'u5-lesson-1.html',b:'u5-lesson-2.html',c:'u5-lesson-3.html'};}catch(e){}
try{var HERE=document.documentElement.getAttribute('data-u5-lesson')||'a';}catch(e){}
try{var cur=LESSONS[HERE][0], lesson=HERE;}catch(e){}
function paneOfHash(h){
  h=String(h||'');
  var m=h.match(/^#p(20|1[0-9]|[1-9])$/); if(m) return +m[1];
  var intPane=h.match(/^#int-(20|1[0-9]|[1-9])$/); if(intPane) return +intPane[1];
  if(h==='#gate-win'||h==='#p-gate'||h==='#gate') return 19;
  if(h==='#ex53-full'||h==='#p-524') return 20;
  if(h==='#ex-58'||h==='#exg'||h==='#例题') return 15;
  if(h==='#ex53'||h==='#例5-3') return 12;
  if(h==='#ex51'||h==='#例5-1') return 13;
  if(h==='#tload'||h==='#装值'||h==='#hex-split'||h==='#rev-hex') return 14;
  if(h==='#media2') return 2;
  if(h==='#lab4clips') return 9;
  if(h==='#mem'||h==='#速记'||h==='#快速记忆') return 16;
  if(h==='#quiz'||h==='#测试') return 17;
  if(h==='#review'||h==='#全复习'||h==='#rev-sym'||h==='#rev-why'||h==='#rev-sz'||h==='#rev-kd'||h==='#rev-warm') return 18;
  if(h==='#struct6'||h==='#struct'||h==='#lcall-hw'||h==='#lcall'||h==='#level-edge'||h==='#it-mode') return 1;
  if(h==='#drill'||/^#act[A-D]$/.test(h)) return 10;
  return 0;
}
function lessonOf(n){
  n=+n;
  if(LESSONS.b.indexOf(n)>=0) return 'b';
  if(LESSONS.c.indexOf(n)>=0) return 'c';
  return 'a';
}
function lessonFromToken(token){
  token=String(token||'').replace(/^#/,'');
  if(token==='a'||token==='1'||token==='lesson-a'||token==='lesson-1'||token==='la') return 'a';
  if(token==='b'||token==='2'||token==='lesson-b'||token==='lesson-2'||token==='lb') return 'b';
  if(token==='c'||token==='3'||token==='lesson-c'||token==='lesson-3'||token==='lc') return 'c';
  return '';
}
function applyLesson(id){
  lesson=id;
  $$('.lesson').forEach(function(button){
    var on=button.dataset.lesson===id;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', on?'true':'false');
  });
  $$('.tab').forEach(function(tab){
    tab.classList.toggle('is-off', lessonOf(+tab.dataset.p)!==id);
  });
  var kicker=document.getElementById('lesson-kicker');
  if(kicker) kicker.textContent=LESSON_LABEL[id];
}
function show(n){n=+n||1;var dest=lessonOf(n);if(dest!==HERE){var hash=(n===10)?'#p10':'#p'+n;var fromDom='';var el=document.activeElement;if(el&&el.getAttribute){var href=el.getAttribute('href')||'';if(href.charAt(0)==='#'&&paneOfHash(href)===n)fromDom=href;}if(!fromDom&&paneOfHash(location.hash)===n)fromDom=location.hash;location.href=LESSON_PAGE[dest]+(fromDom||hash);return;}applyLesson(dest);cur=n;$$('.tab').forEach(function(t){t.setAttribute('aria-selected',String(t.dataset.p)===String(n));});$$('.pane').forEach(function(p){p.classList.toggle('on',p.id==='p'+n);});
try{window.show=show}catch(e){}
  var hashWant=(n===10)?'#p10':'#p'+n;
  try{if(location.hash!==hashWant && location.hash!=='#drill' && !/^#(struct6|struct|lcall-hw|lcall|level-edge|it-mode|ex53|例5-3|ex51|例5-1|tload|装值|hex-split|rev-hex|media2|lab4clips|exg|例题|mem|速记|快速记忆|quiz|测试|review|全复习|rev-sym|rev-why|rev-sz|rev-kd|rev-warm|gate-win|p-gate|gate|ex-58|ex53-full|p-524|p20)$/.test(location.hash) && !(n===10 && /^#act[A-D]$/.test(location.hash)))history.replaceState(null,'',hashWant)}catch(e){}
}
try{window.show=show}catch(e){}
try{applyLesson(HERE);}catch(e){}
try{$$('.tab').forEach(function(t){t.onclick=function(){show(+t.dataset.p)}});}catch(e){}
try{$('.lesson').forEach(function(button){
  button.onclick=function(ev){
    var id=button.dataset.lesson;
    if(ev&&ev.preventDefault) ev.preventDefault();
    if(id===lesson) return false;
    show(LESSONS[id][0]);
    return false;
  };
});}catch(e){}
try{(function(){
  var h=location.hash||'';
  var picked=lessonFromToken(h);
  if(!picked && !h){
    try{picked=lessonFromToken(new URLSearchParams(location.search).get('lesson'));}catch(e){}
  }
  if(picked){show(LESSONS[picked][0]);return}
  var m=h.match(/^#p(20|1[0-9]|[1-9])$/); if(m){show(+m[1]);return}
  var intPane=h.match(/^#int-(20|1[0-9]|[1-9])$/); if(intPane){show(+intPane[1]);return}
  if(h==='#gate-win' || h==='#p-gate' || h==='#gate' || h==='#p19'){show(19);return}
  if(h==='#ex53-full' || h==='#p-524' || h==='#p20'){show(20);return}
  if(h==='#ex-58'){show(15);setTimeout(function(){var e=document.getElementById('ex-58');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},80);return}
  if(h==='#ex53' || h==='#例5-3'){show(12);return}
  if(h==='#ex51' || h==='#例5-1'){show(13);return}
  if(h==='#tload' || h==='#装值'){show(14);return}
  if(h==='#hex-split' || h==='#rev-hex'){show(14);setTimeout(function(){var e=document.getElementById(h.slice(1)==='rev-hex'?'rev-hex':'hex-split');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},80);return}
  if(h==='#media2'){show(2);setTimeout(function(){var e=document.getElementById('media2');if(e)e.scrollIntoView({block:'start'});},80);return}
  if(h==='#lab4clips'){show(9);setTimeout(function(){var e=document.getElementById('lab4clips');if(e)e.scrollIntoView({block:'start'});},80);return}
  if(h==='#exg' || h==='#例题' || h==='#p15'){show(15);return}
  if(h==='#mem' || h==='#速记' || h==='#快速记忆' || h==='#p16'){show(16);return}
  if(h==='#quiz' || h==='#测试' || h==='#p17'){show(17);return}
  if(h==='#review' || h==='#全复习' || h==='#p18' || h==='#rev-sym' || h==='#rev-why' || h==='#rev-sz' || h==='#rev-kd' || h==='#rev-warm'){
    show(18);
    if(h==='#rev-sym'||h==='#rev-why'||h==='#rev-sz'||h==='#rev-kd'||h==='#rev-warm'){
      setTimeout(function(){var e=document.getElementById(h.slice(1)); if(e) e.scrollIntoView({behavior:'smooth',block:'start'});},80);
    }
    return
  }
  if(h==='#struct6' || h==='#struct'){show(1);setTimeout(function(){var e=document.getElementById('struct6');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},100);return}
  if(h==='#lcall-hw' || h==='#lcall'){show(1);setTimeout(function(){var e=document.getElementById('lcall-hw');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},100);return}
  if(h==='#level-edge' || h==='#it-mode'){show(1);setTimeout(function(){var e=document.getElementById('level-edge');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},100);return}
  if(h==='#drill' || /^#act[A-D]$/.test(h)){
    show(10);
    if(/^#act[A-D]$/.test(h)){
      setTimeout(function(){var el=document.querySelector(h); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});},60);
    }
    return;
  }
})();}catch(e){}
try{document.addEventListener('keydown',function(e){
  var tg=e.target;if(tg.tagName==='SELECT'||tg.tagName==='TEXTAREA'||(tg.tagName==='INPUT'&&tg.type!=='checkbox'))return;
  var order=LESSONS[lesson]||LESSONS.a;
  var at=order.indexOf(cur); if(at<0) at=0;
  if(e.key==='ArrowRight'){show(order[(at+1)%order.length]);e.preventDefault()}
  else if(e.key==='ArrowLeft'){show(order[(at-1+order.length)%order.length]);e.preventDefault()}
  else if(e.key===' '&&cur===8){e.preventDefault();stepGo(1)}
  else if(e.key===' '&&cur===6){e.preventDefault();nzStepGo(1)}
});}catch(e){}
try{$$('.zoom .btn').forEach(function(b){b.onclick=function(){document.body.className=b.dataset.z>0?'z'+b.dataset.z:'';$$('.zoom .btn').forEach(function(x){x.setAttribute('aria-pressed',x===b)})}});}catch(e){}


/* ---------- 电平 vs 边沿示意 ---------- */
try{(function(){
  var lv=$('#leLevel'), eg=$('#leEdge'), cap=$('#leCap');
  if(!lv) return;
  function reset(){
    lv.classList.remove('on-level'); eg.classList.remove('on-edge');
    var a=$('#leIeLevel'), b=$('#leIeEdge');
    if(a) a.textContent='0'; if(b) b.textContent='0';
    if(cap) cap.textContent='点按钮看波形与 IE0 怎么变。';
  }
  function showLevel(){
    reset(); lv.classList.add('on-level');
    var a=$('#leIeLevel'); if(a) a.textContent='1';
    if(cap) cap.textContent='开关闭合→引脚保持低→IE0 跟着为 1；不撤低，服务完还可能再进。';
  }
  function showEdge(){
    reset(); eg.classList.add('on-edge');
    var b=$('#leIeEdge'); if(b) b.textContent='1';
    if(cap) cap.textContent='按钮叮一声→采到下降沿→IE0 锁存为 1；CPU 响应后硬件清 0。';
    setTimeout(function(){
      if(!eg.classList.contains('on-edge')) return;
      if(b) b.textContent='0';
      if(cap) cap.textContent='响应后 IE0 已由硬件清 0（边沿方式）。';
    }, 1100);
  }
  var b1=$('#leDemoLevel'), b2=$('#leDemoEdge'), b3=$('#leDemoReset');
  if(b1) b1.onclick=showLevel;
  if(b2) b2.onclick=showEdge;
  if(b3) b3.onclick=reset;
})();}catch(e){}

/* ---------- 结构六步（课件第8页） ---------- */
try{(function(){
  var step=0, timer=null, playing=false;
  var caps=[
    '还没开始。五路源安静，标志灯灭，闸门关着。',
    '① 中断源亮：INT0／INT1／T0／T1／串口——谁会喊。',
    '② 请求标志亮：IE0／IE1／TF0／TF1／RI／TI——叫声留下的灯。',
    '③ IE 允许闸亮：总闸 EA + 分闸 EX0／ET0／EX1／ET1／ES——两道都开才放行。',
    '④ IP 优先级亮：PX0／PT0／PX1／PT1／PS——谁先接、高级能不能打断。',
    '⑤ 硬件查询亮：芯片自己轮询裁决，不是主程序去问。',
    '⑥ 中断入口亮：硬件执行 LCALL，跳进向量表办事。整条链走完。'
  ];
  var dots=$('#s6Dots'), chain=$('#s6Chain'), hint=$('#s6Hint'), cap=$('#s6Cap');
  var btnAuto=$('#s6Auto'), btnPause=$('#s6Pause'), btnNext=$('#s6Next'), btnReset=$('#s6Reset');
  if(!chain) return;
  dots.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i>';
  function syncBtns(){
    if(btnPause){
      btnPause.disabled=(!playing && step===0 && !timer) && !(!playing && step>0 && step<6 && btnPause.dataset.paused==='1') && !(playing);
      // clearer: enable pause only when playing; enable continue when paused mid-way
      if(playing){
        btnPause.disabled=false;
        btnPause.textContent='⏸ 暂停';
        btnPause.dataset.paused='0';
      }else if(btnPause.dataset.paused==='1' && step>0 && step<6){
        btnPause.disabled=false;
        btnPause.textContent='▶ 继续';
      }else if(btnPause.dataset.paused==='1' && step>=6){
        btnPause.disabled=true;
        btnPause.textContent='⏸ 暂停';
        btnPause.dataset.paused='0';
      }else{
        btnPause.disabled=true;
        btnPause.textContent='⏸ 暂停';
      }
    }
    if(btnAuto){
      btnAuto.textContent=playing?'▶ 自动播放中…':'▶ 自动播放';
      btnAuto.disabled=playing;
    }
    if(btnNext) btnNext.disabled=playing || step>=6;
  }
  function paint(){
    $$('#s6Chain .s6-stage').forEach(function(st){
      var n=+st.dataset.s, on=n<=step;
      st.classList.toggle('on', on);
      if(on && n===step){
        Array.prototype.forEach.call(st.querySelectorAll('.s6-chip'),function(ch){ch.classList.remove('pulse'); void ch.offsetWidth; ch.classList.add('pulse');});
      }
    });
    $$('#s6Chain .s6-wire').forEach(function(w){
      var n=+w.dataset.w;
      var on=n<step;
      w.classList.toggle('on', on);
      if(on && n===step-1){
        var fl=w.querySelector('.flow');
        if(fl){fl.style.animation='none'; void fl.offsetWidth; fl.style.animation='';}
      }
    });
    $$('#s6Dots i').forEach(function(d,i){d.classList.toggle('on', i<step);});
    hint.innerHTML=caps[step];
    cap.textContent=step===0?'点「下一步」或「自动播放」。':(step===6?'整条链已亮。可「重来」再播。':'第 '+step+'／6 步'+(playing?' · 播放中':(btnPause&&btnPause.dataset.paused==='1'?' · 已暂停':'') ));
    syncBtns();
  }
  function clearTimer(){ if(timer){clearInterval(timer); timer=null;} }
  function next(){
    if(step>=6){ stopPlay(false); return; }
    step++; paint();
    if(step>=6) stopPlay(false);
  }
  function stopPlay(asPause){
    playing=false; clearTimer();
    if(asPause && step>0 && step<6){
      if(btnPause) btnPause.dataset.paused='1';
    }else if(!asPause){
      if(btnPause) btnPause.dataset.paused='0';
    }
    paint();
  }
  function startPlay(){
    if(playing) return;
    if(step>=6){ step=0; if(btnPause) btnPause.dataset.paused='0'; }
    playing=true; if(btnPause) btnPause.dataset.paused='0';
    paint();
    timer=setInterval(function(){ next(); }, 1400);
  }
  function reset(){ stopPlay(false); step=0; if(btnPause) btnPause.dataset.paused='0'; paint(); }
  if(btnNext) btnNext.onclick=function(){ stopPlay(false); next(); };
  if(btnReset) btnReset.onclick=reset;
  if(btnAuto) btnAuto.onclick=function(){ startPlay(); };
  if(btnPause) btnPause.onclick=function(){
    if(playing){ stopPlay(true); }
    else if(btnPause.dataset.paused==='1' && step<6){ startPlay(); }
  };
  if(btnPause) btnPause.dataset.paused='0';
  paint();
})();}catch(e){}

/* ---------- 硬件 LCALL / RETI 拆解 ---------- */
try{(function(){
  var mode='lcall', step=0, timer=null, playing=false;
  var stage=$('#lhStage'); if(!stage) return;
  var dots=$('#lhDots'), hint=$('#lhHint'), cap=$('#lhCap'), insn=$('#lhInsn'), flow=$('#lhFlow');
  var btnNext=$('#lhNext'), btnAuto=$('#lhAuto'), btnReset=$('#lhReset');
  var btnL=$('#lhModeLcall'), btnR=$('#lhModeReti');
  var lcallCaps=[
    '步 0 · 初始态：PC＝1000H 处有一条 3 字节 <b>LCALL 0003H</b>；SP＝07H；堆栈空槽。',
    '步 1 · 压入堆栈：返回地址低字节 <b>03H</b>（PC+3＝1003H 的 PCL）。先 SP←08H，再写入 @08H＝03H。',
    '步 2 · 压入堆栈：返回地址高字节 <b>10H</b>（PCH）。先 SP←09H，再写入 @09H＝10H。',
    '步 3 · 改 PC：把 LCALL 后面的 16 位目标地址写入 PC（PC←<b>0003H</b>），程序跳转到向量入口。'
  ];
  var retiCaps=[
    'RETI 初态（承接 LCALL 播完）：PC 在服务程序示意处 <b>0003H</b>；SP＝09H；栈里已有 10H／03H。',
    '步 1 · 弹出高字节：读 @SP＝@09H 得 <b>10H</b>，再 SP←08H。',
    '步 2 · 弹出低字节：读 @SP＝@08H 得 <b>03H</b>，再 SP←07H。',
    '步 3 · 恢复 PC：把弹出的高／低字节拼回（10H、03H → PC＝<b>1003H</b>），回到断点下一条。'
  ];
  var lcallPills=['初始','压 PCL','压 PCH','PC←目标'];
  var retiPills=['初态','弹 PCH','弹 PCL','PC←断点'];
  function clearTimer(){ if(timer){clearInterval(timer); timer=null;} }
  function stopPlay(){ playing=false; clearTimer(); if(btnAuto){btnAuto.disabled=false; btnAuto.textContent='▶ 自动';} }
  function setMode(m){
    stopPlay(); mode=m; step=0;
    if(btnL){btnL.classList.toggle('on', m==='lcall'); btnL.setAttribute('aria-pressed', String(m==='lcall'));}
    if(btnR){btnR.classList.toggle('on', m==='reti'); btnR.setAttribute('aria-pressed', String(m==='reti'));}
    paint();
  }
  function paint(){
    var max=3;
    var caps=mode==='lcall'?lcallCaps:retiCaps;
    var pills=mode==='lcall'?lcallPills:retiPills;
    dots.innerHTML='';
    for(var i=0;i<=max;i++){ var d=document.createElement('i'); if(i<=step) d.className='on'; dots.appendChild(d); }
    flow.innerHTML='';
    pills.forEach(function(lab,i){
      var s=document.createElement('span'); s.className='lh-pill'+(i<step?' done':'')+(i===step?' on':''); s.textContent=lab; flow.appendChild(s);
    });
    var pcEl=$('#lhPc'), spEl=$('#lhSp');
    pcEl.classList.remove('hi'); spEl.classList.remove('hi');
    $$('#lhStack .lh-slot').forEach(function(sl){sl.classList.remove('hi','filled','sp-mark');});
    var b07=$('#lhB07'), b08=$('#lhB08'), b09=$('#lhB09');
    b07.textContent='—'; b08.textContent='—'; b09.textContent='—';
    $$('#lhStack .lh-slot .tag').forEach(function(t,i){ t.textContent=['空','低字节位','高字节位'][i]; });

    if(mode==='lcall'){
      if(step===0){
        $('#lhPcV').textContent='1000H'; $('#lhSpV').textContent='07H';
        insn.innerHTML='示意：PC=<b>1000H</b> 处有一条 3 字节 <b>LCALL 0003H</b>；返回地址＝PC+3＝<b>1003H</b>';
        $$('#lhStack .lh-slot[data-a="07"]')[0].classList.add('sp-mark');
      }else if(step===1){
        $('#lhPcV').textContent='1000H'; $('#lhSpV').textContent='08H';
        insn.innerHTML='压栈中：返回地址 <b>1003H</b> 的低字节 <b>03H</b> → @08H；SP 已先加 1';
        b08.textContent='03H';
        var s8=$$('#lhStack .lh-slot[data-a="08"]')[0]; s8.classList.add('filled','hi','sp-mark');
        s8.querySelector('.tag').textContent='PCL';
        spEl.classList.add('hi');
      }else if(step===2){
        $('#lhPcV').textContent='1000H'; $('#lhSpV').textContent='09H';
        insn.innerHTML='压栈中：返回地址 <b>1003H</b> 的高字节 <b>10H</b> → @09H；SP←09H';
        b08.textContent='03H'; b09.textContent='10H';
        var s8b=$$('#lhStack .lh-slot[data-a="08"]')[0]; s8b.classList.add('filled'); s8b.querySelector('.tag').textContent='PCL';
        var s9=$$('#lhStack .lh-slot[data-a="09"]')[0]; s9.classList.add('filled','hi','sp-mark'); s9.querySelector('.tag').textContent='PCH';
        spEl.classList.add('hi');
      }else{
        $('#lhPcV').textContent='0003H'; $('#lhSpV').textContent='09H';
        insn.innerHTML='跳转完成：PC←目标地址 <b>0003H</b>（向量入口）；断点 <b>1003H</b> 已在栈顶等待 RETI';
        b08.textContent='03H'; b09.textContent='10H';
        var s8c=$$('#lhStack .lh-slot[data-a="08"]')[0]; s8c.classList.add('filled'); s8c.querySelector('.tag').textContent='PCL';
        var s9b=$$('#lhStack .lh-slot[data-a="09"]')[0]; s9b.classList.add('filled','sp-mark'); s9b.querySelector('.tag').textContent='PCH';
        pcEl.classList.add('hi');
      }
    }else{
      // RETI: start with stack full from LCALL end state
      if(step===0){
        $('#lhPcV').textContent='0003H'; $('#lhSpV').textContent='09H';
        insn.innerHTML='RETI 开始：栈顶有断点高／低字节（@09H＝<b>10H</b>，@08H＝<b>03H</b>）；PC 仍在服务区示意 <b>0003H</b>';
        b08.textContent='03H'; b09.textContent='10H';
        var r8=$$('#lhStack .lh-slot[data-a="08"]')[0]; r8.classList.add('filled'); r8.querySelector('.tag').textContent='PCL';
        var r9=$$('#lhStack .lh-slot[data-a="09"]')[0]; r9.classList.add('filled','sp-mark'); r9.querySelector('.tag').textContent='PCH';
      }else if(step===1){
        $('#lhPcV').textContent='0003H'; $('#lhSpV').textContent='08H';
        insn.innerHTML='弹栈：读出高字节 <b>10H</b>（PCH），SP←08H';
        b08.textContent='03H'; b09.textContent='—';
        var r8b=$$('#lhStack .lh-slot[data-a="08"]')[0]; r8b.classList.add('filled','sp-mark'); r8b.querySelector('.tag').textContent='PCL';
        var r9b=$$('#lhStack .lh-slot[data-a="09"]')[0]; r9b.classList.add('hi'); r9b.querySelector('.tag').textContent='已弹 PCH';
        spEl.classList.add('hi');
      }else if(step===2){
        $('#lhPcV').textContent='0003H'; $('#lhSpV').textContent='07H';
        insn.innerHTML='弹栈：读出低字节 <b>03H</b>（PCL），SP←07H';
        b08.textContent='—'; b09.textContent='—';
        var r8c=$$('#lhStack .lh-slot[data-a="08"]')[0]; r8c.classList.add('hi'); r8c.querySelector('.tag').textContent='已弹 PCL';
        $$('#lhStack .lh-slot[data-a="07"]')[0].classList.add('sp-mark');
        spEl.classList.add('hi');
      }else{
        $('#lhPcV').textContent='1003H'; $('#lhSpV').textContent='07H';
        insn.innerHTML='恢复完成：PC←<b>1003H</b>（断点下一条）；SP 回到 07H。旁注：RETI 另清优先级触发器，本图只画堆栈这一段。';
        b08.textContent='—'; b09.textContent='—';
        $$('#lhStack .lh-slot[data-a="07"]')[0].classList.add('sp-mark');
        pcEl.classList.add('hi');
      }
    }
    hint.innerHTML=caps[step];
    if(cap){
      var label=mode==='lcall'?'LCALL':'RETI';
      cap.textContent=step===0?'点「下一步」或「自动」，看 '+label+'。':(step>=max?label+' 序列播完。可切模式或「重来」。':'第 '+step+'／'+max+' 步 · '+label+(playing?' · 播放中':''));
    }
    if(btnNext) btnNext.disabled=playing || step>=max;
    if(btnAuto){ btnAuto.disabled=playing; btnAuto.textContent=playing?'▶ 自动中…':'▶ 自动'; }
  }
  function next(){
    if(step>=3){ stopPlay(); paint(); return; }
    step++; paint();
    if(step>=3) stopPlay();
  }
  function startPlay(){
    if(playing) return;
    if(step>=3) step=0;
    playing=true; paint();
    timer=setInterval(function(){ next(); }, 1500);
  }
  function reset(){ stopPlay(); step=0; paint(); }
  if(btnNext) btnNext.onclick=function(){ stopPlay(); next(); };
  if(btnAuto) btnAuto.onclick=startPlay;
  if(btnReset) btnReset.onclick=reset;
  if(btnL) btnL.onclick=function(){ setMode('lcall'); };
  if(btnR) btnR.onclick=function(){ setMode('reti'); };
  paint();
})();}catch(e){}



/* ---------- 寄存器位格 ---------- */
function drawReg(el,name,addr,bits,vals,onclick){
  el.innerHTML='<div class="nm">'+name+'</div>'+bits.map(function(b,i){var d=7-i,na=(b==='—');
    return '<div class="bit'+(na?' na':'')+(vals&&vals[i]?' one':'')+'" data-i="'+i+'"><div class="bn">D'+d+'</div><div class="bl">'+b+'</div>'+(vals?'<div class="bv">'+(vals[i]?1:0)+'</div>':'')+'</div>'}).join('')+'<div class="addr">'+addr+'</div>';
  if(onclick)$$('#'+el.id+' .bit').forEach(function(x){if(!x.classList.contains('na'))x.onclick=function(){onclick(+x.dataset.i)}});
}
try{var TCON=['TF1','TR1','TF0','TR0','IE1','IT1','IE0','IT0'];}catch(e){}
try{var IEB=['EA','—','—','ES','ET1','EX1','ET0','EX0'];}catch(e){}
try{var IPB=['—','—','—','PS','PT1','PX1','PT0','PX0'];}catch(e){}

/* ---------- ① ---------- */
try{var tocT=['① 接上第4章：LCALL','② 查询与中断','③ 5 个中断源和标志','④ TCON：触发与清零','⑤ IE：总开关和分开关','⑥ IP：优先级与嵌套','⑦ 响应条件与封锁','⑧ 响应过程单步','⑨ 按键计数总览','练 学生互动 A–D','⑪ 术语中英拼写','⑫ 例5-3 LED+INT0','⑬ 例5-1 单外中断采数','⑭ 装值计算（定时器）','⑮ 例题全览','⑯ 速记寄存器','⑰ 课末测试','⑱ 全复习','⑲ GATE 计时窗口','⑳ 例5-3整页源码'];}catch(e){}
try{var tocS=['中断响应就是硬件执行了一次 LCALL','CPU 去看 / 外设来叫','外0、定0、外1、定1、串口','IT0、IE0、TI/RI 谁来清','EA + 5 个分开关','先比级别，再比自然顺序','三个条件，三种封锁','PC、SP、堆栈一步步看','一张图串起整节课','门铃对决 / 谁替你 LCALL / 拼字节 / 选哪种','中文 · 英文全称 · 缩写','八灯移位 + 模拟 INT0 服务','课件30–31页 / P99 · INT0 采数入外 RAM','方式1/0/2 初值公式与练习','课件例题卡片（含重号说明）','TCON→IE→IP 记忆链与位图','即时对错 + 装值计算器','必会重点 + 易错难点总复习','GATE 门控：计时窗口开合','PPT 25+27–29 整页源码墙'];}catch(e){}
try{var tocGroups=[
  {title:'第 1 次课 · 中断入门', panes:LESSONS.a},
  {title:'第 2 次课 · 案例与练习', panes:LESSONS.b},
  {title:'第 3 次课 · 定时与收口', panes:LESSONS.c}
];}catch(e){}
try{$('#toc').innerHTML=tocGroups.map(function(group){
  var cards=group.panes.map(function(pane){
    var index=pane-1;
    return '<button data-g="'+pane+'"><b>'+tocT[index]+'</b>'+tocS[index]+'</button>';
  }).join('');
  return '<div class="toc-h">'+group.title+'</div><div class="toc-grid">'+cards+'</div>';
}).join('');}catch(e){}
try{$$('#toc button').forEach(function(b){b.onclick=function(){show(+b.dataset.g)}});}catch(e){}
try{var LC=['主程序执行 LCALL','PC 压栈（断点）','转到子程序','执行子程序','RET：弹回 PC','回到主程序'];}catch(e){}
try{var IR=['按键：IE0 置 1','硬件执行 LCALL','PC 压栈（断点）','转到 0003H','执行服务程序','RETI：弹回 PC，清优先级触发器','回到主程序'];}catch(e){}
function flowAnim(el,arr){el.innerHTML=arr.map(function(s){return '<span>'+s+'</span>'}).join('');var sp=el.children,i=0;
  (function nx(){for(var k=0;k<sp.length;k++)sp[k].classList.toggle('cur',k===i);i++;if(i<=sp.length)setTimeout(nx,700)})();}
try{$('#lcFlow').innerHTML=LC.map(function(s){return '<span>'+s+'</span>'}).join('');}catch(e){}
try{$('#irFlow').innerHTML=IR.map(function(s){return '<span>'+s+'</span>'}).join('');}catch(e){}
try{$('#lcGo').onclick=function(){flowAnim($('#lcFlow'),LC)};}catch(e){}
try{$('#irGo').onclick=function(){flowAnim($('#irFlow'),IR)};}catch(e){}

/* ---------- ② ---------- */
try{var TL={t:0,timer:null,key:-1,doneQ:-1,doneI:-1,wq:0,wi:0};}catch(e){}
try{var SLOT=48,N=24;}catch(e){}
function tlReset(){clearInterval(TL.timer);TL={t:0,timer:null,key:-1,doneQ:-1,doneI:-1,wq:0,wi:0};$('#laneQ').innerHTML='';$('#laneI').innerHTML='';['#wq','#wi'].forEach(function(s){$(s).textContent=0});$('#dq').textContent='—';$('#di').textContent='—';}
function blk(lane,t,cls,txt){var d=document.createElement('div');d.className='blk '+cls;d.style.left=(t*SLOT+2)+'px';d.style.width=(SLOT-4)+'px';d.textContent=txt;lane.appendChild(d)}
function tick(){
  var t=TL.t;if(t>=N){clearInterval(TL.timer);return}
  // 查询：每 4 格问一次，其余格干活；发现后处理 2 格
  var q=$('#laneQ'),ii=$('#laneI');
  if(TL.key>=0&&TL.doneQ<0&&t%4===0&&t>=TL.key){TL.doneQ=t;$('#dq').textContent=(t-TL.key)+' 格'}
  if(TL.doneQ>=0&&t<TL.doneQ+2)blk(q,t,'b-isr','处理');
  else if(t%4===0)blk(q,t,'b-ask','到了吗');
  else if(t%4===1)blk(q,t,'b-ask','到了吗');
  else{blk(q,t,'b-main','主程序');TL.wq++}
  // 中断：一直干活，按键后下一格处理 2 格
  if(TL.key>=0&&TL.doneI<0&&t>=TL.key){TL.doneI=t;$('#di').textContent=(t-TL.key)+' 格'}
  if(TL.doneI>=0&&t<TL.doneI+2)blk(ii,t,'b-isr','服务');
  else{blk(ii,t,'b-main','主程序');TL.wi++}
  $('#wq').textContent=TL.wq;$('#wi').textContent=TL.wi;TL.t++;
}
try{$('#tlStart').onclick=function(){if(TL.timer)clearInterval(TL.timer);if(TL.t>=N)tlReset();TL.timer=setInterval(tick,450)};}catch(e){}
try{$('#tlReset').onclick=tlReset;}catch(e){}
try{$('#tlKey').onclick=function(){if(TL.key>=0||TL.t>=N)return;if(!TL.timer)$('#tlStart').click();TL.key=TL.t;
  [$('#laneQ'),$('#laneI')].forEach(function(l){var d=document.createElement('div');d.className='blk b-ev';d.style.left=(TL.key*SLOT)+'px';l.appendChild(d)})};}catch(e){}

/* ---------- ③ ---------- */
try{var SRC=[['外部中断 0','INT0','IE0','TCON.1','P3.2 引脚'],['定时器 T0','T0','TF0','TCON.5','T0 溢出'],['外部中断 1','INT1','IE1','TCON.3','P3.3 引脚'],['定时器 T1','T1','TF1','TCON.7','T1 溢出'],['串行口','串口','RI / TI','SCON','收完或发完一帧']];}catch(e){}
try{var s3=[0,0,0,0,0];}catch(e){}
function draw3(){
  $('#srcs').innerHTML=SRC.map(function(s,i){return '<button class="src'+(s3[i]?' lit':'')+'" data-i="'+i+'"><div class="lamp"></div><div class="t">'+s[0]+'</div><div class="f">'+s[2]+' = '+(s3[i]?1:0)+'</div><div class="r">'+s[3]+' · '+s[4]+'</div></button>'}).join('');
  $$('#srcs .src').forEach(function(b){b.onclick=function(){s3[+b.dataset.i]=1;draw3()}});
  var v=[s3[3],0,s3[1],0,s3[2],0,s3[0],0];
  drawReg($('#s3tcon'),'TCON','88H',TCON,v);
  [0,2,4,6].forEach(function(i){if(v[i])$$('#s3tcon .bit')[i].classList.add('flash')});
}
try{$('#srcClr').onclick=function(){s3=[0,0,0,0,0];draw3()};}catch(e){}

/* ---------- ④ ---------- */
try{var S4={it0:1,pin:1,ie0:0,cnt:0,busy:false,ri:0,cri:0,riTimer:null};}catch(e){}
function draw4(){
  var v=[0,0,0,0,0,0,S4.ie0,S4.it0];drawReg($('#s4tcon'),'TCON','88H',TCON,v);
  $$('#s4tcon .bit')[7].classList.add('flash');if(S4.ie0)$$('#s4tcon .bit')[6].classList.add('flash');
  $('#it0b').textContent=S4.it0?'IT0 = 1（下降沿触发）':'IT0 = 0（低电平触发）';
  $('#pin4').textContent=S4.pin?'1（高）':'0（低，键按下）';$('#cnt4').textContent=S4.cnt;
  $('#ri4').textContent=S4.ri;$('#cntRI').textContent=S4.cri;
}
function serve4(){ // CPU 响应一次
  if(S4.busy||!S4.ie0)return;S4.busy=true;
  setTimeout(function(){
    S4.cnt++;
    if(S4.it0){S4.ie0=0;$('#msg4').innerHTML='下降沿触发：响应后 <b>IE0 由硬件自动清零</b>，按住不放也只算一次。'}
    else{S4.ie0=S4.pin?0:1;$('#msg4').innerHTML='低电平触发：IE0 不自动清零，跟着引脚走。<b>键还按着，返回后又进中断</b>。'}
    draw4();
    setTimeout(function(){S4.busy=false;if(S4.ie0)serve4()},500);
  },350);
}
function press4(d){
  if(d){if(S4.pin===1){S4.pin=0;S4.ie0=1;}} else {S4.pin=1;if(!S4.it0)S4.ie0=0;}
  draw4();if(S4.ie0)serve4();
}
try{var k4=$('#k4');}catch(e){}
try{k4.addEventListener('pointerdown',function(e){e.preventDefault();k4.classList.add('down');press4(1)});}catch(e){}
try{['pointerup','pointerleave'].forEach(function(ev){k4.addEventListener(ev,function(){if(S4.pin===0){k4.classList.remove('down');press4(0)}})});}catch(e){}
function syncCap4(){
  var el=$('#cap4'); if(!el) return;
  if(S4.it0){
    el.innerHTML='点按 vs 按住（当前为 <b>下降沿 IT0=1</b>）：点按一次 → 服务 1 次；按住不放 → 仍只服务 1 次（IE0 已硬件清零，本次按住不再锁存新边沿）。';
  }else{
    el.innerHTML='点按 vs 按住（当前为 <b>低电平 IT0=0</b>）：点按（很快松开）→ 可能只服务 1 次；按住不放 → 服务次数持续增加（IE0 不自动清，引脚仍低则 RETI 后再进）。';
  }
}
try{$('#it0b').onclick=function(){S4.it0^=1;S4.cnt=0;S4.ie0=0;$('#msg4').textContent=S4.it0?'下降沿触发：点按一下，再按住不放，比较服务次数。':'低电平触发：按住不放，看服务次数怎么变。';draw4();syncCap4()};}catch(e){}
try{syncCap4();}catch(e){}
function riLoop(){clearTimeout(S4.riTimer);if(!S4.ri)return;S4.riTimer=setTimeout(function(){if(!S4.ri)return;S4.cri++;draw4();$('#msgRI').innerHTML='RI 还是 1，返回后 CPU 又看到请求，<b class="bad">再次进入服务程序</b>。';riLoop()},700)}
try{$('#rxb').onclick=function(){S4.ri=1;S4.cri=0;draw4();riLoop()};}catch(e){}
try{$('#clrRI').onclick=function(){S4.ri=0;clearTimeout(S4.riTimer);draw4();$('#msgRI').innerHTML='<b class="ok">服务程序里执行 CLR RI 后，不再重复进入。</b>'};}catch(e){}

/* ---------- ⑤ ---------- */
try{var IEv=0;}catch(e){}
try{var IEsrc=[['外部中断 0（INT0）',0],['定时器 T0',1],['外部中断 1（INT1）',2],['定时器 T1',3],['串行口',4]];}catch(e){}
function draw5(){
  var bits=[];for(var i=0;i<8;i++)bits.push((IEv>>(7-i))&1);
  drawReg($('#ieReg'),'IE','A8H',IEB,bits,function(i){IEv^=1<<(7-i);draw5()});
  $('#ieHex').textContent=hex2(IEv);$('#ieBin').textContent=bin8(IEv);
  var ea=IEv>>7&1;
  $('#ieList').innerHTML=IEsrc.map(function(s){var on=IEv>>s[1]&1,y=on&&ea;
    return '<div class="st '+(y?'y':'n')+'"><span>'+s[0]+'</span><span>'+(y?'能响应':(on?'分开关开，但 EA = 0':'禁止'))+'</span></div>'}).join('');
}
try{$$('[data-ie]').forEach(function(b){b.onclick=function(){IEv=+b.dataset.ie;draw5()}});}catch(e){}

/* ---------- ⑥ ---------- */
try{var IPv=0;}catch(e){}try{var NM=['INT0','T0','INT1','T1','串口'];}catch(e){}try{var IPbit=[0,1,2,3,4];}catch(e){} // PX0 PT0 PX1 PT1 PS
function lvl(i){return IPv>>IPbit[i]&1}
function draw6(){
  var bits=[];for(var i=0;i<8;i++)bits.push((IPv>>(7-i))&1);
  drawReg($('#ipReg'),'IP','B8H',IPB,bits,function(i){IPv^=1<<(7-i);draw6()});
  $('#ipHex').textContent=hex2(IPv);
}
try{['#ipA','#ipB'].forEach(function(s,k){$(s).innerHTML=NM.map(function(n,i){return '<option value="'+i+'"'+((k===0&&i===1)||(k===1&&i===2)?' selected':'')+'>'+n+'</option>'}).join('')});}catch(e){}
function L(i){return NM[i]+'（'+(lvl(i)?'高':'低')+'）'}
try{$('#ipSim').onclick=function(){var a=+$('#ipA').value,b=+$('#ipB').value;if(a===b){$('#ipWhy1').textContent='请选两个不同的中断源。';return}
  var first,why;
  if(lvl(a)!==lvl(b)){first=lvl(a)>lvl(b)?a:b;why='两者级别不同，先响应高优先级的 '+NM[first]+'。'}
  else{first=Math.min(a,b);why='两者同级，按自然顺序 INT0 > T0 > INT1 > T1 > 串口，先响应 '+NM[first]+'。'}
  var second=first===a?b:a;
  var el=$('#ipOut1');el.innerHTML='<span>'+L(a)+' + '+L(b)+' 同时请求</span><span>先响应 '+NM[first]+'</span><span>'+NM[first]+' 的 RETI</span><span>再响应 '+NM[second]+'</span>';
  var sp=el.children,i=0;(function nx(){for(var k=0;k<sp.length;k++)sp[k].classList.toggle('cur',k===i);i++;if(i<=sp.length)setTimeout(nx,700)})();
  $('#ipWhy1').textContent=why;};}catch(e){}
try{$('#ipNest').onclick=function(){var a=+$('#ipA').value,b=+$('#ipB').value;if(a===b){$('#ipWhy2').textContent='请选两个不同的中断源。';return}
  var can=lvl(b)===1&&lvl(a)===0;var el=$('#ipOut2');
  el.innerHTML=can?'<span>正在服务 '+L(a)+'</span><span>'+L(b)+' 请求</span><span>打断，先服务 '+NM[b]+'</span><span>RETI 回到 '+NM[a]+'</span>':'<span>正在服务 '+L(a)+'</span><span>'+L(b)+' 请求</span><span>不能打断，等待</span><span>'+NM[a]+' RETI 后再响应 '+NM[b]+'</span>';
  var sp=el.children,i=0;(function nx(){for(var k=0;k<sp.length;k++)sp[k].classList.toggle('cur',k===i);i++;if(i<=sp.length)setTimeout(nx,700)})();
  $('#ipWhy2').textContent=can?'低优先级的服务可以被高优先级中断打断（两级嵌套）。':(lvl(a)===1?'正在服务的是高优先级中断，任何中断都不能打断它。':'两者同为低优先级，同级不能打断同级，自然顺序在这里不起作用。');};}catch(e){}
try{$('#ip05').onclick=function(){IPv=5;draw6()};}catch(e){}try{$('#ip00').onclick=function(){IPv=0;draw6()};}catch(e){}

/* ---------- ⑦ ---------- */
function draw7(){
  var c=[$('#c1').checked,$('#c2').checked,$('#c3').checked],b=[$('#b1').checked,$('#b2').checked,$('#b3').checked];
  var cN=['没有中断请求','EX0 = 0，该源未允许','EA = 0，CPU 关中断'];
  var bN=['CPU 正在处理同级或更高优先级的中断：等它 RETI 之后','当前指令还没执行完：等到最后一个机器周期','正在执行 RETI 或访问 IE、IP 的指令：执行完后还要再执行一条指令'];
  var miss=c.map(function(x,i){return x?null:cN[i]}).filter(Boolean);
  var blk=b.map(function(x,i){return x?bN[i]:null}).filter(Boolean);
  if(miss.length){$('#r7').innerHTML='<span class="bad">不响应</span>';$('#w7').innerHTML='条件不满足：'+miss.join('；')+'。'}
  else if(blk.length){$('#r7').innerHTML='<span class="gold">请求等待中…</span>';$('#w7').innerHTML='被封锁：<br>'+blk.join('<br>')+'<br>本次查询结果丢弃，下一个机器周期重新查询。'}
  else{$('#r7').innerHTML='<span class="ok">响应：硬件 LCALL 0003H</span>';$('#w7').textContent='三个条件都满足，也没有被封锁。'}
}
try{$$('#p7 input').forEach(function(x){x.onchange=draw7});}catch(e){}
// 响应时间时间轴（教材 P97–98）
try{var T7=[
 {seg:[['查询标志',1,'#67e8f9'],['硬件 LCALL',2,'#fcd34d']],f:'1 + 2 = 3',w:'1 个周期查询中断标志，2 个周期执行硬件 LCALL。任何中断都少不了这 3 个。'},
 {seg:[['RETI（剩余）',2,'#fda4af'],['再执行 1 条',1,'#c4b5fd'],['硬件 LCALL',2,'#fcd34d']],f:'2 + 1 + 2 = 5',w:'查询时正碰上 RETI：RETI 执行完，还要再执行 1 条指令才能响应。这里假设那条是单周期指令。<span class="gold">此例是按教材规则推出来的，书上没有直接给这个数，待核对。</span>'},
 {seg:[['RETI 或访问 IE、IP',2,'#fda4af'],['接着是 MUL/DIV',4,'#c4b5fd'],['硬件 LCALL',2,'#fcd34d']],f:'2 + 4 + 2 = 8',w:'RETI 或访问 IE、IP 的指令最多 2 个周期；接着那条若是乘除，要 4 个周期；再加 LCALL 2 个。教材按这三段相加得 8。<span class="gold">查询那 1 个周期教材在这里没有单独计入，图 5-3 的细节待核对。</span>'}];}catch(e){}
try{var t7i=0,t7tm=null;}catch(e){}
function t7Draw(n){var c=T7[t7i],h='',k=0,tot=0;c.seg.forEach(function(g){tot+=g[1]});
  c.seg.forEach(function(g){for(var j=0;j<g[1];j++){var on=k<n;h+='<div style="width:84px;height:62px;border-radius:7px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-size:13px;transition:.3s;border:1px solid '+(on?g[2]:'rgba(255,255,255,.12)')+';background:'+(on?g[2]+'33':'rgba(255,255,255,.03)')+';opacity:'+(on?1:.45)+'"><b class="mono" style="font-size:18px">C'+(k+1)+'</b><span>'+(j===0?g[0]:'')+'</span></div>';k++}});
  $('#t7Bar').innerHTML=h;$('#t7N').textContent=Math.min(n,tot);$('#t7F').textContent=n>=tot?'（'+c.f+'）':'';$('#t7W').innerHTML=n>=tot?c.w+'<br>正在处理同级或更高级中断时，要等那个服务程序做完，响应时间就算不出来了。':''}
function t7Play(){clearTimeout(t7tm);var tot=0;T7[t7i].seg.forEach(function(g){tot+=g[1]});var n=0;(function f(){t7Draw(n);if(n<tot){n++;t7tm=setTimeout(f,450)}})()}
try{$$('[data-t7]').forEach(function(b){b.onclick=function(){t7i=+b.dataset.t7;$$('[data-t7]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});t7Play()}});}catch(e){}
try{$('#t7Play').onclick=t7Play;}catch(e){}
try{(function(){var tot=0;T7[0].seg.forEach(function(g){tot+=g[1]});t7Draw(tot)})();}catch(e){}

/* ---------- ⑧ ---------- */
// 原 13 步：pc, sp, stack{addr:val}, r2, ff, msg（按 SP=07H 写，换 SP 初值时整体平移）
try{var ST=[
 ['主程序运行','0100H',0x07,{},0,'0','主程序正在执行地址 0100H 的指令（2 字节），下一条在 0102H。'],
 ['按键：IE0 置 1，满足响应条件','0100H',0x07,{},0,'0','当前指令执行完，CPU 查到 IE0 = 1，EX0、EA 都为 1。'],
 ['优先级状态触发器置 1','0102H',0x07,{},0,'1（低级）','阻断同级和更低级的中断。断点 = 0102H。'],
 ['硬件 LCALL：断点压栈','0102H',0x09,{8:'02H',9:'01H'},0,'1（低级）','先压 PCL = 02H 到 @1，再压 PCH = 01H 到 @2。'],
 ['PC = 0003H（INT0 入口）','0003H',0x09,{8:'02H',9:'01H'},0,'1（低级）','入口只有 8 个字节（0003H～000AH）。'],
 ['LJMP INT0_ISR：跳到服务程序','0200H',0x09,{8:'02H',9:'01H'},0,'1（低级）','服务程序放在别处，这里设为 0200H。'],
 ['PUSH ACC','0202H',0x0A,{8:'02H',9:'01H',10:'A=35H'},0,'1（低级）','保护累加器 A（A 的值为示意）。'],
 ['PUSH PSW','0204H',0x0B,{8:'02H',9:'01H',10:'A=35H',11:'PSW=00H'},0,'1（低级）','保护 PSW。硬件只保护 PC，这两步要自己写。'],
 ['INC R2：计数加 1','0206H',0x0B,{8:'02H',9:'01H',10:'A=35H',11:'PSW=00H'},1,'1（低级）','数码管要显示的数加 1。'],
 ['POP PSW','0208H',0x0A,{8:'02H',9:'01H',10:'A=35H'},1,'1（低级）','按相反顺序恢复：先进后出。'],
 ['POP ACC','020AH',0x09,{8:'02H',9:'01H'},1,'1（低级）','A 恢复为原值。'],
 ['RETI：弹回断点，清触发器','0102H',0x07,{},1,'0','先弹 PCH，再弹 PCL，PC = 0102H；同时把优先级状态触发器清零。'],
 ['回到主程序断点继续','0102H',0x07,{},1,'0','主程序从被打断的地方接着执行。']];}catch(e){}
try{var S8={mode:0,sp0:0x07,noPsw:false,i:0,tm:null,tr:null};}catch(e){}
function h4w(n){var t=n.toString(16).toUpperCase();while(t.length<4)t='0'+t;return t+'H'}
function par8(v){var n=0;for(var k=0;k<8;k++)n+=(v>>k)&1;return n&1}
// 带数值的轨迹：主程序算 12F0H + 0130H，低字节 ADD、高字节 ADDC；做完低字节时来了 INT0
function trBuild(){
  var s={pc:0x0100,sp:S8.sp0,A:0,CY:0,AC:0,OV:0,m30:0x05,m50:null,m51:null,stk:{}},out=[];
  function psw(){return (s.CY<<7)|(s.AC<<6)|(s.OV<<2)|par8(s.A)}
  function add(v,c){var a=s.A,r=a+v+c;s.AC=((a&15)+(v&15)+c)>15?1:0;var c7=((a&127)+(v&127)+c)>127?1:0;s.CY=r>255?1:0;s.OV=c7^s.CY;s.A=r&255}
  function snap(t,where,msg,chg){var o=JSON.parse(JSON.stringify(s));o.t=t;o.where=where;o.msg=msg;o.chg=chg||[];o.psw=psw();out.push(o)}
  snap('（开始）','主','主程序要算 12F0H + 0130H：低字节 F0H + 30H 用 ADD，高字节 12H + 01H 用 ADDC，把低字节的进位接上。');
  s.A=0xF0;s.pc=0x0102;snap('MOV A,#0F0H','主','A = F0H。',['A']);
  add(0x30,0);s.pc=0x0104;snap('ADD A,#30H','主','F0H + 30H = 120H：A = 20H，CY = 1。这个 1 要留给高字节。',['A','CY']);
  s.m50=s.A;s.pc=0x0106;snap('MOV 50H,A','主','低字节 20H 存进 50H。就在这条执行时，INT0 来了（IE0 = 1）。',['m50']);
  s.sp++;s.stk[s.sp]='断点低 8 位 06H';s.sp++;s.stk[s.sp]='断点高 8 位 01H';s.pc=0x0003;
  snap('LCALL 0003H','硬件','这条指令做完才响应。断点 0106H 压栈：先 06H，再 01H。此刻 CY = 1 还在 PSW 里。',['SP','PC']);
  s.pc=0x0200;snap('LJMP INT0_ISR','入口','入口 0003H 只有 8 字节，跳到 0200H 的服务程序。',['PC']);
  s.sp++;s.stk[s.sp]='A = '+hex2(s.A);s.pc=0x0202;snap('PUSH ACC','服','保护 A = 20H。',['SP']);
  var sv=null;if(!S8.noPsw){var p=psw();sv=p;s.sp++;s.stk[s.sp]='PSW = '+hex2(p)+'（CY = '+s.CY+'）';s.pc=0x0204;snap('PUSH PSW','服','保护 PSW = '+hex2(p)+'，里面有 CY = 1。',['SP'])}
  else{snap('（这里漏了 PUSH PSW）','服','少写了一条：PSW 没进栈，CY = 1 没人保管。',[])}
  var b=S8.noPsw?0x0202:0x0204;
  s.A=s.m30;s.pc=b+2;snap('MOV A,30H','服','服务程序给 30H 里的计数加 1，先取出来：A = '+hex2(s.A)+'。',['A']);
  add(0x01,0);s.pc=b+4;snap('ADD A,#01H','服','05H + 01H = 06H，没有进位：CY 被改成 0。主程序留下的那个 1 就这样被覆盖了。',['A','CY']);
  s.m30=s.A;s.pc=b+6;snap('MOV 30H,A','服','计数存回 30H。',['m30']);
  if(!S8.noPsw){var top=s.sp;s.sp--;var pv=sv;s.CY=pv>>7&1;s.AC=pv>>6&1;s.OV=pv>>2&1;delete s.stk[top];s.pc=b+8;snap('POP PSW','服','PSW 弹回 '+hex2(pv)+'：CY 又变回 '+s.CY+'。',['SP','CY'])}
  else{snap('（这里也没有 POP PSW）','服','CY 还是服务程序留下的 0。',[])}
  var bb=S8.noPsw?b+6:b+8;
  s.A=0x20;delete s.stk[s.sp];s.sp--;s.pc=bb+2;snap('POP ACC','服','A 恢复为 20H。',['A','SP']);
  delete s.stk[s.sp];s.sp--;delete s.stk[s.sp];s.sp--;s.pc=0x0106;snap('RETI','服','弹回断点 0106H，SP 回到 '+hex2(S8.sp0)+'，清优先级状态触发器。',['PC','SP']);
  s.A=0x12;s.pc=0x0108;snap('MOV A,#12H','主','回到主程序算高字节：A = 12H。',['A']);
  var cin=s.CY;add(0x01,cin);s.pc=0x010A;snap('ADDC A,#01H','主','12H + 01H + CY('+cin+') = '+hex2(s.A)+(cin?'。进位接上了。':'。CY 是 0，进位丢了。'),['A','CY']);
  s.m51=s.A;s.pc=0x010C;snap('MOV 51H,A','主','高字节存进 51H。51H:50H = '+h4w((s.m51<<8)|s.m50)+'，应为 1420H。',['m51']);
  return out}
function stTot(){return S8.mode?S8.tr.length:ST.length}
function spRow(a,top,txt){var r1=S8.sp0===0x07&&a>=8&&a<=15?' <span class="r1">第1组 R'+(a-8)+'</span>':'';
  return '<div class="'+(top?'top':'')+'"><span>'+hex2(a)+(top?' ← SP':'')+r1+'</span><span>'+(a===S8.sp0&&!txt?'<span class="sub">栈底</span>':(txt||''))+'</span></div>'}
function drawSt(){var i=S8.i,off=S8.sp0-7,h='',a;
  $('#stPrev').disabled=i===0;$('#stNext').disabled=i===stTot()-1;
  $('#stSpNote').innerHTML=S8.sp0===0x07?'<span class="bad">SP = 07H：栈从 08H 开始放，正好占了第 1 组工作寄存器 R0～R7（08H～0FH）。程序一旦切到第 1 组，断点和保护的数据会被冲掉。</span>':'SP = 60H：栈放在 61H 以上的普通 RAM，避开了 4 组工作寄存器（00H～1FH）和位寻址区（20H～2FH）。';
  if(!S8.mode){var s=ST[i];
    $('#stListH').textContent='步骤';
    $('#stList').innerHTML=ST.map(function(x,k){return '<li class="'+(k===i?'cur':k<i?'done':'')+'">'+x[0]+'</li>'}).join('');
    $('#stPC').textContent=s[1];$('#stSP').textContent=hex2(s[2]+off);
    $('#stRegs').innerHTML='R2（计数）= <b class="mono gold">'+s[4]+'</b> · 优先级状态触发器：<b class="mono">'+s[5]+'</b>';
    $('#stMsg').textContent=s[6].replace('@1',hex2(8+off)).replace('@2',hex2(9+off));
    for(a=S8.sp0+4;a>=S8.sp0;a--)h+=spRow(a,a===s[2]+off,s[3][a-off]);
    $('#stRes').innerHTML='';
  }else{var t=S8.tr[i],c=t.chg;
    $('#stListH').textContent='逐条执行（主：主程序　服：服务程序）';
    $('#stList').innerHTML=S8.tr.map(function(x,k){return k?'<li class="'+(k===i?'cur':k<i?'done':'')+'"'+(/漏|没有/.test(x.t)?' style="color:var(--rose300)"':'')+'><span class="mono">'+x.where+'</span> '+x.t+'</li>':''}).join('');
    $('#stPC').textContent=h4w(t.pc);$('#stSP').textContent=hex2(t.sp);
    function v(k,lab,val){return '<span style="display:inline-block;min-width:104px;margin:2px 6px 2px 0;padding:2px 6px;border-radius:5px;'+(c.indexOf(k)>=0?'background:rgba(252,211,77,.22);outline:1px solid #fcd34d':'')+'">'+lab+' = <b class="mono gold">'+val+'</b></span>'}
    $('#stRegs').innerHTML=v('A','A',hex2(t.A))+v('CY','CY',t.CY)+v('PSW','PSW',hex2(t.psw))+'<br>'+v('m30','(30H)',hex2(t.m30))+v('m50','(50H)',t.m50==null?'—':hex2(t.m50))+v('m51','(51H)',t.m51==null?'—':hex2(t.m51));
    $('#stMsg').textContent=t.msg;
    for(a=S8.sp0+4;a>=S8.sp0;a--)h+=spRow(a,a===t.sp,t.stk[a]);
    if(i===stTot()-1){var r=(t.m51<<8)|t.m50,ok=r===0x1420;$('#stRes').innerHTML='结果 51H:50H = <b class="mono '+(ok?'ok':'bad')+'">'+h4w(r)+'</b>，应为 <b class="mono">1420H</b>。'+(ok?'服务程序把 PSW 存了又取回，主程序感觉不到被打断过。':'服务程序里的 ADD 改了 CY，又没把 PSW 恢复，主程序的 ADDC 少加了 1。')}
    else $('#stRes').innerHTML='';
  }
  $('#stStack').innerHTML=h}
function stAutoStop(){if(S8.tm){clearTimeout(S8.tm);S8.tm=null}$('#stAuto').textContent='▶ 自动连播'}
function stepGo(d){S8.i=Math.max(0,Math.min(stTot()-1,S8.i+d));drawSt()}
function stRebuild(keep){stAutoStop();S8.tr=trBuild();if(!keep)S8.i=0;S8.i=Math.min(S8.i,stTot()-1);
  $('#stM0').setAttribute('aria-pressed',!S8.mode);$('#stM1').setAttribute('aria-pressed',!!S8.mode);
  $('#stS07').setAttribute('aria-pressed',S8.sp0===7);$('#stS60').setAttribute('aria-pressed',S8.sp0===0x60);
  $('#stPswW').style.display=S8.mode?'':'none';drawSt()}
try{$('#stNext').onclick=function(){stAutoStop();stepGo(1)};}catch(e){}try{$('#stPrev').onclick=function(){stAutoStop();stepGo(-1)};}catch(e){}try{$('#stReset').onclick=function(){stAutoStop();S8.i=0;drawSt()};}catch(e){}
try{$('#stAuto').onclick=function(){if(S8.tm){stAutoStop();return}if(S8.i>=stTot()-1)S8.i=0;drawSt();this.textContent='⏸ 暂停';
  (function t(){S8.tm=setTimeout(function(){stepGo(1);if(S8.i>=stTot()-1){S8.tm=null;$('#stAuto').textContent='▶ 自动连播';return}t()},1400)})()};}catch(e){}
try{$('#stM0').onclick=function(){S8.mode=0;stRebuild()};}catch(e){}try{$('#stM1').onclick=function(){S8.mode=1;stRebuild()};}catch(e){}
try{$('#stS07').onclick=function(){S8.sp0=0x07;stRebuild(1)};}catch(e){}try{$('#stS60').onclick=function(){S8.sp0=0x60;stRebuild(1)};}catch(e){}
try{$('#stNoPsw').onchange=function(){S8.noPsw=this.checked;stRebuild()};}catch(e){}
try{stRebuild();}catch(e){}

/* ---------- ⑨ ---------- */
try{var ASM=["ORG 0000H","LJMP MAIN","ORG 0003H","LJMP INT0_ISR","ORG 0040H","MAIN:","\tSETB IT0     ","    SETB EX0      ","    SETB EA       ","    SETB PX0","\tMOV R1,#10","\tMOV\tR2,#0","\tMOV\tDPTR,#TAB","\tMOV\tP0,#0C0H   \t","    SJMP $ ","","","INT0_ISR:","\tLCALL DELAY","\tJB P3.2,TT","\tINC\tR2\t","\tDJNZ R1,NT0","\tMOV R1,#10 ","\tMOV\tR2,#0","NT0:MOV\tA,R2","\tMOVC A,@A+DPTR","\tMOV\tP0,A","TT:RETI","","DELAY:","\tMOV R6,#0FFH","DELAY1:","\tMOV R7,#0FFH","DELAY2:","\tDJNZ R7,DELAY2","\tDJNZ R6,DELAY1","\tRET","TAB:DB 0xc0,0xf9,0xa4,0xb0,0x99,0x92,0x82,0xf8,0x80,0x90","END"];}catch(e){}
try{var TAB=[0xc0,0xf9,0xa4,0xb0,0x99,0x92,0x82,0xf8,0x80,0x90];}catch(e){}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\t/g,'    ')}
try{$('#code9').innerHTML=ASM.map(function(l,i){return '<div id="L'+i+'"><span class="ln">'+(i+1)+'</span>'+esc(l)+'</div>'}).join('');}catch(e){}
try{var C9={r1:10,r2:0,p0:0xc0,busy:false,slow:true};}catch(e){}
function seg(v){['a','b','c','d','e','f','g'].forEach(function(n,k){$('#seg .'+n).classList.toggle('on',!((v>>k)&1))})}
function hl(i){$$('#code9 div').forEach(function(d){d.classList.remove('hl')});if(i>=0){var e=$('#L'+i);e.classList.add('hl');var c=$('#code9');c.scrollTop=Math.max(0,e.offsetTop-c.clientHeight/2)}}
function draw9(){seg(C9.p0);$('#p0v').textContent=hex2(C9.p0);$('#r2v').textContent=C9.r2;$('#r1v').textContent=C9.r1}
try{var F9=['按键：IE0=1','LCALL 0003H','LJMP INT0_ISR','消抖','R2+1','查表送 P0','RETI'];}catch(e){}
function flow9(k){$('#flow9').innerHTML=F9.map(function(s,i){return '<span class="'+(i===k?'cur':'')+'">'+s+'</span>'}).join('')}
try{$('#k9').onclick=function(){if(C9.busy)return;C9.busy=true;var wrap=false;
  var seq=[[14,0],[2,1],[3,2],[17,2],[18,3],[19,3],[20,4,function(){C9.r2++;}],[21,4,function(){C9.r1--;wrap=C9.r1===0;}]];
  var tail=function(){var t=[];if(wrap){t.push([22,4,function(){C9.r1=10}]);t.push([23,4,function(){C9.r2=0}])}
    t.push([24,5]);t.push([25,5]);t.push([26,5,function(){C9.p0=TAB[C9.r2]}]);t.push([27,6]);t.push([14,-1]);return t};
  var i=0,dt=C9.slow?650:160,added=false;
  (function nx(){if(i>=seq.length&&!added){seq=seq.concat(tail());added=true}
    if(i>=seq.length){C9.busy=false;hl(14);flow9(-1);return}
    var s=seq[i++];if(s[2])s[2]();hl(s[0]);flow9(s[1]);draw9();setTimeout(nx,dt)})();};}catch(e){}
try{$('#sp9').onclick=function(){C9.slow=!C9.slow;this.textContent=C9.slow?'动画：慢':'动画：快'};}catch(e){}
try{$('#rs9').onclick=function(){C9={r1:10,r2:0,p0:0xc0,busy:false,slow:C9.slow};hl(14);flow9(-1);draw9()};}catch(e){}

/* ---------- ⑥ 嵌套时间线 ---------- */
/* ---------- ⑥ 两级嵌套时间线 ---------- */
try{var NZ=(function(){
function h2(n){return (n<16?'0':'')+n.toString(16).toUpperCase()+'H'}
function h4(n){var s=n.toString(16).toUpperCase();while(s.length<4)s='0'+s;return s+'H'}
function par(a){var c=0;for(var i=0;i<8;i++)c+=(a>>i)&1;return c&1}
/* 程序：地址 → [长度, 文本, 执行, 说明] */
function prog(cfg){
  var P={};
  function d(a,n,t,f,m){P[a]={n:n,t:t,f:f,m:m}}
  d(0x000B,3,'LJMP  T0_ISR',function(s){s.pc=0x0200},'T0 入口只有 8 个字节，放一条 LJMP 跳到 0200H。');
  d(0x0013,3,'LJMP  X1_ISR',function(s){s.pc=0x0300},'INT1 入口，LJMP 跳到 0300H。');
  d(0x0100,2,'MOV   A,#35H',function(s){s.A=0x35},'主程序：A = 35H。');
  d(0x0102,1,'SETB  C',function(s){s.CY=1},'主程序：CY = 1，PSW = 80H。');
  [0x0103,0x0105,0x0107,0x0109,0x010B,0x010D,0x010F].forEach(function(a){d(a,2,'INC   30H',function(s){s.r30=(s.r30+1)&255},'主程序在干自己的活：INC 30H。')});
  d(0x0111,2,'SJMP  0103H',function(s){s.pc=0x0103},'主程序循环。');
  function who(s){return s.from[s.from.length-1]+'的'}
  function pushA(s){s.sp=(s.sp+1)&255;s.mem[s.sp]=s.A;s.tag[s.sp]='A = '+h2(s.A)+'（'+who(s)+'）'}
  function pushP(s){var v=(s.CY<<7)|par(s.A);s.sp=(s.sp+1)&255;s.mem[s.sp]=v;s.tag[s.sp]='PSW = '+h2(v)+'（'+who(s)+'）'}
  function popP(s){var v=s.mem[s.sp];s.CY=v>>7&1;s.sp=(s.sp-1)&255;return v}
  function popA(s){var v=s.mem[s.sp];s.A=v;s.sp=(s.sp-1)&255;return v}
  function reti(s,isRet){var ph=s.mem[s.sp];s.sp=(s.sp-1)&255;var pl=s.mem[s.sp];s.sp=(s.sp-1)&255;s.pc=ph<<8|pl;
    if(!isRet){if(s.ffH)s.ffH=0;else s.ffL=0}s.from.pop()}
  d(0x0200,2,'PUSH  ACC',function(s){pushA(s)},'保护现场：SP 先加 1，再存 A。');
  d(0x0202,2,'PUSH  PSW',function(s){pushP(s)},'保护 PSW。硬件只保护了断点，A、PSW 要自己压。');
  d(0x0204,2,'MOV   A,#0AAH',function(s){s.A=0xAA},'T0 服务程序干活：A = AAH。');
  d(0x0206,1,'CLR   C',function(s){s.CY=0},'T0 服务程序：CY = 0。');
  d(0x0207,2,'MOV   40H,A',function(s){},'T0 服务程序：结果存 40H。');
  d(0x0209,2,'POP   PSW',function(s){popP(s)},'恢复 PSW：先取出，SP 再减 1。顺序和压栈相反。');
  d(0x020B,2,'POP   ACC',function(s){popA(s)},'恢复 A。');
  if(cfg.ret)d(0x020D,1,'RET',function(s){reti(s,true)},'');
  else d(0x020D,1,'RETI',function(s){reti(s,false)},'');
  d(0x0300,2,'PUSH  ACC',function(s){pushA(s)},'INT1 也要保护现场。');
  d(0x0302,2,'PUSH  PSW',function(s){pushP(s)},'压 PSW。');
  d(0x0304,2,'MOV   A,#0FH',function(s){s.A=0x0F},'INT1 服务程序干活：A = 0FH。');
  d(0x0306,2,'MOV   41H,A',function(s){},'INT1 服务程序：结果存 41H。');
  d(0x0308,2,'POP   PSW',function(s){popP(s)},'恢复 PSW。');
  d(0x030A,2,'POP   ACC',function(s){popA(s)},'恢复 A。');
  d(0x030C,1,'RETI',function(s){reti(s,false)},'');
  return P;
}
function lane(a){if(a===0x000B||(a>=0x0200&&a<0x0300))return 't';if(a===0x0013||(a>=0x0300&&a<0x0400))return 'x';return 'm'}
function gen(cfg){
  var P=prog(cfg),lvT=0,lvX=cfg.same?0:1;
  var s={pc:0x0100,sp:cfg.sp0,A:0,CY:0,mem:{},tag:{},ffH:0,ffL:0,tf0:0,ie1:0,r30:0,t0req:0,x1req:0,t0ret:0,from:[]};
  var out=[],block=0,since=0;
  function snap(o){o.sp=s.sp;o.pc=s.pc;o.A=s.A;o.psw=(s.CY<<7)|par(s.A);o.ffH=s.ffH;o.ffL=s.ffL;o.tf0=s.tf0;o.ie1=s.ie1;
    o.mem=JSON.parse(JSON.stringify(s.mem));o.tag=JSON.parse(JSON.stringify(s.tag));out.push(o);return o}
  for(var g=0;g<90;g++){
    var at=s.pc,ins=P[at];if(!ins)break;var ln=lane(at),req=null,msg='';
    s.pc=at+ins.n;ins.f(s);
    var isReti=ins.t==='RETI',isRet=ins.t==='RET';
    if(isReti||isRet){var back=s.pc;
      msg=(isRet?'<b class="bad">RET</b>：':'<b>RETI</b>：')+'先弹高 8 位、再弹低 8 位，PC = '+h4(back)+'，回到'+(lane(back)==='m'?'主程序':'T0 服务程序')+'。'+
        (isRet?'<b class="bad">RET 不清优先级状态触发器，低级触发器还是 1。</b>':'同时把'+(ln==='x'&&!cfg.same?'高级':'低级')+'优先级状态触发器清 0。');
      if(ln==='t')s.t0ret=1}
    else msg=ins.m;
    if(at===0x0103&&s.t0req===0){s.tf0=1;s.t0req=1;req='TF0';msg+=' <b class="gold">T0 溢出：TF0 = 1。</b>'}
    if(at===0x0204&&s.x1req===0){s.ie1=1;s.x1req=1;req='IE1';msg+=' <b class="gold">INT1 引脚来了下降沿：IE1 = 1。</b>'}
    if(at===0x0109&&s.t0ret&&s.t0req===1){s.tf0=1;s.t0req=2;req='TF0';msg+=' <b class="gold">T0 又溢出一次：TF0 = 1。</b>'}
    /* 查询：本条执行完，看能不能响应 */
    var c=[];if(s.tf0)c.push({n:'T0',lv:lvT,nat:1,vec:0x000B});if(s.ie1)c.push({n:'INT1',lv:lvX,nat:2,vec:0x0013});
    var go=null,why='';
    if(c.length){
      if(isReti){why='刚执行完 RETI，按规定还要再执行一条指令，才能响应新的请求。'}
      else{var ok=c.filter(function(q){return !s.ffH&&!(s.ffL&&q.lv===0)});
        if(ok.length){ok.sort(function(a,b){return b.lv-a.lv||a.nat-b.nat});go=ok[0]}
        else why=c.map(function(q){return q.n}).join('、')+' 的请求挂着：'+(s.ffH?'高级触发器 = 1，所有请求都被挡住。':'低级触发器 = 1，同级（低级）的请求进不来。')+(cfg.ret&&s.t0ret?'这个 1 是 RET 留下的，不会再清了。':'')}}
    if(why)msg+=' <span class="gold">'+why+'</span>';
    snap({k:'i',lane:ln,at:at,t:ins.t,req:req,msg:msg,ret:isReti?'reti':(isRet?'ret':'')});
    if(c.length&&!go&&!isReti&&ln==='m')block++;
    if(go){var bp=s.pc,tl=go.n==='T0'?'t':'x';
      if(go.lv)s.ffH=1;else s.ffL=1;
      if(go.n==='T0')s.tf0=0;else s.ie1=0;
      s.sp=(s.sp+1)&255;s.mem[s.sp]=bp&255;s.tag[s.sp]='断点低 8 位 '+h2(bp&255)+'（回 '+h4(bp)+'）';
      s.sp=(s.sp+1)&255;s.mem[s.sp]=bp>>8;s.tag[s.sp]='断点高 8 位 '+h2(bp>>8);
      s.from.push(lane(bp)==='m'?'主程序':(lane(bp)==='t'?'T0 服务':'INT1 服务'));s.pc=go.vec;
      snap({k:'r',lane:tl,at:null,t:'硬件 LCALL',msg:'<b>响应 '+go.n+'</b>（'+(go.lv?'高':'低')+'级）：'+(go.lv?'高':'低')+'级触发器置 1；硬件 LCALL 把断点 '+h4(bp)+' 压栈，先低 8 位 '+h2(bp&255)+'、后高 8 位 '+h2(bp>>8)+'；'+(go.n==='T0'?'TF0':'IE1')+' 由硬件清 0；PC = '+h4(go.vec)+'。'+(out.length&&lane(bp)==='t'?' <b class="ok">高级打断了正在服务的低级：嵌套。</b>':''),bp:bp});
      since=0;continue}
    since=(ln==='m')?since+1:0;
    if(s.t0req===2&&ln==='m'&&!c.length&&!s.ffH&&!s.ffL&&since>=2)break;
    if(block>=5)break;
  }
  var L=out[out.length-1];
  L.msg+='<br><b class="ok">'+(cfg.ret?'结论：RET 也能回到断点，可低级触发器一直是 1，之后'+(cfg.same?'T0 和 INT1（都是低级）':'T0 这一级')+'的请求再也进不来'+(cfg.same?'。':'；高级的 INT1 还能进来。'):(cfg.same?'结论：同级不能打断同级。IE1 一直等到 T0 的 RETI，再执行一条主程序指令，才得到响应。':'结论：高级打断低级，INT1 先返回，T0 接着做完再返回主程序；第二次 T0 请求照常响应。'))+'</b>';
  return {steps:out,prog:P,cfg:cfg};
}
return {gen:gen,lane:lane,h2:h2,h4:h4};
})();}catch(e){}
try{var NZS={cfg:{sp0:0x60,same:false,ret:false},i:-1,tm:null};}catch(e){}
function nzLines(){var c=NZS.cfg,P=NZS.r.prog,L=[];
  function pre(t,chg){L.push({a:null,t:t,pre:1,chg:chg})}
  function sec(from,to,lab){Object.keys(P).map(Number).filter(function(a){return a>=from&&a<to}).sort(function(x,y){return x-y}).forEach(function(a,k){
    var lb=k===0&&lab?lab+':':'';while(lb.length<8)lb+=' ';L.push({a:a,t:lb+P[a].t,chg:(P[a].t==='RET')})})}
  pre('        ORG   0000H');pre('        LJMP  MAIN');pre('        ORG   000BH');
  L.push({a:0x000B,t:'        LJMP  T0_ISR      ; T0 入口'});pre('        ORG   0013H');
  L.push({a:0x0013,t:'        LJMP  X1_ISR      ; INT1 入口'});pre('        ORG   0030H');
  pre(c.sp0===0x60?'MAIN:   MOV   SP,#60H     ; 栈移到 60H 以上':'MAIN:   ; 没写 MOV SP，SP = 07H',c.sp0!==0x60);
  pre('        SETB  IT1         ; INT1 下降沿触发');
  pre(c.same?'        MOV   IP,#00H     ; 两个都是低级':'        MOV   IP,#04H     ; PX1 = 1：INT1 高级',c.same);
  pre('        MOV   IE,#86H     ; EA、EX1、ET0 = 1');pre('        LJMP  LOOP        ; 以上已执行');
  pre('        ORG   0100H');sec(0x0100,0x0200,'LOOP');pre('        ORG   0200H');sec(0x0200,0x0300,'T0_ISR');pre('        ORG   0300H');sec(0x0300,0x0400,'X1_ISR');
  return L}
function nzCodeDraw(){NZS.lines=nzLines();$('#nzCode').innerHTML=NZS.lines.map(function(l,i){var a=l.a!=null?NZ.h4(l.a).slice(0,4):'';
  return '<div id="nzL'+i+'" class="'+(l.pre?'pre':'')+'" style="'+(l.chg?'border-left:3px solid #fcd34d':'')+'"><span class="ln">'+a+'</span> '+l.t.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>'}).join('')}
function nzBuild(){clearTimeout(NZS.tm);NZS.tm=null;$('#nzAuto').textContent='▶ 自动';NZS.r=NZ.gen(NZS.cfg);NZS.i=-1;nzCodeDraw();nzDraw()}
function nzTL(){var st=NZS.r.steps,N=st.length,i=NZS.i,c=NZS.cfg;
  var lanes=[['m','主程序'],['t','T0 服务（低级）'],['x','INT1 服务（'+(c.same?'低级':'高级')+'）']];
  var W=100/N,html='';
  var waits={t:[],x:[]},open={t:-1,x:-1};
  for(var k=0;k<=i;k++){var s=st[k];if(s.req==='TF0')open.t=k;if(s.req==='IE1')open.x=k;
    if(s.k==='r'&&open[s.lane]>=0){waits[s.lane].push([open[s.lane],k]);open[s.lane]=-1}}
  ['t','x'].forEach(function(l){if(open[l]>=0)waits[l].push([open[l],i+1])});
  lanes.forEach(function(L){var h='';
    (waits[L[0]]||[]).forEach(function(w){h+='<div class="nzWait" style="left:'+(w[0]*W+W)+'%;width:'+Math.max(0.6,(w[1]-w[0]-1)*W)+'%"></div>'});
    for(var k=0;k<=i;k++){var s=st[k];
      if(s.req&&((s.req==='TF0'&&L[0]==='t')||(s.req==='IE1'&&L[0]==='x')))h+='<div class="nzReq" style="left:'+(k*W+W/2)+'%">'+s.req+' = 1</div>';
      if(s.lane!==L[0])continue;
      var cls=s.k==='r'?'r':(s.ret==='reti'?'ret':(s.ret==='ret'?'bad':L[0])),lab=s.k==='r'?'响应':(s.ret==='reti'?'RETI':(s.ret==='ret'?'RET':''));
      h+='<div class="nzC '+cls+(k===i?' new':'')+'" style="left:'+(k*W+0.06)+'%;width:'+(W-0.12)+'%" title="'+(s.t||'')+'">'+(W>2.6?lab:'')+'</div>'}
    h+='<div class="nzCur" style="left:'+((i+1)*W)+'%"></div>';
    html+='<div class="nzLane"><div class="nm">'+L[1]+'</div><div class="nzTrack">'+h+'</div></div>'});
  $('#nzTL').innerHTML=html}
function nzDraw(){var c=NZS.cfg,st=NZS.r.steps,i=NZS.i,s=i>=0?st[i]:{pc:0x0100,sp:c.sp0,A:0,psw:0,ffH:0,ffL:0,tf0:0,ie1:0,mem:{},tag:{},msg:'主程序在跑。'+(c.same?'IP = 00H：T0、INT1 都是低级。':'IP = 04H：INT1 高级，T0 低级。')+'SP = '+NZ.h2(c.sp0)+'。点“单步”或“自动”。'};
  nzTL();
  $('#nzMsg').innerHTML=(i>=0?'<b class="mono">第 '+(i+1)+' / '+st.length+' 步</b>　':'')+s.msg;
  $('#nzPC').textContent=NZ.h4(s.pc);$('#nzSP').textContent=NZ.h2(s.sp);$('#nzA').textContent=NZ.h2(s.A);$('#nzPSW').textContent=NZ.h2(s.psw)+'（CY = '+(s.psw>>7)+'）';
  $('#nzIP').textContent=c.same?'00H（PX1 = 0，PT0 = 0）':'04H（PX1 = 1，PT0 = 0）';
  $('#nzTF0').classList.toggle('on',!!s.tf0);$('#nzIE1').classList.toggle('on',!!s.ie1);$('#nzFFH').classList.toggle('on',!!s.ffH);$('#nzFFL').classList.toggle('on',!!s.ffL);
  $('#nzFFn').innerHTML=s.ffH?'高级 = 1：正在服务高级中断，<b>所有</b>请求都进不来。':(s.ffL?'低级 = 1：正在服务低级中断，<b>只有高级</b>能进来。':'都是 0：没有中断在服务。');
  var h='';for(var a=c.sp0+8;a>=c.sp0;a--){var has=s.mem[a]!=null,live=a<=s.sp&&a>c.sp0,top=a===s.sp;
    h+='<div class="'+(top?'top':(has&&!live&&a!==c.sp0?'old':''))+'"><span>'+NZ.h2(a)+(top?' ← SP':'')+(c.sp0===0x07&&a>=8&&a<=15?' <span class="r1">第1组 R'+(a-8)+'</span>':'')+'</span><span>'+(a===c.sp0?'<span class="sub">栈底（SP 初值）</span>':(has?(s.tag[a]||NZ.h2(s.mem[a]))+(live?'':' · 已弹出'):''))+'</span></div>'}
  $('#nzStack').innerHTML=h;
  $('#nzStN').innerHTML=c.sp0===0x07?'<span class="bad">SP = 07H：断点和现场压进 08H～0FH，这正是第 1 组工作寄存器 R0～R7。本程序没用第 1 组，看不出错；用了就被冲掉。</span>':'先 SP 加 1 再存；先取再 SP 减 1。弹出后数据还留在单元里，只是 SP 退回来了。';
  $$('#nzCode div').forEach(function(d){d.classList.remove('hl');d.classList.remove('hl2')});
  if(i>=0){var tgt=s.k==='r'?(s.pc):s.at,cls=s.k==='r'?'hl2':'hl';var ix=-1;NZS.lines.forEach(function(l,k){if(l.a===tgt)ix=k});
    if(ix>=0){var el=$('#nzL'+ix);el.classList.add(cls);var box=$('#nzCode');if(el.offsetTop<box.scrollTop||el.offsetTop>box.scrollTop+box.clientHeight-30)box.scrollTop=Math.max(0,el.offsetTop-box.clientHeight/2)}}
  $('#nzBack').disabled=i<0;$('#nzStep').disabled=i>=st.length-1}
function nzStepGo(d){var N=NZS.r.steps.length;NZS.i=Math.max(-1,Math.min(N-1,NZS.i+d));nzDraw()}
try{$('#nzStep').onclick=function(){clearTimeout(NZS.tm);NZS.tm=null;$('#nzAuto').textContent='▶ 自动';nzStepGo(1)};}catch(e){}
try{$('#nzBack').onclick=function(){clearTimeout(NZS.tm);NZS.tm=null;$('#nzAuto').textContent='▶ 自动';nzStepGo(-1)};}catch(e){}
try{$('#nzReset').onclick=function(){clearTimeout(NZS.tm);NZS.tm=null;$('#nzAuto').textContent='▶ 自动';NZS.i=-1;nzDraw()};}catch(e){}
try{$('#nzAuto').onclick=function(){if(NZS.tm){clearTimeout(NZS.tm);NZS.tm=null;this.textContent='▶ 自动';return}
  if(NZS.i>=NZS.r.steps.length-1)NZS.i=-1;var b=this;b.textContent='⏸ 暂停';
  (function t(){nzStepGo(1);if(NZS.i>=NZS.r.steps.length-1){NZS.tm=null;b.textContent='▶ 自动';return}NZS.tm=setTimeout(t,NZS.r.steps[NZS.i].k==='r'||NZS.r.steps[NZS.i].ret?1300:800)})()};}catch(e){}
try{$('#nzSp60').onclick=function(){NZS.cfg.sp0=0x60;$('#nzSp60').setAttribute('aria-pressed',true);$('#nzSp07').setAttribute('aria-pressed',false);nzBuild()};}catch(e){}
try{$('#nzSp07').onclick=function(){NZS.cfg.sp0=0x07;$('#nzSp07').setAttribute('aria-pressed',true);$('#nzSp60').setAttribute('aria-pressed',false);nzBuild()};}catch(e){}
try{$('#nzSame').onchange=function(){NZS.cfg.same=this.checked;nzBuild()};}catch(e){}
try{$('#nzRet').onchange=function(){NZS.cfg.ret=this.checked;nzBuild()};}catch(e){}
try{nzBuild();}catch(e){}

/* 初始 */
try{draw3();}catch(e){}try{draw4();}catch(e){}try{draw5();}catch(e){}try{draw6();}catch(e){}try{draw7();}catch(e){}try{drawSt();}catch(e){}try{draw9();}catch(e){}try{hl(14);}catch(e){}try{flow9(-1);}catch(e){}

/* ---------- ⑩ 学生互动 A–D · 强体验 ---------- */
try{(function(){
  function $(id){return document.getElementById(id)}
  function qsa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
  function pick(sel, btn){qsa(sel+' .opt').forEach(function(x){x.classList.remove('pick','ok','bad')}); btn.classList.add('pick')}
  function hex2(n){return (n<16?'0':'')+n.toString(16).toUpperCase()+'H'}
  function bin8(n){var s=n.toString(2);while(s.length<8)s='0'+s;return s.slice(0,4)+' '+s.slice(4)+'B'}
  function fx(el, cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function(){el.classList.remove(cls)}, 500) }
  function bumpCnt(el, n){ if(!el) return; el.textContent=n; fx(el,'fx-bump') }

  /* sound */
  var sndOn=false, AC=null;
  function ensureAC(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)() }catch(e){} } return AC }
  function beep(kind){
    if(!sndOn) return;
    var ac=ensureAC(); if(!ac) return;
    try{
      var o=ac.createOscillator(), g=ac.createGain();
      o.connect(g); g.connect(ac.destination);
      var now=ac.currentTime;
      if(kind==='ok'){ o.frequency.value=880; g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.06,now+0.02); g.gain.exponentialRampToValueAtTime(0.0001,now+0.18); o.start(now); o.stop(now+0.2) }
      else if(kind==='bad'){ o.type='square'; o.frequency.value=180; g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.05,now+0.01); g.gain.exponentialRampToValueAtTime(0.0001,now+0.16); o.start(now); o.stop(now+0.18) }
      else { o.frequency.value=520; g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.035,now+0.01); g.gain.exponentialRampToValueAtTime(0.0001,now+0.07); o.start(now); o.stop(now+0.08) }
    }catch(e){}
  }
  var sndBtn=$('sndToggle');
  if(sndBtn) sndBtn.onclick=function(){
    sndOn=!sndOn; sndBtn.setAttribute('aria-pressed', sndOn?'true':'false'); sndBtn.textContent=sndOn?'音效 开':'音效 关';
    if(sndOn){ ensureAC(); beep('click') }
  };

  /* HUD */
  var cleared={A:false,B:false,C:false,D:false};
  var assistUsed={A:false,B:false,C:false,D:false};
  function updateHud(){
    var n=0;
    ['A','B','C','D'].forEach(function(k){
      var el=$('hud'+k); if(!el) return;
      el.classList.toggle('done', !!cleared[k]);
      if(cleared[k]) n++;
      var link=document.querySelector('#drillNav a[href="#act'+k+'"]');
      if(link) link.classList.toggle('cleared', !!cleared[k]);
      var art=$('act'+k); if(art) art.classList.toggle('cleared', !!cleared[k]);
    });
    var p=$('drillProg'); if(p) p.textContent='通关 '+n+'/4';
  }
  function markClear(k){
    if(cleared[k]) return;
    cleared[k]=true; updateHud(); beep('ok'); fx($('hud'+k),'fx-ok');
  }
  function unlockPhase(phaseId, hintId){
    var ph=$(phaseId); if(!ph) return;
    ph.classList.remove('gated'); ph.classList.add('ready');
    var h=$(hintId); if(h) h.style.display='none';
    var gh=ph.querySelector('.gate-hint'); if(gh) gh.style.display='none';
  }
  function useAssist(k, phaseId){
    if(assistUsed[k]) return;
    assistUsed[k]=true;
    if(phaseId) unlockPhase(phaseId);
  }
  updateHud();

  /* ===== A duel ===== */
  var aEdge={cnt:0, held:false, fired:false}, aLvl={cnt:0, held:false, timer:null};
  var aTried={edge:false, lvl:false};
  function aCheckVs(){
    if(aTried.edge && aTried.lvl && aEdge.cnt===1 && aLvl.cnt>=2){
      var vs=$('aVs'); if(vs){ vs.classList.add('show'); fx(vs,'fx-ok') }
      $('aColEdge').classList.add('hot'); $('aColLvl').classList.add('hot');
      useAssist('A','aPredPhase');
    } else if(aTried.edge && aTried.lvl){
      useAssist('A','aPredPhase');
    }
  }
  function bindBell(bell, wave, onDown, onUp){
    if(!bell) return;
    function down(e){ e.preventDefault(); bell.classList.add('down'); if(wave) wave.classList.add('low'); beep('click'); onDown() }
    function up(e){ bell.classList.remove('down'); if(wave) wave.classList.remove('low'); onUp() }
    bell.addEventListener('pointerdown', down);
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ bell.addEventListener(ev, up) });
  }
  bindBell($('aBellEdge'), $('aWaveEdge'), function(){
    aEdge.held=true;
    if(!aEdge.fired){ aEdge.fired=true; aEdge.cnt=1; bumpCnt($('aEdgeCnt'),1); beep('ok') }
    aTried.edge=true; aCheckVs();
  }, function(){ aEdge.held=false });
  bindBell($('aBellLvl'), $('aWaveLvl'), function(){
    aLvl.held=true; aTried.lvl=true;
    if(aLvl.timer) clearInterval(aLvl.timer);
    aLvl.cnt++; bumpCnt($('aLvlCnt'), aLvl.cnt); beep('click');
    aLvl.timer=setInterval(function(){
      if(!aLvl.held){ clearInterval(aLvl.timer); aLvl.timer=null; return }
      aLvl.cnt++; bumpCnt($('aLvlCnt'), aLvl.cnt); fx($('aColLvl'),'fx-ok'); beep('click');
      aCheckVs();
    }, 480);
    aCheckVs();
  }, function(){ aLvl.held=false; if(aLvl.timer){ clearInterval(aLvl.timer); aLvl.timer=null } });
  $('aEdgeRst').onclick=function(){ aEdge.cnt=0; aEdge.fired=false; bumpCnt($('aEdgeCnt'),0); $('aVs').classList.remove('show'); $('aColEdge').classList.remove('hot') };
  $('aLvlRst').onclick=function(){ aLvl.cnt=0; if(aLvl.timer) clearInterval(aLvl.timer); aLvl.timer=null; bumpCnt($('aLvlCnt'),0); $('aVs').classList.remove('show'); $('aColLvl').classList.remove('hot') };

  var aIT=1;
  function syncAIT(){ $('aIt1').setAttribute('aria-pressed',aIT===1?'true':'false'); $('aIt0').setAttribute('aria-pressed',aIT===0?'true':'false') }
  $('aIt1').onclick=function(){aIT=1;syncAIT()}; $('aIt0').onclick=function(){aIT=0;syncAIT()}; syncAIT();
  qsa('#aPred .opt').forEach(function(b){b.onclick=function(){
    pick('#aPred', b); beep('click');
    var v=b.dataset.v, correct=(aIT===1&&v==='1')||(aIT===0&&v==='many');
    qsa('#aPred .opt').forEach(function(x){ var ok=(aIT===1&&x.dataset.v==='1')||(aIT===0&&x.dataset.v==='many'); x.classList.toggle('ok',ok); x.classList.toggle('bad',x===b&&!ok) });
    if(correct){ fx(b,'fx-ok'); beep('ok') } else { fx(b,'fx-bad'); beep('bad') }
    var msg=aIT===1?'下降沿：真按住次数停在 1——<b>硬件清 IE0</b>。':'低电平：真按住次数往上爬——<b>IE0 不自动清</b>。';
    var rev=$('aReveal'); rev.innerHTML=(correct?'✅ ':'❌ ')+msg; rev.classList.add('show');
    $('aAbs').hidden=false; $('aChk').hidden=false;
  }});
  qsa('#aQuiz .opt').forEach(function(b){b.onclick=function(){
    pick('#aQuiz', b);
    var ok=b.dataset.ans==='edge';
    qsa('#aQuiz .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.ans==='edge'); x.classList.toggle('bad',x===b&&!ok)});
    var fb=$('aFb'); fb.className='fb '+(ok?'ok':'bad');
    fb.textContent=ok?'对：下降沿应答时硬件清 IE0；低电平不自动清。':'再看：只有下降沿应答时硬件清 IE0。';
    if(ok){ fx(b,'fx-ok'); beep('ok'); markClear('A') } else { fx(b,'fx-bad'); beep('bad') }
  }});
  $('aGoto4').onclick=function(){ S4.it0=1;S4.cnt=0;S4.ie0=0;S4.pin=1; $('msg4').textContent='下降沿：点按 / 按住比次数。'; draw4(); syncCap4(); show(4); try{history.replaceState(null,'','#p4')}catch(e){} };

  /* ===== B drag stack ===== */
  var bSel=null;
  function labelChip(c){return ({PCL:'PC低',PCH:'PC高',A:'A',PSW:'PSW'})[c]||c}
  function updateTower(){
    var v08=$('bSlot08').getAttribute('data-val');
    var v09=$('bSlot09').getAttribute('data-val');
    var sp=$('bSpAfter').getAttribute('data-val');
    $('t07').classList.add('on');
    $('t08').classList.toggle('on', !!v08);
    $('t08').textContent=v08?('08 · '+labelChip(v08)):'08';
    $('t09').classList.toggle('on', !!v09);
    $('t09').textContent=v09?('09 · '+labelChip(v09)):'09';
    if(sp==='09'){ $('t09').classList.add('sp'); $('bSpLive').textContent='09H'; fx($('bSpLive'),'fx-bump') }
    else if(sp==='08'){ $('bSpLive').textContent='08H' }
    else { $('t09').classList.remove('sp'); $('bSpLive').textContent='07H' }
  }
  function resetB(){
    bSel=null;
    qsa('#bChips .chip').forEach(function(c){c.classList.remove('on','used','dragging')});
    ['bSlot08','bSlot09'].forEach(function(id){ var s=$(id); s.className='slot'; s.textContent='拖到这里 / 点选放入'; s.removeAttribute('data-val') });
    qsa('#bSpAfter .btn').forEach(function(x){x.setAttribute('aria-pressed','false')});
    $('bSpAfter').className='slot'; $('bSpAfter').removeAttribute('data-val');
    $('bDraftFb').textContent=''; updateTower();
  }
  function placeInto(slotEl, chip){
    var prev=slotEl.getAttribute('data-val');
    if(prev){ qsa('#bChips .chip').forEach(function(c){ if(c.dataset.chip===prev) c.classList.remove('used') }) }
    var wrong=(chip==='A'||chip==='PSW');
    slotEl.setAttribute('data-val', chip);
    slotEl.textContent=labelChip(chip);
    slotEl.className='slot filled'+(wrong?' wrong':'');
    fx(slotEl, wrong?'fx-bad':'fx-ok');
    beep(wrong?'bad':'ok');
    qsa('#bChips .chip').forEach(function(c){ if(c.dataset.chip===chip){ c.classList.add('used'); c.classList.remove('on','dragging') } });
    bSel=null;
    if(wrong){
      setTimeout(function(){
        slotEl.className='slot'; slotEl.textContent='拖到这里 / 点选放入'; slotEl.removeAttribute('data-val');
        qsa('#bChips .chip').forEach(function(c){ if(c.dataset.chip===chip) c.classList.remove('used') });
        updateTower();
      }, 550);
    } else updateTower();
  }
  qsa('#bChips .chip').forEach(function(c){
    c.addEventListener('click', function(){
      qsa('#bChips .chip').forEach(function(x){x.classList.remove('on')});
      if(c.classList.contains('used')) return;
      bSel=c.dataset.chip; c.classList.add('on'); beep('click');
    });
    c.addEventListener('dragstart', function(e){
      if(c.classList.contains('used')){ e.preventDefault(); return }
      bSel=c.dataset.chip; c.classList.add('dragging');
      try{ e.dataTransfer.setData('text/plain', c.dataset.chip); e.dataTransfer.effectAllowed='move' }catch(err){}
    });
    c.addEventListener('dragend', function(){ c.classList.remove('dragging') });
  });
  ['bSlot08','bSlot09'].forEach(function(id){
    var s=$(id);
    s.addEventListener('click', function(){ if(bSel) placeInto(s, bSel) });
    s.addEventListener('dragover', function(e){ e.preventDefault(); s.classList.add('dragover') });
    s.addEventListener('dragleave', function(){ s.classList.remove('dragover') });
    s.addEventListener('drop', function(e){
      e.preventDefault(); s.classList.remove('dragover');
      var chip=bSel; try{ chip=e.dataTransfer.getData('text/plain')||bSel }catch(err){}
      if(chip) placeInto(s, chip);
    });
  });
  qsa('#bSpAfter .btn').forEach(function(b){ b.onclick=function(e){
    e.stopPropagation();
    qsa('#bSpAfter .btn').forEach(function(x){x.setAttribute('aria-pressed','false')});
    b.setAttribute('aria-pressed','true');
    $('bSpAfter').setAttribute('data-val', b.dataset.sp);
    $('bSpAfter').classList.add('filled'); beep('click'); updateTower();
  }});
  $('bClear').onclick=resetB;
  $('bCheck').onclick=function(){
    var v08=$('bSlot08').getAttribute('data-val'), v09=$('bSlot09').getAttribute('data-val'), sp=$('bSpAfter').getAttribute('data-val');
    var ok08=v08==='PCL', ok09=v09==='PCH', okSp=sp==='09';
    $('bSlot08').className='slot filled '+(ok08?'right':'wrong');
    $('bSlot09').className='slot filled '+(ok09?'right':'wrong');
    $('bSpAfter').className='slot filled '+(okSp?'right':'wrong');
    var fb=$('bDraftFb');
    if(ok08&&ok09&&okSp){
      fb.innerHTML='✅ SP→<b>09H</b>；只压 PC。'; fx($('bAssist'),'fx-ok'); beep('ok');
      updateTower(); useAssist('B','bPredPhase');
      $('bAbs').hidden=false; $('bChk').hidden=false;
      $('bReveal').innerHTML='✅ 草稿对：硬件只压断点 PC，入口 <b>0003H</b>。'; $('bReveal').classList.add('show');
    } else {
      fb.textContent='再摆：PC低→08H，PC高→09H，SP=09H。'; fx($('bAssist'),'fx-bad'); beep('bad');
    }
  };
  updateTower();
  qsa('#bPred .opt').forEach(function(b){b.onclick=function(){
    pick('#bPred', b); var ok=b.dataset.v==='09';
    qsa('#bPred .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.v==='09'); x.classList.toggle('bad',x===b&&!ok)});
    if(ok){fx(b,'fx-ok');beep('ok')} else {fx(b,'fx-bad');beep('bad')}
    $('bReveal').innerHTML=(ok?'✅ ':'❌ ')+'标准：<b>SP=09H</b>；(08H)=PC低；(09H)=PC高。不压 A/PSW。';
    $('bReveal').classList.add('show'); $('bAbs').hidden=false; $('bChk').hidden=false;
  }});
  qsa('#bQuiz .opt').forEach(function(b){b.onclick=function(){
    pick('#bQuiz', b); var ok=b.dataset.ans==='pc';
    qsa('#bQuiz .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.ans==='pc'); x.classList.toggle('bad',x===b&&!ok)});
    $('bFb').className='fb '+(ok?'ok':'bad');
    $('bFb').textContent=ok?'对：只保 PC。':'硬件只保 PC（断点）。';
    if(ok){ fx(b,'fx-ok'); beep('ok'); markClear('B') } else { fx(b,'fx-bad'); beep('bad') }
  }});
  $('bGoto8').onclick=function(){ var s=$('stS07'); if(s) s.click(); show(8); try{history.replaceState(null,'','#p8')}catch(e){} };
  $('bGoto1').onclick=function(){show(1)};

  /* ===== C switches ===== */
  var IEB_L=['EA','—','—','ES','ET1','EX1','ET0','EX0'];
  var cVal=0, cMode='83', cBuilt={83:false,'8A':false}, cRaceT=null;
  function drawC(){
    var bits=$('cBits'), html='';
    for(var i=0;i<8;i++){
      var d=7-i, name=IEB_L[i], na=name==='—', on=((cVal>>(7-i))&1);
      html+='<div class="sw'+(na?' na':'')+(on&&!na?' one':'')+'" data-i="'+i+'"><div class="bn">D'+d+'</div><div class="bl">'+name+'</div><div class="track"><div class="knob"></div></div></div>';
    }
    bits.innerHTML=html;
    qsa('.sw', bits).forEach(function(el){
      if(el.classList.contains('na')) return;
      el.onclick=function(){
        cVal ^= (1<<(7-(+el.dataset.i)));
        beep('click'); drawC(); onCVal();
      };
    });
    var ro=$('cReadout');
    $('cHex').textContent=hex2(cVal); $('cBin').textContent=bin8(cVal);
    if(ro){ ro.classList.remove('flash'); void ro.offsetWidth; ro.classList.add('flash') }
  }
  function celebrateTarget(want){
    $('cTarget').classList.add('ok');
    qsa('#cBits .sw.one').forEach(function(s){ s.classList.add('cele'); fx(s,'fx-ok') });
    fx($('cBoard'),'fx-ok'); beep('ok');
    cBuilt[want===0x83?'83':'8A']=true;
    useAssist('C','cQuizPhase');
    if(cBuilt['83']&&cBuilt['8A']){ $('cAbs').hidden=false }
  }
  function onCVal(){
    var want=(cMode==='8A')?0x8A:0x83;
    var t=$('cTarget');
    if(cVal===want){
      t.classList.add('ok');
      t.textContent=(want===0x83?'目标 ① 已拼出 83H ★':'目标 ② 已拼出 8AH ★')+'（可再点核对）';
      celebrateTarget(want);
      if(cRaceT && want===0x83){ clearInterval(cRaceT); cRaceT=null; $('cTimer').classList.remove('on'); $('cBoardFb').innerHTML='⏱️ 限时成功！IE=<b>83H</b>' }
    } else {
      t.classList.remove('ok');
      if(cMode==='8A') t.textContent='目标 ②：例5-1 只要 T0、T1 → EA、ET1、ET0 → 8AH';
      else t.textContent='目标 ①：只要 INT0 + T0 → EA、ET0、EX0 → 83H';
    }
  }
  drawC();
  $('cClr').onclick=function(){ cVal=0; drawC(); $('cBoardFb').textContent=''; $('cTarget').classList.remove('ok'); qsa('#cBits .sw').forEach(function(s){s.classList.remove('cele')}) };
  $('cTarget8A').onclick=function(){ cMode='8A'; $('cTarget').dataset.mode='8A'; onCVal(); $('cBoardFb').textContent='换目标：拼 8AH。'; beep('click') };
  function checkWant(want){
    cMode=(want===0x8A)?'8A':'83';
    if(cVal===want){ $('cBoardFb').innerHTML='✅ 确认 IE=<b>'+hex2(want)+'</b>'; celebrateTarget(want) }
    else { $('cBoardFb').innerHTML='现在 <b>'+hex2(cVal)+'</b>，目标 <b>'+hex2(want)+'</b>'; fx($('cBoard'),'fx-bad'); beep('bad') }
  }
  $('cCheck83').onclick=function(){ checkWant(0x83) };
  $('cCheck8A').onclick=function(){ checkWant(0x8A) };
  $('cRace').onclick=function(){
    cMode='83'; cVal=0; drawC(); onCVal();
    var bar=$('cTimer'), fill=$('cTimerFill');
    bar.classList.add('on'); fill.style.transition='none'; fill.style.transform='scaleX(1)';
    void fill.offsetWidth; fill.style.transition='transform 30s linear'; fill.style.transform='scaleX(0)';
    $('cBoardFb').textContent='⏱️ 30 秒拼 83H——拨 EA、ET0、EX0！'; beep('click');
    if(cRaceT) clearInterval(cRaceT);
    var left=30;
    cRaceT=setInterval(function(){
      left--; if(left<=0){ clearInterval(cRaceT); cRaceT=null; bar.classList.remove('on');
        if(cVal!==0x83){ $('cBoardFb').textContent='时间到。再拨一次，不限时。'; beep('bad') } }
    },1000);
  };
  qsa('#cQuiz .opt').forEach(function(b){b.onclick=function(){
    pick('#cQuiz', b); var ans=b.dataset.ans, ok=(ans==='83'||ans==='8A');
    qsa('#cQuiz .opt').forEach(function(x){ x.classList.remove('ok','bad'); if(x===b) x.classList.add(ok?'ok':'bad') });
    $('cFb').className='fb '+(ok?'ok':'bad');
    if(ans==='83') $('cFb').textContent='对：1000 0011B = 83H';
    else if(ans==='8A') $('cFb').textContent='对：1000 1010B = 8AH';
    else if(ans==='03') $('cFb').textContent='陷阱：忘了 EA';
    else $('cFb').textContent='陷阱：忘了 EA';
    $('cAbs').hidden=false; $('cReveal').classList.add('show');
    $('cReveal').innerHTML='两式：INT0+T0→<b>83H</b>；例5-1→<b>8AH</b>。';
    if(ok){ fx(b,'fx-ok'); beep('ok'); markClear('C') } else { fx(b,'fx-bad'); beep('bad') }
  }});
  function gotoIE(v){ IEv=v; draw5(); show(5); try{history.replaceState(null,'','#p5')}catch(e){} }
  $('cGoto5').onclick=function(){show(5)};
  $('cFill83').onclick=function(){gotoIE(0x83)};
  $('cFill8A').onclick=function(){gotoIE(0x8A)};

  /* ===== D path ===== */
  qsa('#dList input').forEach(function(inp){ inp.onchange=function(){
    var lab=inp.closest('label'); if(lab) lab.classList.toggle('done', inp.checked);
    beep('click');
    var any=qsa('#dList input').some(function(x){return x.checked});
    if(any) useAssist('D','dScenePhase');
  }});
  var dDone={d1:false,d2:false};
  function maybeD(){ if(dDone.d1&&dDone.d2){ $('dAbs').hidden=false; $('dChk').hidden=false } }
  qsa('#d1 .opt').forEach(function(b){b.onclick=function(){
    pick('#d1', b); var ok=b.dataset.v==='edge';
    qsa('#d1 .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.v==='edge'); x.classList.toggle('bad',x===b&&!ok)});
    if(ok){ fx(b,'fx-ok'); beep('ok'); $('d1path').classList.add('show') } else { fx(b,'fx-bad'); beep('bad'); $('d1path').classList.remove('show') }
    $('d1r').innerHTML=(ok?'✅ ':'❌ ')+'点一下只加 1 → <b>下降沿</b>'; $('d1r').classList.add('show');
    dDone.d1=true; maybeD();
  }});
  qsa('#d2 .opt').forEach(function(b){b.onclick=function(){
    pick('#d2', b); var ok=b.dataset.v==='level';
    qsa('#d2 .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.v==='level'); x.classList.toggle('bad',x===b&&!ok)});
    if(ok){ fx(b,'fx-ok'); beep('ok'); $('d2path').classList.add('show') } else { fx(b,'fx-bad'); beep('bad'); $('d2path').classList.remove('show') }
    $('d2r').innerHTML=(ok?'✅ ':'❌ ')+'持续故障 → <b>低电平</b>；结束前撤低'; $('d2r').classList.add('show');
    dDone.d2=true; maybeD();
  }});
  qsa('#dQuiz .opt').forEach(function(b){b.onclick=function(){
    pick('#dQuiz', b); var ok=b.dataset.ans==='no';
    qsa('#dQuiz .opt').forEach(function(x){x.classList.toggle('ok',x.dataset.ans==='no'); x.classList.toggle('bad',x===b&&!ok)});
    $('dFb').className='fb '+(ok?'ok':'bad');
    $('dFb').textContent=ok?'对：低电平 IE0 不自动清。':'× 低电平不自动清 IE0。';
    if(ok){ fx(b,'fx-ok'); beep('ok'); markClear('D') } else { fx(b,'fx-bad'); beep('bad') }
  }});
  $('dGoto4').onclick=function(){ show(4); try{ var el=$('mech4'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) }catch(e){} };

  /* nav */
  function jumpDrill(actId){
    show(10); try{history.replaceState(null,'','#'+actId)}catch(e){}
    setTimeout(function(){ var el=$(actId); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); syncDrillNav() },50);
  }
  var bA=$('backA'); if(bA) bA.onclick=function(){jumpDrill('actA')};
  var bB=$('backB'); if(bB) bB.onclick=function(){jumpDrill('actB')};
  var bC=$('backC'); if(bC) bC.onclick=function(){jumpDrill('actC')};
  function syncDrillNav(){
    var h=location.hash||'';
    qsa('#drillNav a').forEach(function(a){a.classList.toggle('on', a.getAttribute('href')===h)});
  }
  qsa('#drillNav a').forEach(function(a){ a.addEventListener('click', function(){ show(10); setTimeout(syncDrillNav,0) }) });
  qsa('#drillHud .slot-h').forEach(function(s){ s.style.cursor='pointer'; s.onclick=function(){ jumpDrill('act'+s.dataset.act) } });
  addEventListener('hashchange', function(){
    var h=location.hash||'';
    if(h==='#drill'||h==='#p10'||/^#act[A-D]$/.test(h)){
      show(10);
      if(/^#act[A-D]$/.test(h)) setTimeout(function(){ var el=document.querySelector(h); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) },40);
    }else if(h==='#ex53'||h==='#例5-3'||h==='#p12'){
      show(12);
    }else if(h==='#ex51'||h==='#例5-1'||h==='#p13'){
      show(13);
    }else if(h==='#hex-split'||h==='#rev-hex'){
      show(14); setTimeout(function(){ var e=document.getElementById(h==='#rev-hex'?'rev-hex':'hex-split'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },60);
    }else if(h==='#media2'){
      show(2); setTimeout(function(){ var e=document.getElementById('media2'); if(e) e.scrollIntoView({block:'start'}); },60);
    }else if(h==='#lab4clips'){
      show(9); setTimeout(function(){ var e=document.getElementById('lab4clips'); if(e) e.scrollIntoView({block:'start'}); },60);
    }else if(h==='#tload'||h==='#装值'||h==='#p14'){
      show(14);
    }else if(h==='#gate-win'||h==='#p-gate'||h==='#gate'||h==='#p19'){
      show(19);
    }else if(h==='#ex53-full'||h==='#p-524'||h==='#p20'){
      show(20);
    }else if(h==='#ex-58'){
      show(15); setTimeout(function(){ var e=document.getElementById('ex-58'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },60);
    }else if(h==='#exg'||h==='#例题'||h==='#p15'){
      show(15);
    }else if(h==='#mem'||h==='#速记'||h==='#快速记忆'||h==='#p16'){
      show(16);
    }else if(h==='#quiz'||h==='#测试'||h==='#p17'){
      show(17);
    }else if(h==='#review'||h==='#全复习'||h==='#p18'||h==='#rev-sym'||h==='#rev-why'||h==='#rev-sz'||h==='#rev-kd'||h==='#rev-warm'){
      show(18);
      if(h==='#rev-sym'||h==='#rev-why'||h==='#rev-sz'||h==='#rev-kd'||h==='#rev-warm') setTimeout(function(){ var e=document.getElementById(h.slice(1)); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },60);
    }else if(/^#p(20|1[0-9]|[1-9])$/.test(h)){
      show(+h.slice(2));
    }else if(h==='#lcall-hw'||h==='#lcall'){
      show(1); setTimeout(function(){ var e=document.getElementById('lcall-hw'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },80);
    }else if(h==='#struct6'||h==='#struct'){
      show(1); setTimeout(function(){ var e=document.getElementById('struct6'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },80);
    }else if(h==='#level-edge'||h==='#it-mode'){
      show(1); setTimeout(function(){ var e=document.getElementById('level-edge'); if(e) e.scrollIntoView({behavior:'smooth',block:'start'}); },80);
    }
    syncDrillNav();
  });
  syncDrillNav();
})();}catch(e){}


/* ---------- ⑫ 例5-3 LED + INT0 演示 ---------- */
try{(function(){
  var ledsEl=$('#ex53Leds'), stepsEl=$('#ex53Steps');
  if(!ledsEl) return;
  var A=0xFF, R1=8, P1=0xFF, PC='0030H', SP=0x70;
  var playing=false, inIsr=false, pendingInt=false;
  var mainTimer=null, isrTimer=null, isrStep=-1;
  var MAIN_MS=420, ISR_MS=520;
  var savedA=0xFF, savedR1=8;

  function hexP1(v){ var h=(v&0xFF).toString(16).toUpperCase(); if(h.length<2)h='0'+h; return '#0'+h+'H'; }
  function hexSP(v){ return ((v&0xFF)<16?'0':'')+(v&0xFF).toString(16).toUpperCase()+'H'; }

  ledsEl.innerHTML=[0,1,2,3,4,5,6,7].map(function(i){
    return '<div class="ex53-led" data-bit="'+i+'"><div class="dot"></div><div class="pin">P1.'+i+'</div></div>';
  }).join('');

  function paintLeds(){
    $$('#ex53Leds .ex53-led').forEach(function(el){
      var bit=+el.dataset.bit;
      // 共阳：引脚=0 灯亮 → 对应位为 0 时点亮
      var on=((P1>>bit)&1)===0;
      el.classList.toggle('on', on);
    });
    var p1el=$('#ex53P1'); if(p1el) p1el.textContent=hexP1(P1);
    var pcel=$('#ex53PC'); if(pcel) pcel.textContent=PC;
    var spel=$('#ex53SP'); if(spel) spel.textContent=hexSP(SP);
  }

  function setStat(txt, cls){
    var el=$('#ex53Stat'); if(!el) return;
    el.textContent=txt;
    el.className='v '+cls;
  }

  function setStep(n){
    if(!stepsEl) return;
    $$('#ex53Steps li').forEach(function(li){
      var s=+li.dataset.s;
      li.classList.toggle('cur', s===n);
      li.classList.toggle('done', s<n && n>=0);
    });
  }

  function setBtns(){
    var bStart=$('#ex53Start'), bPause=$('#ex53Pause'), bInt=$('#ex53Int0');
    if(bStart) bStart.disabled=playing || inIsr;
    if(bPause) bPause.disabled=!playing || inIsr;
    if(bInt) bInt.disabled=inIsr;
  }

  function stopMain(){
    playing=false;
    if(mainTimer){ clearInterval(mainTimer); mainTimer=null; }
    setBtns();
  }

  function tickMain(){
    if(inIsr) return;
    if(pendingInt){ pendingInt=false; startIsr(); return; }
    // DEC A; MOV P1,A; Delay; DJNZ R1,Loop
    A=(A-1)&0xFF;
    P1=A;
    PC='Loop';
    setStep(0);
    setStat('主程序移位中','stat-main');
    paintLeds();
    R1-=1;
    if(R1<=0){
      A=0xFF; R1=8; PC='RES';
    }
  }

  function startMain(){
    if(inIsr) return;
    playing=true;
    setStat('主程序移位中','stat-main');
    setStep(0);
    setBtns();
    if(mainTimer) clearInterval(mainTimer);
    mainTimer=setInterval(tickMain, MAIN_MS);
  }

  function runIsrChain(){
    // steps 1..11 with timed highlights
    var seq=[
      {s:1, pc:'—',   sp:0x72, p1:null,   delay:ISR_MS,   msg:'中断服务中 · PC 压栈'},
      {s:2, pc:'0003H',sp:0x72, p1:null,   delay:ISR_MS,   msg:'中断服务中 · 向量 0003H'},
      {s:3, pc:'EXT0', sp:0x72, p1:null,   delay:ISR_MS,   msg:'中断服务中 · AJMP EXT0'},
      {s:4, pc:'EXT0', sp:0x73, p1:null,   delay:ISR_MS,   msg:'中断服务中 · PUSH ACC'},
      {s:5, pc:'EXT0', sp:0x74, p1:null,   delay:ISR_MS,   msg:'中断服务中 · PUSH PSW'},
      {s:6, pc:'EXT0', sp:0x74, p1:null,   delay:ISR_MS,   msg:'中断服务中 · SETB RS1'},
      {s:7, pc:'EXT0', sp:0x74, p1:0xFF,   delay:ISR_MS*1.4, msg:'中断服务中 · 全灭 P1=#FF'},
      {s:8, pc:'EXT0', sp:0x74, p1:0x00,   delay:ISR_MS*1.4, msg:'中断服务中 · 全亮 P1=#00'},
      {s:9, pc:'EXT0', sp:0x73, p1:null,   delay:ISR_MS,   msg:'中断服务中 · POP PSW'},
      {s:10,pc:'EXT0', sp:0x72, p1:null,   delay:ISR_MS,   msg:'中断服务中 · POP ACC'},
      {s:11,pc:'Loop', sp:0x70, p1:null,   delay:ISR_MS,   msg:'RETI · 返回主程序'}
    ];
    var i=0;
    function next(){
      if(i>=seq.length){
        inIsr=false;
        // restore main A/R1 and P1 from saved main state
        A=savedA; R1=savedR1; P1=A; PC='Loop'; SP=0x70;
        setStep(0);
        setStat(playing?'主程序移位中':'就绪', playing?'stat-main':'stat-main');
        paintLeds();
        setBtns();
        if(playing){
          if(mainTimer) clearInterval(mainTimer);
          mainTimer=setInterval(tickMain, MAIN_MS);
        }
        return;
      }
      var st=seq[i++];
      setStep(st.s);
      PC=st.pc; SP=st.sp;
      if(st.p1!==null) P1=st.p1;
      setStat(st.msg,'stat-isr');
      paintLeds();
      isrTimer=setTimeout(next, st.delay);
    }
    next();
  }

  function startIsr(){
    if(inIsr) return;
    inIsr=true;
    if(mainTimer){ clearInterval(mainTimer); mainTimer=null; }
    savedA=A; savedR1=R1;
    setBtns();
    setStat('中断服务中','stat-isr');
    runIsrChain();
  }

  function resetAll(){
    if(isrTimer){ clearTimeout(isrTimer); isrTimer=null; }
    stopMain();
    inIsr=false; pendingInt=false;
    A=0xFF; R1=8; P1=0xFF; PC='0030H'; SP=0x70;
    setStep(0);
    setStat('就绪','stat-main');
    paintLeds();
    setBtns();
  }

  $('#ex53Start').onclick=function(){ startMain(); };
  $('#ex53Pause').onclick=function(){
    stopMain();
    if(!inIsr) setStat('已暂停','stat-main');
  };
  $('#ex53Reset').onclick=function(){ resetAll(); };
  $('#ex53Int0').onclick=function(){
    if(inIsr) return;
    if(playing){ pendingInt=true; startIsr(); }
    else { startIsr(); }
  };

  resetAll();
})();}catch(e){}


/* ---------- ⑬ 例5-1 单外部中断源采数 ---------- */
try{(function(){
  var stepsEl=$('#ex51Steps'), ramEl=$('#ex51Ram');
  if(!ramEl) return;
  var DPTR=0x1000, P30=1, sample=0x5A, ACC=0, inIsr=false, autoTimer=null, stepIdx=0;
  var RAM_SLOTS=8, ram=[], justIdx=-1;
  var FIXED_SAMPLES=[0x5A,0xA5,0x3C,0xC3,0x12,0x34,0x56,0x78];
  var sampleCount=0;
  var STEP_MS=520;

  function hex2(v){ var h=(v&0xFF).toString(16).toUpperCase(); return (h.length<2?'0':'')+h+'H'; }
  function hex4(v){ var h=(v&0xFFFF).toString(16).toUpperCase(); while(h.length<4)h='0'+h; return h+'H'; }

  function buildRam(){
    ram=[];
    for(var i=0;i<RAM_SLOTS;i++) ram.push(null);
    justIdx=-1;
    paintRam();
  }
  function paintRam(){
    ramEl.innerHTML=ram.map(function(v,i){
      var addr=0x1000+i;
      var cls='cell'+(v!==null?' filled':'')+(i===justIdx?' just':'');
      return '<div class="'+cls+'"><span class="addr">'+hex4(addr)+'</span><span class="val">'+(v===null?'··':hex2(v))+'</span></div>';
    }).join('');
  }

  function setStat(txt, cls){
    var el=$('#ex51Stat'); if(!el) return;
    el.textContent=txt; el.className='v '+cls;
  }
  function setStep(n){
    if(!stepsEl) return;
    $$('#ex51Steps li').forEach(function(li){
      var s=+li.dataset.s;
      li.classList.toggle('cur', s===n);
      li.classList.toggle('done', s<n && n>=0);
    });
  }
  function setPulse(on){
    var p=$('#ex51Pulse'); if(p) p.classList.toggle('on', !!on);
  }
  function paintHud(){
    var a=$('#ex51P1'); if(a) a.textContent=inIsr && stepIdx>=8 ? hex2(ACC) : (ACC?hex2(ACC):'—');
    var d=$('#ex51Dptr'); if(d) d.textContent=hex4(DPTR);
    var p=$('#ex51P30'); if(p) p.textContent=String(P30);
  }
  function setBtns(){
    var bInt=$('#ex51Int0'), bNext=$('#ex51Next'), bAuto=$('#ex51Auto');
    if(bInt) bInt.disabled=inIsr;
    if(bNext) bNext.disabled=!inIsr;
    if(bAuto) bAuto.disabled=!inIsr;
  }
  function stopAuto(){
    if(autoTimer){ clearTimeout(autoTimer); autoTimer=null; }
  }

  // ISR step actions 1..13 (0 = idle)
  function applyStep(n){
    stepIdx=n;
    setStep(n);
    if(n===0){
      P30=1; setPulse(false);
      setStat('主循环空转','stat-main');
    }else if(n===1){
      setStat('中断服务 · 向量→INT0_ISR','stat-isr');
      setPulse(false); P30=1;
    }else if(n===2){
      setStat('中断服务 · PUSH PSW','stat-isr');
    }else if(n===3){
      setStat('中断服务 · PUSH ACC','stat-isr');
    }else if(n===4){
      P30=0; setPulse(true);
      setStat('中断服务 · CLR P3.0 选通','stat-isr');
    }else if(n===5){
      P30=0; setPulse(true);
      setStat('中断服务 · NOP×2','stat-isr');
    }else if(n===6){
      P30=1; setPulse(true);
      setStat('中断服务 · SETB P3.0','stat-isr');
    }else if(n===7){
      setPulse(false);
      setStat('中断服务 · MOV P1,#0FFH','stat-isr');
    }else if(n===8){
      ACC=sample;
      setStat('中断服务 · MOV A,P1 = '+hex2(ACC),'stat-isr');
    }else if(n===9){
      var slot=DPTR-0x1000;
      if(slot>=0 && slot<RAM_SLOTS){ ram[slot]=ACC; justIdx=slot; }
      else {
        // wrap visual: shift left if full
        if(ram.every(function(x){return x!==null;})){
          ram.shift(); ram.push(ACC); justIdx=RAM_SLOTS-1;
        } else {
          for(var i=0;i<RAM_SLOTS;i++){ if(ram[i]===null){ ram[i]=ACC; justIdx=i; break; } }
        }
      }
      paintRam();
      setStat('中断服务 · MOVX @DPTR,A','stat-isr');
    }else if(n===10){
      DPTR=(DPTR+1)&0xFFFF;
      justIdx=-1; paintRam();
      setStat('中断服务 · INC DPTR','stat-isr');
    }else if(n===11){
      setStat('中断服务 · POP ACC','stat-isr');
    }else if(n===12){
      setStat('中断服务 · POP PSW','stat-isr');
    }else if(n===13){
      setPulse(false); P30=1;
      setStat('RETI · 回主循环空转','stat-main');
    }
    paintHud();
  }

  function finishIsr(){
    inIsr=false; stopAuto();
    applyStep(0);
    setBtns();
  }

  function nextStep(){
    if(!inIsr) return;
    if(stepIdx>=13){ finishIsr(); return; }
    applyStep(stepIdx+1);
    if(stepIdx>=13){
      // brief hold then idle
      setTimeout(function(){ if(stepIdx>=13) finishIsr(); }, 380);
    }
  }

  function startIsr(){
    if(inIsr) return;
    stopAuto();
    inIsr=true;
    sample=FIXED_SAMPLES[sampleCount % FIXED_SAMPLES.length];
    sampleCount+=1;
    ACC=0; justIdx=-1; paintRam();
    applyStep(1);
    setBtns();
  }

  function runAuto(){
    if(!inIsr) return;
    stopAuto();
    function tick(){
      if(!inIsr) return;
      if(stepIdx>=13){ finishIsr(); return; }
      nextStep();
      if(inIsr && stepIdx<13) autoTimer=setTimeout(tick, STEP_MS);
      else if(inIsr && stepIdx>=13){ /* finishIsr scheduled */ }
    }
    autoTimer=setTimeout(tick, STEP_MS);
  }

  function resetAll(){
    stopAuto();
    inIsr=false; sampleCount=0; DPTR=0x1000; P30=1; ACC=0; sample=0x5A;
    buildRam();
    applyStep(0);
    var a=$('#ex51P1'); if(a) a.textContent='—';
    setBtns();
  }

  $('#ex51Int0').onclick=function(){ if(!inIsr) startIsr(); };
  $('#ex51Next').onclick=function(){ stopAuto(); nextStep(); };
  $('#ex51Auto').onclick=function(){ if(inIsr) runAuto(); };
  $('#ex51Reset').onclick=function(){ resetAll(); };

  resetAll();
})();}catch(e){}

})();
