
/* ============ STUDY PLANNER ============ */
let spCurrentSubject = null;
function checkpointKeys(type){ return type==='language' ? ['grammar','writing','lesson','revision'] : ['concept','learning','revision']; }
function checkpointLabels(type){ return type==='language' ? {grammar:'Grammar',writing:'Writing Skill',lesson:'Lesson',revision:'Revision'} : {concept:'Concept',learning:'Learning',revision:'Revision'}; }
function chapterProgress(c){
  const s = SUBJECT_DEFS.find(x=>x.id===c.subjectId);
  if(!s) return 0;
  const keys = checkpointKeys(s.type);
  const done = keys.filter(k=>c.checkpoints[k]).length;
  return Math.round(done/keys.length*100);
}
function renderStudyPlannerPage(){
  if(spCurrentSubject){
    document.getElementById('sp-overview').style.display='none';
    document.getElementById('sp-workspace').style.display='block';
    renderSubjectWorkspace();
  } else {
    document.getElementById('sp-overview').style.display='block';
    document.getElementById('sp-workspace').style.display='none';
    renderStudyPlanner();
  }
}
function renderStudyPlanner(){
  document.getElementById('sp-subject-grid').innerHTML = SUBJECT_DEFS.map(s=>{
    const chapters = DATA.chapters.filter(c=>c.subjectId===s.id && !c._draft);
    const overall = chapters.length ? Math.round(chapters.reduce((a,c)=>a+chapterProgress(c),0)/chapters.length) : 0;
    const meta = DATA.subjectMeta[s.id]||{};
    let examTxt='';
    if(meta.examDate){ const days = Math.ceil((dateFromKey(meta.examDate)-startOfDay())/86400000); examTxt = days>=0? ` Â· Exam in ${days}d` : ` Â· Exam passed`; }
    return `<div class="card subject-clickable" onclick="openSubjectWorkspace('${s.id}')">
      <h3>${s.name} <span style="float:right;text-transform:none;">${s.type==='language'?'Language':'Core'}</span></h3>
      <div class="stat-num">${overall}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${overall}%"></div></div>
      <div class="stat-sub">${chapters.length} chapter${chapters.length!==1?'s':''}${examTxt}</div>
    </div>`;
  }).join('');
}
function openSubjectWorkspace(id){
  spCurrentSubject = id;
  document.getElementById('sp-overview').style.display='none';
  document.getElementById('sp-workspace').style.display='block';
  renderSubjectWorkspace();
}
function closeSubjectWorkspace(){
  spCurrentSubject=null;
  document.getElementById('sp-overview').style.display='block';
  document.getElementById('sp-workspace').style.display='none';
  renderStudyPlanner();
}
function estimateSyllabusCompletion(subjectId){
  const chapters = DATA.chapters.filter(c=>c.subjectId===subjectId && !c._draft);
  const remaining = chapters.filter(c=>chapterProgress(c)<100).length;
  if(!chapters.length) return 'Add chapters to estimate';
  if(remaining===0) return 'Complete âœ…';
  const completedWithDates = chapters.filter(c=>c.completedAt).map(c=>new Date(c.completedAt)).sort((a,b)=>a-b);
  if(completedWithDates.length<2) return 'Not enough data yet';
  let gaps=[]; for(let i=1;i<completedWithDates.length;i++) gaps.push((completedWithDates[i]-completedWithDates[i-1])/86400000);
  const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length || 3;
  const estDays = Math.max(1, Math.round(avgGap*remaining));
  const estDate = new Date(); estDate.setDate(estDate.getDate()+estDays);
  return `~${todayStr(estDate)} (${estDays}d)`;
}
function computeReadiness(subjectId, chapterFilterIds){
  const chapters = DATA.chapters.filter(c=>c.subjectId===subjectId && !c._draft && (!chapterFilterIds || chapterFilterIds.includes(c.id)));
  if(!chapters.length) return {score:0, suggestions:['Add chapters to this subject to compute readiness.']};
  const s = SUBJECT_DEFS.find(x=>x.id===subjectId);
  const syllabus = chapters.reduce((a,c)=>a+chapterProgress(c),0)/chapters.length;
  const revisionEvents = DATA.events.filter(e=>e.type==='revision' && chapters.some(c=>c.id===e.chapterId));
  const revisionDone = revisionEvents.length? Math.round(revisionEvents.filter(e=>e.completed).length/revisionEvents.length*100) : 0;
  const missedRevisions = revisionEvents.filter(e=>!e.completed && e.date<todayStr()).length;
  const totalStudyTime = DATA.sessions.filter(sess=>{ const t=DATA.tasks.find(x=>x.id===sess.taskId); return t && s && t.category===s.name; }).reduce((a,sess)=>a+sess.duration,0);
  const questionsTotal = chapters.reduce((a,c)=>a+(c.questions?c.questions.length:0),0);
  const avgConfidence = chapters.reduce((a,c)=>a+(c.confidence||3),0)/chapters.length;
  const last14=[]; for(let i=13;i>=0;i--){ last14.push(focusMinutesInRange(...dayRange(daysAgo(i)))>0?1:0); }
  const consistency = Math.round(last14.reduce((a,b)=>a+b,0)/14*100);
  const raw = syllabus*0.35 + revisionDone*0.2 + Math.min(100,totalStudyTime/10)*0.15 + Math.min(100,questionsTotal*5)*0.1 + (avgConfidence/5*100)*0.1 + consistency*0.1 - missedRevisions*2;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const suggestions=[];
  if(syllabus<80) suggestions.push('Complete more chapters to raise syllabus coverage.');
  if(revisionDone<60) suggestions.push('Catch up on pending revisions.');
  if(missedRevisions>0) suggestions.push(`${missedRevisions} revision(s) overdue â€” reschedule or complete them.`);
  if(avgConfidence<3) suggestions.push('Confidence is low â€” spend more time reinforcing concepts.');
  if(questionsTotal<5) suggestions.push('Add more practice questions / PYQs.');
  if(consistency<50) suggestions.push('Study more consistently â€” recent days show gaps.');
  if(!suggestions.length) suggestions.push('Looking solid â€” keep up the consistency.');
  return {score, suggestions};
}
function renderSubjectWorkspace(){
  const s = SUBJECT_DEFS.find(x=>x.id===spCurrentSubject);
  const chapters = DATA.chapters.filter(c=>c.subjectId===s.id && !c._draft);
  const overall = chapters.length? Math.round(chapters.reduce((a,c)=>a+chapterProgress(c),0)/chapters.length):0;
  const completedCh = chapters.filter(c=>chapterProgress(c)===100).length;
  const remainingCh = chapters.length - completedCh;
  const totalStudyTime = DATA.sessions.filter(sess=>{ const t=DATA.tasks.find(x=>x.id===sess.taskId); return t && t.category===s.name; }).reduce((a,sess)=>a+sess.duration,0);
  const revisionEvents = DATA.events.filter(e=>e.type==='revision' && chapters.some(c=>c.id===e.chapterId));
  const revisionProgress = revisionEvents.length? Math.round(revisionEvents.filter(e=>e.completed).length/revisionEvents.length*100) : 0;
  const estCompletion = estimateSyllabusCompletion(s.id);
  const readiness = computeReadiness(s.id);
  if(!DATA.subjectMeta[s.id]) DATA.subjectMeta[s.id] = {examDate:''};
  const meta = DATA.subjectMeta[s.id];
  document.getElementById('sp-workspace-body').innerHTML = `
    <div class="grid grid-4" style="margin:14px 0;">
      <div class="card"><h3>Overall Progress</h3><div class="stat-num">${overall}%</div></div>
      <div class="card"><h3>Chapters</h3><div class="stat-num">${completedCh}/${chapters.length}</div><div class="stat-sub">${remainingCh} remaining</div></div>
      <div class="card"><h3>Total Study Time</h3><div class="stat-num">${fmtMin(totalStudyTime)}</div></div>
      <div class="card"><h3>Revision Progress</h3><div class="stat-num">${revisionProgress}%</div></div>
    </div>
    <div class="grid grid-2" style="margin-bottom:14px;">
      <div class="card"><h3>Exam Readiness Score</h3><div class="readiness-badge">${readiness.score}%</div>
        ${readiness.suggestions.map(sg=>`<div class="task-meta">â€¢ ${sg}</div>`).join('')}
      </div>
      <div class="card"><h3>Estimated Syllabus Completion</h3><div class="stat-num" style="font-size:16px;">${estCompletion}</div>
        <div class="field" style="max-width:220px;margin-top:12px;"><label>Exam Date</label><input type="date" value="${meta.examDate||''}" onchange="setExamDate('${s.id}', this.value)"></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">Chapters</h3>
      <button class="btn btn-primary btn-sm" onclick="openChapterModal(null)">+ Add Chapter</button>
    </div>
    <div id="sp-chapter-list">${chapters.length? chapters.map(chapterRow).join('') : '<div class="empty">No chapters yet. Add your syllabus chapters here.</div>'}</div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px;">
      <h3 style="margin:0;">Backlogs</h3>
    </div>
    <div class="card">
      <div class="field-row">
        <input id="bl-newtext" placeholder="Unfinished work, e.g. Redo Chapter 2 practice problems" style="flex:1;">
        <select id="bl-chapterlink" style="max-width:200px;">
          <option value="">No linked chapter</option>
          ${chapters.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn btn-sm" onclick="addBacklog('${s.id}')">Add</button>
      </div>
      <div id="bl-list" style="margin-top:10px;">${renderBacklogList(s.id)}</div>
    </div>
  `;
}
function renderBacklogList(subjectId){
  const meta = DATA.subjectMeta[subjectId] || {};
  const backlogs = meta.backlogs || [];
  if(!backlogs.length) return '<div class="empty">No backlogs â€” all caught up.</div>';
  return backlogs.map(b=>{
    const chapter = b.chapterId ? DATA.chapters.find(c=>c.id===b.chapterId) : null;
    return `<div class="task-row ${b.done?'done':''}">
      <div class="chk" onclick="toggleBacklog('${subjectId}','${b.id}')"></div>
      <div class="task-main">
        <div class="task-name">${esc(b.text)}</div>
        ${chapter? `<div class="task-meta"><span>Linked: ${esc(chapter.name)}</span></div>` : ''}
      </div>
      <div class="task-actions"><button class="icon-btn" onclick="deleteBacklog('${subjectId}','${b.id}')">ðŸ—‘ï¸</button></div>
    </div>`;
  }).join('');
}
function addBacklog(subjectId){
  const text = document.getElementById('bl-newtext').value.trim();
  if(!text){ toast('Enter a backlog item'); return; }
  const chapterId = document.getElementById('bl-chapterlink').value || null;
  DATA.subjectMeta[subjectId] = DATA.subjectMeta[subjectId] || {};
  DATA.subjectMeta[subjectId].backlogs = DATA.subjectMeta[subjectId].backlogs || [];
  DATA.subjectMeta[subjectId].backlogs.push({id:uid(), text, chapterId, done:false, createdAt:new Date().toISOString()});
  document.getElementById('bl-newtext').value='';
  save(); toast('Backlog added'); renderSubjectWorkspace();
}
function toggleBacklog(subjectId, id){
  const b = DATA.subjectMeta[subjectId].backlogs.find(x=>x.id===id);
  b.done = !b.done;
  save(); renderSubjectWorkspace();
}
function deleteBacklog(subjectId, id){
  showConfirm('Delete this backlog item?', ()=>{
    DATA.subjectMeta[subjectId].backlogs = DATA.subjectMeta[subjectId].backlogs.filter(x=>x.id!==id);
    save(); renderSubjectWorkspace();
  });
}
function setExamDate(subjectId,val){ DATA.subjectMeta[subjectId] = DATA.subjectMeta[subjectId]||{}; DATA.subjectMeta[subjectId].examDate = val; save(); renderSubjectWorkspace(); renderStudyPlanner(); }
function chapterRow(c){
  const s = SUBJECT_DEFS.find(x=>x.id===c.subjectId);
  const keys = checkpointKeys(s.type); const labels = checkpointLabels(s.type);
  const pr = chapterProgress(c);
  const ring = chapterRing(pr);
  return `<div id="chapter-${c.id}" class="card" style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;gap:10px;align-items:center;">${ring}<div>
        <div style="font-weight:600;">${esc(c.name)} <span class="badge p-${c.priority}">${c.priority}</span> <span class="badge p-${c.difficulty||'medium'}">${c.difficulty||'medium'}</span></div>
        <div class="task-meta">${pr}% complete ${c.revisionDate? 'Â· Next revision: '+c.revisionDate:''} ${c.nextSteps? 'Â· Next: '+esc(c.nextSteps.slice(0,40)):''}</div>
      </div></div>
      <div class="task-actions">
        <button class="icon-btn" onclick="openChapterModal('${c.id}')">âœï¸</button>
        <button class="icon-btn" onclick="deleteChapter('${c.id}')">ðŸ—‘ï¸</button>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pr}%"></div></div>
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
      ${keys.map(k=>`<span class="pill ${c.checkpoints[k]?'on':''}" onclick="toggleCheckpoint('${c.id}','${k}')">${c.checkpoints[k]?'âœ…':'â¬œ'} ${labels[k]}</span>`).join('')}
    </div>
    ${(c.pdfs&&c.pdfs.length)||(c.resources&&c.resources.length) ? `<div class="task-meta" style="margin-top:8px;flex-wrap:wrap;">
      ${(c.pdfs||[]).map(p=>`<a href="#" onclick="openPdfViewer('${c.id}','${p.id}');return false;" style="margin-right:10px;">ðŸ“„ ${esc(p.name)}</a>`).join('')}
      ${(c.resources||[]).map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener" style="margin-right:10px;">ðŸ”— ${esc(r.title||r.url)}</a>`).join('')}
    </div>` : ''}
  </div>`;
}
function chapterRing(progress){ const c=2*Math.PI*17; return `<svg class="chapter-ring" viewBox="0 0 42 42" aria-label="${progress}% complete"><circle class="track" cx="21" cy="21" r="17"></circle><circle class="value" cx="21" cy="21" r="17" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-progress/100)}"></circle><text class="chapter-ring-label" x="21" y="24" text-anchor="middle">${progress}%</text></svg>`; }
function generateSpacedRevisions(chapterId){
  const c = DATA.chapters.find(x=>x.id===chapterId);
  if(!c || c.revisionScheduleGenerated) return;
  const s = SUBJECT_DEFS.find(x=>x.id===c.subjectId);
  const offsets = [1,3,7,15,30];
  const base = startOfDay();
  offsets.forEach((off,i)=>{
    const d = new Date(base.getTime()+off*86400000);
    DATA.events.push({id:uid(), title:`Revision ${i+1}: ${c.name} (${s.name})`, date:todayStr(d), time:'', type:'revision', subjectId:c.subjectId, chapterId:c.id, notes:'', completed:false, reminder:true, priority:'medium', repeat:'none', color:'#a58bff', auto:true, revisionStage:i+1});
  });
  c.revisionScheduleGenerated = true;
  toast(`ðŸ“… 5 spaced revisions scheduled for "${c.name}"`);
}
function toggleCheckpoint(chapterId,key){
  const c = DATA.chapters.find(x=>x.id===chapterId);
  c.checkpoints[key] = !c.checkpoints[key];
  const pr = chapterProgress(c);
  if(pr===100 && !c.completedAt){ c.completedAt = new Date().toISOString(); generateSpacedRevisions(c.id); }
  if(pr<100) c.completedAt = null;
  save(); renderSubjectWorkspace(); renderStudyPlanner();
}
let chapterModalId = null;
function openChapterModal(id){
  if(id){ chapterModalId = id; }
  else {
    chapterModalId = uid();
    DATA.chapters.push({id:chapterModalId, subjectId:spCurrentSubject, name:'', priority:'medium', difficulty:'medium', revisionDate:'', confidence:3, nextSteps:'', notesList:[], questions:[], pdfs:[], resources:[], checkpoints:{}, createdAt:new Date().toISOString(), completedAt:null, revisionScheduleGenerated:false, _draft:true});
  }
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  document.getElementById('chapterModalTitle').textContent = id? 'Edit Chapter' : 'New Chapter';
  document.getElementById('ch-name').value=c.name||'';
  document.getElementById('ch-priority').value=c.priority||'medium';
  document.getElementById('ch-difficulty').value=c.difficulty||'medium';
  document.getElementById('ch-revision').value=c.revisionDate||'';
  document.getElementById('ch-confidence').value=c.confidence||3;
  document.getElementById('ch-confVal').textContent=c.confidence||3;
  document.getElementById('ch-nextsteps').value=c.nextSteps||'';
  renderNotesList(c); renderQuestions(c); renderPdfs(c); renderResources(c);
  document.getElementById('chapterModal').classList.add('active');
}
function closeChapterModal(){
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  if(c && c._draft){ DATA.chapters = DATA.chapters.filter(x=>x.id!==chapterModalId); }
  chapterModalId=null;
  closeModal('chapterModal');
}
function saveChapterMeta(){
  const name = document.getElementById('ch-name').value.trim();
  if(!name){ toast('Enter a chapter name'); return; }
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  c.name = name;
  c.priority = document.getElementById('ch-priority').value;
  c.difficulty = document.getElementById('ch-difficulty').value;
  c.revisionDate = document.getElementById('ch-revision').value;
  c.confidence = parseInt(document.getElementById('ch-confidence').value)||3;
  c.nextSteps = document.getElementById('ch-nextsteps').value;
  delete c._draft;
  syncRevisionEvent(chapterModalId);
  save(); closeModal('chapterModal'); chapterModalId=null; toast('Chapter saved'); renderSubjectWorkspace(); renderStudyPlanner();
}
function deleteChapter(id){
  showConfirm('Delete this chapter?', ()=>{
    const item=DATA.chapters.find(c=>c.id===id); if(!item) return;
    const relatedEvents=DATA.events.filter(e=>e.chapterId===id);
    DATA.chapters = DATA.chapters.filter(c=>c.id!==id);
    DATA.events = DATA.events.filter(e=>e.chapterId!==id);
    if(chapterModalId===id){ chapterModalId=null; closeModal('chapterModal'); }
    setUndo('Chapter',{chapter:item,relatedEvents}); renderSubjectWorkspace(); renderStudyPlanner();
  });
}
function renderNotesList(c){
  document.getElementById('ch-notesList').innerHTML = (c.notesList||[]).map(n=>`<div class="note-card"><span>${esc(n.text)}</span><button class="icon-btn" onclick="removeNote('${n.id}')">ðŸ—‘ï¸</button></div>`).join('') || '<div class="empty">No notes yet</div>';
}
function addNote(){
  const val = document.getElementById('ch-newnote').value.trim();
  if(!val) return;
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  c.notesList = c.notesList||[]; c.notesList.push({id:uid(), text:val});
  document.getElementById('ch-newnote').value=''; save(); renderNotesList(c);
}
function removeNote(id){ const c = DATA.chapters.find(x=>x.id===chapterModalId); c.notesList = c.notesList.filter(n=>n.id!==id); save(); renderNotesList(c); }
function renderQuestions(c){
  document.getElementById('ch-questions').innerHTML = (c.questions||[]).map(q=>`<div class="note-card"><span>${esc(q.text)}</span><button class="icon-btn" onclick="removeQuestion('${q.id}')">ðŸ—‘ï¸</button></div>`).join('') || '<div class="empty">No questions saved</div>';
}
function addQuestion(){
  const val = document.getElementById('ch-newquestion').value.trim();
  if(!val) return;
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  c.questions = c.questions||[]; c.questions.push({id:uid(), text:val});
  document.getElementById('ch-newquestion').value=''; save(); renderQuestions(c);
}
function removeQuestion(id){ const c = DATA.chapters.find(x=>x.id===chapterModalId); c.questions = c.questions.filter(q=>q.id!==id); save(); renderQuestions(c); }
function renderPdfs(c){
  document.getElementById('ch-pdfs').innerHTML = (c.pdfs||[]).map(p=>`<div class="note-card"><a href="#" onclick="openPdfViewer('${c.id}','${p.id}');return false;">ðŸ“„ ${esc(p.name)}</a><span style="display:flex;align-items:center;gap:4px;">${(p.size/1024).toFixed(0)}KB
    <label class="icon-btn" style="cursor:pointer;" title="Replace">ðŸ”<input type="file" accept="application/pdf" style="display:none;" onchange="replacePdf(event,'${p.id}')"></label>
    <button class="icon-btn" onclick="removePdf('${p.id}')" title="Delete">ðŸ—‘ï¸</button></span></div>`).join('') || '<div class="empty">No PDFs uploaded</div>';
}
function renderResources(c){
  document.getElementById('ch-resources').innerHTML = (c.resources||[]).map(r=>`<div class="note-card"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title||r.url)}</a><button class="icon-btn" onclick="removeResource('${r.id}')">ðŸ—‘ï¸</button></div>`).join('') || '<div class="empty">No resources saved</div>';
}
function addResource(){
  const title = document.getElementById('ch-newresource-title').value.trim();
  let url = document.getElementById('ch-newresource-url').value.trim();
  if(!url){ toast('Enter a link URL'); return; }
  if(!/^https?:\/\//i.test(url)) url = 'https://'+url;
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  c.resources = c.resources||[]; c.resources.push({id:uid(), title: title||url, url});
  document.getElementById('ch-newresource-title').value='';
  document.getElementById('ch-newresource-url').value='';
  save(); renderResources(c);
}
function removeResource(id){ const c = DATA.chapters.find(x=>x.id===chapterModalId); c.resources = c.resources.filter(r=>r.id!==id); save(); renderResources(c); }
function uploadPdfs(e){
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  const files = Array.from(e.target.files);
  files.forEach(f=>{
    if(f.size > 8*1024*1024){ toast(`${f.name} is too large (max 8MB)`); return; }
    const reader = new FileReader();
    reader.onload = ev=>{
      c.pdfs = c.pdfs||[]; c.pdfs.push({id:uid(), name:f.name, size:f.size, dataUrl:ev.target.result});
      try{ save(); }catch(err){ c.pdfs.pop(); }
      renderPdfs(c);
    };
    reader.readAsDataURL(f);
  });
  e.target.value='';
}
function replacePdf(e,id){
  const file = e.target.files[0]; if(!file) return;
  if(file.size > 8*1024*1024){ toast('File too large (max 8MB)'); return; }
  const c = DATA.chapters.find(x=>x.id===chapterModalId);
  const reader = new FileReader();
  reader.onload = ev=>{
    const p = c.pdfs.find(x=>x.id===id);
    p.name=file.name; p.size=file.size; p.dataUrl=ev.target.result;
    try{ save(); }catch(err){}
    renderPdfs(c); toast('PDF replaced');
  };
  reader.readAsDataURL(file);
}
function removePdf(id){ const c = DATA.chapters.find(x=>x.id===chapterModalId); c.pdfs = c.pdfs.filter(p=>p.id!==id); save(); renderPdfs(c); }

/* ============ PDF VIEWER ============ */
let pdfZoomLevel = 1;
function openPdfViewer(chapterId, pdfId){
  const c = DATA.chapters.find(x=>x.id===chapterId);
  const p = c && c.pdfs.find(x=>x.id===pdfId);
  if(!p){ toast('PDF not found'); return; }
  pdfZoomLevel = 1;
  document.getElementById('pdfViewerTitle').textContent = p.name;
  document.getElementById('pdfViewerFrame').src = p.dataUrl;
  document.getElementById('pdfViewerFrame').style.transform = 'scale(1)';
  document.getElementById('pdfZoomLabel').textContent = '100%';
  document.getElementById('pdfOpenNewTab').href = p.dataUrl;
  document.getElementById('pdfDownloadBtn').href = p.dataUrl;
  document.getElementById('pdfDownloadBtn').setAttribute('download', p.name);
  document.getElementById('pdfViewerModal').classList.add('active');
}
function pdfZoom(delta){
  pdfZoomLevel = Math.max(0.5, Math.min(2.5, pdfZoomLevel+delta));
  document.getElementById('pdfViewerFrame').style.transform = `scale(${pdfZoomLevel})`;
  document.getElementById('pdfZoomLabel').textContent = Math.round(pdfZoomLevel*100)+'%';
}
function pdfFullscreen(){
  const box = document.getElementById('pdfViewerBox');
  if(box.requestFullscreen) box.requestFullscreen();
  else if(box.webkitRequestFullscreen) box.webkitRequestFullscreen();
}
function syncRevisionEvent(chapterId){
  const c = DATA.chapters.find(x=>x.id===chapterId);
  if(!c) return;
  DATA.events = DATA.events.filter(e=>!(e.chapterId===chapterId && e.type==='revision' && !e.auto));
  if(c.revisionDate){
    const s = SUBJECT_DEFS.find(x=>x.id===c.subjectId);
    DATA.events.push({id:uid(), title:`Revise: ${c.name} (${s.name})`, date:c.revisionDate, time:'', type:'revision', subjectId:c.subjectId, chapterId:c.id, notes:'', completed:false, reminder:true, priority:'medium', repeat:'none', color:'#a58bff', auto:false});
  }
}
