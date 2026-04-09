// --- CONFIG & STATE ---
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';
const API_URL = IS_FILE_PROTOCOL ? null : window.location.origin + '/api';

if (IS_FILE_PROTOCOL) {
  console.log('🚀 NexusTask running in Mock Mode (No Local Server required)');
}

let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;
let resetEmail = ''; // Store email during recovery flow

// Simple hash simulation for Mock Mode
const hashSim = str => btoa('salt-' + str).split('').reverse().join('');

// Mock Data for file:// mode
const MOCK_DB = JSON.parse(localStorage.getItem('mock_db_clean')) || {
  users: [],
  tasks: [],
  logs: [],
  recovery_tokens: []
};

function saveMock() { localStorage.setItem('mock_db_clean', JSON.stringify(MOCK_DB)); }

// Official Google Identity Services JWT Decoder
function decodeJwtResponse(token) {
  let base64Url = token.split('.')[1];
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Event listener for the Google Identity bridge in index.html
window.addEventListener('google-oauth', async (event) => {
    console.log('📦 Google OAuth event received', event.detail);
    const response = event.detail;
    const payload = decodeJwtResponse(response.credential);
    const email = payload.email;
    
    try {
      showToast('Authenticating with Google...', 'success');
      const data = await api('/oauth', 'POST', { provider: 'Google', email });
      console.log('✅ Google Authentication success', data);
      
      currentUser = data.user;
      currentToken = data.token;
      localStorage.setItem('user', JSON.stringify(currentUser));
      localStorage.setItem('token', currentToken);
      
      renderApp();
      showToast('Signed in successfully!', 'success');
    } catch (err) {
      console.error('❌ Google Authentication failed', err);
      showToast(err.message, 'error');
    }
});

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
  
  if (path === '/forgot-password') {
    const user = MOCK_DB.users.find(u => u.email === body.email);
    if (!user) throw new Error('No account found with this email address.');
    const key = Math.floor(100000 + Math.random() * 900000).toString();
    MOCK_DB.recovery_tokens.push({ email: body.email, key, expires: Date.now() + 3600000 });
    saveMock();
    return { message: `Recovery key sent! (DEMO MODE: Your key is ${key})`, demoKey: key };
  }

  if (path === '/reset-password') {
    const tokenIndex = MOCK_DB.recovery_tokens.findIndex(t => t.email === body.email && t.key === body.key);
    if (tokenIndex === -1) throw new Error('Invalid or expired recovery key.');
    const user = MOCK_DB.users.find(u => u.email === body.email);
    if (user) user.password = hashSim(body.newPassword);
    MOCK_DB.recovery_tokens.splice(tokenIndex, 1);
    saveMock();
    return { message: 'Password reset successful' };
  }

  if (path === '/demo/emails') {
    return [...MOCK_DB.recovery_tokens].reverse();
  }
  
  throw new Error('Not implemented in Mock Mode');
}

// --- UTILS ---
function $(id) { return document.getElementById(id); }
function hide(id) { 
  const el = $(id);
  if (el) el.classList.add('hidden'); 
}
function show(id) { 
  const el = $(id);
  if (el) el.classList.remove('hidden'); 
}

