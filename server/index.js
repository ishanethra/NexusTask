const http = require('http');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { read, write, ensureDataDir } = require('./db');
const { hashPassword, generateToken, verifyToken } = require('./auth');

const PORT = process.env.PORT || 3035;
const HOST = '0.0.0.0';

async function startServer() {
  await ensureDataDir();

  const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || HOST}`);
    const requestPath = parsedUrl.pathname;
    const segments = requestPath.split('/').filter(Boolean);

    let body = '';
    req.on('data', chunk => { body += chunk; });
    
    req.on('end', async () => {
      try {
        // --- STATIC FILES ---
        if (requestPath === '/' || requestPath === '/index.html') {
          const content = await fs.readFile(path.join(__dirname, '../public/index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return res.end(content);
        }
        if (requestPath.startsWith('/public/') || requestPath === '/styles.css' || requestPath === '/app.js') {
          const fileName = requestPath === '/styles.css' || requestPath === '/app.js' ? `../public${requestPath}` : `..${requestPath}`;
          try {
            const content = await fs.readFile(path.join(__dirname, fileName));
            const ext = fileName.split('.').pop();
            const types = { css: 'text/css', js: 'application/javascript', html: 'text/html' };
            res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
            return res.end(content);
          } catch (e) {
            res.writeHead(404);
            return res.end();
          }
        }

        const payload = body ? JSON.parse(body) : {};
        const context = await getContext(req);

        // --- PUBLIC ROUTES ---
        if (req.method === 'POST' && requestPath === '/api/register') {
          return await handleRegister(res, payload);
        }
        if (req.method === 'POST' && requestPath === '/api/login') {
          return await handleLogin(res, payload);
        }
        if (req.method === 'GET' && requestPath === '/api/demo/emails') {
          const tokens = await read('recovery_tokens');
          res.writeHead(200);
          return res.end(JSON.stringify(tokens));
        }
        if (req.method === 'POST' && requestPath === '/api/oauth') {
          return await handleOAuth(res, payload);
        }
        if (req.method === 'POST' && requestPath === '/api/forgot-password') {
          return await handleForgotPassword(res, payload);
        }
        if (req.method === 'POST' && requestPath === '/api/reset-password') {
          return await handleResetPassword(res, payload);
        }

        // --- PROTECTED ROUTES ---
        if (!context.user) {
          res.writeHead(401);
          return res.end(JSON.stringify({ error: 'Unauthorized' }));
        }

        // --- TASKS ROUTES ---
        if (segments[0] === 'api' && segments[1] === 'tasks') {
          return await handleTasks(req, res, segments, context, payload);
        }

        // --- AUDIT LOGS ---
        if (req.method === 'GET' && requestPath === '/api/logs') {
          if (context.user.role !== 'ADMIN') {
            res.writeHead(403);
            return res.end(JSON.stringify({ error: 'Access Denied' }));
          }
          const logs = await read('logs');
          const orgLogs = logs.filter(l => l.orgId === context.user.orgId);
          res.writeHead(200);
          return res.end(JSON.stringify(orgLogs));
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found' }));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    });
  });

  server.listen(PORT, HOST, () => {
    const address = server.address();
    const url = `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${address.port}`;
    console.log(`Server running on ${url}`);
    
    // Automatically open the user's default web browser
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${startCmd} ${url}`);
  });
}

async function getContext(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return { user: null };
  const token = authHeader.split(' ')[1];
  const user = verifyToken(token);
  return { user };
}

async function handleRegister(res, payload) {
  const { email, password, orgName, role } = payload;
  const users = await read('users');
  const orgs = await read('organizations');

  if (users.find(u => u.email === email)) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: 'Email already exists' }));
  }

  // Find or Create Organization
  let org = orgs.find(o => o.name.toLowerCase() === orgName.toLowerCase());
  if (!org) {
    org = { id: crypto.randomUUID(), name: orgName };
    orgs.push(org);
    await write('organizations', orgs);
  }

  // Security: First user is ADMIN. Rest are MEMBERs.
  const existingAdmin = users.find(u => u.orgId === org.id && u.role === 'ADMIN');
  const enforcedRole = existingAdmin ? 'MEMBER' : 'ADMIN';

  const newUser = {
    id: crypto.randomUUID(),
    email,
    password: hashPassword(password),
    role: enforcedRole,
    orgId: org.id
  };

  users.push(newUser);
  await write('users', users);

  res.writeHead(201);
  res.end(JSON.stringify({ message: 'User registered', user: { email, role: newUser.role, orgName } }));
}

async function handleLogin(res, payload) {
  const { email, password } = payload;
  const users = await read('users');
  const orgs = await read('organizations');

  const user = users.find(u => u.email === email && u.password === hashPassword(password));
  if (!user) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Invalid credentials' }));
  }

  const org = orgs.find(o => o.id === user.orgId);
  const token = generateToken({ id: user.id, email: user.email, role: user.role, orgId: user.orgId });

  res.writeHead(200);
  res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role, orgName: org.name } }));
}

