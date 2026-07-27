#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error('Usage: node scripts/detect-keystore-format.mjs <keystore>');
  process.exit(1);
}

const passwordIndex = process.argv.indexOf('--password');
const password =
  (passwordIndex >= 0 ? process.argv[passwordIndex + 1] : undefined) ??
  process.env.KEYSTORE_PASSWORD;

try {
  const argumentsList = ['-list', '-keystore', file];
  if (password) argumentsList.push('-storepass', password);
  const output = execFileSync('keytool', argumentsList, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  console.log(`Keystore type: ${output.match(/Keystore type:\s*(\S+)/i)?.[1] ?? 'unknown'}`);
} catch {
  console.error('Unable to read the keystore. Check the password and file format.');
  process.exit(1);
}
