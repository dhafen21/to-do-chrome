// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#DC2626',
  '#D97706', '#DB2777', '#0891B2', '#65A30D',
  '#9333EA', '#EA580C',
];

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  projects: [],
  tasks: [],
  selectedProjectId: null,
  showDone: false,
  doneCollapsed: false,
  dragSrcId: null,
  selectedColor: PROJECT_COLORS[0],
};

// ─── Storage ──────────────────────────────────────────────────────────────────

async function load() {
  const data = await chrome.storage.sync.get(['projects', 'tasks']);
  state.projects = data.projects || [];
  state.tasks    = data.tasks    || [];
}

async function save() {
  await chrome.storage.sync.set({
    projects: state.projects,
    tasks:    state.tasks,
  });
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Project helpers ──────────────────────────────────────────────────────────

function openTaskCount(projectId) {
  return state.tasks.filter(t => t.projectId === projectId && t.status === 'open').length;
}

function priorityCounts(projectId) {
  const open = state.tasks.filter(t => t.projectId === projectId && t.status === 'open');
  return {
    high:   open.filter(t => t.priority === 'high').length,
    medium: open.filter(t => t.priority === 'medium').length,
    low:    open.filter(t => t.priority === 'low').length,
  };
}

function buildProjectPriRow(counts) {
  if (!counts.high && !counts.medium && !counts.low) return '';

  const highIcon = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <circle cx="4.5" cy="4.5" r="4" fill="#FEE2E2" stroke="#DC2626" stroke-width="1"/>
    <path d="M4.5 2.5v2.2M4.5 6.2v.6" stroke="#DC2626" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;
  const medIcon = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <circle cx="4.5" cy="4.5" r="4" fill="#FEF9C3" stroke="#EAB308" stroke-width="1"/>
    <path d="M2.5 4.5h4" stroke="#EAB308" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
  const lowIcon = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none">
    <circle cx="4.5" cy="4.5" r="4" fill="#D1FAE5" stroke="#059669" stroke-width="1"/>
    <path d="M2.8 4.5l1.3 1.3 2.1-2.1" stroke="#059669" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const parts = [];
  if (counts.high)   parts.push(`<span class="ppr high"><span class="ppr-icon pulse">${highIcon}</span>${counts.high}</span>`);
  if (counts.medium) parts.push(`<span class="ppr medium"><span class="ppr-icon">${medIcon}</span>${counts.medium}</span>`);
  if (counts.low)    parts.push(`<span class="ppr low"><span class="ppr-icon">${lowIcon}</span>${counts.low}</span>`);

  return `<div class="project-pri-row">${parts.join('')}</div>`;
}

// ─── Render: sidebar ──────────────────────────────────────────────────────────

function renderProjects() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';

  state.projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'project-item' + (p.id === state.selectedProjectId ? ' active' : '');
    item.dataset.id = p.id;

    const count  = openTaskCount(p.id);
    const priRow = buildProjectPriRow(priorityCounts(p.id));

    item.innerHTML = `
      <span class="project-dot" style="background:${p.color}"></span>
      <div class="project-info">
        <span class="project-name">${escHtml(p.name)}</span>
        ${priRow}
      </div>
      ${count > 0 ? `<span class="project-badge">${count}</span>` : ''}
    `;

    item.addEventListener('click', () => selectProject(p.id));
    list.appendChild(item);
  });
}

// ─── Render: task pane ────────────────────────────────────────────────────────

function renderTaskPane() {
  const emptyState    = document.getElementById('emptyState');
  const taskPaneInner = document.getElementById('taskPaneInner');

  if (!state.selectedProjectId) {
    emptyState.style.display    = 'flex';
    taskPaneInner.style.display = 'none';
    return;
  }

  const project = state.projects.find(p => p.id === state.selectedProjectId);
  if (!project) return;

  emptyState.style.display    = 'none';
  taskPaneInner.style.display = 'flex';

  document.getElementById('projectDotLg').style.background = project.color;
  document.getElementById('projectTitle').textContent = project.name;

  const openTasks = state.tasks
    .filter(t => t.projectId === state.selectedProjectId && t.status === 'open')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
  const doneTasks = state.tasks.filter(t => t.projectId === state.selectedProjectId && t.status === 'done');

  const total = openTasks.length + doneTasks.length;
  document.getElementById('taskCount').textContent =
    total === 0 ? 'no tasks' :
    openTasks.length === 0 ? 'all done' :
    `${openTasks.length} open`;

  const toggleBtn = document.getElementById('btnToggleDone');
  toggleBtn.classList.toggle('active', state.showDone);

  renderTaskList(openTasks, doneTasks);
}

