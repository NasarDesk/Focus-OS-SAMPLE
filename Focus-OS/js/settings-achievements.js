
/* ============ ACHIEVEMENTS ============ */
const ACHIEVEMENTS = [
  {id:'first_session', name:'First Focus', desc:'Complete your first session', icon:'ðŸŽ¯', check:d=>d.sessions.filter(s=>s.type==='focus').length>=1},
  {id:'10h', name:'10 Hours', desc:'Focus for 10 total hours', icon:'â³', check:d=>totalFocusMin(d)>=600},
  {id:'100h', name:'100 Hours', desc:'Focus for 100 total hours', icon:'ðŸ”ï¸', check:d=>totalFocusMin(d)>=6000},
  {id:'streak7', name:'7-Day Streak', desc:'Keep a habit streak for 7 days', icon:'ðŸ”¥', check:d=>d.habits.some(h=>habitStreak(h)>=7)},
  {id:'streak30', name:'30-Day Streak', desc:'Keep a habit streak for 30 days', icon:'ðŸŒŸ', check:d=>d.habits.some(h=>habitStreak(h)>=30)},
  {id:'tasks100', name:'100 Tasks', desc:'Complete 100 tasks', icon:'âœ…', check:d=>d.tasks.filter(t=>t.status==='completed').length>=100},
  {id:'tasks10', name:'10 Tasks', desc:'Complete 10 tasks', icon:'ðŸ“‹', check:d=>d.tasks.filter(t=>t.status==='completed').length>=10},
  {id:'sessions100', name:'100 Sessions', desc:'Log 100 focus sessions', icon:'ðŸŽ§', check:d=>d.sessions.filter(s=>s.type==='focus').length>=100},
  {id:'chapter1', name:'First Chapter', desc:'Complete your first chapter', icon:'ðŸ“˜', check:d=>d.chapters.some(c=>chapterProgress(c)===100)},
  {id:'chapter10', name:'10 Chapters', desc:'Complete 10 chapters', icon:'ðŸ“š', check:d=>d.chapters.filter(c=>chapterProgress(c)===100).length>=10},
];
function productiveDayCount(d){ return new Set(d.sessions.filter(s=>s.type==='focus').map(s=>localDateStr(new Date(s.date)))).size; }
const MILESTONES = [
  {id:'50h', name:'50 Study Hours', desc:'Log 50 hours of focused study', icon:'â—·', check:d=>totalFocusMin(d)>=3000},
  {id:'500h', name:'500 Study Hours', desc:'Log 500 hours of focused study', icon:'â—·', check:d=>totalFocusMin(d)>=30000},
  {id:'1000h', name:'1000 Study Hours', desc:'Log 1000 hours of focused study', icon:'â—·', check:d=>totalFocusMin(d)>=60000},
  {id:'chapter100', name:'100 Chapters', desc:'Complete 100 chapters', icon:'â–£', check:d=>d.chapters.filter(c=>chapterProgress(c)===100).length>=100},
  {id:'productive7', name:'7 Productive Days', desc:'Study on 7 distinct days', icon:'âœ“', check:d=>productiveDayCount(d)>=7},
  {id:'productive30', name:'30 Productive Days', desc:'Study on 30 distinct days', icon:'âœ“', check:d=>productiveDayCount(d)>=30},
  {id:'sessions500', name:'500 Sessions', desc:'Log 500 focus sessions', icon:'â—‰', check:d=>d.sessions.filter(s=>s.type==='focus').length>=500}
];
function totalFocusMin(d){ return d.sessions.filter(s=>s.type==='focus').reduce((a,s)=>a+s.duration,0); }
function checkAchievements(){
  [...ACHIEVEMENTS,...MILESTONES].forEach(a=>{
    if(!DATA.unlocked.includes(a.id) && a.check(DATA)){
      DATA.unlocked.push(a.id);
      DATA.xp = (DATA.xp||0)+50;
      toast(`ðŸ† Achievement unlocked: ${a.name}`);
    }
  });
}
function renderAchievements(){
  const level = Math.floor((DATA.xp||0)/200)+1;
  const xpInLevel = (DATA.xp||0)%200;
  document.getElementById('ach-level').textContent = level;
  document.getElementById('ach-xpbar').style.width = (xpInLevel/200*100)+'%';
  document.getElementById('ach-xptext').textContent = `${xpInLevel} / 200 XP to next level`;
  document.getElementById('ach-grid').innerHTML = [...ACHIEVEMENTS,...MILESTONES].map(a=>{
    const unlocked = DATA.unlocked.includes(a.id);
    return `<div class="ach-card ${unlocked?'':'locked'}"><div class="ach-icon">${a.icon}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div></div>`;
  }).join('');
}

