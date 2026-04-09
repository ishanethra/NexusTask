/**
 * NexusTask | Enterprise Orchestration Engine 🚀
 * @description Bespoke frontend controller managing multi-tenant state and real-time UI synchronization.
 */

const API_BASE = '/api';
let platformState = {
  activeIdentity: JSON.parse(localStorage.getItem('user')),
  sessionToken: localStorage.getItem('token'),
  registryCache: []
};

/**
 * @function $
 * @description Utility for rapid DOM node acquisition.
 */
const $ = (id) => document.getElementById(id);
const show = (id) => $(id) && $(id).classList.remove('hidden');
const hide = (id) => $(id) && $(id).classList.add('hidden');

/**
 * @function invokeSecureAPI
 * @description Generic orchestration helper for asynchronous backend communication.
 */
async function invokeSecureAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (platformState.sessionToken) {
    options.headers['Authorization'] = `Bearer ${platformState.sessionToken}`;
  }
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Identity Propagation Failed');
  }
  return response.status === 204 ? null : response.json();
}

/**
 * @function initiateSecureAccess
 * @description Authenticates the user and initializes the enterprise dashboard session.
 */
async function initiateSecureAccess() {
  const email = $('login-email').value;
  const password = $('login-password').value;
  try {
    const data = await invokeSecureAPI('/login', 'POST', { email, password });
    commitSessionIdentity(data.user, data.token);
    refreshNexusDashboard();
  } catch (err) {
    alert(err.message);
  }
}

/**
 * @function submitCorporateOnboarding
 * @description Orchestrates new user registration and seamless organization alignment.
 */
async function submitCorporateOnboarding() {
  const orgName = $('reg-org').value;
  const email = $('reg-email').value;
  const password = $('reg-password').value;
  try {
    await invokeSecureAPI('/register', 'POST', { orgName, email, password });
    // Auto-login seamless transition
    const data = await invokeSecureAPI('/login', 'POST', { email, password });
    commitSessionIdentity(data.user, data.token);
    refreshNexusDashboard();
  } catch (err) {
    alert(err.message);
  }
}

/**
 * @function commitSessionIdentity
 * @description Persists identity markers to local storage for state resilience.
 */
function commitSessionIdentity(user, token) {
  platformState.activeIdentity = user;
  platformState.sessionToken = token;
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
}

/**
 * @function terminateSessionIdentity
 * @description Purges active session contexts and restores the platform to its public state.
 */
function terminateSessionIdentity() {
  localStorage.clear();
  platformState.activeIdentity = null;
  platformState.sessionToken = null;
  location.reload();
}

/**
 * @function synchronizeTaskRegistry
 * @description Pulls operational data from the backend and updates the local state cache.
 */
async function synchronizeTaskRegistry() {
  try {
    platformState.registryCache = await invokeSecureAPI('/tasks');
    repaintDashboardInterface();
  } catch (err) {
    console.error('State Sync Failure:', err.message);
  }
}

/**
 * @function repaintDashboardInterface
 * @description Transforms the local state registry into a high-fidelity visual interface using the bespoke nt- component library.
 */
function repaintDashboardInterface() {
  const container = $('task-container');
  if (!container) return;
  container.innerHTML = '';

  platformState.registryCache.forEach(task => {
    const card = document.createElement('div');
    card.className = 'nt-glass-panel nt-task-card fade-in';
    card.innerHTML = `
        <h3>${task.title}</h3>
        <p>${task.description || ''}</p>
        <div class="nt-meta-footer">
          <span>By: ${(() => {
            const name = (task.creatorEmail || 'Unknown').split('@')[0];
            return name.toLowerCase().includes('admin') ? 'Admin' : name.charAt(0).toUpperCase() + name.slice(1);
          })()}</span>
          <span>${new Date(task.createdAt || task.created_at || Date.now()).toLocaleDateString()}</span>
        </div>
      `;
    card.onclick = () => launchTaskMutationModal(task);
    container.appendChild(card);
  });
}

/**
 * @function commitTaskMutation
 * @description Propagates task modifications (Create/Update) to the persistent registry.
 */
async function commitTaskMutation() {
  const title = $('task-title').value;
  const description = $('task-desc').value;
  const status = $('task-status').value;
  const taskId = $('task-id').value;

  try {
    if (taskId) {
      await invokeSecureAPI(`/tasks/${taskId}`, 'PUT', { title, description, status });
    } else {
      await invokeSecureAPI('/tasks', 'POST', { title, description, status });
    }
    dismissTaskModal();
    synchronizeTaskRegistry();
  } catch (err) {
    alert(err.message);
  }
}

