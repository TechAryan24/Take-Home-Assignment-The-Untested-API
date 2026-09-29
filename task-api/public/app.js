// Task Manager Frontend Client
let currentStatus = '';
let currentPage = 1;
let currentLimit = 12;
let allTasks = [];

// Elements
const tasksGrid = document.getElementById('tasksGrid');
const statTodo = document.getElementById('statTodo');
const statInProgress = document.getElementById('statInProgress');
const statDone = document.getElementById('statDone');
const statOverdue = document.getElementById('statOverdue');
const overdueBadge = document.getElementById('overdueBadge');
const paginationInfo = document.getElementById('paginationInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const limitSelect = document.getElementById('limitSelect');
const refreshBtn = document.getElementById('refreshBtn');
const seedBtn = document.getElementById('seedBtn');

// Modals
const createModal = document.getElementById('createModal');
const openCreateModalBtn = document.getElementById('openCreateModalBtn');
const closeCreateModalBtn = document.getElementById('closeCreateModalBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const createTaskForm = document.getElementById('createTaskForm');

const assignModal = document.getElementById('assignModal');
const closeAssignModalBtn = document.getElementById('closeAssignModalBtn');
const cancelAssignBtn = document.getElementById('cancelAssignBtn');
const assignTaskForm = document.getElementById('assignTaskForm');
const assignTaskId = document.getElementById('assignTaskId');
const assignTaskTitle = document.getElementById('assignTaskTitle');
const assigneeInput = document.getElementById('assigneeInput');

const editModal = document.getElementById('editModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editTaskForm = document.getElementById('editTaskForm');
const editTaskId = document.getElementById('editTaskId');
const editTitle = document.getElementById('editTitle');
const editDesc = document.getElementById('editDesc');
const editStatus = document.getElementById('editStatus');
const editPriority = document.getElementById('editPriority');
const editDueDate = document.getElementById('editDueDate');

const toastContainer = document.getElementById('toastContainer');

// Notification Toast
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Fetch Stats
async function loadStats() {
  try {
    const res = await fetch('/tasks/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();
    statTodo.textContent = stats.todo;
    statInProgress.textContent = stats.in_progress;
    statDone.textContent = stats.done;
    statOverdue.textContent = stats.overdue;
    if (stats.overdue > 0) {
      overdueBadge.style.display = 'inline-block';
      overdueBadge.textContent = `${stats.overdue} Overdue`;
    } else {
      overdueBadge.style.display = 'none';
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

// Fetch Tasks
async function loadTasks() {
  tasksGrid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <h3>Loading tasks...</h3>
    </div>
  `;

  try {
    let url = '/tasks';
    const params = new URLSearchParams();

    if (currentStatus) {
      params.append('status', currentStatus);
    } else {
      params.append('page', currentPage);
      params.append('limit', currentLimit);
    }

    const query = params.toString();
    if (query) url += `?${query}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load tasks');
    allTasks = await res.json();
    renderTasks(allTasks);
    updatePaginationControls();
    loadStats();
  } catch (err) {
    tasksGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Failed to load tasks</h3>
        <p style="color: var(--text-muted);">${err.message}</p>
      </div>
    `;
  }
}

// Render Tasks
function renderTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    tasksGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No tasks found</h3>
        <p style="color: var(--text-muted); margin-top: 0.25rem;">
          ${currentStatus ? `No tasks with status "${currentStatus}".` : 'Create your first task or seed sample data!'}
        </p>
      </div>
    `;
    return;
  }

  tasksGrid.innerHTML = tasks.map(task => {
    const isDone = task.status === 'done';
    const hasDueDate = !!task.dueDate;
    const isOverdue = hasDueDate && !isDone && new Date(task.dueDate) < new Date();
    const formattedDueDate = hasDueDate ? new Date(task.dueDate).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'No due date';

    const assigneeHtml = task.assignee
      ? `<span class="assignee-chip" onclick="openAssignModal('${task.id}', '${escapeHtml(task.title)}', '${escapeHtml(task.assignee)}')">
           <span>👤</span> ${escapeHtml(task.assignee)} <span style="font-size:0.65rem;opacity:0.7;">✎</span>
         </span>`
      : `<span class="assignee-chip assignee-empty" onclick="openAssignModal('${task.id}', '${escapeHtml(task.title)}', '')">
           <span>+</span> Assign
         </span>`;

    return `
      <article class="task-card ${isDone ? 'is-done' : ''}" id="task-${task.id}">
        <div class="task-top">
          <div class="badges-row">
            <span class="badge badge-${task.status}">${formatStatus(task.status)}</span>
            <span class="badge badge-priority-${task.priority}">${task.priority}</span>
          </div>
          ${!isDone ? `
            <button class="btn btn-secondary btn-sm" onclick="completeTask('${task.id}')" title="Mark Done">
              ✓ Done
            </button>
          ` : `
            <span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">Completed</span>
          `}
        </div>

        <div>
          <h2 class="task-title" style="text-decoration: ${isDone ? 'line-through' : 'none'}; opacity: ${isDone ? 0.75 : 1};">
            ${escapeHtml(task.title)}
          </h2>
          ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        </div>

        <div class="task-meta">
          <div class="meta-row">
            <span>Assignee:</span>
            ${assigneeHtml}
          </div>
          <div class="meta-row">
            <span>Due:</span>
            <span class="due-date ${isOverdue ? 'is-overdue' : ''}">
              ${isOverdue ? '⚠️ ' : ''}${formattedDueDate}
            </span>
          </div>
          <div class="task-actions">
            <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="openEditModal('${task.id}')">
              Edit
            </button>
            <button class="btn btn-danger-outline btn-sm" onclick="deleteTask('${task.id}')" title="Delete Task">
              Delete
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function formatStatus(status) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'done') return 'Completed';
  return 'To Do';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

function updatePaginationControls() {
  if (currentStatus) {
    paginationInfo.textContent = `Showing all ${allTasks.length} ${currentStatus} tasks`;
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
  } else {
    paginationInfo.textContent = `Page ${currentPage} (${allTasks.length} items shown)`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = allTasks.length < currentLimit;
  }
}

// Complete Task
async function completeTask(id) {
  try {
    const res = await fetch(`/tasks/${id}/complete`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to mark task complete');
    showToast('Task marked as complete! 🎉');
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Delete Task
async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    const res = await fetch(`/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    showToast('Task deleted successfully');
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Assign Modal
window.openAssignModal = function(id, title, currentAssignee) {
  assignTaskId.value = id;
  assignTaskTitle.textContent = title;
  assigneeInput.value = currentAssignee || '';
  assignModal.classList.add('active');
  setTimeout(() => assigneeInput.focus(), 100);
};

closeAssignModalBtn.addEventListener('click', () => assignModal.classList.remove('active'));
cancelAssignBtn.addEventListener('click', () => assignModal.classList.remove('active'));

// Quick user suggestions
document.querySelectorAll('.quick-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    assigneeInput.value = chip.dataset.user;
    assigneeInput.focus();
  });
});

assignTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = assignTaskId.value;
  const assignee = assigneeInput.value.trim();

  if (!assignee) {
    showToast('Assignee name is required', 'error');
    return;
  }

  try {
    const res = await fetch(`/tasks/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to assign task');

    showToast(`Assigned to ${data.assignee}! 👤`);
    assignModal.classList.remove('active');
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Create Modal
openCreateModalBtn.addEventListener('click', () => {
  createTaskForm.reset();
  createModal.classList.add('active');
});

closeCreateModalBtn.addEventListener('click', () => createModal.classList.remove('active'));
cancelCreateBtn.addEventListener('click', () => createModal.classList.remove('active'));

createTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('createTitle').value.trim();
  const description = document.getElementById('createDesc').value.trim();
  const status = document.getElementById('createStatus').value;
  const priority = document.getElementById('createPriority').value;
  const dueDateInput = document.getElementById('createDueDate').value;
  const dueDate = dueDateInput ? new Date(dueDateInput).toISOString() : null;

  try {
    const res = await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, status, priority, dueDate }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create task');

    showToast('Task created successfully! ✨');
    createModal.classList.remove('active');
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Edit Modal
window.openEditModal = function(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;

  editTaskId.value = task.id;
  editTitle.value = task.title;
  editDesc.value = task.description || '';
  editStatus.value = task.status;
  editPriority.value = task.priority;

  if (task.dueDate) {
    const d = new Date(task.dueDate);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    editDueDate.value = d.toISOString().slice(0, 16);
  } else {
    editDueDate.value = '';
  }

  editModal.classList.add('active');
};

closeEditModalBtn.addEventListener('click', () => editModal.classList.remove('active'));
cancelEditBtn.addEventListener('click', () => editModal.classList.remove('active'));

editTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editTaskId.value;
  const title = editTitle.value.trim();
  const description = editDesc.value.trim();
  const status = editStatus.value;
  const priority = editPriority.value;
  const dueDateInput = editDueDate.value;
  const dueDate = dueDateInput ? new Date(dueDateInput).toISOString() : null;

  try {
    const res = await fetch(`/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, status, priority, dueDate }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update task');

    showToast('Task updated successfully!');
    editModal.classList.remove('active');
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Toolbar Filtering
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatus = btn.dataset.status;
    currentPage = 1;
    loadTasks();
  });
});

limitSelect.addEventListener('change', (e) => {
  currentLimit = parseInt(e.target.value) || 12;
  currentPage = 1;
  loadTasks();
});

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadTasks();
  }
});

