
/* ============ CHART HELPER ============ */
const chartInstances = {};
function drawChart(canvasId, type, labels, datasets){
  const ctx = document.getElementById(canvasId);
  if(!ctx || typeof Chart==='undefined') return;
  if(chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(ctx, {
    type, data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:type==='doughnut', labels:{color:getComputedStyle(document.body).getPropertyValue('--text')}}},
      scales: type==='doughnut' ? {} : {
        x:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--text-dim')}, grid:{color:'rgba(255,255,255,.05)'}},
        y:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--text-dim')}, grid:{color:'rgba(255,255,255,.05)'}}
      }
    }
  });
}

/* ============ INIT ============ */
function init(){
  buildNav();
  document.addEventListener('keydown',handleShortcuts);
  document.addEventListener('click',e=>{ if(!document.getElementById('globalSearch').contains(e.target)) document.getElementById('globalSearchResults').style.display='none'; });
  document.getElementById('sidebarVersion').textContent = APP_VERSION;
  applyTheme();
  pomo.totalSec = pomoDurationSec('focus'); pomo.remaining = pomo.totalSec;
  document.getElementById('log-date').value = todayStr();
  rescheduleOverdueRevisions();
  goPage('dashboard');
  try{ if(window.Notification && Notification.permission==='default') Notification.requestPermission(); }catch(e){}
  checkTimeReminders();
  setInterval(checkTimeReminders, 20000);
  setInterval(()=>{ if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard(); }, 60000);
  const {overdueTasks, overdueEvents, todayEvents, todayDeadlines, habitsPending} = computeAgendaAlerts();
  const total = overdueTasks.length+overdueEvents.length+todayEvents.length+todayDeadlines.length;
  if(total>0) setTimeout(()=>toast(`You have ${total} item(s) needing attention today`), 500);
}
init();