function renderTaskList(openTasks, doneTasks) {
  const list = document.getElementById('taskList');
  list.innerHTML = '';

  openTasks.forEach(task => {
    list.appendChild(buildTaskEl(task));
  });

  if (state.showDone && doneTasks.length > 0) {
    const header = document.createElement('div');
    header.className = 'done-section-header';
    header.innerHTML = `
      <span class="done-section-label">Completed</span>
      <span class="done-section-count">${doneTasks.length}</span>
      <span class="done-section-toggle ${state.doneCollapsed ? 'collapsed' : ''}">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
    header.addEventListener('click', () => {
      state.doneCollapsed = !state.doneCollapsed;
      renderTaskPane();
    });
    list.appendChild(header);

    if (!state.doneCollapsed) {
      doneTasks.forEach(task => {
        list.appendChild(buildTaskEl(task));
      });
    }
  }
}

function buildTaskEl(task) {
  const item = document.createElement('div');
  item.className = 'task-item' + (task.status === 'done' ? ' done' : '');
  item.dataset.id = task.id;
  item.draggable = task.status === 'open';

  const priorityHtml = buildPriorityHtml(task.priority);
  const notesHtml = task.notes
    ? `<span class="task-notes-preview">${escHtml(task.notes.slice(0, 50))}${task.notes.length > 50 ? '…' : ''}</span>`
    : '';

  item.innerHTML = `
    <div class="task-main">
      <div class="drag-handle" title="Drag to reorder">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <circle cx="3" cy="3"  r="1.2" fill="currentColor"/>
          <circle cx="7" cy="3"  r="1.2" fill="currentColor"/>
          <circle cx="3" cy="7"  r="1.2" fill="currentColor"/>
          <circle cx="7" cy="7"  r="1.2" fill="currentColor"/>
          <circle cx="3" cy="11" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
        </svg>
      </div>
      <div class="task-checkbox" data-action="toggle" title="Complete"></div>
      <div class="task-body">
        <div class="task-title">${escHtml(task.title)}</div>
        ${priorityHtml || notesHtml ? `<div class="task-meta">${priorityHtml}${notesHtml}</div>` : ''}
      </div>
      <div class="task-actions">
        <button class="task-action-btn" data-action="edit" title="Edit">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9.5 1.5l2 2L4 11H2V9L9.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="task-action-btn danger" data-action="delete" title="Delete">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 3.5h8M5 3.5V2.5h3v1M4.5 3.5l.5 7h3l.5-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Delegate clicks within the task
  item.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle') {
      toggleTask(task.id, item);
    } else if (action === 'edit') {
      openInlineEditor(task.id);
    } else if (action === 'delete') {
      deleteTask(task.id, item);
    } else if (!e.target.closest('.task-actions') && !e.target.closest('.drag-handle')) {
      // Click on body — expand notes if any
      if (task.notes) toggleNotesExpand(task.id, item);
    }
  });

  // Drag and drop
  item.addEventListener('dragstart', e => onDragStart(e, task.id));
  item.addEventListener('dragover',  e => onDragOver(e, task.id));
  item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
  item.addEventListener('drop',      e => onDrop(e, task.id));
  item.addEventListener('dragend',   () => {
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over', 'dragging'));
  });

  return item;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, null: 3, undefined: 3 };

function buildPriorityHtml(priority) {
  if (!priority) return '';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return `<span class="task-priority ${priority}">${label}</span>`;
}

// ─── Priority picker helper ───────────────────────────────────────────────────

