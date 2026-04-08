const { describe, it, expect } = require('./runner');
const { hashPassword, generateToken, verifyToken } = require('../server/auth');

describe('Authentication', () => {
  it('should hash passwords correctly', () => {
    const pass = 'secret123';
    const hash1 = hashPassword(pass);
    const hash2 = hashPassword(pass);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(128); // SHA-512 hex length
  });

  it('should generate and verify valid tokens', () => {
    const payload = { id: 'u1', email: 'test@org.com', orgId: 'o1' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    
    expect(decoded.toExist);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.orgId).toBe(payload.orgId);
  });

  it('should return null for invalid tokens', () => {
    const invalidToken = 'abc.def.ghi';
    const decoded = verifyToken(invalidToken);
    expect(decoded).toBe(null);
  });
});
