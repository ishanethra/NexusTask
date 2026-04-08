const fs = require('fs/promises');
const path = require('path');
const { hashPassword } = require('../server/auth');

const DB_DIR = path.join(__dirname, '../data');

async function seed() {
  await fs.mkdir(DB_DIR, { recursive: true });

  const orgs = [
    { id: 'o1', name: 'DesignTech' },
    { id: 'o2', name: 'GreenEnergy' }
  ];

  const users = [
    { id: 'u1', email: 'admin@apple.com', password: hashPassword('password123'), role: 'ADMIN', orgId: 'o1' },
    { id: 'u2', email: 'bob@apple.com', password: hashPassword('password123'), role: 'MEMBER', orgId: 'o1' },
    { id: 'u3', email: 'admin@google.com', password: hashPassword('password123'), role: 'ADMIN', orgId: 'o2' },
    { id: 'u4', email: 'alen@google.com', password: hashPassword('password123'), role: 'MEMBER', orgId: 'o2' }
  ];

  const tasks = [
    { id: 't1', title: 'Design System V2', description: 'Update all components to glassmorphism', status: 'IN_PROGRESS', orgId: 'o1', createdBy: 'u1', creatorEmail: 'admin@apple.com', createdAt: new Date().toISOString() },
    { id: 't2', title: 'Solar Panel Layout', description: 'Calculate efficiency for roof A', status: 'TODO', orgId: 'o2', createdBy: 'u4', creatorEmail: 'alen@google.com', createdAt: new Date().toISOString() }
  ];

  await fs.writeFile(path.join(DB_DIR, 'organizations.json'), JSON.stringify(orgs, null, 2));
  await fs.writeFile(path.join(DB_DIR, 'users.json'), JSON.stringify(users, null, 2));
  await fs.writeFile(path.join(DB_DIR, 'tasks.json'), JSON.stringify(tasks, null, 2));
  await fs.writeFile(path.join(DB_DIR, 'logs.json'), JSON.stringify([], null, 2));

  console.log('✅ Base Demo Data Seeded successfully!');
  console.log('Organizations: DesignTech (Sarah, Alex), GreenEnergy (David)');
}

seed();
