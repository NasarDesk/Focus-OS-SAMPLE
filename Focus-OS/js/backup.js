
/* ============ BACKUP & RESTORE (versioned, modular format) ============ */
const APP_VERSION = '1.4.0';
const BACKUP_FORMAT_VERSION = 1;
function buildBackupObject(){
  const now = new Date();
  return {
    metadata: {
      app: 'StudentOS',
      appVersion: APP_VERSION,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      createdAt: now.toISOString(),
      createdAtLocal: `${todayStr(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    },
    settings: {
      preferences: DATA.settings,
      customCategories: DATA.customCategories,
      notifications: { reminderEventsUseBrowserNotifications: true }
    },
    tasks: { items: DATA.tasks },
    habits: { items: DATA.habits },
    pomodoro: { sessions: DATA.sessions },
    planner: { events: DATA.events },
    journal: { entries: DATA.journal, dayNotes: DATA.dayNotes },
    studyPlanner: { subjectDefs: SUBJECT_DEFS, subjectMeta: DATA.subjectMeta, chapters: DATA.chapters },
    exams: { items: DATA.exams },
    achievements: { unlocked: DATA.unlocked, xp: DATA.xp, definitions: ACHIEVEMENTS.map(a=>({id:a.id, name:a.name, desc:a.desc})) },
    statistics: buildStatisticsSnapshot(),
    notes: { quickNotes: DATA.notes }
  };
}
function buildStatisticsSnapshot(){
  const totalFocus = DATA.sessions.filter(s=>s.type==='focus').reduce((a,s)=>a+s.duration,0);
  return {
    lifetimeFocusMinutes: Math.round(totalFocus),
    lifetimeSessions: DATA.sessions.filter(s=>s.type==='focus').length,
    lifetimeTasksCompleted: DATA.tasks.filter(t=>t.status==='completed').length,
    longestHabitStreak: DATA.habits.reduce((a,h)=>Math.max(a,habitLongestStreak(h)),0),
    note: 'Point-in-time snapshot for reference only â€” all reports, charts, and scores are recalculated live from tasks/pomodoro/habits data on every load or restore, never from this cached snapshot.'
  };
}
function validateBackupFile(parsed){
  if(!parsed || typeof parsed !== 'object') return {valid:false, reason:'the file is not a valid JSON object.'};
  if(parsed.metadata && parsed.metadata.app === 'StudentOS' && typeof parsed.metadata.backupFormatVersion !== 'undefined'){
    if(parsed.metadata.backupFormatVersion > BACKUP_FORMAT_VERSION){
      return {valid:false, reason:`this backup was made with a newer app version (format v${parsed.metadata.backupFormatVersion}) than this one supports (v${BACKUP_FORMAT_VERSION}). Update the app first.`};
    }
    return {valid:true, legacy:false, meta:parsed.metadata};
  }
  // Backward compatibility: earlier versions of this app exported the raw data object with
  // no metadata wrapper. Recognize that shape too so old backups still import cleanly.
  if(Array.isArray(parsed.tasks) && Array.isArray(parsed.habits) && Array.isArray(parsed.sessions)){
    return {valid:true, legacy:true, meta:null};
  }
  return {valid:false, reason:"this doesn't match any known StudentOS backup format."};
}
function importData(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    let parsed;
    try{ parsed = JSON.parse(ev.target.result); }
    catch(err){ toast('âŒ Import failed â€” this file is not valid JSON (it may be corrupted).'); e.target.value=''; return; }
    const check = validateBackupFile(parsed);
    if(!check.valid){ toast('âŒ Import failed â€” ' + check.reason); e.target.value=''; return; }
    const createdLabel = check.legacy
      ? 'an older StudentOS backup (legacy format, no timestamp)'
      : `${check.meta.createdAtLocal || check.meta.createdAt} (backup format v${check.meta.backupFormatVersion})`;
    showConfirm(
      `Import backup from ${createdLabel}?\n\nThis will completely overwrite all current data in this browser â€” tasks, habits, Study Planner, journal, planner events, exams, achievements, and settings â€” with the contents of this file. This cannot be undone.`,
      ()=>{ restoreFromBackup(parsed, check.legacy); }
    );
    e.target.value='';
  };
  reader.onerror = ()=>{ toast('âŒ Could not read that file.'); };
  reader.readAsText(file);
}
function restoreFromBackup(parsed, legacy){
  try{
    let restored = defaultData();
    if(legacy){
      restored = Object.assign(restored, parsed);
    } else {
      restored.tasks = parsed.tasks && Array.isArray(parsed.tasks.items) ? parsed.tasks.items : [];
      restored.habits = parsed.habits && Array.isArray(parsed.habits.items) ? parsed.habits.items : [];
      restored.sessions = parsed.pomodoro && Array.isArray(parsed.pomodoro.sessions) ? parsed.pomodoro.sessions : [];
      restored.events = parsed.planner && Array.isArray(parsed.planner.events) ? parsed.planner.events : [];
      restored.journal = (parsed.journal && parsed.journal.entries) || {};
      restored.dayNotes = (parsed.journal && parsed.journal.dayNotes) || {};
      restored.subjectMeta = (parsed.studyPlanner && parsed.studyPlanner.subjectMeta) || {};
      restored.chapters = (parsed.studyPlanner && Array.isArray(parsed.studyPlanner.chapters)) ? parsed.studyPlanner.chapters : [];
      restored.exams = (parsed.exams && Array.isArray(parsed.exams.items)) ? parsed.exams.items : [];
      restored.unlocked = (parsed.achievements && parsed.achievements.unlocked) || [];
      restored.xp = (parsed.achievements && parsed.achievements.xp) || 0;
      restored.settings = Object.assign(defaultData().settings, (parsed.settings && parsed.settings.preferences) || {});
      restored.customCategories = (parsed.settings && parsed.settings.customCategories) || [];
      restored.notes = (parsed.notes && parsed.notes.quickNotes) || '';
    }
    DATA = restored;
    migrateData(); // fills in any fields missing from older/partial backups so nothing crashes
    resetTransientUIState();
    save();
    toast(`âœ… Backup restored â€” ${DATA.tasks.length} tasks, ${DATA.habits.length} habits, ${DATA.chapters.length} chapters, ${DATA.sessions.length} sessions, ${DATA.exams.length} exams`);
    goPage('dashboard');
  }catch(err){
    toast('âŒ Import failed â€” the backup appears to be corrupted or incompatible (' + err.message + ').');
  }
}
function resetTransientUIState(){
  clearInterval(pomo.intervalId);
  pomo = { mode:'focus', totalSec:pomoDurationSec('focus'), remaining:pomoDurationSec('focus'), running:false, intervalId:null, taskId:null, startedAt:null, elapsedBeforePause:0, sessionAccumMin:0 };
  resetButtons();
  taskFilter = 'all';
  reportMode = 'day';
  reportOffset = 0;
  spCurrentSubject = null;
  chapterModalId = null;
  planView = 'agenda';
  planRefDate = new Date();
  journalDate = new Date();
  calDate = new Date();
  yearActivityView = 'monthly';
}
function renderBackupInfo(){
  const el = document.getElementById('backupLastInfo');
  if(!el) return;
  el.textContent = DATA._lastBackupAt ? `Last backup exported: ${new Date(DATA._lastBackupAt).toLocaleString()}` : 'No backup exported yet from this browser.';
}
function resetAllData(){ DATA = defaultData(); save(); toast('All data cleared'); goPage('dashboard'); }
