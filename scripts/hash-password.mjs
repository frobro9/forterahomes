#!/usr/bin/env node
// Hash a management-portal password for storage in the ADMIN_USERS env var.
// Usage: node scripts/hash-password.mjs <username> <password>
import { hashPassword } from '../functions/_lib/password.js';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: node scripts/hash-password.mjs <username> <password>');
  process.exit(1);
}

const hash = await hashPassword(password);
console.log(JSON.stringify({ username, passwordHash: hash }));
