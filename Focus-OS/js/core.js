/* ============ SUBJECT DEFINITIONS ============ */
const SUBJECT_DEFS = [
  {id:'science1', name:'Science 1', type:'stem'},
  {id:'science2', name:'Science 2', type:'stem'},
  {id:'math1', name:'Math 1', type:'stem'},
  {id:'math2', name:'Math 2', type:'stem'},
  {id:'history', name:'History', type:'stem'},
  {id:'geography', name:'Geography', type:'stem'},
  {id:'english', name:'English', type:'language'},
  {id:'marathi', name:'Marathi', type:'language'},
  {id:'hindi', name:'Hindi', type:'language'},
];

/* ============ DATA LAYER ============ */
const STORAGE_KEY = 'focusOS_data_v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function defaultData(){
  return {
    tasks: [], habits: [], sessions: [], chapters: [], events: [], exams: [], journal: {}, subjectMeta: {}, customCategories: [], dayNotes: {}, activityArchive: {},
    settings: { focus:25, short:5, long:15, sessionsBeforeLong:4, autobreak:false, autonext:false, goalFocus:240, goalSessions:8, theme:'dark' },
    xp: 0, unlocked: [], notes:'', undo:null
  };
}
let DATA = load();
function load(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) return Object.assign(defaultData(), JSON.parse(raw)); }catch(e){}
  return defaultData();
}
function migrateData(){
  DATA.chapters.forEach(c=>{
    if(!c.notesList){ c.notesList = c.notes ? [{id:uid(), text:c.notes}] : []; }
    delete c.notes;
    if(c.questions && c.questions.length && typeof c.questions[0]==='string'){
      c.questions = c.questions.map(q=>({id:uid(), text:q}));
    }
    if(!c.questions) c.questions=[];
    if(!c.resources) c.resources=[];
    if(c.confidence===undefined) c.confidence=3;
    if(!c.difficulty) c.difficulty='medium';
    if(c.revisionScheduleGenerated===undefined) c.revisionScheduleGenerated=false;
  });
  DATA.habits.forEach(h=>{
    if(h.trackCompletion===undefined || h.trackTime===undefined){
      // First-time migration from the old single trackingType field
      if(h.trackingType==='time'){
        h.trackTime = true;
        h.trackCompletion = false;
        h.timeLog = Object.assign({}, h.completions); // old time values were stored in completions
        h.completions = {};
      } else {
        h.trackCompletion = true;
        h.trackTime = false;
        if(!h.timeLog) h.timeLog = {};
      }
      delete h.trackingType;
    }
    if(!h.timeLog) h.timeLog = {};
    if(!h.trackCompletion && !h.trackTime) h.trackCompletion = true; // never allow a habit with no tracking type
  });
  Object.keys(DATA.subjectMeta).forEach(sid=>{
    if(!DATA.subjectMeta[sid].backlogs) DATA.subjectMeta[sid].backlogs=[];
  });
  if(!DATA.exams) DATA.exams=[];
  if(!DATA.journal) DATA.journal={};
  if(!DATA.customCategories) DATA.customCategories=[];
  if(!DATA.dayNotes) DATA.dayNotes={};
  if(!DATA.activityArchive) DATA.activityArchive={};
  if(DATA.settings.sessionsBeforeLong===undefined) DATA.settings.sessionsBeforeLong=4;
  if(!DATA.settings.shortcuts) DATA.settings.shortcuts={task:'t',journal:'j',planning:'p',pomodoro:'space',search:'s'};
  DATA.events.forEach(e=>{
    if(e.priority===undefined) e.priority='medium';
    if(e.repeat===undefined) e.repeat='none';
    if(e.color===undefined) e.color = e.type==='revision' ? '#a58bff' : '#5b8cff';
  });
}
migrateData();
function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
    const el = document.getElementById('syncStatus');
    if(el){ el.textContent='Saved âœ“'; }
  }catch(e){
    toast('Storage full â€” try removing an old PDF, then save again');
    throw e;
  }
  checkAchievements();
}
function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastT); window._toastT = setTimeout(()=>t.classList.remove('show'), 2400);
}
function setUndo(type, item){
  DATA.undo={type,item:JSON.parse(JSON.stringify(item))}; save();
  const t=document.getElementById('toast'); t.innerHTML=`${type} deleted <button class="btn btn-sm" style="margin-left:8px" onclick="undoLastDelete()">Undo</button>`; t.classList.add('show');
  clearTimeout(window._toastT); window._toastT=setTimeout(()=>t.classList.remove('show'),5000);
}
function undoLastDelete(){
  const u=DATA.undo; if(!u) return;
  const map={Task:'tasks',Habit:'habits',Chapter:'chapters',Planner:'events'};
  if(u.type==='Journal') DATA.journal[u.item.date]=u.item;
  else if(u.type==='Chapter' && u.item.chapter){ DATA.chapters.push(u.item.chapter); DATA.events.push(...(u.item.relatedEvents||[])); }
  else if(map[u.type]) DATA[map[u.type]].push(u.item);
  DATA.undo=null; save(); toast(`${u.type} restored`); renderPage(document.querySelector('.page.active')?.id.replace('page-','')||'dashboard');
}

