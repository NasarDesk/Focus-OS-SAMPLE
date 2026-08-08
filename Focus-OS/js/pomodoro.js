
/* ============ MANUAL LOG ============ */
function openLogModal(type){
  document.getElementById('logTargetType').value = type;
  document.getElementById('log-date').value = todayStr();
  document.getElementById('log-duration').value = 30;
  document.getElementById('log-duration-h').value = '';
  document.getElementById('log-duration-m').value = '';
  renderLogTargetOptions();
  document.getElementById('logModal').classList.add('active');
}
function renderLogTargetOptions(){
  const type = document.getElementById('logTargetType').value;
  const sel = document.getElementById('logTargetId');
  const items = type==='task' ? DATA.tasks.filter(t=>t.status!=='completed') : DATA.habits;
  sel.innerHTML = items.length? items.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('') : `<option value="">Create one first</option>`;
}
function saveManualLog(){
  const type = document.getElementById('logTargetType').value;
  const targetId = document.getElementById('logTargetId').value;
  const duration = parseFloat(document.getElementById('log-duration').value)||0;
  const date = document.getElementById('log-date').value || todayStr();
  if(!targetId || duration<=0){ toast('Fill in all fields'); return; }
  DATA.sessions.push({ id:uid(), type:'focus', duration, date:dateFromKey(date).toISOString(), manual:true, taskId: type==='task'?targetId:null, habitId: type==='habit'?targetId:null });
  if(type==='task'){
    const t = DATA.tasks.find(x=>x.id===targetId);
    t.actualFocusTime = (t.actualFocusTime||0) + duration;
    t.sessionCount = (t.sessionCount||0)+1;
    if(t.requiredFocusTime>0 && t.actualFocusTime>=t.requiredFocusTime && t.status!=='completed'){
      t.status='completed'; t.completedAt=new Date().toISOString(); t.progress=100;
      toast(`ðŸŽ‰ "${t.name}" completed via logged time!`);
    }
  } else {
    const h = DATA.habits.find(x=>x.id===targetId);
    if(h.trackTime) h.timeLog[date] = (h.timeLog[date]||0) + duration;
    if(h.trackCompletion) h.completions[date] = true;
  }
  save(); closeModal('logModal'); toast('Time logged');
  renderTasks(); renderHabits(); renderToday(); renderDashboard();
}

/* ============ POMODORO ENGINE ============ */
let pomo = {
  mode:'focus', totalSec: 25*60, remaining: 25*60, running:false,
  intervalId:null, taskId:null, startedAt:null, elapsedBeforePause:0, sessionAccumMin:0,
};
/* Computes remaining time from actual wall-clock elapsed time (not tick count),
   so the timer can never drift even if setInterval fires late (tab throttling, etc). */