function initPriorityPicker(editor, selected = 'low') {
  const btns = editor.querySelectorAll('.priority-btn');
  btns.forEach(btn => {
    if (btn.dataset.priority === selected) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

// ─── Inline editor ────────────────────────────────────────────────────────────

function openInlineEditor(taskId) {
  // Close any open editor first
  closeInlineEditors();

  const task    = state.tasks.find(t => t.id === taskId);
  const taskEl  = document.querySelector(`.task-item[data-id="${taskId}"]`);
  if (!task || !taskEl) return;

  const tpl    = document.getElementById('taskEditorTemplate');
  const editor = tpl.content.cloneNode(true).querySelector('.task-editor');

  editor.querySelector('.task-editor-input').value = task.title;
  editor.querySelector('.task-editor-notes').value = task.notes || '';
  initPriorityPicker(editor, task.priority || 'low');

  editor.querySelector('.editor-cancel').addEventListener('click', closeInlineEditors);
  editor.querySelector('.editor-save').addEventListener('click', () => saveInlineEditor(taskId, editor));

  editor.querySelector('.task-editor-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveInlineEditor(taskId, editor); }
    if (e.key === 'Escape') closeInlineEditors();
  });

  taskEl.replaceWith(editor);
  editor.dataset.editingId = taskId;
  editor.querySelector('.task-editor-input').focus();
}

function openNewTaskEditor() {
  closeInlineEditors();

  const tpl    = document.getElementById('taskEditorTemplate');
  const editor = tpl.content.cloneNode(true).querySelector('.task-editor');
  editor.dataset.editingId = 'new';
  initPriorityPicker(editor, 'low');

  editor.querySelector('.editor-cancel').addEventListener('click', closeInlineEditors);
  editor.querySelector('.editor-save').addEventListener('click', () => saveNewTask(editor));

  editor.querySelector('.task-editor-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNewTask(editor); }
    if (e.key === 'Escape') closeInlineEditors();
  });

  const list = document.getElementById('taskList');
  list.appendChild(editor);
  editor.querySelector('.task-editor-input').focus();
  editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeInlineEditors() {
  renderTaskPane();
}

async function saveInlineEditor(taskId, editor) {
  const title = editor.querySelector('.task-editor-input').value.trim();
  if (!title) return;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.title    = title;
  task.notes    = editor.querySelector('.task-editor-notes').value.trim();
  task.priority = editor.querySelector('.priority-btn.selected')?.dataset.priority || 'low';

  await save();
  renderAll();
}

async function saveNewTask(editor) {
  const title = editor.querySelector('.task-editor-input').value.trim();
  if (!title) { closeInlineEditors(); return; }

  const task = {
    id:          uid(),
    projectId:   state.selectedProjectId,
    title,
    notes:       editor.querySelector('.task-editor-notes').value.trim(),
    priority:    editor.querySelector('.priority-btn.selected')?.dataset.priority || 'low',
    status:      'open',
    order:       state.tasks.filter(t => t.projectId === state.selectedProjectId).length,
    createdAt:   Date.now(),
    completedAt: null,
  };

  state.tasks.push(task);
  await save();
  renderAll();
}

// ─── Task actions ─────────────────────────────────────────────────────────────

async function toggleTask(taskId, itemEl) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  itemEl.classList.add('completing');

  await new Promise(r => setTimeout(r, 200));

  if (task.status === 'open') {
    task.status      = 'done';
    task.completedAt = Date.now();
  } else {
    task.status      = 'open';
    task.completedAt = null;
  }

  await save();
  renderAll();
}

async function deleteTask(taskId, itemEl) {
  itemEl.style.transition = 'opacity 150ms, transform 150ms';
  itemEl.style.opacity    = '0';
  itemEl.style.transform  = 'scale(.97)';

  await new Promise(r => setTimeout(r, 150));

  state.tasks = state.tasks.filter(t => t.id !== taskId);
  await save();
  renderAll();
}

function toggleNotesExpand(taskId, itemEl) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task?.notes) return;

  const existing = itemEl.querySelector('.task-expand');
  if (existing) {
    existing.remove();
    return;
  }

  const expand = document.createElement('div');
  expand.className = 'task-expand';
  expand.innerHTML = `<p class="task-notes-full">${escHtml(task.notes)}</p>`;
  itemEl.appendChild(expand);
}