function bindClick(id, fn) {
  const el = $(id);
  if (el) el.onclick = fn;
  else console.warn(`⚠️ Warning: Element #${id} not found for binding.`);
}

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
    
    // Auto-login the user seamlessly
    const data = await api('/login', 'POST', { email, password });
    currentUser = data.user;
    currentToken = data.token;
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    
    renderApp();
    showToast('Registration successful! You are now logged in.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function requestPasswordReset() {
  const email = $('forgot-email').value;
  if (!email) return showToast('Email is required', 'error');
  
  try {
    const data = await api('/forgot-password', 'POST', { email });
    resetEmail = email; // Save for next step
    showToast('Reset request received!', 'success');
    showCheckEmailScreen();
    setTimeout(refreshInboxCount, 500); // Immediate check
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshInboxCount() {
  try {
    const emails = await api('/demo/emails');
    const count = emails.length;
    $('inbox-count').innerText = count;
    $('inbox-count').style.display = count > 0 ? 'inline-block' : 'none';
  } catch (err) {
    console.error('Failed to fetch inbox count');
  }
}

async function viewDemoInbox() {
  show('demo-inbox-modal');
  const container = $('inbox-messages');
  container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading mailbox...</p>';
  
  try {
    const emails = await api('/demo/emails');
    if (emails.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Your inbox is empty.</p>';
      return;
    }
    
    container.innerHTML = emails.map(mail => `
      <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid var(--glass-border);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <strong style="color: var(--accent);">NexusTask Security</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Just now</span>
        </div>
        <p style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Subject:</strong> Password Recovery Code</p>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.25rem; font-family: monospace; font-size: 1.1rem; border: 1px dashed var(--accent);">
          Hello, your security code is: <b style="color: white; letter-spacing: 2px;">${mail.key}</b>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Sent to: ${mail.email}</p>
      </div>
    `).reverse().join('');
  } catch (err) {
    container.innerHTML = '<p style="color: #ef4444; text-align: center;">Error loading inbox.</p>';
  }
}

async function confirmPasswordReset() {
  const email = resetEmail; // Use saved email
  const key = $('reset-key').value;
  const newPassword = $('reset-new-password').value;
  
  if (!email) return showToast('Session expired. Please restart reset flow.', 'error');
  if (!key || !newPassword) return showToast('Key and New Password are required', 'error');
  if (!validatePassword(newPassword)) return showToast('Password must be 8+ characters with a number', 'error');

  try {
    const data = await api('/reset-password', 'POST', { email, key, newPassword });
    showToast(data.message, 'success');
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
    
    const emailEl = $('user-email-display');
    const orgEl = $('org-name-display');
    const roleEl = $('user-role-display');
    if (emailEl) emailEl.innerText = currentUser.email || 'user@nexus.task';
    if (orgEl) orgEl.innerText = currentUser.orgName || 'Organization';
    if (roleEl) {
      roleEl.innerText = currentUser.role || 'Member';
      if (currentUser.role === 'ADMIN') {
        roleEl.style.borderColor = 'var(--accent)';
        roleEl.style.color = 'white';
      }
    }
    
    if (currentUser.role === 'ADMIN') {
      show('admin-controls');
    } else {
      hide('admin-controls');
    }
    
    loadTasks();
  } else {
    hide('dashboard-section');
    show('auth-section');
    // Ensure we start on the login form for better UX
    showLoginForm();
  }
}

function showForgotPasswordForm() {
  hide('login-form');
  hide('register-form');
  show('forgot-password-form');
  hide('reset-password-form');
  hide('check-email-screen');
}

function showCheckEmailScreen() {
  hide('login-form');
  hide('register-form');
  hide('forgot-password-form');
  hide('reset-password-form');
  show('check-email-screen');
}

function showResetPasswordForm() {
  hide('login-form');
  hide('register-form');
  hide('forgot-password-form');
  show('reset-password-form');
  hide('check-email-screen');
}

function showLoginForm() {
  hide('register-form');
  hide('forgot-password-form');
  hide('reset-password-form');
  hide('check-email-screen');
  show('login-form');
}

function showRegisterForm() {
  hide('login-form');
  hide('forgot-password-form');
  hide('reset-password-form');
  hide('check-email-screen');
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

// --- INITIALIZATION ---
window.onload = () => {
    console.log('🏁 Initializing NexusTask Application');
    
    // Check for existing session
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            currentToken = savedToken;
            console.log('👋 Welcome back,', currentUser.email);
        } catch (e) {
            console.error('Session corruption detected, clearing store');
            localStorage.clear();
        }
    }
    
    renderApp();
    setupEventListeners();
    
    // Background tasks
    setInterval(refreshInboxCount, 5000); // Check for virtual mail every 5s
};

function setupEventListeners() {
  bindClick('btn-login', login);
  bindClick('btn-show-register', showRegisterForm);
  bindClick('btn-show-login', showLoginForm);
  bindClick('btn-register', register);
  bindClick('btn-logout', logout);
  bindClick('btn-view-logs', viewLogs);
  bindClick('btn-close-logs', () => hide('logs-modal'));
  
  bindClick('show-forgot-pass', e => { e.preventDefault(); showForgotPasswordForm(); });
  bindClick('back-to-login', e => { e.preventDefault(); showLoginForm(); });
  bindClick('show-register', e => { e.preventDefault(); showRegisterForm(); });
  bindClick('show-login', e => { e.preventDefault(); showLoginForm(); });
  
  // Recovery Events
  bindClick('btn-send-reset', requestPasswordReset);
  bindClick('btn-reset-confirm', confirmPasswordReset);
  
  // Virtual Inbox Events
  bindClick('btn-demo-inbox', viewDemoInbox);
  bindClick('btn-refresh-inbox', viewDemoInbox);
  bindClick('btn-close-inbox', () => hide('demo-inbox-modal'));
  bindClick('btn-to-reset-form', showResetPasswordForm);
  bindClick('retry-recovery', e => { e.preventDefault(); showForgotPasswordForm(); });

  // Dashboard / Task Events
  bindClick('btn-add-task', () => openTaskModal());
  bindClick('btn-save-task', saveTask);
  bindClick('btn-delete-task', deleteTask);
  bindClick('btn-cancel-task', closeTaskModal);

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