async function handleOAuth(res, payload) {
  const { provider, email } = payload;
  const users = await read('users');
  const orgs = await read('organizations');

  let user = users.find(u => u.email === email);

  if (!user) {
    // Determine Org from Email Domain
    const domain = email.split('@')[1] || 'oauth.com';
    const orgName = domain.split('.')[0].toUpperCase();
    
    let org = orgs.find(o => o.name === orgName);
    if (!org) {
      org = { id: crypto.randomUUID(), name: orgName };
      orgs.push(org);
      await write('organizations', orgs);
    }

    // Assign Role: If Org already has an Admin, make them a Member.
    const existingAdmin = users.find(u => u.orgId === org.id && u.role === 'ADMIN');
    const role = existingAdmin ? 'MEMBER' : 'ADMIN';

    user = {
      id: crypto.randomUUID(),
      email,
      password: hashPassword('oauth-dummy-pass-' + crypto.randomUUID()),
      role,
      orgId: org.id
    };
    users.push(user);
    await write('users', users);
  }

  const org = orgs.find(o => o.id === user.orgId);
  const token = generateToken({ id: user.id, email: user.email, role: user.role, orgId: user.orgId });

  res.writeHead(200);
  res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role, orgName: org.name } }));
}

async function handleForgotPassword(res, payload) {
  const { email } = payload;
  const users = await read('users');
  const user = users.find(u => u.email === email);

  if (!user) {
    // Security: Don't reveal if user exists. 
    // But for demo purposes, we can provide a nice message.
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'If that email is registered, you will receive a code.' }));
  }

  const resetKey = Math.floor(100000 + Math.random() * 900000).toString();
  const tokens = await read('recovery_tokens');
  tokens.push({ email, key: resetKey, expires: Date.now() + 3600000 }); // 1 hour
  await write('recovery_tokens', tokens);

  // In a real app, this would be an email. 
  // For this demo, we "leak" it in the UI success message for the user.
  res.writeHead(200);
  res.end(JSON.stringify({ 
    message: `Recovery key sent! (DEMO MODE: Your key is ${resetKey})`,
    demoKey: resetKey 
  }));
}

async function handleResetPassword(res, payload) {
  const { email, key, newPassword } = payload;
  const tokens = await read('recovery_tokens');
  const tokenIndex = tokens.findIndex(t => t.email === email && t.key === key && t.expires > Date.now());

  if (tokenIndex === -1) {
    res.writeHead(400);
    return res.end(JSON.stringify({ error: 'Invalid or expired recovery key.' }));
  }

  const users = await read('users');
  const user = users.find(u => u.email === email);
  if (user) {
    user.password = hashPassword(newPassword);
    await write('users', users);
  }

  // Clear the used token
  tokens.splice(tokenIndex, 1);
  await write('recovery_tokens', tokens);

  res.writeHead(200);
  res.end(JSON.stringify({ message: 'Password reset successful. Please login.' }));
}

async function handleTasks(req, res, segments, context, payload) {
  const tasks = await read('tasks');
  const { user } = context;
  const taskId = segments[2];

  // Filter Tasks by Organization (Tenant Isolation)
  const orgTasks = tasks.filter(t => t.orgId === user.orgId);

  if (req.method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify(orgTasks));
  }

  if (req.method === 'POST') {
    const newTask = {
      id: crypto.randomUUID(),
      title: payload.title,
      description: payload.description,
      status: 'TODO',
      orgId: user.orgId,
      createdBy: user.id,
      creatorEmail: user.email,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    await write('tasks', tasks);
    await logAction(user, 'CREATE_TASK', newTask.id);
    res.writeHead(201);
    return res.end(JSON.stringify(newTask));
  }

  const task = tasks.find(t => t.id === taskId && t.orgId === user.orgId);
  if (!task) {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Task not found' }));
  }

  // RBAC: Only Admin or Creator can Update/Delete
  const canModify = user.role === 'ADMIN' || task.createdBy === user.id;

  if (req.method === 'PUT') {
    if (!canModify) {
      res.writeHead(403);
      return res.end(JSON.stringify({ error: 'Forbidden' }));
    }
    Object.assign(task, payload);
    await write('tasks', tasks);
    await logAction(user, 'UPDATE_TASK', task.id);
    res.writeHead(200);
    return res.end(JSON.stringify(task));
  }

  if (req.method === 'DELETE') {
    if (!canModify) {
      res.writeHead(403);
      return res.end(JSON.stringify({ error: 'Forbidden' }));
    }
    const index = tasks.findIndex(t => t.id === taskId);
    tasks.splice(index, 1);
    await write('tasks', tasks);
    await logAction(user, 'DELETE_TASK', taskId);
    res.writeHead(204);
    return res.end();
  }
}

async function logAction(user, action, taskId) {
  const logs = await read('logs');
  logs.push({
    id: crypto.randomUUID(),
    userId: user.id,
    userEmail: user.email,
    orgId: user.orgId,
    action,
    taskId,
    timestamp: new Date().toISOString()
  });
  await write('logs', logs);
}

const crypto = require('crypto');
startServer();