nextPageBtn.addEventListener('click', () => {
  currentPage++;
  loadTasks();
});

refreshBtn.addEventListener('click', () => {
  loadTasks();
  showToast('Refreshed data from API');
});

// Seed Sample Data Button
seedBtn.addEventListener('click', async () => {
  const sampleTasks = [
    {
      title: 'Review Unit & Integration Test Coverage',
      description: 'Ensure Jest test suites achieve >=80% coverage on taskService and routes.',
      status: 'done',
      priority: 'high',
      dueDate: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      title: 'Fix Pagination Offset Calculation',
      description: 'Resolve off-by-one error in taskService.getPaginated formula for 1-based pages.',
      status: 'done',
      priority: 'high',
      dueDate: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      title: 'Implement PATCH /tasks/:id/assign Endpoint',
      description: 'Support assigning and reassigning tasks with explicit string validation.',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    },
    {
      title: 'Audit Overdue Task Stats Calculation',
      description: 'Confirm completed tasks with past due dates do not count toward overdue counter.',
      status: 'todo',
      priority: 'medium',
      dueDate: new Date(Date.now() - 86400000 * 3).toISOString(), // Overdue!
    },
    {
      title: 'Prepare Final Take-Home Assignment Deliverables',
      description: 'Compile BUG_REPORT.md, test outputs, and submission notes.',
      status: 'todo',
      priority: 'medium',
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    },
    {
      title: 'Set up Production Database Migration',
      description: 'Plan transition from in-memory array to managed PostgreSQL cluster.',
      status: 'todo',
      priority: 'low',
      dueDate: null,
    }
  ];

  try {
    for (const t of sampleTasks) {
      const res = await fetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      });
      const created = await res.json();
      // Assign the in-progress task to Aryan
      if (t.title.includes('Implement PATCH')) {
        await fetch(`/tasks/${created.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignee: 'Aryan' }),
        });
      }
    }
    showToast('Seeded 6 sample tasks! 🌱');
    currentPage = 1;
    loadTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Initial Load
loadTasks();
