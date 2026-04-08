// --- CONFIG & STATE ---
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';
const API_URL = IS_FILE_PROTOCOL ? null : window.location.origin + '/api';

if (IS_FILE_PROTOCOL) {
  console.log('🚀 NexusTask running in Mock Mode (No Local Server required)');
}

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;

// Simple hash simulation for Mock Mode
const hashSim = str => btoa('salt-' + str).split('').reverse().join('');

// Mock Data for file:// mode
const MOCK_DB = JSON.parse(localStorage.getItem('mock_db_clean')) || {
  users: [],
  tasks: [],
  logs: []
};

function saveMock() { localStorage.setItem('mock_db_clean', JSON.stringify(MOCK_DB)); }

// --- API CORE ---
async function api(path, method = 'GET', body = null) {
  if (IS_FILE_PROTOCOL) return await mockApi(path, method, body);
  
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_URL}${path}`, options);
  if (res.status === 401) logout();
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Something went wrong');
  }
  return res.status !== 204 ? res.json() : null;
}

// --- MOCK API (For file:// protocol) ---
async function mockApi(path, method, body) {
  await new Promise(r => setTimeout(r, 300)); // Simulate latency
  
  if (path === '/login') {
    const hashed = hashSim(body.password);
    const user = MOCK_DB.users.find(u => u.email === body.email && u.password === hashed);
    if (!user) throw new Error('Invalid credentials');
    const safeUser = { ...user };
    delete safeUser.password; // Strip password before returning
    return { token: 'mock-token-' + user.id, user: safeUser };
  }
  
  if (path === '/register') {
    if (MOCK_DB.users.some(u => u.email === body.email)) {
      throw new Error('User already registered with this email. Please sign in instead.');
    }
    // Domain/Org detection for Role Enforcement
    const existingAdmin = MOCK_DB.users.find(u => u.orgName.toLowerCase() === body.orgName.toLowerCase() && u.role === 'ADMIN');
    const role = existingAdmin ? 'MEMBER' : 'ADMIN';
    
    const existingOrgUser = MOCK_DB.users.find(u => u.orgName.toLowerCase() === body.orgName.toLowerCase());
    const orgId = existingOrgUser ? existingOrgUser.orgId : 'o' + Date.now();

    const user = { id: 'u' + Date.now(), ...body, role, password: hashSim(body.password), orgId };
    MOCK_DB.users.push(user);
    saveMock();
    return { message: 'Success' };
  }

  if (path === '/oauth') {
    let user = MOCK_DB.users.find(u => u.email === body.email);
    if (!user) {
      // New OAuth user logic: assign domain-based org
      const domain = body.email.split('@')[1] || 'oauth.com';
      const company = domain.split('.')[0].toUpperCase();
      const orgId = 'o' + domain;
      // Only assign ADMIN if there is no other Admin for this org
      const existingAdmin = MOCK_DB.users.find(u => u.orgId === orgId && u.role === 'ADMIN');
      const role = existingAdmin ? 'MEMBER' : 'ADMIN';
      
      user = {
        id: 'u' + Date.now(),
        email: body.email,
        password: hashSim('oauth-dummy'),
        orgName: company,
        role: role,
        orgId: orgId
      };
      MOCK_DB.users.push(user);
      saveMock();
    }
    const safeUser = { ...user };
    delete safeUser.password;
    return { token: 'mock-token-' + user.id, user: safeUser };
  }

  // Auth check
  if (!currentUser) throw new Error('Unauthorized');
  
  if (path === '/tasks') {
    if (method === 'GET') return MOCK_DB.tasks.filter(t => t.orgId === currentUser.orgId);
    if (method === 'POST') {
      const task = { 
        id: 't' + Date.now(), 
        ...body, 
        orgId: currentUser.orgId, 
        createdBy: currentUser.id, 
        creatorEmail: currentUser.email,
        createdAt: new Date().toISOString() 
      };
      MOCK_DB.tasks.push(task);
      saveMock();
      return task;
    }
  }
  
  if (path.startsWith('/tasks/')) {
    const id = path.split('/')[2];
    const taskIndex = MOCK_DB.tasks.findIndex(t => t.id === id);
    if (method === 'PUT') {
      Object.assign(MOCK_DB.tasks[taskIndex], body);
      saveMock();
      return MOCK_DB.tasks[taskIndex];
    }
    if (method === 'DELETE') {
      MOCK_DB.tasks.splice(taskIndex, 1);
      saveMock();
      return null;
    }
  }
  
  if (path === '/logs') return MOCK_DB.logs.filter(l => l.orgId === currentUser.orgId);
  
  throw new Error('Not implemented in Mock Mode');
}

// --- UTILS ---
const $ = id => document.getElementById(id);
const hide = id => $(id).classList.add('hidden');
const show = id => $(id).classList.remove('hidden');

function validateEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function validatePassword(pass) {
  // Min 8 chars, at least one number
  return pass.length >= 8 && /\d/.test(pass);
}

function showToast(message, type = 'error') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}


// --- AUTH ---
async function login() {
  try {
    const email = $('login-email').value;
    const password = $('login-password').value;
    
    if (!validateEmail(email)) return showToast('Please enter a valid email address (e.g. name@company.com)', 'error');
    if (!password) return showToast('Password is required', 'error');

    const data = await api('/login', 'POST', { email, password });
    
    currentUser = data.user;
    currentToken = data.token;
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    
    renderApp();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function register() {
  try {
    const orgName = $('reg-org').value;
    const email = $('reg-email').value;
    const password = $('reg-password').value;
    
    if (!orgName) return showToast('Organization name is required', 'error');
    if (!validateEmail(email)) return showToast('Please enter a valid work email', 'error');
    if (!validatePassword(password)) {
      return showToast('Password must be 8+ characters and contain at least one number', 'error');
    }

    await api('/register', 'POST', { orgName, email, password });
    showToast('Registration successful! Please login.', 'success');
    showLoginForm();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  renderApp();
}

// --- TASKS ---
async function loadTasks() {
  try {
    const tasks = await api('/tasks');
    const container = $('task-list');
    container.innerHTML = tasks.length ? '' : '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No tasks found. Create your first one!</p>';
    
    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card glass fade-in';
      card.innerHTML = `
        <span class="task-status status-${task.status.toLowerCase()}">${task.status}</span>
        <h3 style="margin-bottom: 0.5rem;">${task.title}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.4;">${task.description}</p>
        <div class="task-meta">
          <span>By: ${(() => {
            const name = (task.creatorEmail || 'Unknown').split('@')[0];
            return name.toLowerCase().includes('admin') ? 'Admin' : name.charAt(0).toUpperCase() + name.slice(1);
          })()}</span>
          <span>${new Date(task.createdAt).toLocaleDateString()}</span>
        </div>
      `;
      card.onclick = () => openTaskModal(task);
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function saveTask() {
  try {
    const id = $('task-id').value;
    const title = $('task-title').value;
    const description = $('task-desc').value;
    const status = $('task-status').value;
    
    const method = id ? 'PUT' : 'POST';
    const path = id ? `/tasks/${id}` : '/tasks';
    
    await api(path, method, { title, description, status });
    closeTaskModal();
    loadTasks();
    showToast(id ? 'Task updated' : 'Task created', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTask() {
  const id = $('task-id').value;
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    await api(`/tasks/${id}`, 'DELETE');
    closeTaskModal();
    loadTasks();
    showToast('Task deleted', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- UI FLOW ---
function renderApp() {
  if (currentUser) {
    hide('auth-section');
    show('dashboard-section');
    $('user-info').innerText = `${currentUser.email} | ${currentUser.orgName} (${currentUser.role})`;
    
    if (currentUser.role === 'ADMIN') show('admin-tools');
    else hide('admin-tools');
    
    loadTasks();
  } else {
    show('auth-section');
    hide('dashboard-section');
    showLoginForm();
  }
}

function showLoginForm() {
  hide('register-form');
  show('login-form');
}

function showRegisterForm() {
  hide('login-form');
  show('register-form');
}

function openTaskModal(task = null) {
  show('task-modal');
  $('modal-title').innerText = task ? 'Edit Task' : 'Create New Task';
  $('task-id').value = task ? task.id : '';
  $('task-title').value = task ? task.title : '';
  $('task-desc').value = task ? task.description : '';
  
  if (task) {
    show('status-group');
    $('task-status').value = task.status;
    
    // RBAC UI Enforcement: Only creators or Admins can edit/delete
    const canModify = currentUser.role === 'ADMIN' || task.createdBy === currentUser.id;
    if (canModify) {
      show('btn-save-task');
      show('btn-delete-task');
    } else {
      hide('btn-save-task');
      hide('btn-delete-task');
      $('modal-title').innerText = 'View Task (Read Only)';
    }
  } else {
    hide('status-group');
    hide('btn-delete-task');
    show('btn-save-task');
  }
}

function closeTaskModal() {
  hide('task-modal');
}

async function viewLogs() {
  try {
    const logs = await api('/logs');
    show('logs-modal');
    const container = $('logs-container');
    container.innerHTML = logs.reverse().map(log => `
      <div style="padding: 0.75rem; border-bottom: 1px solid var(--glass-border); font-size: 0.8rem;">
        <span style="color: var(--accent); font-weight: bold;">${log.action}</span> 
        by <span style="color: white;">${log.userEmail}</span>
        <br>
        <span style="color: var(--text-muted); font-size: 0.7rem;">${new Date(log.timestamp).toLocaleString()}</span>
      </div>
    `).join('') || '<p style="color: var(--text-muted); text-align: center;">No logs found.</p>';
  } catch (err) {
    alert(err.message);
  }
}

// --- EVENTS ---
window.onload = () => {
  renderApp();
  
  $('btn-login').onclick = login;
  $('btn-register').onclick = register;
  $('btn-logout').onclick = logout;
  $('show-register').onclick = e => { e.preventDefault(); showRegisterForm(); };
  $('show-login').onclick = e => { e.preventDefault(); showLoginForm(); };
  
  $('btn-add-task').onclick = () => openTaskModal();
  $('btn-cancel-task').onclick = closeTaskModal;
  $('btn-save-task').onclick = saveTask;
  $('btn-delete-task').onclick = deleteTask;
  
  $('btn-close-logs').onclick = () => hide('logs-modal');
  $('btn-view-logs').onclick = viewLogs;

  const handleOAuth = (provider) => {
    // Open the authentic popup redirect simulation
    const width = 450;
    const height = 600;
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);
    window.open(`oauth-mock.html?provider=${provider}`, 'OAuth_SignIn', `width=${width},height=${height},top=${top},left=${left}`);
  };

  window.addEventListener('message', async (event) => {
    if (event.data && event.data.oauth) {
      const { provider, email } = event.data;
      try {
        const data = await api('/oauth', 'POST', { provider, email });
        currentUser = data.user;
        currentToken = data.token;
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('token', currentToken);
        
        renderApp();
        showToast(`Welcome! Signed in via ${provider} as ${email}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  $('btn-google').onclick = () => handleOAuth('Google');

  // Password Toggles
  const setupToggle = (btnId, inputId) => {
    const btn = $(btnId);
    const input = $(inputId);
    if (btn && input) {
      btn.onclick = () => {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.innerText = isPass ? 'Hide' : 'Show';
      };
    }
  };

  setupToggle('toggle-login-pass', 'login-password');
  setupToggle('toggle-reg-pass', 'reg-password');
};
