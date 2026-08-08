
/* ============ HABITS ============ */
function openHabitModal(id){
  document.getElementById('hb-id').value = id||'';
  if(id){
    const h = DATA.habits.find(x=>x.id===id);
    document.getElementById('hb-name').value=h.name;
    document.getElementById('hb-category').value=h.category;
    document.getElementById('hb-frequency').value=h.frequency;
    document.getElementById('hb-track-completion').checked = !!h.trackCompletion;
    document.getElementById('hb-track-time').checked = !!h.trackTime;
    document.getElementById('hb-color').value=h.color;
  } else {
    document.getElementById('hb-name').value='';
    document.getElementById('hb-track-completion').checked = true;
    document.getElementById('hb-track-time').checked = false;
    document.getElementById('hb-color').value='#5b8cff';
  }
  document.getElementById('habitModal').classList.add('active');
}
function saveHabit(){
  const name = document.getElementById('hb-name').value.trim();
  if(!name){ toast('Please enter a habit name'); return; }
  const trackCompletion = document.getElementById('hb-track-completion').checked;
  const trackTime = document.getElementById('hb-track-time').checked;
  if(!trackCompletion && !trackTime){ toast('Select at least one tracking type'); return; }
  const id = document.getElementById('hb-id').value;
  const payload = {
    name, category:document.getElementById('hb-category').value,
    frequency:document.getElementById('hb-frequency').value,
    trackCompletion, trackTime,
    color:document.getElementById('hb-color').value
  };
  if(id){ Object.assign(DATA.habits.find(h=>h.id===id), payload); }
  else { DATA.habits.push(Object.assign({id:uid(), completions:{}, timeLog:{}, createdAt:new Date().toISOString()}, payload)); }
  save(); closeModal('habitModal'); toast('Habit saved'); renderHabits();
}
function deleteHabit(id){
  showConfirm('Delete this habit?', ()=>{
    const item=DATA.habits.find(h=>h.id===id); if(!item) return;
    DATA.habits=DATA.habits.filter(h=>h.id!==id); setUndo('Habit',item); renderHabits(); renderDashboard();
  });
}
function toggleHabitDate(id,key){
  const h = DATA.habits.find(x=>x.id===id);
  if(h.completions[key]) delete h.completions[key]; else h.completions[key]=true;
  save(); renderHabits(); renderDashboard();
}
function toggleHabitToday(id){ toggleHabitDate(id, todayStr()); }
/* Productive streak = consecutive days with > 0 minutes of focus time (any amount counts).
   A day only breaks the streak if its total is exactly 0 minutes. If today hasn't had any
   focus time logged yet, that's not treated as a break â€” today just isn't counted yet,
   since the day isn't over. Optional filterVal restricts to one subject/category. */
function computeProductiveStreak(filterVal){
  filterVal = filterVal || 'all';
  const minutesForDay = (day) => {
    const sess = sessionsInRange(...dayRange(day)).filter(s=>s.type==='focus');
    const matched = filterVal==='all' ? sess : sess.filter(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); return t && t.category===filterVal; });
    return matched.reduce((a,s)=>a+s.duration,0);
  };
  let d = new Date();
  if(minutesForDay(d) <= 0){ d = new Date(d.getTime()-86400000); }
  let streak = 0;
  while(minutesForDay(d) > 0){ streak++; d = new Date(d.getTime()-86400000); }
  return streak;
}

/* A habit counts as "done" on a given day if EITHER of its enabled tracking modes shows
   activity â€” a completion mark, or logged time greater than 0 minutes. This lets a single
   habit be tracked both ways at once without double-counting or conflicting logic. */
