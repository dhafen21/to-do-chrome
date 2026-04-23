function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadProjects() {
  const data = await chrome.storage.sync.get(['projects']);
  return data.projects || [];
}

async function loadTasks() {
  const data = await chrome.storage.sync.get(['tasks']);
  return data.tasks || [];
}

async function init() {
  const projects = await loadProjects();
  const select   = document.getElementById('projectSelect');

  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

  // Pre-select first project if any
  if (projects.length > 0) select.value = projects[0].id;
}

async function capture() {
  const title     = document.getElementById('taskInput').value.trim();
  const projectId = document.getElementById('projectSelect').value;

  if (!title) {
    document.getElementById('taskInput').focus();
    return;
  }

  const tasks = await loadTasks();
  const task  = {
    id:          uid(),
    projectId:   projectId || null,
    title,
    notes:       '',
    dueDate:     null,
    status:      'open',
    order:       tasks.filter(t => t.projectId === projectId).length,
    createdAt:   Date.now(),
    completedAt: null,
  };

  tasks.push(task);
  await chrome.storage.sync.set({ tasks });

  // Flash success, clear, close
  document.querySelector('.qc-wrap').classList.add('success');
  document.getElementById('taskInput').value = '';
  document.getElementById('taskInput').placeholder = 'Task added!';

  setTimeout(() => window.close(), 600);
}

document.getElementById('btnCapture').addEventListener('click', capture);

document.getElementById('taskInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') capture();
  if (e.key === 'Escape') window.close();
});

init();
