
/* ============ REPORTS (merged with former Statistics) ============ */
let reportMode='day';
let reportOffset=0;
let reportSubjectFilter='all';
const OTHER_CATEGORIES = ['Coding','Reading','Work','Personal','Completion','Assignment','Other'];
function setReportMode(m){ reportMode=m; reportOffset=0; document.querySelectorAll('#reportTabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.m===m)); renderReports(); }
function reportShift(dir){ reportOffset += dir; renderReports(); }
function reportJumpToday(){ reportOffset = 0; renderReports(); }
function jumpToMonth(val){ const [y,m] = val.split('-').map(Number); const now=new Date(); reportOffset = (y-now.getFullYear())*12 + (m-now.getMonth()); renderReports(); }
function jumpToYear(val){ const now=new Date(); reportOffset = parseInt(val)-now.getFullYear(); renderReports(); }
function getRangeDates(){
  const now = new Date();
  if(reportMode==='day'){ const d=new Date(now); d.setDate(d.getDate()+reportOffset); return dayRange(d); }
  if(reportMode==='week'){ const s=startOfWeek(now); s.setDate(s.getDate()+reportOffset*7); return [s, new Date(s.getTime()+7*86400000)]; }
  if(reportMode==='month'){ const d=new Date(now.getFullYear(), now.getMonth()+reportOffset, 1); return [d, new Date(d.getFullYear(), d.getMonth()+1, 1)]; }
  if(reportMode==='year'){ const y=now.getFullYear()+reportOffset; return [new Date(y,0,1), new Date(y+1,0,1)]; }
  return dayRange();
}
function reportRangeLabelText(start){
  const now = new Date();
  if(reportMode==='day'){
    if(reportOffset===0) return 'Today';
    if(reportOffset===-1) return 'Yesterday';
    return start.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric', year:'numeric'});
  }
  if(reportMode==='week'){
    const end = new Date(start.getTime()+6*86400000);
    return `${start.toLocaleDateString([], {month:'short',day:'numeric'})} â€“ ${end.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}`;
  }
  if(reportMode==='month') return start.toLocaleDateString([], {month:'long', year:'numeric'});
  if(reportMode==='year') return start.getFullYear().toString();
  return '';
}
function populateReportNavControls(start){
  const monthSel = document.getElementById('reportMonthSelect');
  const yearSel = document.getElementById('reportYearSelect');
  const weekDaysEl = document.getElementById('reportWeekDays');
  const exportBtn = document.getElementById('reportExportBtn');
  monthSel.style.display = reportMode==='month' ? 'inline-block' : 'none';
  yearSel.style.display = (reportMode==='month'||reportMode==='year') ? 'inline-block' : 'none';
  weekDaysEl.style.display = reportMode==='week' ? 'block' : 'none';
  exportBtn.style.display = reportMode==='month' ? 'inline-block' : 'none';

  // Years available: from earliest session/habit data through current year, at least 3 years span
  const now = new Date();
  let earliestYear = now.getFullYear();
  DATA.sessions.forEach(s=>{ const y=new Date(s.date).getFullYear(); if(y<earliestYear) earliestYear=y; });
  const years=[]; for(let y=earliestYear; y<=Math.max(now.getFullYear(), start.getFullYear()); y++) years.push(y);
  const curYear = start.getFullYear();
  if(reportMode==='month'||reportMode==='year'){
    yearSel.innerHTML = years.map(y=>`<option value="${y}" ${y===curYear?'selected':''}>${y}</option>`).join('');
  }
  if(reportMode==='month'){
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthSel.innerHTML = monthNames.map((name,i)=>`<option value="${curYear}-${i}" ${i===start.getMonth()?'selected':''}>${name}</option>`).join('');
  }
  if(reportMode==='week'){
    const days=[]; for(let i=0;i<7;i++) days.push(new Date(start.getTime()+i*86400000));
    weekDaysEl.innerHTML = `<div class="grid" style="grid-template-columns:repeat(7,1fr);gap:8px;">` + days.map(d=>{
      const key = todayStr(d);
      const min = focusSessionsMatchingFilter(sessionsInRange(...dayRange(d)).filter(s=>s.type==='focus')).reduce((a,s)=>a+s.duration,0);
      return `<div class="card subject-clickable" style="padding:10px;text-align:center;" onclick="openDayDetail('${key}')">
        <div style="font-weight:600;font-size:12px;">${d.toLocaleDateString([], {weekday:'short'})}</div>
        <div class="subtle" style="font-size:11px;">${d.getDate()}</div>
        <div style="font-size:13px;margin-top:4px;">${min>0? fmtMin(min) : 'â€”'}</div>
      </div>`;
    }).join('') + `</div>`;
  }
}
function populateReportSubjectFilter(){
  const sel = document.getElementById('reportSubjectFilter');
  if(!sel) return;
  const prev = reportSubjectFilter;
  const allCats = [...SUBJECT_DEFS.map(s=>s.name), ...OTHER_CATEGORIES, ...DATA.customCategories];
  sel.innerHTML = '<option value="all">All Subjects / Categories</option>' + allCats.map(c=>`<option value="${esc(c)}" ${c===prev?'selected':''}>${esc(c)}</option>`).join('');
  sel.value = prev; // if prev no longer valid, falls back to 'all' automatically via browser default
  if(sel.value !== prev) reportSubjectFilter = 'all';
}
function focusSessionsMatchingFilter(sessions){
  if(reportSubjectFilter==='all') return sessions;
  return sessions.filter(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); return t && t.category===reportSubjectFilter; });
}
function tasksMatchingFilter(tasks){
  if(reportSubjectFilter==='all') return tasks;
  return tasks.filter(t=>t.category===reportSubjectFilter);
}
function renderReports(){
  reportSubjectFilter = document.getElementById('reportSubjectFilter') ? (document.getElementById('reportSubjectFilter').value || 'all') : 'all';
  populateReportSubjectFilter();

  const [start,end] = getRangeDates();
  activeReportRange={start:new Date(start),end:new Date(end)};
  renderGoalProgress(start,end);
  renderLifetimeOverview(start,end);
  document.getElementById('reportRangeLabel').textContent = reportRangeLabelText(start);
  populateReportNavControls(start);
  const sess = focusSessionsMatchingFilter(sessionsInRange(start,end).filter(s=>s.type==='focus'));
  const totalFocus = sess.reduce((a,s)=>a+s.duration,0);
  document.getElementById('r-focus').textContent = fmtMin(totalFocus);
  document.getElementById('r-sessions').textContent = sess.length;
  const tasksCompleted = tasksMatchingFilter(DATA.tasks.filter(t=>t.completedAt && new Date(t.completedAt)>=start && new Date(t.completedAt)<end)).length;
  document.getElementById('r-tasks').textContent = tasksCompleted;
  let habitsCompleted=0;
  if(reportSubjectFilter==='all'){
    DATA.habits.forEach(h=>Object.keys(h.completions).forEach(k=>{ const d=dateFromKey(k); if(d>=start&&d<end) habitsCompleted++; }));
  }
  document.getElementById('r-habits').textContent = habitsCompleted;

  const days=[]; let cursor=new Date(start);
  const maxDays=reportMode==='year'?366:reportMode==='month'?31:reportMode==='week'?7:1;
  while(cursor<end && days.length<maxDays){ days.push(new Date(cursor)); cursor.setDate(cursor.getDate()+1); }
  const labels = days.map(d=>d.toLocaleDateString([], {month:'short',day:'numeric'}));
  const vals = days.map(d=>focusSessionsMatchingFilter(sessionsInRange(...dayRange(d)).filter(s=>s.type==='focus')).reduce((a,s)=>a+s.duration,0));
  drawChart('chartReportBar','bar',labels,[{label:'Minutes',data:vals,backgroundColor:'#ff5f5f'}]);

  if(reportSubjectFilter==='all'){
    const catTotals={};
    sess.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); const cat = t?t.category:'Other'; catTotals[cat]=(catTotals[cat]||0)+s.duration; });
    const catLabels = Object.keys(catTotals).length? Object.keys(catTotals):['No data'];
    const catVals = Object.keys(catTotals).length? Object.values(catTotals):[1];
    drawChart('chartReportPie','doughnut',catLabels,[{data:catVals,backgroundColor:['#5b8cff','#ff5f5f','#3ecf8e','#f5c451','#a58bff','#4dd0e1','#e879f9','#fb923c','#38bdf8']}]);
  } else {
    // Filtered to one subject: break down by individual task instead of by category
    const taskTotals={};
    sess.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); const name = t?t.name:'Unlinked session'; taskTotals[name]=(taskTotals[name]||0)+s.duration; });
    const taskLabels = Object.keys(taskTotals).length? Object.keys(taskTotals):['No data'];
    const taskVals = Object.keys(taskTotals).length? Object.values(taskTotals):[1];
    drawChart('chartReportPie','doughnut',taskLabels,[{data:taskVals,backgroundColor:['#5b8cff','#ff5f5f','#3ecf8e','#f5c451','#a58bff','#4dd0e1','#e879f9','#fb923c','#38bdf8']}]);
  }

  document.getElementById('insights').innerHTML = generateInsights(start,end).map(i=>`<div class="insight">${i}</div>`).join('') || `<div class="empty">Log more sessions to unlock insights</div>`;

  renderYearActivity(start,end);

  const monthLabels=[], monthVals=[];
  const chartAnchor=new Date(end.getFullYear(),end.getMonth()-1,1);
  for(let i=11;i>=0;i--){ const d=new Date(chartAnchor.getFullYear(),chartAnchor.getMonth()-i,1); const s=new Date(d.getFullYear(),d.getMonth(),1); const e=new Date(d.getFullYear(),d.getMonth()+1,1);
    monthLabels.push(d.toLocaleDateString([], {month:'short'})); monthVals.push(focusSessionsMatchingFilter(sessionsInRange(s,e).filter(x=>x.type==='focus')).reduce((a,x)=>a+x.duration,0)); }
  drawChart('chartMonthly','line',monthLabels,[{label:'Minutes',data:monthVals,borderColor:'#3ecf8e',backgroundColor:'rgba(62,207,142,.15)',fill:true,tension:.3}]);
}
function renderGoalProgress(rangeStart,rangeEnd){
  const goalDaily = DATA.settings.goalFocus||240;
  const start=rangeStart||startOfDay(), end=rangeEnd||new Date(start.getTime()+86400000), days=Math.max(1,Math.round((end-start)/86400000));
  const focusToday = focusMinutesInRange(start,end), rangeGoal=goalDaily*days;
  const dailyPct = Math.min(100, Math.round((focusToday/rangeGoal)*100));
  document.getElementById('goal-daily-label').textContent = `${fmtMin(focusToday)} / ${fmtMin(rangeGoal)}`;
  document.getElementById('goal-daily-bar').style.width = dailyPct+'%';

  const monthlyPct = dailyPct;
  document.getElementById('goal-monthly-label').textContent = `${(focusToday/60).toFixed(1)}h / ${(rangeGoal/60).toFixed(1)}h`;
  document.getElementById('goal-monthly-bar').style.width = monthlyPct+'%';
}
function renderLifetimeOverview(rangeStart,rangeEnd){
  const start=rangeStart||new Date(0), end=rangeEnd||new Date();
  const allFocusSessions = focusSessionsMatchingFilter(sessionsInRange(start,end).filter(s=>s.type==='focus'));
  const totalFocus = allFocusSessions.reduce((a,s)=>a+s.duration,0);
  document.getElementById('s-totalFocus').textContent = (totalFocus/60).toFixed(1)+'h';
  document.getElementById('s-totalSessions').textContent = allFocusSessions.length;
  document.getElementById('s-totalTasks').textContent = tasksMatchingFilter(DATA.tasks.filter(t=>t.completedAt&&new Date(t.completedAt)>=start&&new Date(t.completedAt)<end)).length;
  document.getElementById('s-longestStreak').textContent = longestProductiveStreakInRange(start,end);

  const dowTotals={}; const dowCounts={};
  allFocusSessions.forEach(s=>{ const d=new Date(s.date).toLocaleDateString([], {weekday:'long'}); dowTotals[d]=(dowTotals[d]||0)+s.duration; dowCounts[d]=(dowCounts[d]||0)+1; });
  let bestDay='â€”', bestAvg=0;
  Object.keys(dowTotals).forEach(d=>{ const avg=dowTotals[d]/dowCounts[d]; if(avg>bestAvg){bestAvg=avg;bestDay=d;} });
  document.getElementById('s-bestDay').textContent = bestDay;

  const goal = DATA.settings.goalFocus||240;
  const focusToday = allFocusSessions.reduce((a,s)=>a+s.duration,0), days=Math.max(1,Math.round((end-start)/86400000));
  document.getElementById('s-focusScore').textContent = Math.min(100, Math.round((focusToday/(goal*days))*100));

  let active=0; for(let d=new Date(start);d<end;d.setDate(d.getDate()+1)){ if(focusSessionsMatchingFilter(sessionsInRange(...dayRange(d)).filter(s=>s.type==='focus')).length) active++; }
  document.getElementById('s-consistency').textContent = Math.round(active/days*100)+'%';

  document.getElementById('s-studyStreak').textContent = `${longestProductiveStreakInRange(start,end)} days`;
}
function longestProductiveStreakInRange(start,end){ let best=0,run=0; for(let d=new Date(start);d<end;d.setDate(d.getDate()+1)){ if(focusSessionsMatchingFilter(sessionsInRange(...dayRange(d)).filter(s=>s.type==='focus')).length){best=Math.max(best,++run);}else run=0; } return best; }
function generateInsights(rangeStart,rangeEnd){
  const insights=[];
  const focusSessions = focusSessionsMatchingFilter(sessionsInRange(rangeStart||new Date(0),rangeEnd||new Date()).filter(s=>s.type==='focus'));
  if(focusSessions.length<3) return insights;
  const hourCounts={};
  focusSessions.forEach(s=>{ const h=new Date(s.date).getHours(); hourCounts[h]=(hourCounts[h]||0)+s.duration; });
  const bestHour = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0];
  if(bestHour) insights.push(`You're most productive around <b>${bestHour[0]}:00</b>.`);
  const dowCounts={};
  focusSessions.forEach(s=>{ const d=new Date(s.date).toLocaleDateString([], {weekday:'long'}); dowCounts[d]=(dowCounts[d]||0)+s.duration; });
  const bestDay = Object.entries(dowCounts).sort((a,b)=>b[1]-a[1])[0];
  if(bestDay) insights.push(`Your most productive day is <b>${bestDay[0]}</b>.`);
  const avgLen = focusSessions.reduce((a,s)=>a+s.duration,0)/focusSessions.length;
  insights.push(`Your average focus session is <b>${fmtMin(avgLen)}</b>.`);
  if(reportSubjectFilter==='all'){
    const catTotals={};
    focusSessions.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); const cat=t?t.category:null; if(cat) catTotals[cat]=(catTotals[cat]||0)+s.duration; });
    const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
    if(topCat) insights.push(`You spend the most focus time on <b>${topCat[0]}</b>.`);
  }
  const periodDays=Math.max(1,Math.round(((rangeEnd||new Date())-(rangeStart||new Date(0)))/86400000));
  const priorEnd=new Date(rangeStart||new Date()), priorStart=new Date(priorEnd.getTime()-periodDays*86400000);
  const prior=focusSessionsMatchingFilter(sessionsInRange(priorStart,priorEnd).filter(s=>s.type==='focus')).reduce((a,s)=>a+s.duration,0), current=focusSessions.reduce((a,s)=>a+s.duration,0);
  if(prior>0){ const change=Math.round(((current-prior)/prior)*100); insights.push(`Focus time is ${change>=0?'up':'down'} <b>${Math.abs(change)}%</b> versus the previous period.`); }
  if(reportSubjectFilter==='all'){
    const habitRates = DATA.habits.map(h=>{ const total=Math.max(1,Math.ceil((Date.now()-new Date(h.createdAt))/86400000)); return Object.keys(h.completions).length/total; });
    if(habitRates.length){ const avgRate = Math.round((habitRates.reduce((a,b)=>a+b,0)/habitRates.length)*100); insights.push(`You complete <b>${avgRate}%</b> of your habits on average.`); }
    const overdueRevisions = DATA.events.filter(e=>e.type==='revision' && !e.completed && dateFromKey(e.date)<startOfDay());
    if(overdueRevisions.length) insights.push(`You have <b>${overdueRevisions.length}</b> revision(s) overdue.`);
  }
  return insights;
}