function habitActiveOnDay(h, key){
  return (h.trackCompletion && !!h.completions[key]) || (h.trackTime && (h.timeLog[key]||0) > 0);
}
function habitActiveDays(h){
  const days = new Set();
  if(h.trackCompletion) Object.keys(h.completions).forEach(k=>{ if(h.completions[k]) days.add(k); });
  if(h.trackTime) Object.keys(h.timeLog).forEach(k=>{ if(h.timeLog[k]>0) days.add(k); });
  return days;
}
function habitStreak(h){
  let streak=0, d=new Date();
  while(true){
    const key = todayStr(d);
    if(habitActiveOnDay(h,key)){ streak++; d.setDate(d.getDate()-1); } else break;
  }
  return streak;
}
function habitLongestStreak(h){
  const dates = [...habitActiveDays(h)].sort();
  let longest=0, cur=0, prev=null;
  dates.forEach(ds=>{
    const d = dateFromKey(ds);
    if(prev && (d-prev)===86400000) cur++; else cur=1;
    longest=Math.max(longest,cur); prev=d;
  });
  return longest;
}
function habitCard(h){
  const streak = habitStreak(h);
  const todayCompletionDone = !!h.completions[todayStr()];
  const todayTimeVal = h.timeLog[todayStr()]||0;
  let heat='';
  for(let i=27;i>=0;i--){ const key=todayStr(daysAgo(i)); const active=habitActiveOnDay(h,key); heat += `<div class="heat-cell ${active?'on':''}" style="${active?`background:${h.color}`:''}" title="${key}"></div>`; }
  const totalDays = Math.max(1, Math.ceil((Date.now()-new Date(h.createdAt))/86400000));
  const rate = Math.round((habitActiveDays(h).size/totalDays)*100);
  const typeLabel = [h.trackCompletion?'completion':null, h.trackTime?'time-based':null].filter(Boolean).join(' + ');
  let actionBtns = '';
  if(h.trackCompletion){
    actionBtns += `<button class="btn btn-sm ${todayCompletionDone?'btn-green':''}" onclick="toggleHabitToday('${h.id}')">${todayCompletionDone?'âœ“ Done':'Mark Done'}</button> `;
  }
  if(h.trackTime){
    actionBtns += `<button class="btn btn-sm ${todayTimeVal>0?'btn-green':''}" onclick="openLogHabitTimeModal('${h.id}','${todayStr()}')">${todayTimeVal>0? 'âœ“ '+habitCellDisplay(h,todayTimeVal) : 'Log Time'}</button>`;
  }
  return `<div id="habit-${h.id}" class="habit-card">
    <div class="habit-top">
      <div class="habit-name"><span class="habit-dot" style="background:${h.color}"></span>${esc(h.name)} <span class="subtle">(${h.category} Â· ${typeLabel})</span></div>
      <div>
        ${actionBtns}
        <button class="icon-btn" onclick="openHabitModal('${h.id}')">âœï¸</button>
        <button class="icon-btn" onclick="deleteHabit('${h.id}')">ðŸ—‘ï¸</button>
      </div>
    </div>
    <div class="task-meta" style="margin-top:8px;">
      <span>ðŸ”¥ Streak: ${streak}</span><span>ðŸ… Best: ${habitLongestStreak(h)}</span><span>âœ… ${rate}% completion</span>
    </div>
    <div class="heat-row">${heat}</div>
  </div>`;
}
function renderHabits(){
  document.getElementById('habits-list').innerHTML = DATA.habits.length? DATA.habits.map(habitCard).join('') : `<div class="empty">No habits yet. Add one to start building streaks.</div>`;
  renderHabitTracker();
}