/* ============ DATE HELPERS (local timezone, no UTC drift) ============ */
function pad(n){ return String(n).padStart(2,'0'); }
function localDateStr(d=new Date()){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function todayStr(d=new Date()){ return localDateStr(d); }
function dateFromKey(key){ const [y,m,dd] = key.split('-').map(Number); return new Date(y, m-1, dd); }
function startOfDay(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dayRange(input){
  const d = typeof input==='string' ? dateFromKey(input) : startOfDay(input||new Date());
  return [d, new Date(d.getTime()+86400000)];
}
function startOfWeek(d=new Date()){ const x=startOfDay(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }
function fmtMin(mins){ mins=Math.round(mins); const h=Math.floor(mins/60), m=mins%60; return h>0 ? `${h}h ${m}m` : `${m}m`; }
function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return d; }

function sessionsInRange(start,end){
  return DATA.sessions.filter(s=>{ const t=new Date(s.date); return t>=start && t<end; });
}
function focusMinutesInRange(start,end){
  return sessionsInRange(start,end).filter(s=>s.type==='focus').reduce((a,s)=>a+s.duration,0);
}

/* ============ NAVIGATION ============ */
const PAGES = [
  ['dashboard','ðŸ ','Dashboard'],['today','â˜€ï¸','Today'],['pomodoro','â±ï¸','Pomodoro'],
  ['tasks','âœ…','Tasks'],['studyplanner','ðŸ“š','Study Planner'],['planning','ðŸ—“ï¸','Planning'],
  ['journal','ðŸ““','Journal'],['habits','ðŸ”','Habits'],['calendar','ðŸ“…','Calendar'],
  ['reports','ðŸ“Š','Reports'],['achievements','ðŸ†','Achievements'],
  ['settings','âš™ï¸','Settings']
];
function buildNav(){
  const nav = document.getElementById('navList');
  nav.innerHTML = PAGES.map(([id,icon,label])=>
    `<div class="nav-item" data-page="${id}" onclick="goPage('${id}')"><span class="nav-icon">${icon}</span>${label}</div>`
  ).join('');
}
function goPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelector(`.nav-item[data-page="${id}"]`).classList.add('active');
  renderPage(id);
}
function renderPage(id){
  if(id==='dashboard') renderDashboard();
  if(id==='today') renderToday();
  if(id==='pomodoro') renderPomodoroPage();
  if(id==='tasks') renderTasks();
  if(id==='studyplanner') renderStudyPlannerPage();
  if(id==='planning') renderPlanning();
  if(id==='journal') renderJournal();
  if(id==='habits') renderHabits();
  if(id==='calendar') renderCalendar();
  if(id==='reports') renderReports();
  if(id==='achievements') renderAchievements();
  if(id==='settings') fillSettingsForm();
}

/* ============ THEME ============ */
/* ============ DAILY THOUGHTS (quote rotates once per day) ============ */
const DAILY_QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Small daily improvements are the key to staggering long-term results.",
  "You don't have to be great to start, but you have to start to be great.",
  "Focus on being productive instead of busy.",
  "The expert in anything was once a beginner.",
  "Motivation gets you going, but discipline keeps you growing.",
  "What you do today can improve all your tomorrows.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "Don't watch the clock; do what it does â€” keep going.",
  "A little progress each day adds up to big results.",
  "Well begun is half done.",
  "The future depends on what you do today.",
  "Study while others are sleeping; work while others are loafing.",
  "It always seems impossible until it's done.",
  "The secret of getting ahead is getting started.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things are done by a series of small things brought together.",
  "You are capable of more than you know.",
  "Dream big. Start small. Act now.",
  "Every accomplishment starts with the decision to try.",
  "Consistency is what transforms average into excellence.",
  "The pain of discipline weighs ounces; the pain of regret weighs tons.",
  "Do something today that your future self will thank you for.",
  "Progress, not perfection.",
  "Hard work beats talent when talent doesn't work hard.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "You don't need more time, you just need to decide.",
  "One day or day one â€” you decide.",
  "Slow progress is still progress.",
  "Learning never exhausts the mind."
];
function dayOfYear(d=new Date()){
  const start = new Date(d.getFullYear(),0,0);
  return Math.floor((d - start)/86400000);
}
function getDailyQuote(){
  return DAILY_QUOTES[dayOfYear() % DAILY_QUOTES.length];
}
function renderDailyThoughts(){
  const q = getDailyQuote();
  const dash = document.getElementById('dashDailyThought');
  const pomo = document.getElementById('pomoDailyThought');
  if(dash) dash.textContent = `"${q}"`;
  if(pomo) pomo.textContent = `"${q}"`;
}

function toggleTheme(){
  DATA.settings.theme = DATA.settings.theme==='dark' ? 'light' : 'dark';
  applyTheme(); save();
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme', DATA.settings.theme);
  document.getElementById('themeBtn').textContent = DATA.settings.theme==='dark' ? 'ðŸŒ™' : 'â˜€ï¸';
}

function requestNotificationPermission(){
  if(!window.Notification){ toast('Notifications are not supported by this browser'); return; }
  if(Notification.permission==='granted'){ toast('Notifications are already enabled'); return; }
  Notification.requestPermission().then(status=>toast(status==='granted'?'Notifications enabled':'Notifications not enabled'));
}