// ─── Project actions ──────────────────────────────────────────────────────────

function selectProject(id) {
  state.selectedProjectId = id;
  state.showDone          = false;
  state.doneCollapsed     = false;
  renderAll();
}

async function createProject(name, color) {
  const project = {
    id:        uid(),
    name,
    color,
    order:     state.projects.length,
    createdAt: Date.now(),
  };
  state.projects.push(project);
  state.selectedProjectId = project.id;
  await save();
  renderAll();
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its tasks?')) return;
  state.projects = state.projects.filter(p => p.id !== id);
  state.tasks    = state.tasks.filter(t => t.projectId !== id);
  state.selectedProjectId = state.projects[0]?.id || null;
  await save();
  renderAll();
}

// ─── Drag and drop ────────────────────────────────────────────────────────────

function onDragStart(e, taskId) {
  state.dragSrcId = taskId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e, taskId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (taskId === state.dragSrcId) return;
  document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}

async function onDrop(e, targetId) {
  e.preventDefault();
  if (!state.dragSrcId || state.dragSrcId === targetId) return;

  const src = state.tasks.find(t => t.id === state.dragSrcId);
  const tgt = state.tasks.find(t => t.id === targetId);
  if (!src || !tgt || src.projectId !== tgt.projectId) return;

  // Reorder: move src to tgt's position
  const projectTasks = state.tasks.filter(t => t.projectId === src.projectId && t.status === 'open');
  const srcIdx = projectTasks.findIndex(t => t.id === src.id);
  const tgtIdx = projectTasks.findIndex(t => t.id === tgt.id);

  projectTasks.splice(srcIdx, 1);
  projectTasks.splice(tgtIdx, 0, src);
  projectTasks.forEach((t, i) => { t.order = i; });

  state.dragSrcId = null;
  await save();
  renderAll();
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openProjectModal() {
  state.selectedColor = PROJECT_COLORS[0];
  document.getElementById('projectNameInput').value = '';
  buildColorPicker();
  document.getElementById('projectModal').style.display = 'flex';
  document.getElementById('projectNameInput').focus();
}

function closeProjectModal() {
  document.getElementById('projectModal').style.display = 'none';
}

function buildColorPicker() {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = '';
  PROJECT_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (color === state.selectedColor ? ' selected' : '');
    swatch.style.cssText = `background:${color}; --color:${color}`;
    swatch.addEventListener('click', () => {
      state.selectedColor = color;
      picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });
    picker.appendChild(swatch);
  });
}

// ─── Full re-render ───────────────────────────────────────────────────────────

function renderAll() {
  renderProjects();
  renderTaskPane();
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Listen for cross-window storage changes (quick capture) ──────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.tasks) {
    state.tasks = changes.tasks.newValue || [];
    renderAll();
  }
  if (changes.projects) {
    state.projects = changes.projects.newValue || [];
    renderAll();
  }
});

// ─── Wire up UI ───────────────────────────────────────────────────────────────

document.getElementById('btnAddProject').addEventListener('click', openProjectModal);

document.getElementById('btnAddTask').addEventListener('click', openNewTaskEditor);

document.getElementById('btnToggleDone').addEventListener('click', () => {
  state.showDone = !state.showDone;
  renderTaskPane();
});

document.getElementById('btnDeleteProject').addEventListener('click', () => {
  if (state.selectedProjectId) deleteProject(state.selectedProjectId);
});

document.getElementById('btnCancelProject').addEventListener('click', closeProjectModal);

document.getElementById('btnCreateProject').addEventListener('click', async () => {
  const name = document.getElementById('projectNameInput').value.trim();
  if (!name) return;
  closeProjectModal();
  await createProject(name, state.selectedColor);
});

document.getElementById('projectNameInput').addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    const name = e.target.value.trim();
    if (!name) return;
    closeProjectModal();
    await createProject(name, state.selectedColor);
  }
  if (e.key === 'Escape') closeProjectModal();
});

document.getElementById('projectModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeProjectModal();
});


// ─── Boot ─────────────────────────────────────────────────────────────────────

load().then(() => {
  state.selectedProjectId = state.projects[0]?.id || null;
  renderAll();
});
