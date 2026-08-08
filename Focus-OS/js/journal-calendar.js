
/* ============ JOURNAL ============ */
let journalDate = new Date();
function journalShift(dir){
  const next = new Date(journalDate.getTime()+dir*86400000);
  if(startOfDay(next) > startOfDay()){ toast("Can't journal for a future date yet â€” that day hasn't happened"); return; }
  journalDate = next; renderJournal();
}
function journalToday(){ journalDate = new Date(); renderJournal(); }
function renderJournal(){
  const key = todayStr(journalDate);
  document.getElementById('journalLabel').textContent = journalDate.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  const [start,end] = dayRange(journalDate);
  const focusMin = focusMinutesInRange(start,end);
  document.getElementById('j-time').textContent = fmtMin(focusMin);
  const goal = DATA.settings.goalFocus||240;
  const sessions = sessionsInRange(start,end).filter(s=>s.type==='focus').length;
  const tasksDoneCount = DATA.tasks.filter(t=>t.completedAt && localDateStr(new Date(t.completedAt))===key).length;
  const score = Math.min(100, Math.round((focusMin/goal)*50 + Math.min(1,sessions/8)*30 + Math.min(1,tasksDoneCount/5)*20));
  document.getElementById('j-score').textContent = score;
  document.getElementById('j-tasks').textContent = tasksDoneCount;
  const habitsDoneCount = DATA.habits.filter(h=>habitActiveOnDay(h,key)).length;
  document.getElementById('j-habits').textContent = habitsDoneCount;
  const doneTasks = DATA.tasks.filter(t=>t.completedAt && localDateStr(new Date(t.completedAt))===key);
  document.getElementById('j-taskList').innerHTML = doneTasks.length? doneTasks.map(t=>`<div class="task-meta">âœ… ${esc(t.name)} â€” ${fmtMin(t.actualFocusTime||0)}</div>`).join('') : '<div class="empty">No tasks completed</div>';
  const doneHabits = DATA.habits.filter(h=>habitActiveOnDay(h,key));
  document.getElementById('j-habitList').innerHTML = doneHabits.length? doneHabits.map(h=>`<div class="task-meta">âœ… ${esc(h.name)}${h.trackTime && h.timeLog[key] ? ' â€” '+habitCellDisplay(h,h.timeLog[key],'time') : ''}</div>`).join('') : '<div class="empty">No habits completed</div>';
  const entry = DATA.journal[key] || {};
  document.getElementById('j-mood').value = entry.mood||'';
  document.getElementById('j-learned').value = entry.learned||'';
  document.getElementById('j-hardest').value = entry.hardest||'';
  document.getElementById('j-improve').value = entry.improve||'';
  document.getElementById('j-priorities').value = entry.priorities||'';
  document.getElementById('j-rating').value = entry.rating||5;
  document.getElementById('j-ratingVal').textContent = entry.rating||5;
  document.getElementById('j-notes').value = entry.notes||'';
}
function saveJournalEntry(){
  const key = todayStr(journalDate);
  DATA.journal[key] = {
    date:key,
    mood:document.getElementById('j-mood').value,
    learned:document.getElementById('j-learned').value,
    hardest:document.getElementById('j-hardest').value,
    improve:document.getElementById('j-improve').value,
    priorities:document.getElementById('j-priorities').value,
    rating:parseInt(document.getElementById('j-rating').value)||5,
    notes:document.getElementById('j-notes').value,
  };
  save(); toast('Journal entry saved');
}
function deleteJournalEntry(){
  const key=todayStr(journalDate), item=DATA.journal[key];
  if(!item){ toast('No journal entry to delete'); return; }
  showConfirm('Delete this journal entry?', ()=>{ delete DATA.journal[key]; setUndo('Journal',item); renderJournal(); });
}

