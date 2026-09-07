const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

function clientFiles(root = 'src/app') {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return clientFiles(path);
    if (!/\.[jt]sx?$/u.test(path)) return [];
    return /^\s*['"]use client['"]/u.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

module.exports = clientFiles;
