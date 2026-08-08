
/* ============ PLANNING ============ */
let planView='agenda';
let planRefDate = new Date();
function setPlanView(v){ planView=v; document.querySelectorAll('#planTabs .tab').forEach(t=>t.classList.toggle('active',t.dataset.v===v)); renderPlanning(); }
function planShift(dir){
  if(planView==='day') planRefDate.setDate(planRefDate.getDate()+dir);
  else if(planView==='week') planRefDate.setDate(planRefDate.getDate()+dir*7);
  else planRefDate.setMonth(planRefDate.getMonth()+dir);
  renderPlanning();
}
function filterEventsByType(list){
  const f = document.getElementById('planFilterType')?document.getElementById('planFilterType').value:'all';
  return f==='all'? list : list.filter(e=>e.type===f);
}
function expandRecurringInRange(rangeStart, rangeEnd){
  const out = [];
  DATA.events.forEach(e=>{
    if(!e.repeat || e.repeat==='none'){
      const d = dateFromKey(e.date);
      if(d>=rangeStart && d<rangeEnd) out.push(e);
      return;
    }
    const step = e.repeat==='daily'?1:7;
    let cur = dateFromKey(e.date);
    while(cur < rangeStart){ cur = new Date(cur.getTime()+step*86400000); }
    while(cur < rangeEnd){
      out.push(Object.assign({}, e, {date:todayStr(cur), virtual: todayStr(cur)!==e.date}));
      cur = new Date(cur.getTime()+step*86400000);
    }
  });
  return out;
}
function openEventModal(prefillDate){
  document.getElementById('ev-id').value='';
  document.getElementById('ev-title').value='';
  document.getElementById('ev-type').value='study';
  document.getElementById('ev-priority').value='medium';
  document.getElementById('ev-repeat').value='none';
  document.getElementById('ev-color').value='#5b8cff';
  const subjSel = document.getElementById('ev-subject');
  subjSel.innerHTML = '<option value="">None</option>' + SUBJECT_DEFS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('ev-date').value = prefillDate || todayStr();
  document.getElementById('ev-time').value='';
  document.getElementById('ev-notes').value='';
  document.getElementById('ev-reminder').checked=true;
  document.getElementById('eventModal').classList.add('active');
}
function saveEvent(){
  const title = document.getElementById('ev-title').value.trim();
  if(!title){ toast('Enter a title'); return; }
  const payload = {
    title, type:document.getElementById('ev-type').value,
    subjectId:document.getElementById('ev-subject').value||null,
    date:document.getElementById('ev-date').value || todayStr(),
    time:document.getElementById('ev-time').value,
    priority:document.getElementById('ev-priority').value,
    repeat:document.getElementById('ev-repeat').value,
    color:document.getElementById('ev-color').value,
    notes:document.getElementById('ev-notes').value,
    reminder:document.getElementById('ev-reminder').checked,
  };
  DATA.events.push(Object.assign({id:uid(), completed:false, chapterId:null, auto:false}, payload));
  save(); closeModal('eventModal'); toast('Event scheduled'); renderPlanning(); renderDashboard();
}
function toggleEventDone(id){ const e = DATA.events.find(x=>x.id===id); if(!e) return; e.completed=!e.completed; save(); renderPlanning(); renderDashboard(); }
function deleteEvent(id){
  showConfirm('Delete this event?', ()=>{
    const item=DATA.events.find(e=>e.id===id); if(!item) return;
    DATA.events = DATA.events.filter(e=>e.id!==id); setUndo('Planner',item); renderPlanning(); renderDashboard();
  });
}
function eventRow(e){
  const overdue = !e.completed && dateFromKey(e.date) < startOfDay();
  const subj = e.subjectId? SUBJECT_DEFS.find(s=>s.id===e.subjectId) : null;
  return `<div id="event-${e.id}" class="task-row ${e.completed?'done':''}" style="border-left:3px solid ${e.color||'var(--accent2)'};">
    <div class="chk" onclick="toggleEventDone('${e.id}')"></div>
    <div class="task-main">
      <div class="task-name">${esc(e.title)} ${e.repeat && e.repeat!=='none'?'<span class="subtle">(repeats '+e.repeat+')</span>':''}</div>
      <div class="task-meta">
        <span class="badge p-${e.priority||'medium'}">${e.priority||'medium'}</span>
        <span class="badge p-low">${e.type}</span>
        ${subj?`<span>${subj.name}</span>`:''}
        ${e.time?`<span>${e.time}</span>`:''}
        ${overdue?`<span style="color:var(--accent)">Overdue${e.rescheduled?' Â· rescheduled '+e.rescheduled+'x':''}</span>`:''}
      </div>
    </div>
    <div class="task-actions"><button class="icon-btn" onclick="deleteEvent('${e.id}')">ðŸ—‘ï¸</button></div>
  </div>`;
}
function renderAgendaView(){
  const rangeStart = startOfDay(daysAgo(60));
  const rangeEnd = new Date(Date.now()+120*86400000);
  const all = filterEventsByType(expandRecurringInRange(rangeStart, rangeEnd));
  const overdue = all.filter(e=>!e.completed && dateFromKey(e.date)<startOfDay()).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming = all.filter(e=>dateFromKey(e.date)>=startOfDay()).sort((a,b)=> (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  let html='';
  if(overdue.length) html += `<h3 style="color:var(--accent);">Overdue</h3>` + overdue.map(eventRow).join('');
  const grouped = {};
  upcoming.forEach(e=>{ (grouped[e.date]=grouped[e.date]||[]).push(e); });
  const tomorrowKey = todayStr(new Date(Date.now()+86400000));
  Object.keys(grouped).sort().forEach(date=>{
    const label = date===todayStr()? 'Today' : date===tomorrowKey? 'Tomorrow' : date;
    html += `<h3>${label}</h3>` + grouped[date].map(eventRow).join('');
  });
  return html || `<div class="empty">No events scheduled. Click "+ New Event" to plan a study session.</div>`;
}
function renderDayView(d){
  const key = todayStr(d);
  const [s,e] = dayRange(d);
  const events = filterEventsByType(expandRecurringInRange(s,e)).filter(x=>x.date===key).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  return events.length? events.map(eventRow).join('') : `<div class="empty">Nothing scheduled for this day. <button class="btn btn-sm" onclick="openEventModal('${key}')">+ Add</button></div>`;
}
function renderWeekView(d){
  const start = startOfWeek(d);
  const rangeEnd = new Date(start.getTime()+7*86400000);
  const all = filterEventsByType(expandRecurringInRange(start, rangeEnd));
  let html = '<div class="grid" style="grid-template-columns:repeat(7,1fr);gap:8px;">';
  for(let i=0;i<7;i++){
    const day = new Date(start.getTime()+i*86400000);
    const key = todayStr(day);
    const events = all.filter(e=>e.date===key);
    html += `<div class="card day-col" ondragover="event.preventDefault();this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="onDropEvent(event,'${key}')">
      <div style="font-weight:600;font-size:12px;margin-bottom:6px;">${day.toLocaleDateString([], {weekday:'short', day:'numeric'})}</div>
      ${events.map(e=>`<div class="event-chip" draggable="true" ondragstart="onDragEvent(event,'${e.id}')" style="border-left-color:${e.color||'var(--accent2)'}">${esc(e.title)}</div>`).join('') || '<div class="subtle">â€”</div>'}
    </div>`;
  }
  html += '</div>';
  return html;
}
function onDragEvent(ev,id){ ev.dataTransfer.setData('text/plain', id); }
function onDropEvent(ev,dateKey){
  ev.preventDefault(); ev.currentTarget.classList.remove('dragover');
  const id = ev.dataTransfer.getData('text/plain');
  const e = DATA.events.find(x=>x.id===id);
  if(e){ e.date = dateKey; save(); renderPlanning(); toast('Event moved'); }
}
function renderMonthPlanView(d){
  const first = new Date(d.getFullYear(), d.getMonth(),1);
  const startOffset = (first.getDay()+6)%7;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1,0).getDate();
  const monthEnd = new Date(d.getFullYear(), d.getMonth()+1, 1);
  const all = filterEventsByType(expandRecurringInRange(first, monthEnd));
  let html = '<div class="cal-grid">' + ['Mo','Tu','We','Th','Fr','Sa','Su'].map(x=>`<div class="cal-head">${x}</div>`).join('');
  for(let i=0;i<startOffset;i++) html+='<div></div>';
  for(let day=1; day<=daysInMonth; day++){
    const dateObj = new Date(d.getFullYear(), d.getMonth(), day);
    const key = todayStr(dateObj);
    const events = all.filter(e=>e.date===key);
    html += `<div class="cal-cell ${key===todayStr()?'today':''}" style="cursor:pointer;" onclick="jumpToDay(${d.getFullYear()},${d.getMonth()},${day})">
      <div class="dnum">${day}</div>
      ${events.slice(0,3).map(e=>`<div style="font-size:10px;">${esc(e.title.slice(0,16))}</div>`).join('')}
      ${events.length>3?`<div class="subtle">+${events.length-3} more</div>`:''}
    </div>`;
  }
  html += '</div>';
  return html;
}
function jumpToDay(y,m,day){ planRefDate = new Date(y,m,day); setPlanView('day'); }
function planLabelText(){
  if(planView==='day') return planRefDate.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
  if(planView==='week'){ const s=startOfWeek(planRefDate); const e=new Date(s.getTime()+6*86400000); return `${s.toLocaleDateString([], {month:'short',day:'numeric'})} - ${e.toLocaleDateString([], {month:'short',day:'numeric'})}`; }
  if(planView==='month') return planRefDate.toLocaleDateString([], {month:'long',year:'numeric'});
  return 'Upcoming';
}
function renderExamsView(){
  let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;"><button class="btn btn-primary btn-sm" onclick="openExamModal()">+ New Exam</button></div>`;
  if(!DATA.exams.length) return html + '<div class="empty">No exams scheduled. Add one to track countdown and readiness.</div>';
  html += DATA.exams.slice().sort((a,b)=>a.examDate.localeCompare(b.examDate)).map(examCard).join('');
  return html;
}
function examCard(x){
  const s = SUBJECT_DEFS.find(sub=>sub.id===x.subjectId);
  const daysLeft = Math.ceil((dateFromKey(x.examDate)-startOfDay())/86400000);
  const chapters = DATA.chapters.filter(c=>x.chapterIds.includes(c.id));
  const remaining = chapters.filter(c=>chapterProgress(c)<100).length;
  const readiness = computeReadiness(x.subjectId, x.chapterIds);
  const revisionEvents = DATA.events.filter(e=>e.type==='revision' && x.chapterIds.includes(e.chapterId));
  const revisionProgress = revisionEvents.length? Math.round(revisionEvents.filter(e=>e.completed).length/revisionEvents.length*100):0;
  let paceStatus = 'Not enough data yet';
  const completedDates = chapters.filter(c=>c.completedAt).map(c=>new Date(c.completedAt)).sort((a,b)=>a-b);
  if(remaining===0){ paceStatus = 'Syllabus complete âœ…'; }
  else if(completedDates.length>=2 && daysLeft>0){
    const gaps=[]; for(let i=1;i<completedDates.length;i++) gaps.push((completedDates[i]-completedDates[i-1])/86400000);
    const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const neededDays = remaining*avgGap;
    paceStatus = neededDays<=daysLeft ? 'On track âœ…' : `At risk âš ï¸ â€” needs ~${Math.round(neededDays)}d, only ${daysLeft}d left. Consider studying more chapters per week.`;
  }
  return `<div class="exam-card">
    <div style="display:flex;justify-content:space-between;">
      <div><strong>${esc(x.name)}</strong> <span class="subtle">(${s?s.name:''})</span></div>
      <button class="icon-btn" onclick="deleteExam('${x.id}')">ðŸ—‘ï¸</button>
    </div>
    <div class="grid grid-4" style="margin-top:10px;">
      <div><div class="stat-num" style="font-size:20px;">${daysLeft}</div><div class="stat-sub">days remaining</div></div>
      <div><div class="stat-num" style="font-size:20px;">${remaining}/${chapters.length}</div><div class="stat-sub">chapters remaining</div></div>
      <div><div class="stat-num" style="font-size:20px;">${revisionProgress}%</div><div class="stat-sub">revision progress</div></div>
      <div><div class="stat-num" style="font-size:20px;">${readiness.score}%</div><div class="stat-sub">readiness score</div></div>
    </div>
    <div class="task-meta" style="margin-top:8px;">${paceStatus}</div>
  </div>`;
}
function openExamModal(){
  document.getElementById('ex-subject').innerHTML = SUBJECT_DEFS.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('ex-name').value=''; document.getElementById('ex-date').value=''; document.getElementById('ex-target').value=100;
  renderExamChapterOptions();
  document.getElementById('examModal').classList.add('active');
}
function renderExamChapterOptions(){
  const subjectId = document.getElementById('ex-subject').value;
  const chapters = DATA.chapters.filter(c=>c.subjectId===subjectId && !c._draft);
  document.getElementById('ex-chapters').innerHTML = chapters.length? chapters.map(c=>`<label style="display:block;font-size:12px;margin-bottom:4px;"><input type="checkbox" value="${c.id}" style="width:auto;"> ${esc(c.name)}</label>`).join('') : '<div class="empty">No chapters in this subject yet</div>';
}
function saveExam(){
  const name = document.getElementById('ex-name').value.trim();
  const date = document.getElementById('ex-date').value;
  if(!name || !date){ toast('Enter exam name and date'); return; }
  const chapterIds = Array.from(document.querySelectorAll('#ex-chapters input:checked')).map(el=>el.value);
  DATA.exams.push({id:uid(), subjectId:document.getElementById('ex-subject').value, name, examDate:date, chapterIds, targetCompletion:parseInt(document.getElementById('ex-target').value)||100});
  save(); closeModal('examModal'); toast('Exam scheduled'); renderPlanning();
}
function deleteExam(id){
  showConfirm('Delete this exam?', ()=>{
    DATA.exams = DATA.exams.filter(x=>x.id!==id); save(); renderPlanning();
  });
}
function renderPlanning(){
  document.querySelectorAll('#planTabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.v===planView));
  const body = document.getElementById('planBody');
  const navControls = document.getElementById('planNavControls');
  if(navControls) navControls.style.display = planView==='exams' ? 'none' : 'flex';
  if(planView==='agenda') body.innerHTML = renderAgendaView();
  else if(planView==='day') body.innerHTML = renderDayView(planRefDate);
  else if(planView==='week') body.innerHTML = renderWeekView(planRefDate);
  else if(planView==='exams') body.innerHTML = renderExamsView();
  else body.innerHTML = renderMonthPlanView(planRefDate);
  document.getElementById('planLabel').textContent = planLabelText();
}
