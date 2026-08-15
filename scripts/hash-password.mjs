#!/usr/bin/env node
// Hash a management-portal password for storage in the ADMIN_USERS env var.
// Usage: node scripts/hash-password.mjs <username> <password>
import bcrypt from 'bcryptjs';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: node scripts/hash-password.mjs <username> <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(JSON.stringify({ username, passwordHash: hash }));
