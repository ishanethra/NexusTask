const http = require('http');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { read, write, ensureDataDir, query, USE_SQL } = require('./db');
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
          return res.end(JSON.stringify([...tokens].reverse()));
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
          return await handleLogs(res, context);
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
  
  if (USE_SQL) {
    try {
      // 1. Find or Create Organization
      let orgRes = await query('SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)', [orgName]);
      let orgId;
      if (orgRes.rows.length === 0) {
        let newOrg = await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [orgName]);
        orgId = newOrg.rows[0].id;
      } else {
        orgId = orgRes.rows[0].id;
      }

      // 2. Check User existence
      let userCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (userCheck.rows.length > 0) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Email already exists' }));
      }

      // 3. Register User (First user in org gets ADMIN)
      let adminCheck = await query('SELECT id FROM users WHERE org_id = $1 AND role = \'ADMIN\'', [orgId]);
      const finalRole = adminCheck.rows.length === 0 ? 'ADMIN' : (role || 'MEMBER');
      
      await query('INSERT INTO users (email, password_hash, org_id, role) VALUES ($1, $2, $3, $4)', 
        [email, hashPassword(password), orgId, finalRole]);

      res.writeHead(201);
      return res.end(JSON.stringify({ message: 'Registration successful' }));
    } catch (err) {
      console.error('SQL Error during registration:', err);
      throw err;
    }
  }

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
  
  if (USE_SQL) {
    const resSql = await query(`
      SELECT u.*, o.name as "orgName" 
      FROM users u 
      JOIN organizations o ON u.org_id = o.id 
      WHERE u.email = $1`, [email]);
    
    const user = resSql.rows[0];
    if (!user || user.password_hash !== hashPassword(password)) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Invalid email or password' }));
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role, orgId: user.org_id });
    res.writeHead(200);
    return res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role, orgName: user.orgName } }));
  }

  const users = await read('users');
  const orgs = await read('organizations');
  const user = users.find(u => u.email === email && u.password === hashPassword(password));

  if (!user) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Invalid email or password' }));
  }

  const org = orgs.find(o => o.id === user.orgId);
  const token = generateToken({ id: user.id, email: user.email, role: user.role, orgId: user.orgId });

  res.writeHead(200);
  res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role, orgName: org.name } }));
}

async function handleOAuth(res, payload) {
  const { email } = payload;
  
  if (USE_SQL) {
    let orgRes = await query('SELECT u.*, o.name as "orgName" FROM users u JOIN organizations o ON u.org_id = o.id WHERE u.email = $1', [email]);
    let user = orgRes.rows[0];

    if (!user) {
      const domain = email.split('@')[1] || 'google.com';
      const company = domain.split('.')[0].toUpperCase();
      
      let orgLookup = await query('SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)', [company]);
      let orgId;
      if (orgLookup.rows.length === 0) {
        let newOrg = await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [company]);
        orgId = newOrg.rows[0].id;
      } else {
        orgId = orgLookup.rows[0].id;
      }

      let adminCheck = await query('SELECT id FROM users WHERE org_id = $1 AND role = \'ADMIN\'', [orgId]);
      const role = adminCheck.rows.length === 0 ? 'ADMIN' : 'MEMBER';
      
      let newUser = await query('INSERT INTO users (email, password_hash, org_id, role) VALUES ($1, $2, $3, $4) RETURNING *', 
        [email, hashPassword('oauth-placeholder'), orgId, role]);
      
      user = newUser.rows[0];
      user.orgName = company;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role, orgId: user.org_id });
    res.writeHead(200);
    return res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role, orgName: user.orgName } }));
  }

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
  
  if (USE_SQL) {
    const user = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'No account found with this email address.' }));
    }
    const resetKey = Math.floor(100000 + Math.random() * 900000).toString();
    await query('INSERT INTO recovery_tokens (email, key, expires) VALUES ($1, $2, $3)', [email, resetKey, Date.now() + 3600000]);
    res.writeHead(200);
    return res.end(JSON.stringify({ message: `Recovery key sent! (DEMO MODE: Your key is ${resetKey})`, demoKey: resetKey }));
  }

  const users = await read('users');
  const user = users.find(u => u.email === email);

  if (!user) {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'No account found with this email address.' }));
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
  
  if (USE_SQL) {
    const tokenRes = await query('SELECT * FROM recovery_tokens WHERE email = $1 AND key = $2 AND expires > $3', [email, key, Date.now()]);
    if (tokenRes.rows.length === 0) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Invalid or expired recovery key.' }));
    }
    await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashPassword(newPassword), email]);
    await query('DELETE FROM recovery_tokens WHERE id = $1', [tokenRes.rows[0].id]);
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'Password reset successful. Please login.' }));
  }

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
  const { user } = context;
  const taskId = segments[2];

  if (USE_SQL) {
    if (req.method === 'GET') {
      const tasks = await query('SELECT * FROM tasks WHERE org_id = $1 ORDER BY created_at DESC', [user.orgId]);
      res.writeHead(200);
      return res.end(JSON.stringify(tasks.rows));
    }

    if (req.method === 'POST') {
      const { title, description, status } = payload;
      const resTask = await query('INSERT INTO tasks (org_id, created_by, title, description, status) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
        [user.orgId, user.id, title, description, status || 'TODO']);
      await logAction(user.orgId, user.id, 'CREATE_TASK', { taskId: resTask.rows[0].id, title });
      res.writeHead(201);
      return res.end(JSON.stringify(resTask.rows[0]));
    }

    if (req.method === 'PUT') {
      const { title, description, status } = payload;
      // RBAC: Check ownership if not ADMIN
      const check = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (check.rows.length === 0) { res.writeHead(404); return res.end(); }
      if (user.role !== 'ADMIN' && check.rows[0].created_by !== user.id) {
        res.writeHead(403); return res.end(JSON.stringify({ error: 'Forbidden: You can only edit your own tasks' }));
      }
      const updated = await query('UPDATE tasks SET title = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
        [title, description, status, taskId]);
      await logAction(user.orgId, user.id, 'UPDATE_TASK', { taskId, title });
      res.writeHead(200);
      return res.end(JSON.stringify(updated.rows[0]));
    }

    if (req.method === 'DELETE') {
      const check = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (check.rows.length === 0) { res.writeHead(404); return res.end(); }
      if (user.role !== 'ADMIN' && check.rows[0].created_by !== user.id) {
        res.writeHead(403); return res.end(JSON.stringify({ error: 'Forbidden: You can only delete your own tasks' }));
      }
      await query('DELETE FROM tasks WHERE id = $1', [taskId]);
      await logAction(user.orgId, user.id, 'DELETE_TASK', { taskId });
      res.writeHead(200);
      return res.end(JSON.stringify({ message: 'Task deleted' }));
    }
  }

  const tasks = await read('tasks');

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