/* ============ CALENDAR (overview) ============ */
let calDate = new Date();
function calShift(dir){ calDate.setMonth(calDate.getMonth()+dir); renderCalendar(); }
function renderCalendar(){
  const head = document.getElementById('calHead');
  head.innerHTML = ['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=>`<div class="cal-head">${d}</div>`).join('');
  document.getElementById('calLabel').textContent = calDate.toLocaleDateString([], {month:'long', year:'numeric'});
  const first = new Date(calDate.getFullYear(), calDate.getMonth(),1);
  const startOffset = (first.getDay()+6)%7;
  const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth()+1,0).getDate();
  let html='';
  for(let i=0;i<startOffset;i++) html += `<div></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateObj = new Date(calDate.getFullYear(), calDate.getMonth(), d);
    const key = todayStr(dateObj);
    const isToday = key===todayStr();
    const dueTasks = DATA.tasks.filter(t=>t.deadline===key);
    const scheduledEvents = DATA.events.filter(e=>e.date===key);
    const focusMin = focusMinutesInRange(...dayRange(dateObj));
    const habitsDone = DATA.habits.filter(h=>habitActiveOnDay(h,key)).length;
    const hasNote = !!DATA.dayNotes[key];
    html += `<div class="cal-cell ${isToday?'today':''}" style="cursor:pointer;" onclick="openDayDetail('${key}')">
      <div class="dnum">${d}</div>
      ${focusMin>0?`<div><span class="cal-dot" style="background:var(--accent2)"></span>${fmtMin(focusMin)}</div>`:''}
      ${dueTasks.length?`<div><span class="cal-dot" style="background:var(--accent)"></span>${dueTasks.length} due</div>`:''}
      ${scheduledEvents.length?`<div><span class="cal-dot" style="background:var(--purple)"></span>${scheduledEvents.length} event${scheduledEvents.length>1?'s':''}</div>`:''}
      ${habitsDone?`<div><span class="cal-dot" style="background:var(--green)"></span>${habitsDone} habit${habitsDone>1?'s':''}</div>`:''}
      ${hasNote?`<div>ðŸ“</div>`:''}
    </div>`;
  }
  document.getElementById('calBody').innerHTML = html;
}

/* ============ DAY DETAIL (click a calendar date) ============ */
function openDayDetail(key){
  const dateObj = dateFromKey(key);
  const isFuture = dateObj > startOfDay();
  const dayNote = DATA.dayNotes[key] || '';

  let html = '';

  if(!isFuture){
    // Past or today: retrospective report
    const [start,end] = dayRange(dateObj);
    const focusMin = focusMinutesInRange(start,end);
    const sessions = sessionsInRange(start,end).filter(s=>s.type==='focus');
    const tasksCompleted = DATA.tasks.filter(t=>t.completedAt && localDateStr(new Date(t.completedAt))===key);
    const habitsCompleted = DATA.habits.filter(h=>habitActiveOnDay(h,key));
    const isToday = key===todayStr();
    const habitsMissed = DATA.habits.filter(h=>!habitActiveOnDay(h,key) && new Date(h.createdAt)<=end && !isToday);
    const habitsPendingToday = isToday ? DATA.habits.filter(h=>!habitActiveOnDay(h,key)) : [];
    const catTotals={};
    sessions.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); const cat=t?t.category:'Other'; catTotals[cat]=(catTotals[cat]||0)+s.duration; });
    const goal = DATA.settings.goalFocus||240;
    const score = Math.min(100, Math.round((focusMin/goal)*50 + Math.min(1,sessions.length/8)*30 + Math.min(1,tasksCompleted.length/5)*20));
    const entry = DATA.journal[key];

    html += `<div class="grid grid-4" style="margin-bottom:14px;">
      <div class="card"><h3>Focus Time</h3><div class="stat-num">${fmtMin(focusMin)}</div></div>
      <div class="card"><h3>Sessions</h3><div class="stat-num">${sessions.length}</div></div>
      <div class="card"><h3>Productivity Score</h3><div class="stat-num">${score}</div></div>
      <div class="card"><h3>Tasks Completed</h3><div class="stat-num">${tasksCompleted.length}</div></div>
    </div>`;

    if(Object.keys(catTotals).length){
      html += `<div class="card" style="margin-bottom:14px;"><h3>Time by Subject / Category</h3>`;
      html += Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,min])=>`<div class="task-meta" style="padding:4px 0;display:flex;justify-content:space-between;"><span>${esc(cat)}</span><span>${fmtMin(min)}</span></div>`).join('');
      html += `</div>`;
    }

    html += `<div class="card" style="margin-bottom:14px;"><h3>Tasks Completed</h3>`;
    html += tasksCompleted.length? tasksCompleted.map(t=>`<div class="task-meta">âœ… ${esc(t.name)} <span class="subtle">(${esc(t.category)})</span> â€” ${fmtMin(t.actualFocusTime||0)}</div>`).join('') : `<div class="empty">No tasks completed this day</div>`;
    html += `</div>`;

    html += `<div class="card" style="margin-bottom:14px;"><h3>Habits</h3>`;
    html += habitsCompleted.length? habitsCompleted.map(h=>`<div class="task-meta">âœ… ${esc(h.name)}</div>`).join('') : '';
    if(habitsMissed.length) html += habitsMissed.map(h=>`<div class="task-meta" style="opacity:.6;">â—»ï¸ ${esc(h.name)} <span class="subtle">(not done)</span></div>`).join('');
    if(habitsPendingToday.length) html += habitsPendingToday.map(h=>`<div class="task-meta" style="opacity:.7;">â—»ï¸ ${esc(h.name)} <span class="subtle">(not done yet today)</span></div>`).join('');
    if(!habitsCompleted.length && !habitsMissed.length && !habitsPendingToday.length) html += `<div class="empty">No habits tracked yet</div>`;
    html += `</div>`;

    html += `<div class="card" style="margin-bottom:14px;"><h3>Journal</h3>`;
    if(entry){
      html += `<div class="task-meta" style="margin-bottom:6px;">Rating: ${entry.rating||'â€”'}/10</div>`;
      if(entry.learned) html += `<div class="task-meta"><b>Learned:</b> ${esc(entry.learned)}</div>`;
      if(entry.hardest) html += `<div class="task-meta"><b>Hardest topic:</b> ${esc(entry.hardest)}</div>`;
      if(entry.improve) html += `<div class="task-meta"><b>Improve tomorrow:</b> ${esc(entry.improve)}</div>`;
      if(entry.priorities) html += `<div class="task-meta"><b>Tomorrow's priorities:</b> ${esc(entry.priorities)}</div>`;
      if(entry.notes) html += `<div class="task-meta"><b>Notes:</b> ${esc(entry.notes)}</div>`;
    } else {
      html += `<div class="empty">No journal entry for this day</div>`;
    }
    html += `<div style="margin-top:10px;"><button class="btn btn-sm" onclick="jumpToJournal('${key}')">${entry? 'Edit in Journal':'Add Journal Entry'}</button></div>`;
    html += `</div>`;

  } else {
    // Future day: show what's scheduled, and let the user plan for it
    const plannedTasks = DATA.tasks.filter(t=>t.deadline===key);
    const scheduledEvents = DATA.events.filter(e=>e.date===key);

    html += `<div class="card" style="margin-bottom:14px;">
      <h3>Planned for this day</h3>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-primary" onclick="scheduleTaskOnDate('${key}')">+ Add Task</button>
        <button class="btn btn-sm" onclick="scheduleEventOnDate('${key}')">+ Schedule Event</button>
      </div>
      ${plannedTasks.length? `<div class="subtle" style="margin-bottom:4px;">Tasks due:</div>` + plannedTasks.map(taskRow).join('') : ''}
      ${scheduledEvents.length? `<div class="subtle" style="margin:8px 0 4px;">Events:</div>` + scheduledEvents.map(eventRow).join('') : ''}
      ${(!plannedTasks.length && !scheduledEvents.length)? `<div class="empty">Nothing planned yet for this day.</div>` : ''}
    </div>`;
  }

  html += `<div class="card"><h3>Note for this day</h3>
    <p class="subtle" style="margin-top:-6px;">e.g. "There's an exam on this day" â€” a sticky note independent of the journal, visible whenever you open this date.</p>
    <textarea id="dayNoteInput" rows="2" style="width:100%;" placeholder="Add a note for this day...">${esc(dayNote)}</textarea>
    <button class="btn btn-sm" style="margin-top:8px;" onclick="saveDayNote('${key}')">Save Note</button>
  </div>`;

  document.getElementById('dayDetailTitle').textContent = dateObj.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'});
  document.getElementById('dayDetailBody').innerHTML = html;
  document.getElementById('dayDetailModal').classList.add('active');
}
function saveDayNote(key){
  const val = document.getElementById('dayNoteInput').value.trim();
  if(val) DATA.dayNotes[key] = val; else delete DATA.dayNotes[key];
  save(); toast('Note saved'); renderCalendar();
}
function scheduleTaskOnDate(key){
  closeModal('dayDetailModal');
  openTaskModal();
  document.getElementById('tk-deadline').value = key;
}
function scheduleEventOnDate(key){
  closeModal('dayDetailModal');
  openEventModal(key);
}
function jumpToJournal(key){
  closeModal('dayDetailModal');
  journalDate = dateFromKey(key);
  renderJournal();
  goPage('journal');
}