/**
 * @function terminateTaskEntity
 * @description Executes the permanent removal of a task from the enterprise registry.
 */
async function terminateTaskEntity() {
  const taskId = $('task-id').value;
  if (!taskId || !confirm('Confirm Task Termination?')) return;
  try {
    await invokeSecureAPI(`/tasks/${taskId}`, 'DELETE');
    dismissTaskModal();
    synchronizeTaskRegistry();
  } catch (err) {
    alert(err.message);
  }
}

// --- UI Orchestration Logic ---

function refreshNexusDashboard() {
  if (platformState.activeIdentity) {
    hide('auth-section');
    show('dashboard-section');
    
    const emailEl = $('user-email-display');
    const orgEl = $('org-name-display');
    const roleEl = $('user-role-display');
    
    if (emailEl) emailEl.innerText = platformState.activeIdentity.email;
    if (orgEl) orgEl.innerText = platformState.activeIdentity.orgName;
    if (roleEl) {
      roleEl.innerText = platformState.activeIdentity.role;
      if (platformState.activeIdentity.role === 'ADMIN') {
        roleEl.style.borderColor = 'var(--accent)';
        roleEl.style.color = 'white';
      }
    }
    
    if (platformState.activeIdentity.role === 'ADMIN') {
      show('admin-controls');
    } else {
      hide('admin-controls');
    }
    
    synchronizeTaskRegistry();
  } else {
    hide('dashboard-section');
    show('auth-section');
  }
}

function launchTaskMutationModal(task = null) {
  show('task-modal');
  if (task) {
    $('modal-title').innerText = 'Mutate Task';
    $('task-id').value = task.id;
    $('task-title').value = task.title;
    $('task-desc').value = task.description || '';
    $('task-status').value = task.status;
    
    const creatorId = task.createdBy || task.created_by;
    const canModify = platformState.activeIdentity.role === 'ADMIN' || creatorId === platformState.activeIdentity.id;
    if (canModify) {
      show('btn-save-task');
      show('btn-delete-task');
    } else {
      hide('btn-save-task');
      hide('btn-delete-task');
    }
  } else {
    $('modal-title').innerText = 'Draft New Task';
    $('task-form').reset();
    $('task-id').value = '';
    show('btn-save-task');
    hide('btn-delete-task');
  }
}

function dismissTaskModal() {
  hide('task-modal');
}

/**
 * @function bindOperationalEvents
 * @description Initializes the platform's event listener layer with defensive binding.
 */
function bindOperationalEvents() {
  const bind = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };

  bind('btn-login', initiateSecureAccess);
  bind('btn-show-register', () => { hide('login-form'); show('register-form'); });
  bind('btn-register', submitCorporateOnboarding);
  bind('btn-show-login', () => { hide('register-form'); show('login-form'); });
  bind('btn-logout', terminateSessionIdentity);
  bind('btn-add-task', () => launchTaskMutationModal());
  bind('btn-cancel-task', dismissTaskModal);
  bind('btn-save-task', commitTaskMutation);
  bind('btn-delete-task', terminateTaskEntity);
  
  // Password Recovery Flow
  bind('btn-forgot', () => { hide('login-form'); show('forgot-password-form'); });
  bind('btn-back-login', () => { hide('forgot-password-form'); show('login-form'); });
  bind('btn-send-recovery', async () => {
    const email = $('forgot-email').value;
    try {
      await invokeSecureAPI('/forgot-password', 'POST', { email });
      hide('forgot-password-form');
      show('check-email-screen');
    } catch (err) { alert(err.message); }
  });
  bind('btn-go-reset', () => { hide('check-email-screen'); show('reset-password-form'); });
  bind('btn-reset-password', async () => {
    const email = $('forgot-email').value;
    const key = $('reset-key').value;
    const newPassword = $('reset-new-password').value;
    try {
      await invokeSecureAPI('/reset-password', 'POST', { email, key, newPassword });
      alert('Password Restored Successfully.');
      location.reload();
    } catch (err) { alert(err.message); }
  });
  
  bind('btn-view-logs', async () => {
    try {
      const logs = await invokeSecureAPI('/logs');
      alert(`Audit Ledger Trace: \n${logs.map(l => `[${l.timestamp}] ${l.action} by ${l.userEmail || l.user_id}`).join('\n')}`);
    } catch (err) { alert(err.message); }
  });
}

// Platform Bootstrap
window.onload = () => {
  refreshNexusDashboard();
  bindOperationalEvents();
};