function pomoComputeRemaining(){
  if(!pomo.running) return pomo.remaining;
  const elapsed = pomo.elapsedBeforePause + (Date.now()-pomo.startedAt)/1000;
  return Math.max(0, pomo.totalSec - elapsed);
}
function pomoDurationSec(mode){
  const s = DATA.settings;
  return (mode==='focus'?s.focus: mode==='short'?s.short:s.long) * 60;
}
function selectTaskForPomo(id){ pomo.taskId = id; renderPomodoroPage(); }
function fillQuickSettings(){
  document.getElementById('qs-focus').value = DATA.settings.focus;
  document.getElementById('qs-short').value = DATA.settings.short;
  document.getElementById('qs-long').value = DATA.settings.long;
  document.getElementById('qs-sessions').value = DATA.settings.sessionsBeforeLong||4;
  document.getElementById('qs-autobreak').checked = !!DATA.settings.autobreak;
  document.getElementById('qs-autonext').checked = !!DATA.settings.autonext;
  syncHoursMinsFromTotal('qs-focus','qs-focus-h','qs-focus-m');
  syncHoursMinsFromTotal('qs-short','qs-short-h','qs-short-m');
  syncHoursMinsFromTotal('qs-long','qs-long-h','qs-long-m');
}
function updateQuickSettings(){
  DATA.settings.focus = parseFloat(document.getElementById('qs-focus').value)||25;
  DATA.settings.short = parseFloat(document.getElementById('qs-short').value)||5;
  DATA.settings.long = parseFloat(document.getElementById('qs-long').value)||15;
  DATA.settings.sessionsBeforeLong = parseInt(document.getElementById('qs-sessions').value)||4;
  DATA.settings.autobreak = document.getElementById('qs-autobreak').checked;
  DATA.settings.autonext = document.getElementById('qs-autonext').checked;
  save();
  if(!pomo.running){ pomo.totalSec = pomoDurationSec(pomo.mode); pomo.remaining = pomo.totalSec; updateTimerDisplay(); }
}
function renderPomodoroPage(){
  renderDailyThoughts();
  fillQuickSettings();
  document.getElementById('pomoTaskList').innerHTML = DATA.tasks.filter(t=>t.status!=='completed').map(t=>
    `<div class="select-task-row ${pomo.taskId===t.id?'selected':''}" onclick="selectTaskForPomo('${t.id}')">
      <div style="font-weight:500;">${esc(t.name)}</div>
      <div class="subtle">${t.requiredFocusTime? fmtMin(t.actualFocusTime)+' / '+fmtMin(t.requiredFocusTime) : 'No focus goal set'}</div>
    </div>`).join('') || `<div class="empty">No active tasks. Create one first.</div>`;
  const t = DATA.tasks.find(x=>x.id===pomo.taskId);
  document.getElementById('pomoSelectedTask').textContent = t ? `Working on: ${t.name}` : 'Please select a taskâ€¦';
  renderTodaySessions();
  renderTodayProgress();
  updateTimerDisplay();
}
function renderTodaySessions(){
  // Ascending order first so per-task session numbers are chronological, then displayed most-recent-first.
  const ascending = DATA.sessions.filter(s=>localDateStr(new Date(s.date))===todayStr() && s.type==='focus').sort((a,b)=>new Date(a.date)-new Date(b.date));
  const taskSessionCount = {};
  const enriched = ascending.map(s=>{
    const key = s.taskId || '__none__';
    taskSessionCount[key] = (taskSessionCount[key]||0)+1;
    const finish = new Date(s.date);
    const start = new Date(finish.getTime() - s.duration*60000);
    const task = DATA.tasks.find(x=>x.id===s.taskId);
    return { s, task, sessionNum: taskSessionCount[key], start, finish };
  }).reverse(); // most recent first for display
  document.getElementById('pomoSessions').innerHTML = enriched.length? enriched.map(e=>{
    const name = e.task ? e.task.name : 'Unlinked session';
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="font-weight:500;font-size:13px;">${esc(name)} <span class="subtle">Session ${e.sessionNum}</span>${e.s.manual?' <span class="subtle">(logged)</span>':''}</div>
      <div class="task-meta">Start: ${e.start.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} Â· Finish: ${e.finish.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} Â· Duration: ${fmtMin(e.s.duration)}</div>
    </div>`;
  }).join('') : `<div class="empty">No sessions yet today</div>`;
}
function renderTodayProgress(){
  const focusToday = focusMinutesInRange(...dayRange());
  const goal = DATA.settings.goalFocus||240;
  const sessionsToday = DATA.sessions.filter(s=>localDateStr(new Date(s.date))===todayStr() && s.type==='focus').length;
  const tasksToday = DATA.tasks.filter(t=>t.completedAt && localDateStr(new Date(t.completedAt))===todayStr()).length;
  document.getElementById('pomoTodayProgress').innerHTML = `
    <div class="task-meta" style="padding:4px 0;display:flex;justify-content:space-between;"><span>Focus time</span><span>${fmtMin(focusToday)} / ${fmtMin(goal)}</span></div>
    <div class="progress-bar" style="margin-bottom:8px;"><div class="progress-fill" style="width:${Math.min(100,Math.round(focusToday/goal*100))}%"></div></div>
    <div class="task-meta" style="padding:4px 0;display:flex;justify-content:space-between;"><span>Sessions completed</span><span>${sessionsToday}</span></div>
    <div class="task-meta" style="padding:4px 0;display:flex;justify-content:space-between;"><span>Tasks completed</span><span>${tasksToday}</span></div>
  `;
}
function updateTimerDisplay(){
  const totalWhole = Math.max(0, Math.floor(pomo.remaining));
  const totalMinutesRemaining = Math.floor(totalWhole/60);
  const h = Math.floor(totalMinutesRemaining/60);
  const m = (totalMinutesRemaining%60).toString().padStart(2,'0');
  document.getElementById('timerDisplay').textContent = `${h}:${m}`;
  document.getElementById('timerMode').textContent = pomo.mode==='focus'?'Focus Session': pomo.mode==='short'?'Short Break':'Long Break';
  const total = pomo.totalSec || 1;
  const pct = 1 - (pomo.remaining/total);
  const circumference = 2*Math.PI*132;
  const ring = document.getElementById('ringFg');
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference * (1-pct);
}
function pomoStart(){
  if(!pomo.running && pomo.remaining===pomoDurationSec(pomo.mode)){
    pomo.totalSec = pomoDurationSec(pomo.mode);
    pomo.remaining = pomo.totalSec;
    pomo.elapsedBeforePause = 0;
  }
  pomo.running = true; pomo.startedAt = Date.now();
  document.getElementById('btnStart').style.display='none';
  document.getElementById('btnPause').style.display='inline-block';
  document.getElementById('btnResume').style.display='none';
  document.getElementById('btnStop').style.display='inline-block';
  clearInterval(pomo.intervalId);
  pomo.intervalId = setInterval(tick, 250);
  tick();
}
function tick(){
  pomo.remaining = pomoComputeRemaining();
  if(pomo.mode==='focus') pomo.sessionAccumMin = (pomo.totalSec-pomo.remaining)/60;
  updateTimerDisplay();
  if(pomo.remaining<=0){ pomoComplete(); }
}
function pomoPause(){
  pomo.elapsedBeforePause += (Date.now()-pomo.startedAt)/1000;
  pomo.remaining = Math.max(0, pomo.totalSec - pomo.elapsedBeforePause);
  pomo.running=false; clearInterval(pomo.intervalId);
  document.getElementById('btnPause').style.display='none';
  document.getElementById('btnResume').style.display='inline-block';
  updateTimerDisplay();
}
function pomoResume(){ pomoStart(); }
function pomoStop(){
  const elapsedSec = pomo.totalSec - pomoComputeRemaining();
  if(pomo.mode==='focus' && elapsedSec>0.5){
    logFocusSession(elapsedSec/60);
  }
  clearInterval(pomo.intervalId);
  pomo.running=false; pomo.mode='focus'; pomo.totalSec=pomoDurationSec('focus'); pomo.remaining=pomo.totalSec; pomo.elapsedBeforePause=0;
  resetButtons(); renderPomodoroPage();
}
function pomoReset(){
  clearInterval(pomo.intervalId); pomo.running=false;
  pomo.totalSec = pomoDurationSec(pomo.mode); pomo.remaining=pomo.totalSec; pomo.elapsedBeforePause=0;
  resetButtons(); updateTimerDisplay();
}
function pomoSkip(){
  clearInterval(pomo.intervalId); pomo.running=false;
  pomoComplete(true);
}
function resetButtons(){
  document.getElementById('btnStart').style.display='inline-block';
  document.getElementById('btnPause').style.display='none';
  document.getElementById('btnResume').style.display='none';
  document.getElementById('btnStop').style.display='none';
}
function pomoComplete(skipped){
  clearInterval(pomo.intervalId); pomo.running=false;
  if(pomo.mode==='focus' && !skipped){
    logFocusSession(pomo.totalSec/60);
    playBeep();
  }
  if(pomo.mode==='focus'){
    const focusCountToday = DATA.sessions.filter(s=>localDateStr(new Date(s.date))===todayStr() && s.type==='focus').length;
    pomo.mode = (focusCountToday>0 && focusCountToday%(DATA.settings.sessionsBeforeLong||4)===0) ? 'long' : 'short';
  } else { pomo.mode='focus'; }
  pomo.totalSec = pomoDurationSec(pomo.mode); pomo.remaining = pomo.totalSec;
  resetButtons();
  if((pomo.mode!=='focus' && DATA.settings.autobreak) || (pomo.mode==='focus' && DATA.settings.autonext)){
    setTimeout(pomoStart, 800);
  }
  renderPomodoroPage(); renderDashboard(); renderTasks();
}
function playBeep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value=880; g.gain.value=0.1;
    o.start(); setTimeout(()=>{o.stop();ctx.close();},300);
  }catch(e){}
}
function logFocusSession(minutes){
  if(minutes<0.1) return;
  const session = { id:uid(), type:'focus', duration:minutes, date:new Date().toISOString(), taskId:pomo.taskId, manual:false };
  DATA.sessions.push(session);
  if(pomo.taskId){
    const t = DATA.tasks.find(x=>x.id===pomo.taskId);
    if(t){
      t.actualFocusTime = (t.actualFocusTime||0)+minutes;
      t.sessionCount = (t.sessionCount||0)+1;
      t.status = t.status==='not_started' ? 'in_progress' : t.status;
      if(t.requiredFocusTime>0 && t.actualFocusTime>=t.requiredFocusTime && t.status!=='completed'){
        t.status='completed'; t.completedAt=new Date().toISOString(); t.progress=100;
        toast(`ðŸŽ‰ Task "${t.name}" completed!`);
      }
    }
  }
  DATA.xp = (DATA.xp||0) + Math.round(minutes);
  save();
}
