
/* ============ TASKS ============ */
function openTaskModal(id){
  document.getElementById('taskModalTitle').textContent = id ? 'Edit Task' : 'New Task';
  document.getElementById('tk-id').value = id || '';
  renderCategoryOptions();
  if(id){
    const t = DATA.tasks.find(x=>x.id===id);
    document.getElementById('tk-name').value=t.name;
    document.getElementById('tk-desc').value=t.description||'';
    document.getElementById('tk-project').value=t.project||'';
    document.getElementById('tk-category').value=t.category||'Science 1';
    document.getElementById('tk-priority').value=t.priority||'medium';
    document.getElementById('tk-deadline').value=t.deadline||'';
    document.getElementById('tk-required').value=t.requiredFocusTime||'';
    document.getElementById('tk-tags').value=(t.tags||[]).join(', ');
    document.getElementById('tk-notes').value=t.notes||'';
    syncHoursMinsFromTotal('tk-required','tk-required-h','tk-required-m');
  } else {
    ['tk-name','tk-desc','tk-project','tk-deadline','tk-required','tk-tags','tk-notes','tk-required-h','tk-required-m'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('tk-priority').value='medium';
    document.getElementById('tk-category').value='Science 1';
  }
  document.getElementById('tk-category').dataset.prev = document.getElementById('tk-category').value;
  document.getElementById('taskModal').classList.add('active');
}
function renderCategoryOptions(){
  const sel = document.getElementById('tk-category-custom');
  if(sel) sel.innerHTML = DATA.customCategories.map(c=>`<option>${esc(c)}</option>`).join('');
}
function handleCategoryChange(sel){
  if(sel.value === '__add_new__'){
    sel.value = sel.dataset.prev || 'Science 1';
    openAddCategoryModal();
  } else {
    sel.dataset.prev = sel.value;
  }
}
function openAddCategoryModal(){
  document.getElementById('new-category-name').value='';
  document.getElementById('addCategoryModal').classList.add('active');
}
function saveNewCategory(){
  const name = document.getElementById('new-category-name').value.trim();
  if(!name){ toast('Enter a category name'); return; }
  const builtIn = [...SUBJECT_DEFS.map(s=>s.name), 'Coding','Reading','Work','Personal','Completion','Assignment','Other'];
  const allExisting = [...builtIn, ...DATA.customCategories];
  if(allExisting.some(c=>c.toLowerCase()===name.toLowerCase())){ toast('That category already exists'); return; }
  DATA.customCategories.push(name);
  save();
  renderCategoryOptions();
  const sel = document.getElementById('tk-category');
  sel.value = name;
  sel.dataset.prev = name;
  closeModal('addCategoryModal');
  toast(`Category "${name}" added`);
}
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
let _confirmCallback = null;
function showConfirm(message, onYes){
  document.getElementById('confirmMessage').textContent = message;
  _confirmCallback = onYes;
  document.getElementById('confirmModal').classList.add('active');
}
function confirmYes(){
  document.getElementById('confirmModal').classList.remove('active');
  const cb = _confirmCallback; _confirmCallback = null;
  if(cb) cb();
}
function confirmNo(){
  document.getElementById('confirmModal').classList.remove('active');
  _confirmCallback = null;
}
function saveTask(){
  const name = document.getElementById('tk-name').value.trim();
  if(!name){ toast('Please enter a task name'); return; }
  const id = document.getElementById('tk-id').value;
  const req = parseFloat(document.getElementById('tk-required').value)||0;
  const payload = {
    name, description:document.getElementById('tk-desc').value,
    project:document.getElementById('tk-project').value || 'Tasks',
    category:document.getElementById('tk-category').value,
    priority:document.getElementById('tk-priority').value,
    deadline:document.getElementById('tk-deadline').value,
    requiredFocusTime:req,
    tags:document.getElementById('tk-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    notes:document.getElementById('tk-notes').value,
  };
  if(id){
    const t = DATA.tasks.find(x=>x.id===id);
    Object.assign(t, payload);
  } else {
    DATA.tasks.push(Object.assign({
      id:uid(), actualFocusTime:0, status:'not_started', progress:0,
      createdAt:new Date().toISOString(), completedAt:null, sessionCount:0
    }, payload));
  }
  save(); closeModal('taskModal'); toast('Task saved'); renderTasks(); renderPomodoroPage(); renderToday();
}
function deleteTask(id){
  showConfirm('Delete this task?', ()=>{
    const item=DATA.tasks.find(t=>t.id===id); if(!item) return;
    DATA.tasks = DATA.tasks.filter(t=>t.id!==id);
    setUndo('Task',item); renderTasks(); renderPomodoroPage(); renderToday();
  });
}
function toggleTaskDone(id){
  const t = DATA.tasks.find(x=>x.id===id);
  if(t.status==='completed'){ t.status='in_progress'; t.completedAt=null; }
  else { t.status='completed'; t.completedAt=new Date().toISOString(); t.progress=100; }
  save(); renderTasks(); renderToday(); renderDashboard();
}
function taskProgress(t){
  if(t.requiredFocusTime>0) return Math.min(100, Math.round((t.actualFocusTime/t.requiredFocusTime)*100));
  return t.progress||0;
}
function taskRow(t){
  const done = t.status==='completed';
  const pr = taskProgress(t);
  const overdue = t.deadline && !done && dateFromKey(t.deadline) < startOfDay();
  return `<div id="task-${t.id}" class="task-row ${done?'done':''}">
    <div class="chk" onclick="toggleTaskDone('${t.id}')"></div>
    <div class="task-main">
      <div class="task-name">${esc(t.name)}</div>
      <div class="task-meta">
        <span class="badge p-${t.priority}">${t.priority}</span>
        <span>${esc(t.category||'')}</span>
        ${t.requiredFocusTime? `<span>${fmtMin(t.actualFocusTime)} / ${fmtMin(t.requiredFocusTime)}</span>`:''}
        ${t.deadline? `<span style="color:${overdue?'var(--accent)':'inherit'}">${overdue?'Overdue: ':'Due '}${t.deadline}</span>`:''}
      </div>
      ${t.requiredFocusTime? `<div class="progress-bar"><div class="progress-fill" style="width:${pr}%"></div></div>`:''}
    </div>
    <div class="task-actions">
      <button class="icon-btn" onclick="selectTaskForPomo('${t.id}');goPage('pomodoro')" title="Focus">â–¶ï¸</button>
      <button class="icon-btn" onclick="openTaskModal('${t.id}')" title="Edit">âœï¸</button>
      <button class="icon-btn" onclick="deleteTask('${t.id}')" title="Delete">ðŸ—‘ï¸</button>
    </div>
  </div>`;
}
function esc(s){ return (s||'').toString().replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
/* Keeps a "total minutes" field and a separate Hours/Minutes pair in sync â€” editing either
   updates the other, so both input methods always represent the same underlying duration. */
function syncTotalFromHoursMins(totalId, hId, mId){
  const h = parseFloat(document.getElementById(hId).value)||0;
  const m = parseFloat(document.getElementById(mId).value)||0;
  document.getElementById(totalId).value = (h*60+m) || '';
}
function syncHoursMinsFromTotal(totalId, hId, mId){
  const total = parseFloat(document.getElementById(totalId).value)||0;
  document.getElementById(hId).value = Math.floor(total/60) || '';
  document.getElementById(mId).value = (total%60) || '';
}

let taskFilter='all';
function setTaskFilter(f){ taskFilter=f; document.querySelectorAll('#taskFilterTabs .tab').forEach(t=>t.classList.toggle('active', t.dataset.f===f)); renderTasks(); }
function renderTasks(){
  let list = [...DATA.tasks];
  const now = startOfDay();
  if(taskFilter==='active') list = list.filter(t=>t.status!=='completed');
  if(taskFilter==='completed') list = list.filter(t=>t.status==='completed');
  if(taskFilter==='overdue') list = list.filter(t=>t.status!=='completed' && t.deadline && dateFromKey(t.deadline)<now);
  list.sort((a,b)=> (a.status==='completed')-(b.status==='completed') || new Date(a.deadline||'2999-01-01') - new Date(b.deadline||'2999-01-01'));
  document.getElementById('tasks-list').innerHTML = list.length? list.map(taskRow).join('') : `<div class="empty">No tasks here. Create one to get started.</div>`;
}

/* ============ TODAY PAGE ============ */
function renderToday(){
  const list = DATA.tasks.filter(t=> t.status!=='completed' || (t.completedAt && localDateStr(new Date(t.completedAt))===todayStr()));
  const estimated = list.reduce((a,t)=>a+(t.requiredFocusTime||0),0);
  const completed = list.filter(t=>t.status==='completed').length;
  const elapsed = focusMinutesInRange(...dayRange());
  document.getElementById('t-estimated').textContent = fmtMin(estimated);
  document.getElementById('t-count').textContent = list.filter(t=>t.status!=='completed').length;
  document.getElementById('t-elapsed').textContent = fmtMin(elapsed);
  document.getElementById('t-completed').textContent = completed;
  document.getElementById('today-list').innerHTML = list.length? list.map(taskRow).join('') : `<div class="empty">Nothing planned for today. Add a task!</div>`;
}
