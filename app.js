/* TaskFlow Pro - Plain JS version
   Features:
   - pages: home, tasks, today, roadmap, overdue, summary, settings
   - add/edit/delete/complete
   - Highest priority (#FF0000) override
   - smart estimate (C): base time by priority, adjusts with deadline urgency
   - notifications
   - modal blur + persistent theme
*/

(() => {
  // ------- State -------
  // Application state object: stores the current page, todos list, theme and runtime flags
  const state = {
    page: 'home',
    todos: [],
    editingId: null,
    theme: localStorage.getItem('tflow-theme') || 'dark',
    notifyEnabled: Notification && Notification.permission === 'granted'
  };

  // ------- Elements -------
  // Cache frequently-used DOM elements referenced throughout the app
  const contentEl = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const themeToggle = document.getElementById('themeToggle');
  const newTaskBtn = document.getElementById('newTaskBtn');

  // modal
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('closeModal');
  const taskForm = document.getElementById('taskForm');
  const taskTitle = document.getElementById('taskTitle');
  const taskDate = document.getElementById('taskDate');
  const taskTime = document.getElementById('taskTime');
  const taskCategory = document.getElementById('taskCategory');
  const taskPriority = document.getElementById('taskPriority');
  const saveTaskBtn = document.getElementById('saveTask');
  const cancelTask = document.getElementById('cancelTask');
  const modalTitle = document.getElementById('modalTitle');

  const toast = document.getElementById('toast');

  // ------- Helpers -------
  const uid = () => Date.now() + Math.floor(Math.random()*999);

  function load() {
    const raw = localStorage.getItem('tflow-todos');
    if (raw) {
      try {
        state.todos = JSON.parse(raw).map(t => ({...t}));
      } catch(e){ state.todos = [] }
    }
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : 'dark');
    themeToggle.textContent = state.theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
  }

  function save() {
    localStorage.setItem('tflow-todos', JSON.stringify(state.todos));
    localStorage.setItem('tflow-theme', state.theme);
  }

  function showToast(msg, time = 3500) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(()=> toast.classList.add('hidden'), time);
  }

  // date helpers
  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function formatDate(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  }

  function formatDateTime(dStr, tStr) {
    if(!dStr) return '';
    if(!tStr) return formatDate(dStr);
    const dt = new Date(`${dStr}T${tStr}`);
    return `${dt.toLocaleDateString()} • ${dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  }

  // smart estimated time (Option C)
  // Estimate how many minutes a task will take based on priority and deadline urgency.
  // - Base minutes by priority: Highest=90, High=60, Medium=30, Low=15
  // - Adjust depending on how close the deadline is (more urgent => keep/increase estimate)
  function estimateTimeMinutes(task) {
    const base = (task.priority === 'Highest') ? 90
               : (task.priority === 'High') ? 60
               : (task.priority === 'Medium') ? 30 : 15;

    // if task has deadline adjust: if deadline within 2 hours => keep base; if >2 days reduce slightly; this is arbitrary but consistent with Option C behavior
    if (task.deadline && task.time) {
      const now = new Date();
      const dt = new Date(`${task.deadline}T${task.time}`);
      const diffH = (dt - now) / (1000*60*60);
      if (diffH <= 2) {
        return base; // urgent
      } else if (diffH <= 24) {
        return Math.round(base * 1.0); // near
      } else if (diffH <= 72) {
        return Math.round(base * 0.9);
      } else {
        return Math.round(base * 0.8);
      }
    }
    return base;
  }

  // Returns percentage of time elapsed between creation and deadline (0..100).
  // Used to display the visual "runner" progress bar for each task.
  function deadlineProgress(task) {
    if (!task.deadline || !task.time) return 100;
    if (task.completed) return 100;
    const created = new Date(task.createdAt || task.id);
    const deadline = new Date(`${task.deadline}T${task.time}`);
    const now = new Date();
    const total = deadline - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    const p = Math.min(100, Math.max(0, Math.round((elapsed/total)*100)));
    return p;
  }

  // Returns true if task has passed its deadline and is not completed
  function isOverdue(task) {
    if (!task.deadline) return false;
    if (task.completed) return false;
    const dt = new Date(`${task.deadline}T${task.time || '23:59'}`);
    return dt < new Date();
  }

  // Returns true if task is scheduled for today and not yet completed
  function upcomingToday(task) {
    if (!task.deadline) return false;
    const t = new Date(task.deadline);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return t.toDateString() === today.toDateString() && !task.completed;
  }

  // sort for roadmap: Highest first, then by priority->deadline->time
  function roadmapSort(a,b) {
    const prioVal = p => p === 'Highest' ? 0 : p === 'High' ? 1 : p === 'Medium' ? 2 : 3;
    if (a.priority === 'Highest' && b.priority !== 'Highest') return -1;
    if (b.priority === 'Highest' && a.priority !== 'Highest') return 1;
    if (prioVal(a.priority) !== prioVal(b.priority)) return prioVal(a.priority) - prioVal(b.priority);
    // urgency by deadline
    if (a.deadline && b.deadline) {
      const da = new Date(`${a.deadline}T${a.time || '23:59'}`);
      const db = new Date(`${b.deadline}T${b.time || '23:59'}`);
      return da - db;
    }
    if (a.deadline && !b.deadline) return -1;
    if (b.deadline && !a.deadline) return 1;
    return 0;
  }

  // ------- Render helpers -------
  function clearContent() { contentEl.innerHTML = ''; }

  function renderHome() {
    pageTitle.textContent = 'Welcome Back!';
    pageSubtitle.textContent = "Here's your productivity overview";

    clearContent();

    const stats = {
      total: state.todos.length,
      pending: state.todos.filter(t=>!t.completed).length,
      completed: state.todos.filter(t=>t.completed).length,
      overdue: state.todos.filter(isOverdue).length,
      today: state.todos.filter(upcomingToday).length
    };

    // top stats cards
    const grid = document.createElement('div');
    grid.className = 'grid';
    const cards = [
      {label:'Total', value: stats.total, icon:'📊'},
      {label:'Pending', value: stats.pending, icon:'⏳'},
      {label:'Completed', value: stats.completed, icon:'✅'},
      {label:'Overdue', value: stats.overdue, icon:'⚠️'},
      {label:'Today', value: stats.today, icon:'📅'},
    ];
    cards.forEach(c=>{
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:20px">${c.icon}</div>
        <div>
          <div style="font-size:28px;font-weight:700">${c.value}</div>
          <div style="color:var(--muted)">${c.label}</div>
        </div>
      </div>`;
      grid.appendChild(card);
    });

    contentEl.appendChild(grid);

    // overall progress
    const progressCard = document.createElement('div');
    progressCard.className = 'card';
    const percent = stats.total ? Math.round((stats.completed / stats.total)*100) : 0;
    progressCard.innerHTML = `
      <h3>Overall Progress</h3>
      <div style="display:flex;align-items:center;gap:20px;margin-top:12px">
        <div style="width:110px;height:110px;position:relative">
          <svg viewBox="0 0 200 200" style="transform:rotate(-90deg)">
            <circle cx="100" cy="100" r="88" stroke="rgba(255,255,255,0.12)" stroke-width="16" fill="none"></circle>
            <circle cx="100" cy="100" r="88" stroke="url(#g)" stroke-width="16" stroke-linecap="round" fill="none" stroke-dasharray="${2*Math.PI*88}" stroke-dashoffset="${2*Math.PI*88*(1-percent/100)}"></circle>
            <defs><linearGradient id="g"><stop offset="0" stop-color="${getComputedStyle(document.documentElement).getPropertyValue('--accent1') || '#8b5cf6'}"/><stop offset="1" stop-color="${getComputedStyle(document.documentElement).getPropertyValue('--accent2') || '#ec4899'}"/></linearGradient></defs>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
            <div style="font-weight:700;font-size:20px">${percent}%</div>
            <div style="color:var(--muted);font-size:12px">Complete</div>
          </div>
        </div>
        <div>
          <p style="margin:0">You've completed <strong style="color:#34d399">${stats.completed}</strong> out of <strong>${stats.total}</strong> tasks!</p>
          <p style="color:var(--muted);margin-top:8px">${stats.pending>0 ? `Keep going! ${stats.pending} tasks remaining.` : '🎉 All tasks completed!'}</p>
        </div>
      </div>
    `;
    contentEl.appendChild(progressCard);

    // today's tasks (first 3)
    const todayTasks = state.todos.filter(upcomingToday).slice(0,3);
    const todayCard = document.createElement('div');
    todayCard.className = 'card';
    todayCard.innerHTML = `<h3>Today's Tasks</h3>`;
    if (todayTasks.length===0) {
      todayCard.innerHTML += `<p class="muted">No tasks for today. Add one.</p>`;
    } else {
      const list = document.createElement('div');
      list.style.marginTop = '10px';
      todayTasks.forEach(t=>{
        const el = document.createElement('div');
        el.className = 'task';
        el.innerHTML = `<div class="left">${t.title[0] || 'T'}</div>
          <div class="info">
            <h4 class="${t.completed ? 'muted' : ''}">${t.title}</h4>
            <div class="meta">
              <span class="muted">${t.category} • ${t.time||''}</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div style="color:${t.priority==='Highest'? 'var(--highest)': ''}">${t.priority}</div>
          </div>`;
        list.appendChild(el);
      });
      todayCard.appendChild(list);
    }
    contentEl.appendChild(todayCard);
  }

  function renderTasks() {
    pageTitle.textContent = 'All Tasks';
    pageSubtitle.textContent = '';

    clearContent();

    // search + controls
    const controlCard = document.createElement('div');
    controlCard.className = 'card';
    controlCard.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <input id="searchInput" placeholder="Search tasks..." style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--text)"/>
        <select id="sortSelect" style="padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--text)">
          <option value="deadline-asc">Deadline ↑</option>
          <option value="deadline-desc">Deadline ↓</option>
          <option value="priority">Priority</option>
          <option value="newest">Newest</option>
        </select>
        <select id="filterSelect" style="padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--text)">
          <option value="all">All Tasks</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
        </select>
      </div>
    `;
    contentEl.appendChild(controlCard);

    const listCard = document.createElement('div');
    listCard.className = 'card';
    contentEl.appendChild(listCard);

    function drawList() {
      const search = document.getElementById('searchInput').value.toLowerCase();
      const sort = document.getElementById('sortSelect').value;
      const filter = document.getElementById('filterSelect').value;

      let list = state.todos.slice();

      if (search) list = list.filter(t => t.title.toLowerCase().includes(search));
      if (filter === 'pending') list = list.filter(t=>!t.completed);
      if (filter === 'completed') list = list.filter(t=>t.completed);
      if (filter === 'overdue') list = list.filter(isOverdue);
      if (filter === 'today') list = list.filter(upcomingToday);

      if (sort === 'deadline-asc') list.sort((a,b)=>{
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
      if (sort === 'deadline-desc') list.sort((a,b)=>{
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline) - new Date(a.deadline);
      });
      if (sort === 'priority') list.sort(roadmapSort);
      if (sort === 'newest') list.sort((a,b)=>b.id - a.id);

      listCard.innerHTML = '';
      if (list.length===0) {
        listCard.innerHTML = `<div class="center muted">No tasks found. Add a new task.</div>`;
        return;
      }

      list.forEach(t=>{
        const el = document.createElement('div');
        el.className = 'task';
        if (isOverdue(t)) el.classList.add('overdue');
        const pricolor = t.priority === 'Highest' ? 'var(--highest)' : (t.priority==='High'?'#ffb86b':t.priority==='Medium'?'#ffd25a':'#34d399');
        const catClass = t.category.toLowerCase();
        const est = estimateTimeMinutes(t);

        el.innerHTML = `
          <div class="left">${t.title[0] || 'T'}</div>
          <div class="info">
            <h4 class="${t.completed ? 'muted' : ''}">${t.title}</h4>
            <div class="meta">
              <span class="badge ${catClass}" style="background:${getCategoryGradient(t.category)}">${t.category}</span>
              <span style="color:${pricolor};margin-left:8px">${t.priority}</span>
              ${t.deadline ? `<span class="muted" style="margin-left:8px">• ${formatDateTime(t.deadline, t.time)}</span>` : ''}
              ${isOverdue(t) ? `<span style="color:var(--highest);margin-left:8px;font-weight:700">OVERDUE</span>` : ''}
            </div>
            <div style="margin-top:8px">
              <div class="progress-wrap">
                <div class="progress-fill" data-p="${deadlineProgress(t)}" style="width:${deadlineProgress(t)}%">
                  <span>🏃 Runner</span>
                  <span style="opacity:0.95">💀 ${Math.max(0,100-deadlineProgress(t))}% left</span>
                </div>
              </div>
              <div style="margin-top:8px;color:var(--muted)">Est. ${est} min</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
            <button class="small complete-btn">${t.completed ? '✔' : '○'}</button>
            <button class="small edit-btn">✏</button>
            <button class="small del-btn">🗑</button>
          </div>
        `;
        listCard.appendChild(el);

        // attach events
        el.querySelector('.complete-btn').addEventListener('click', ()=>{
          t.completed = !t.completed;
          if (t.completed) t.completedAt = new Date().toISOString();
          save(); drawList(); showToast(t.completed ? 'Task marked complete' : 'Marked pending');
        });
        el.querySelector('.edit-btn').addEventListener('click', ()=>openEdit(t.id));
        el.querySelector('.del-btn').addEventListener('click', ()=>{ if(confirm('Delete this task?')) { state.todos = state.todos.filter(x=>x.id!==t.id); save(); drawList(); showToast('Task deleted') }});
      });
    }

    // attach listeners
    setTimeout(()=>{ // slight delay to ensure elements exist
      document.getElementById('searchInput').addEventListener('input', drawList);
      document.getElementById('sortSelect').addEventListener('change', drawList);
      document.getElementById('filterSelect').addEventListener('change', drawList);
      drawList();
    }, 50);
  }

  function renderToday() {
    pageTitle.textContent = "Today's Tasks";
    pageSubtitle.textContent = '';

    clearContent();
    const tasks = state.todos.filter(upcomingToday).sort(roadmapSort);
    const card = document.createElement('div'); card.className='card';
    if (tasks.length===0) {
      card.innerHTML = `<div class="center muted"><div style="font-size:34px">📅</div><div>No tasks scheduled for today</div><div style="color:var(--muted)">You're all caught up!</div></div>`;
    } else {
      tasks.forEach(t=>{
        const el = document.createElement('div'); el.className='task';
        if (isOverdue(t)) el.classList.add('overdue');
        const est = estimateTimeMinutes(t);
        el.innerHTML = `<div class="left">${t.title[0]}</div>
          <div class="info"><h4>${t.title}</h4><div class="meta"><span class="badge ${t.category.toLowerCase()}" style="background:${getCategoryGradient(t.category)}">${t.category}</span>
          <span style="margin-left:8px;color:${t.priority==='Highest'?'var(--highest)':''}">${t.priority}</span>
          ${t.time? `<span class="muted" style="margin-left:8px">• ${t.time}</span>` : ''}</div>
          <div style="margin-top:8px"><div class="progress-wrap"><div class="progress-fill" style="width:${deadlineProgress(t)}%">${deadlineProgress(t)}%</div></div></div></div>
          <div style="display:flex;flex-direction:column;gap:8px"><button class="small start-btn">Start</button><button class="small edit-btn">✏</button></div>`;
        card.appendChild(el);

        el.querySelector('.start-btn').addEventListener('click', ()=>{ showToast('Started: ' + t.title); });
        el.querySelector('.edit-btn').addEventListener('click', ()=>openEdit(t.id));
      });
    }
    contentEl.appendChild(card);
  }

  function renderRoadmap() {
    pageTitle.textContent = "Today's Roadmap";
    pageSubtitle.textContent = "Prioritized task plan for today";

    clearContent();
    const roadmap = state.todos.filter(upcomingToday).sort(roadmapSort);
    const topCard = document.createElement('div'); topCard.className='card';
    const totalMin = roadmap.reduce((s,t)=>s + estimateTimeMinutes(t),0);
    topCard.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>Total Time Estimate</strong><div class="muted">Based on priority levels</div></div>
      <div style="text-align:right"><strong style="font-size:22px">${totalMin} min</strong><div class="muted">~${Math.round(totalMin/60)} hours</div></div>
    </div>`;
    contentEl.appendChild(topCard);

    if (roadmap.length===0) {
      const no = document.createElement('div'); no.className='card center muted'; no.innerHTML = 'No roadmap for today<br/>Add tasks with today\'s deadline to see your roadmap'; contentEl.appendChild(no); return;
    }

    roadmap.forEach((t, idx)=>{
      const el = document.createElement('div'); el.className='card';
      if (t.priority==='Highest') el.style.borderLeft = '6px solid var(--highest)';
      el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(90deg,#a78bfa,#f0abfc);display:flex;align-items:center;justify-content:center">${idx+1}</div>
          <div>
            <div style="font-weight:700">${t.title}</div>
            <div class="muted" style="margin-top:6px">${t.category} • Est. ${estimateTimeMinutes(t)} min ${t.time ? '• Due ' + t.time : ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn start small" data-id="${t.id}" style="background:#10b981;color:white;padding:8px 12px;border-radius:8px;border:none">Start This Task</button>
          <button class="icon-btn edit" data-id="${t.id}">✏</button>
        </div>
      </div>`;
      contentEl.appendChild(el);

      el.querySelector('.start').addEventListener('click', e=>{ showToast('Starting: '+t.title); });
      el.querySelector('.edit').addEventListener('click', ()=>openEdit(t.id));
    });
  }

  function renderOverdue() {
    pageTitle.textContent = "Overdue Tasks";
    pageSubtitle.textContent = "Tasks past their deadline";

    clearContent();
    const overdue = state.todos.filter(isOverdue).sort((a,b)=>new Date(a.deadline) - new Date(b.deadline));
    const card = document.createElement('div'); card.className='card';
    if (!overdue.length) {
      card.innerHTML = `<div class="center muted">No overdue tasks — nice!</div>`;
      contentEl.appendChild(card); return;
    }
    overdue.forEach(t=>{
      const el = document.createElement('div'); el.className='task overdue';
      const hr = Math.round((new Date() - new Date(`${t.deadline}T${t.time||'23:59'}`))/(1000*60*60));
      el.innerHTML = `<div class="left">${t.title[0]}</div>
        <div class="info"><h4>${t.title}</h4><div class="meta"><span class="muted">${t.category}</span><span style="color:var(--highest);margin-left:8px">Overdue ${hr}h</span></div></div>
        <div style="display:flex;flex-direction:column;gap:8px"><button class="small edit-btn">✏</button><button class="small del-btn">🗑</button></div>`;
      contentEl.appendChild(el);
      el.querySelector('.edit-btn').addEventListener('click', ()=>openEdit(t.id));
      el.querySelector('.del-btn').addEventListener('click', ()=>{ if(confirm('Delete overdue task?')) { state.todos = state.todos.filter(x=>x.id!==t.id); save(); renderOverdue(); showToast('Deleted') }});
    });
  }

  function renderSummary() {
    pageTitle.textContent = "Daily Summary";
    pageSubtitle.textContent = "Summary of tasks done and remaining today";

    clearContent();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const doneToday = state.todos.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= todayStart);
    const pendingToday = state.todos.filter(t => upcomingToday(t) && !t.completed);
    const overdue = state.todos.filter(isOverdue);
    const totalTimeEst = pendingToday.reduce((s,t)=>s+estimateTimeMinutes(t),0);
    const score = Math.min(100, Math.round((doneToday.length / Math.max(1, (doneToday.length + pendingToday.length))) * 100));

    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div style="display:flex;justify-content:space-between">
      <div>
        <h3>Today's Summary</h3>
        <p class="muted">Quick snapshot of today's progress</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:800">${score}%</div>
        <div class="muted">Productivity score</div>
      </div>
    </div>`;

    const metrics = document.createElement('div'); metrics.className='card';
    metrics.innerHTML = `<div style="display:flex;gap:20px;flex-wrap:wrap">
      <div><strong>${doneToday.length}</strong><div class="muted">Done today</div></div>
      <div><strong>${pendingToday.length}</strong><div class="muted">Pending today</div></div>
      <div><strong>${overdue.length}</strong><div class="muted">Overdue</div></div>
      <div><strong>${totalTimeEst} min</strong><div class="muted">Est. time remaining</div></div>
    </div>`;

    const distribution = document.createElement('div'); distribution.className='card';
    distribution.innerHTML = `<h4>Category distribution</h4>`;
    const categories = ['Personal','Work','Study','Fitness'];
    categories.forEach(cat=>{
      const count = state.todos.filter(t=>t.category===cat).length;
      const percent = state.todos.length ? Math.round((count/state.todos.length)*100) : 0;
      const bar = `<div style="display:flex;justify-content:space-between"><div>${cat}</div><div>${count} tasks</div></div>
        <div style="height:10px;background:rgba(0,0,0,0.2);border-radius:999px;margin-top:6px;overflow:hidden">
          <div style="width:${percent}%;height:100%;background:${getCategoryGradient(cat)}"></div>
        </div>`;
      distribution.innerHTML += bar + '<div style="height:10px"></div>';
    });

    contentEl.appendChild(card);
    contentEl.appendChild(metrics);
    contentEl.appendChild(distribution);
  }

  function renderSettings() {
    pageTitle.textContent = "Settings";
    pageSubtitle.textContent = "";
    clearContent();
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h3>Notifications</h3>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700">Deadline Reminders</div><div class="muted">Get notified 1 minute before deadline</div></div>
        <button id="notifToggle" class="btn">${state.notifyEnabled ? 'Enabled' : 'Enable'}</button>
      </div>
    <div style="height:12px"></div>
    <div style="display:flex;gap:12px">
      <button id="exportBtn" class="btn primary">Export Tasks (JSON)</button>
      <label style="display:inline-block" class="btn" id="importLabel">Import Tasks (JSON)
        <input id="importInput" type="file" accept=".json" style="display:none" />
      </label>
      <button id="clearBtn" class="btn" style="background:#ef4444;color:white">Clear All Tasks</button>
    </div>
    <div style="height:12px"></div>
    <div class="muted">About TaskFlow Pro<br/>Version 1.0.0 • A professional task management application</div>`;
    contentEl.appendChild(card);

    document.getElementById('notifToggle').addEventListener('click', async ()=>{
      if (!('Notification' in window)) { alert('Notifications not supported'); return; }
      const perm = await Notification.requestPermission();
      state.notifyEnabled = perm === 'granted';
      save();
      renderSettings();
      showToast(state.notifyEnabled ? 'Notifications enabled' : 'Notifications disabled');
    });

    document.getElementById('exportBtn').addEventListener('click', ()=>{
      const blob = new Blob([JSON.stringify(state.todos, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `taskflow-${Date.now()}.json`; a.click();
      showToast('Exported tasks');
    });

    document.getElementById('importInput').addEventListener('change', (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const imported = JSON.parse(r.result);
          if (Array.isArray(imported)) {
            state.todos = imported;
            save(); showToast('Imported tasks'); route('tasks');
          } else showToast('Invalid JSON file');
        } catch(err){ showToast('Invalid JSON file') }
      };
      r.readAsText(file);
    });

    document.getElementById('clearBtn').addEventListener('click', ()=>{
      if(confirm('Delete all tasks?')) { state.todos = []; save(); renderSettings(); showToast('All tasks cleared') }
    });
  }

  // ------- Utility renders -------
  function getCategoryGradient(cat){
    if (cat === 'Personal') return 'linear-gradient(90deg,#10b981,#06b6d4)';
    if (cat === 'Work') return 'linear-gradient(90deg,#7c3aed,#ec4899)';
    if (cat === 'Study') return 'linear-gradient(90deg,#60a5fa,#06b6d4)';
    if (cat === 'Fitness') return 'linear-gradient(90deg,#fb7185,#fb923c)';
    return 'linear-gradient(90deg,#ccc,#999)';
  }

  // ------- Modal logic -------
  // Modal open/close helpers; the modal is used for creating and editing tasks
  function openModal() {
    modal.classList.remove('hidden');
    modalBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModalFn() {
    modal.classList.add('hidden');
    modalBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
    state.editingId = null;
    taskForm.reset();
    modalTitle.textContent = 'New Task';
    saveTaskBtn.textContent = 'Add Task';
  }

  function openEdit(id) {
    const t = state.todos.find(x=>x.id===id);
    if(!t) return;
    state.editingId = id;
    modalTitle.textContent = 'Edit Task';
    taskTitle.value = t.title;
    taskDate.value = t.deadline || '';
    taskTime.value = t.time || '';
    taskCategory.value = t.category || 'Personal';
    taskPriority.value = t.priority || 'Medium';
    saveTaskBtn.textContent = 'Update Task';
    openModal();
  }

  // create / update
  taskForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = taskTitle.value.trim();
    if(!title) return alert('Please add title');
    const payload = {
      title,
      deadline: taskDate.value || '',
      time: taskTime.value || '',
      category: taskCategory.value || 'Personal',
      priority: taskPriority.value || 'Medium',
    };
    if (state.editingId) {
      // update
      state.todos = state.todos.map(t => t.id === state.editingId ? {...t, ...payload, notified:false} : t);
      showToast('Task updated');
    } else {
      const newTask = {
        id: uid(),
        createdAt: new Date().toISOString(),
        notified: false,
        completed: false,
        ...payload
      };
      state.todos.push(newTask);
      showToast('Task added');
    }
    save();
    closeModalFn();
    route(state.page); // re-render current page
  });

  cancelTask.addEventListener('click', closeModalFn);
  closeModal.addEventListener('click', closeModalFn);
  modalBackdrop.addEventListener('click', closeModalFn);
  newTaskBtn.addEventListener('click', ()=>{ openModal(); });

  // ------- routing -------
  function setActiveNav(p) {
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === p));
  }

  function route(p) {
    state.page = p;
    setActiveNav(p);
    if (p === 'home') renderHome();
    else if (p === 'tasks') renderTasks();
    else if (p === 'today') renderToday();
    else if (p === 'roadmap') renderRoadmap();
    else if (p === 'overdue') renderOverdue();
    else if (p === 'summary') renderSummary();
    else if (p === 'settings') renderSettings();
  }

  navButtons.forEach(b => {
    b.addEventListener('click', ()=>{ route(b.dataset.page); });
  });

  // ------- Theme toggle -------
  themeToggle.addEventListener('click', ()=>{
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : 'dark');
    themeToggle.textContent = state.theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    localStorage.setItem('tflow-theme', state.theme);
  });

  // ------- Notifications and check loop -------
  function checkDeadlines() {
    const now = new Date();
    state.todos.forEach(t => {
      if (t.completed) return;
      if (!t.deadline || !t.time) return;
      if (t.notified) return;
      const dt = new Date(`${t.deadline}T${t.time}`);
      const diff = dt - now;
      if (diff <= 60000 && diff > 0) { // within 1 minute
        // send notification
        if (state.notifyEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('TaskFlow Pro', {body: `"${t.title}" due in less than 1 minute!`});
        } else {
          showToast(`⏰ "${t.title}" is due in less than 1 minute!`);
        }
        t.notified = true;
        save();
      }
    });
  }

  // run check every 30s
  setInterval(checkDeadlines, 30000);

  // ------- Edit open helper -------
  // This helper opens the edit modal for a given task id. It is defined earlier
  // and re-exposed here to ensure it is available globally (used by renderers).
  function openEdit(id) { // defined earlier but hoisted - keeps behavior consistent
    const t = state.todos.find(x=>x.id===id);
    if(!t) return;
    state.editingId = id;
    modalTitle.textContent = 'Edit Task';
    taskTitle.value = t.title;
    taskDate.value = t.deadline || '';
    taskTime.value = t.time || '';
    taskCategory.value = t.category || 'Personal';
    taskPriority.value = t.priority || 'Medium';
    saveTaskBtn.textContent = 'Update Task';
    openModal();
  }

  // Expose helper for debugging or external calls
  window.openEdit = openEdit;

  // ------- Init -------
  function init() {
    load();
    route(state.page || 'home');

    // initial checks
    checkDeadlines();

    // periodic progress bar animation refresh
    setInterval(()=> {
      // update rendered progress bars if any (brute force re-route to current page)
      route(state.page);
    }, 60000); // every minute

    // keyboard: Esc to close modal
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModalFn();
    });
  }

  init();

})();