/* ============ HABIT TRACKER (monthly, navigable, completion + time-based) ============ */
let habitTrackerDate = new Date();
function habitTrackerShift(dir){ habitTrackerDate.setMonth(habitTrackerDate.getMonth()+dir); renderHabitTracker(); }
function habitTrackerToday(){ habitTrackerDate = new Date(); renderHabitTracker(); }
function habitCellDisplay(h, minutesOrTrue, kind){
  if(kind==='time'){
    const mins = typeof minutesOrTrue==='number' ? minutesOrTrue : 0;
    if(!mins) return '';
    return mins>=60 ? (mins/60).toFixed(mins%60===0?0:1)+'h' : mins+'m';
  }
  return minutesOrTrue ? 'âœ•' : '';
}
function onHabitCellClick(habitId, key, kind, isFuture){
  if(isFuture) return;
  const h = DATA.habits.find(x=>x.id===habitId);
  if(!h) return;
  if(kind==='time'){ openLogHabitTimeModal(habitId, key); }
  else { toggleHabitDate(habitId, key); }
}
function renderHabitTracker(){
  const year = habitTrackerDate.getFullYear(), month = habitTrackerDate.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const now = new Date();
  const isCurrentMonth = year===now.getFullYear() && month===now.getMonth();
  const todayDate = now.getDate();
  const labelEl = document.getElementById('habitTrackerLabel');
  if(labelEl) labelEl.textContent = habitTrackerDate.toLocaleDateString([], {month:'long', year:'numeric'});

  const completionHabits = DATA.habits.filter(h=>h.trackCompletion);
  const timeHabits = DATA.habits.filter(h=>h.trackTime);

  function buildGrid(habitList, kind){
    const dowLetters = ['M','T','W','T','F','S','S']; // Mon..Sun
    let html = '<div style="overflow-x:auto;"><table class="ht-table"><thead>';
    html += '<tr><th class="ht-name">Habit</th>';
    for(let d=1; d<=daysInMonth; d++){ html+=`<th>${d}</th>`; }
    html += '</tr><tr><th class="ht-name"></th>';
    for(let d=1; d<=daysInMonth; d++){
      const dow = new Date(year, month, d).getDay(); // 0=Sun..6=Sat
      const letterIndex = (dow+6)%7; // convert to Mon-first index
      html += `<th class="ht-dow">${dowLetters[letterIndex]}</th>`;
    }
    html += '</tr></thead><tbody>';
    if(!habitList.length){ html += `<tr><td colspan="${daysInMonth+1}" class="empty">None yet</td></tr>`; }
    habitList.forEach(h=>{
      html += `<tr><td class="ht-name">${esc(h.name)}</td>`;
      for(let d=1; d<=daysInMonth; d++){
        const key = `${year}-${pad(month+1)}-${pad(d)}`;
        const val = kind==='time' ? (h.timeLog[key]||0) : h.completions[key];
        const future = isCurrentMonth ? d>todayDate : (new Date(year,month,d) > startOfDay());
        const display = habitCellDisplay(h, val, kind);
        html += `<td class="ht-cell ${val?'on':''} ${future?'future':''}" style="${val?`color:${h.color}`:''}" ${future?'':`onclick="onHabitCellClick('${h.id}','${key}','${kind}',false)"`}>${display}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  const compEl = document.getElementById('ht-completionGrid');
  const timeEl = document.getElementById('ht-timeGrid');
  if(compEl) compEl.innerHTML = buildGrid(completionHabits, 'completion');
  if(timeEl) timeEl.innerHTML = buildGrid(timeHabits, 'time');
}
let lhtHabitId = null, lhtKey = null;
function openLogHabitTimeModal(habitId, key){
  const h = DATA.habits.find(x=>x.id===habitId);
  lhtHabitId = habitId; lhtKey = key;
  const existing = (h.timeLog[key])||0;
  document.getElementById('logHabitTimeTitle').textContent = `Log Time â€” ${h.name} (${key})`;
  document.getElementById('lht-hours').value = Math.floor(existing/60);
  document.getElementById('lht-minutes').value = existing%60;
  document.getElementById('logHabitTimeModal').classList.add('active');
}
function saveHabitTimeLog(){
  const hrs = parseInt(document.getElementById('lht-hours').value)||0;
  const mins = parseInt(document.getElementById('lht-minutes').value)||0;
  const total = hrs*60+mins;
  const h = DATA.habits.find(x=>x.id===lhtHabitId);
  if(total>0) h.timeLog[lhtKey] = total; else delete h.timeLog[lhtKey];
  save(); closeModal('logHabitTimeModal'); renderHabitTracker(); renderHabits(); renderDashboard();
}


/* ============ Yearly Activity (GitHub-style contribution heatmap, Monthly + Yearly tabs) ============ */
function buildDayDataRange(numDays){
  const arr = [];
  for(let i=numDays-1;i>=0;i--){
    const d = daysAgo(i);
    const key = todayStr(d);
    const sessCount = DATA.sessions.filter(s=>localDateStr(new Date(s.date))===key).length;
    let habitCount=0; DATA.habits.forEach(h=>{ if(habitActiveOnDay(h,key)) habitCount++; });
    arr.push({date:d, key, count:sessCount+habitCount});
  }
  return arr;
}
function buildMonthDayData(){
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const arr = [];
  for(let d=1; d<=daysInMonth; d++){
    const dateObj = new Date(now.getFullYear(), now.getMonth(), d);
    const key = todayStr(dateObj);
    const sessCount = DATA.sessions.filter(s=>localDateStr(new Date(s.date))===key).length;
    let habitCount=0; DATA.habits.forEach(h=>{ if(habitActiveOnDay(h,key)) habitCount++; });
    arr.push({date:dateObj, key, count:sessCount+habitCount});
  }
  return arr;
}
function statsFromDayData(days){
  let activeDays=0, total=0, best=0, cur=0;
  days.forEach(x=>{ total+=x.count; if(x.count>0){ activeDays++; cur++; best=Math.max(best,cur); } else cur=0; });
  return {total, activeDays, best};
}
/* Renders a GitHub-style contribution heatmap: month labels on top, Mon/Wed/Fri
   labels on the left, a grid of colored day-squares, and a Lessâ†’More legend. */
function buildActivityHeatmap(days){
  if(!days.length) return '<div class="empty">No activity data yet</div>';
  const firstDow = (days[0].date.getDay()+6)%7; // 0=Mon
  const padded = new Array(firstDow).fill(null).concat(days);
  while(padded.length % 7 !== 0) padded.push(null);
  const weeks = [];
  for(let i=0;i<padded.length;i+=7) weeks.push(padded.slice(i,i+7));

  let lastMonth = -1;
  const monthLabels = weeks.map(week=>{
    const firstCell = week.find(c=>c);
    if(!firstCell) return '';
    const mo = firstCell.date.getMonth();
    if(mo!==lastMonth){ lastMonth = mo; return firstCell.date.toLocaleDateString([], {month:'short'}); }
    return '';
  });
  const weekdayLabels = ['Mon','','Wed','','Fri','',''];

  const monthsHtml = '<div class="yact-months">' + monthLabels.map(l=>`<div>${l}</div>`).join('') + '</div>';
  const weekdaysHtml = '<div class="yact-weekdays">' + weekdayLabels.map(l=>`<div>${l}</div>`).join('') + '</div>';
  let cellsHtml = '<div class="yact-grid">';
  weeks.forEach(week=>{
    week.forEach(cell=>{
      if(!cell){ cellsHtml += '<div class="yact-cell"></div>'; return; }
      const lvl = cell.count===0?0: cell.count===1?1: cell.count===2?2: cell.count<=4?3:4;
      cellsHtml += `<div class="yact-cell ${lvl?'lvl'+lvl:''}" title="${cell.key}: ${cell.count} activities"></div>`;
    });
  });
  cellsHtml += '</div>';

  return `${monthsHtml}<div class="yact-body">${weekdaysHtml}${cellsHtml}</div>
    <div class="yact-legend">Less
      <span class="yact-cell"></span><span class="yact-cell lvl1"></span><span class="yact-cell lvl2"></span><span class="yact-cell lvl3"></span><span class="yact-cell lvl4"></span>
    More</div>`;
}
let yearActivityView = 'monthly';
let activeReportRange = null;
function setYearActivityView(v){
  yearActivityView = v;
  document.querySelectorAll('#yaTabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.v===v));
  renderYearActivity(activeReportRange?.start, activeReportRange?.end);
}
function renderYearActivity(rangeStart, rangeEnd){
  let days, label;
  if(rangeStart && rangeEnd){
    days=[]; for(let d=new Date(rangeStart);d<rangeEnd;d.setDate(d.getDate()+1)){
      const key=todayStr(d), sessCount=DATA.sessions.filter(s=>localDateStr(new Date(s.date))===key).length;
      let habitCount=0; DATA.habits.forEach(h=>{ if(habitActiveOnDay(h,key)) habitCount++; });
      days.push({date:new Date(d),key,count:sessCount+habitCount});
    }
    label=rangeStart.toLocaleDateString([], {month:'short',year:'numeric'})+(rangeEnd-rangeStart>32*86400000?` â€“ ${new Date(rangeEnd-86400000).toLocaleDateString([], {month:'short',year:'numeric'})}`:'');
  } else if(yearActivityView==='monthly'){
    days = buildMonthDayData();
    label = new Date().toLocaleDateString([], {month:'long', year:'numeric'});
  } else {
    days = buildDayDataRange(371);
    label = 'the last 12 months';
  }
  const stats = statsFromDayData(days);
  document.getElementById('ya-stats').textContent = `${stats.total} activities in ${label} Â· ${stats.activeDays} active days Â· ${stats.best} best streak`;
  document.getElementById('ya-heatmap').innerHTML = buildActivityHeatmap(days);
}
