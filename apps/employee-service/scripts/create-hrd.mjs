// Create an HRD account from the terminal.
// Use this for the first HRD when the database is still empty.
// After that, HRD can add employees from the web dashboard.
import { createInterface } from 'node:readline/promises';
import argon2 from 'argon2';

import dataSource from '../dist/data-source.js';
import { User } from '../dist/users/entities/user.entity.js';
import { UserRole } from '../dist/users/user-role.enum.js';

// Read a line without showing what the user types (for passwords).
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let value = '';

    // A pasted password arrives as one chunk, so check every character.
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(1);
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    }

    process.stdin.on('data', onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error('Run this script in an interactive terminal');
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const email = (await rl.question('HRD email: ')).trim().toLowerCase();
  rl.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email is not valid');
  }

  const password = await askHidden('Password (min 12 characters): ');
  const confirm = await askHidden('Repeat password: ');

  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }

  if (password !== confirm) {
    throw new Error('Passwords do not match');
  }

  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);

    const existing = await users.findOneBy({ email });
    if (existing) {
      throw new Error(`Email is already used: ${email}`);
    }

    await users.save(
      users.create({
        email,
        role: UserRole.HRD,
        passwordHash: await argon2.hash(password, {
          type: argon2.argon2id,
        }),
      }),
    );

    console.log(`CREATED: HRD account ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed:', error.message);
  process.exitCode = 1;
});
