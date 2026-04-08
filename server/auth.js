const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'salt-456', 1000, 64, 'sha512').toString('hex');
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) return null;
    
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch (err) {
    return null;
  }
}

module.exports = { hashPassword, generateToken, verifyToken };
