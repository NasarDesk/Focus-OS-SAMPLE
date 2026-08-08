
/* ============ DASHBOARD ============ */
function renderDashboard(){
  renderDailyThoughts();
  const focusToday = focusMinutesInRange(...dayRange());
  document.getElementById('d-focusToday').textContent = fmtMin(focusToday);
  const goal = DATA.settings.goalFocus||240;
  document.getElementById('d-goalProgress').textContent = `${Math.min(100,Math.round(focusToday/goal*100))}% of ${fmtMin(goal)} goal`;
  const maxStreak = computeProductiveStreak('all');
  document.getElementById('d-streak').textContent = `${maxStreak} days`;
  const maxHabitStreak = DATA.habits.reduce((a,h)=>Math.max(a,habitStreak(h)),0);
  document.getElementById('d-habitStreakSub').textContent = `Habit streak: ${maxHabitStreak}d`;
  document.getElementById('d-tasksToday').textContent = DATA.tasks.filter(t=>t.status!=='completed').length;

  const sessions7 = DATA.sessions.filter(s=>s.type==='focus' && new Date(s.date)>daysAgo(7)).length;
  const tasksDone7 = DATA.tasks.filter(t=>t.completedAt && new Date(t.completedAt)>daysAgo(7)).length;
  const weeklySessionGoal = Math.max(1, (DATA.settings.goalSessions||8) * 7);
  const score = Math.min(100, Math.round((focusToday/goal)*50 + Math.min(1,sessions7/weeklySessionGoal)*30 + Math.min(1,tasksDone7/10)*20));
  document.getElementById('d-prodScore').textContent = score;

  const labels=[], vals=[];
  for(let i=6;i>=0;i--){ const d=daysAgo(i); labels.push(d.toLocaleDateString([], {weekday:'short'})); vals.push(focusMinutesInRange(...dayRange(d))); }
  drawChart('chartWeekly','bar',labels,[{label:'Minutes',data:vals,backgroundColor:'#5b8cff'}]);

  renderAgendaBanner();

  document.getElementById('d-habitsToday').innerHTML = DATA.habits.length? DATA.habits.map(h=>{
    const done = habitActiveOnDay(h, todayStr());
    return `<div class="task-meta" style="padding:6px 0;display:flex;justify-content:space-between;"><span><span class="habit-dot" style="background:${h.color};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;"></span>${esc(h.name)}</span><span>${done?'âœ…':'â€”'}</span></div>`;
  }).join('') : `<div class="empty">No habits yet</div>`;

  const upcoming = DATA.tasks.filter(t=>t.status!=='completed' && t.deadline).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,5);
  document.getElementById('d-upcoming').innerHTML = upcoming.length? upcoming.map(t=>`<div class="task-meta" style="padding:6px 0;display:flex;justify-content:space-between;"><span>${esc(t.name)}</span><span>${t.deadline}</span></div>`).join('') : `<div class="empty">No upcoming deadlines</div>`;

  document.getElementById('quickNotes').value = DATA.notes||'';
}
document.addEventListener('input', e=>{ if(e.target.id==='quickNotes'){ DATA.notes=e.target.value; save(); } });

/* ============ AGENDA / NOTIFICATIONS ============ */
function computeAgendaAlerts(){
  const today = todayStr();
  const overdueTasks = DATA.tasks.filter(t=>t.status!=='completed' && t.deadline && t.deadline<today);
  const overdueEvents = DATA.events.filter(e=>!e.completed && e.date<today);
  const todayEvents = DATA.events.filter(e=>e.date===today && !e.completed);
  const todayDeadlines = DATA.tasks.filter(t=>t.status!=='completed' && t.deadline===today);
  const habitsPending = DATA.habits.filter(h=>!h.completions[today]);
  return {overdueTasks, overdueEvents, todayEvents, todayDeadlines, habitsPending};
}
function renderAgendaBanner(){
  const {overdueTasks, overdueEvents, todayEvents, todayDeadlines, habitsPending} = computeAgendaAlerts();
  const el = document.getElementById('agendaBanner');
  const total = overdueTasks.length+overdueEvents.length+todayEvents.length+todayDeadlines.length;
  if(!total){ el.style.display='none'; return; }
  el.style.display='block';
  let html = `<h3>ðŸ“‹ Today's Agenda</h3>`;
  if(overdueTasks.length || overdueEvents.length){
    html += `<div style="color:var(--accent);font-size:13px;margin-bottom:6px;">âš ï¸ ${overdueTasks.length+overdueEvents.length} overdue item(s)</div>`;
  }
  todayEvents.forEach(e=>{ html += `<div class="task-meta">ðŸ—“ï¸ ${e.time?e.time+' â€” ':''}${esc(e.title)} <span class="subtle">(${e.type})</span></div>`; });
  todayDeadlines.forEach(t=>{ html += `<div class="task-meta">â° Task due: ${esc(t.name)}</div>`; });
  if(habitsPending.length) html += `<div class="task-meta">ðŸ” ${habitsPending.length} habit(s) not yet done today</div>`;
  html += `<div style="margin-top:8px;"><button class="btn btn-sm" onclick="goPage('planning')">Open Planning</button></div>`;
  el.innerHTML = html;
}
function checkTimeReminders(){
  const now = new Date();
  const nowKey = todayStr(now);
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let changed=false;
  DATA.events.forEach(e=>{
    if(e.reminder && !e.completed && e.date===nowKey && e.time===nowHM && !e._alerted){
      e._alerted = true; changed=true;
      toast(`â° Reminder: ${e.title}`);
      try{ if(window.Notification && Notification.permission==='granted') new Notification(e.title, {body:'Scheduled now'}); }catch(err){}
    }
  });
  if(changed) save();
}
function rescheduleOverdueRevisions(){
  const today = todayStr();
  const tomorrow = todayStr(new Date(Date.now()+86400000));
  let changed=false;
  DATA.events.forEach(e=>{
    if(e.type==='revision' && e.auto && !e.completed && e.date<today){
      e.date = tomorrow; e.rescheduled = (e.rescheduled||0)+1; changed=true;
    }
  });
  if(changed) save();
}