/* ============ SETTINGS ============ */
const SHORTCUT_ACTIONS=[['task','New Task'],['journal','Open Journal'],['planning','Open Planning'],['pomodoro','Pause / resume Pomodoro'],['search','Open Search']];
function shortcutLabel(key){ return key==='space'?'Space':String(key||'').toUpperCase(); }
function renderShortcutSettings(){
  const el=document.getElementById('shortcutSettings'); if(!el) return;
  const sc=DATA.settings.shortcuts;
  el.innerHTML=SHORTCUT_ACTIONS.map(([id,label])=>`<div class="field-row" style="align-items:center;margin:8px 0;"><span style="flex:1;font-size:13px;">${label}</span><input aria-label="${label} shortcut" style="width:100px" maxlength="10" value="${shortcutLabel(sc[id])}" onchange="saveShortcut('${id}',this.value)"></div>`).join('');
}
function saveShortcut(action,value){
  let key=value.trim().toLowerCase(); if(key==='space' || key===' ') key='space';
  if(!key || key.length>10){ toast('Enter one key'); renderShortcutSettings(); return; }
  if(Object.entries(DATA.settings.shortcuts).some(([id,v])=>id!==action && v===key)){ toast('That shortcut is already in use'); renderShortcutSettings(); return; }
  DATA.settings.shortcuts[action]=key; save(); renderShortcutSettings(); toast('Shortcut saved');
}
function isTypingTarget(el){ return el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT'||el.isContentEditable); }
function handleShortcuts(event){
  if(event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase()==='z'){
    if(isTypingTarget(event.target)) return;
    if(DATA.undo){ event.preventDefault(); undoLastDelete(); }
    return;
  }
  if(isTypingTarget(event.target) || event.ctrlKey||event.altKey||event.metaKey) return;
  const key=event.code==='Space'?'space':event.key.toLowerCase(), sc=DATA.settings.shortcuts||{};
  const action=Object.keys(sc).find(k=>sc[k]===key); if(!action) return;
  event.preventDefault();
  if(action==='task') openTaskModal();
  if(action==='journal') goPage('journal');
  if(action==='planning') goPage('planning');
  if(action==='pomodoro'){ if(pomo.running) pomoPause(); else if(pomo.remaining<pomo.totalSec) pomoResume(); else pomoStart(); }
  if(action==='search') openGlobalSearch();
}
function searchRecords(){
  const records=[]; const add=(kind,title,detail,go)=>records.push({kind,title,detail,go});
  DATA.tasks.forEach(t=>add('Task',t.name,`${t.category||''} ${t.description||''} ${t.notes||''}`,()=>navigateAndHighlight('tasks',`#task-${t.id}`)));
  DATA.habits.forEach(h=>add('Habit',h.name,h.category||'',()=>navigateAndHighlight('habits',`#habit-${h.id}`)));
  SUBJECT_DEFS.forEach(s=>add('Subject',s.name,s.type,()=>{spCurrentSubject=s.id;navigateAndHighlight('studyplanner',null);}));
  DATA.chapters.filter(c=>!c._draft).forEach(c=>{ const detail=`${c.difficulty||'medium'} ${(c.notesList||[]).map(n=>n.text).join(' ')} ${(c.resources||[]).map(r=>r.title+' '+r.url).join(' ')}`; add('Chapter',c.name,detail,()=>{spCurrentSubject=c.subjectId;navigateAndHighlight('studyplanner',`#chapter-${c.id}`);}); (c.pdfs||[]).forEach(p=>add('PDF',p.name,`${c.name} ${c.difficulty||'medium'}`,()=>{spCurrentSubject=c.subjectId;navigateAndHighlight('studyplanner',`#chapter-${c.id}`);})); });
  Object.entries(DATA.journal).forEach(([date,j])=>add('Journal',date,[j.mood,j.learned,j.hardest,j.improve,j.priorities,j.notes].join(' '),()=>{journalDate=dateFromKey(date);navigateAndHighlight('journal','#journalReflection');}));
  DATA.exams.forEach(e=>add('Exam',e.name||e.title||'Exam',e.date||'',()=>{planView='day';planRefDate=dateFromKey(e.date||todayStr());navigateAndHighlight('planning',`#event-${e.id}`);}));
  add('Reports','Productivity reports','Daily, weekly, monthly and yearly archive',()=>navigateAndHighlight('reports','#reportTabs'));
  return records;
}
function navigateAndHighlight(page, selector){
  goPage(page);
  if(!selector) return;
  setTimeout(()=>{
    const el=document.querySelector(selector); if(!el) return;
    el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('search-highlight');
    setTimeout(()=>el.classList.remove('search-highlight'),2000);
  },40);
}
function openGlobalSearch(){ const input=document.getElementById('globalSearchInput'); input.focus(); renderGlobalSearch(input.value); }
function closeGlobalSearch(){ document.getElementById('globalSearchResults').style.display='none'; document.getElementById('globalSearchInput').value=''; }
function renderGlobalSearch(query){
  const out=document.getElementById('globalSearchResults'), q=(query||'').trim().toLowerCase();
  if(!q){ out.style.display='none'; return; }
  const matches=searchRecords().filter(r=>(r.title+' '+r.detail).toLowerCase().includes(q)).slice(0,24);
  out.style.display='block'; out.innerHTML=matches.length?matches.map((r,i)=>`<div class="search-result" data-search-index="${i}"><span class="search-kind">${r.kind}</span>${esc(r.title)}${r.detail?`<div class="subtle">${esc(r.detail).slice(0,120)}</div>`:''}</div>`).join(''):'<div class="empty">No results</div>';
  out.querySelectorAll('[data-search-index]').forEach((el,i)=>el.onclick=()=>{matches[i].go();closeGlobalSearch();});
}
function fillSettingsForm(){
  renderBackupInfo();
  const s = DATA.settings;
  document.getElementById('set-focus').value=s.focus;
  document.getElementById('set-short').value=s.short;
  document.getElementById('set-long').value=s.long;
  document.getElementById('set-sessions').value=s.sessionsBeforeLong||4;
  document.getElementById('set-autobreak').checked=!!s.autobreak;
  document.getElementById('set-autonext').checked=!!s.autonext;
  document.getElementById('set-goalfocus').value=s.goalFocus;
  document.getElementById('set-goalsessions').value=s.goalSessions;
  renderShortcutSettings();
}
function saveSettingsForm(){
  DATA.settings.focus = parseFloat(document.getElementById('set-focus').value)||25;
  DATA.settings.short = parseFloat(document.getElementById('set-short').value)||5;
  DATA.settings.long = parseFloat(document.getElementById('set-long').value)||15;
  DATA.settings.sessionsBeforeLong = parseInt(document.getElementById('set-sessions').value)||4;
  DATA.settings.autobreak = document.getElementById('set-autobreak').checked;
  DATA.settings.autonext = document.getElementById('set-autonext').checked;
  DATA.settings.goalFocus = parseFloat(document.getElementById('set-goalfocus').value)||240;
  DATA.settings.goalSessions = parseFloat(document.getElementById('set-goalsessions').value)||8;
  pomo.mode='focus'; pomo.totalSec=pomoDurationSec('focus'); pomo.remaining=pomo.totalSec;
  save(); toast('Settings saved'); resetButtons(); updateTimerDisplay();
}
/* ============ EXPORT MONTHLY REPORT (PDF) ============ */
function exportMonthlyReportPDF(){
  if(typeof window.jspdf==='undefined'){ toast('PDF library failed to load â€” check your connection and try again'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const [start,end] = getRangeDates();
  const monthLabel = start.toLocaleDateString([], {month:'long', year:'numeric'});
  const sess = sessionsInRange(start,end).filter(s=>s.type==='focus');
  const totalFocus = sess.reduce((a,s)=>a+s.duration,0);
  const tasksCompleted = DATA.tasks.filter(t=>t.completedAt && new Date(t.completedAt)>=start && new Date(t.completedAt)<end);
  let habitsCompletedCount=0;
  DATA.habits.forEach(h=>Object.keys(h.completions).forEach(k=>{ const d=dateFromKey(k); if(d>=start&&d<end) habitsCompletedCount++; }));
  const goal = DATA.settings.goalFocus||240;
  const daysInRange = Math.round((end-start)/86400000);
  const monthGoal = goal*daysInRange;
  const goalPct = Math.min(100, Math.round((totalFocus/monthGoal)*100));
  const productiveDays = (()=>{ let n=0; let c=new Date(start); while(c<end){ if(focusMinutesInRange(...dayRange(c))>0) n++; c=new Date(c.getTime()+86400000); } return n; })();
  const prodScore = Math.min(100, Math.round((totalFocus/monthGoal)*70 + (tasksCompleted.length/Math.max(1,daysInRange/3))*30));
  const streak = computeProductiveStreak('all');

  let y = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 15;
  function line(text, size=11, bold=false, gap=7){
    doc.setFontSize(size); doc.setFont(undefined, bold?'bold':'normal');
    doc.text(text, marginL, y); y += gap;
  }
  function checkPageBreak(){ if(y>270){ doc.addPage(); y=20; } }

  doc.setFillColor(30,33,43); doc.rect(0,0,pageW,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont(undefined,'bold');
  doc.text('StudentOS Monthly Report', marginL, 17);
  doc.setFontSize(11); doc.setFont(undefined,'normal');
  doc.text(monthLabel, marginL, 24);
  doc.setTextColor(0,0,0);
  y = 38;

  line('Overview', 14, true, 9);
  line(`Total productive hours: ${(totalFocus/60).toFixed(1)}h  (${fmtMin(totalFocus)})`);
  line(`Productive days this month: ${productiveDays} / ${daysInRange}`);
  line(`Current productive streak: ${streak} days`);
  line(`Sessions completed: ${sess.length}`);
  line(`Tasks completed: ${tasksCompleted.length}`);
  line(`Habits marked complete: ${habitsCompletedCount}`);
  line(`Monthly focus goal completion: ${goalPct}%  (goal: ${fmtMin(monthGoal)})`);
  line(`Estimated productivity score: ${prodScore} / 100`);
  y += 4; checkPageBreak();

  line('Subject-wise Study Hours', 14, true, 9);
  const subjectTotals = {};
  sess.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); const cat=t?t.category:'Other'; subjectTotals[cat]=(subjectTotals[cat]||0)+s.duration; });
  const subjEntries = Object.entries(subjectTotals).sort((a,b)=>b[1]-a[1]);
  if(!subjEntries.length) line('No subject-linked sessions this period.', 10);
  subjEntries.forEach(([subj,min])=>{ line(`${subj}: ${fmtMin(min)}`, 10, false, 6); checkPageBreak(); });
  y += 4; checkPageBreak();

  line('Weekly Summaries', 14, true, 9);
  let wkCursor = new Date(start); let wkNum=1;
  while(wkCursor < end){
    const wkEnd = new Date(Math.min(wkCursor.getTime()+7*86400000, end.getTime()));
    const wkFocus = focusMinutesInRange(wkCursor, wkEnd);
    line(`Week ${wkNum} (${wkCursor.toLocaleDateString([], {month:'short',day:'numeric'})} â€“ ${new Date(wkEnd.getTime()-86400000).toLocaleDateString([], {month:'short',day:'numeric'})}): ${fmtMin(wkFocus)}`, 10, false, 6);
    wkCursor = wkEnd; wkNum++; checkPageBreak();
  }
  y += 4; checkPageBreak();

  line('Daily Focus Breakdown', 14, true, 9);
  let dCursor = new Date(start);
  while(dCursor < end){
    const dMin = focusMinutesInRange(...dayRange(dCursor));
    if(dMin>0) line(`${dCursor.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})}: ${fmtMin(dMin)}`, 9, false, 5.5);
    dCursor = new Date(dCursor.getTime()+86400000); checkPageBreak();
  }
  y += 4; checkPageBreak();

  line('Monthly Review', 14, true, 9);
  const reviewLines = doc.splitTextToSize(
    `This month you logged ${fmtMin(totalFocus)} of focused work across ${sess.length} sessions, completed ${tasksCompleted.length} tasks and ${habitsCompletedCount} habit check-ins, and stayed productive on ${productiveDays} of ${daysInRange} days. Your current productive streak stands at ${streak} day(s), and you reached ${goalPct}% of your monthly focus goal.`,
    pageW - marginL*2
  );
  doc.setFontSize(10); doc.setFont(undefined,'normal');
  doc.text(reviewLines, marginL, y);

  doc.save(`StudentOS_MonthlyReport_${start.getFullYear()}-${pad(start.getMonth()+1)}.pdf`);
  toast('âœ… Monthly report exported as PDF');
}

function exportData(fmt){
  if(fmt==='json'){
    const backup = buildBackupObject();
    const blob = new Blob([JSON.stringify(backup,null,2)], {type:'application/json'});
    const filename = `StudentOS_Backup_${todayStr()}.json`;
    downloadBlob(blob, filename);
    DATA._lastBackupAt = new Date().toISOString();
    save();
    toast(`âœ… Backup exported as ${filename}`);
    renderBackupInfo();
  } else {
    let csv = 'date,type,duration_minutes,task,manual\n';
    DATA.sessions.forEach(s=>{ const t=DATA.tasks.find(x=>x.id===s.taskId); csv += `${s.date},${s.type},${s.duration},${t?t.name.replace(/,/g,' '):''},${!!s.manual}\n`; });
    downloadBlob(new Blob([csv],{type:'text/csv'}), `StudentOS_Sessions_${todayStr()}.csv`);
    toast('âœ… CSV exported');
  }
}
function downloadBlob(blob,name){
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
