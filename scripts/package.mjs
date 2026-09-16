import { mkdirSync, mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { version } = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
mkdirSync('dist', { recursive: true });
const archive = resolve(`dist/linkedin-quiet-${version}.zip`);
const staging = mkdtempSync(join(tmpdir(), 'linkedin-quiet-package-'));
try {
  cpSync('extension', join(staging, 'extension'), { recursive: true });
  for (const name of ['README.md', 'LICENSE', 'PRIVACY.md']) cpSync(name, join(staging, name));
  rmSync(archive, { force: true });
  execFileSync('zip', ['-qr', archive, 'extension', 'README.md', 'LICENSE', 'PRIVACY.md'], { cwd: staging });
  console.log(archive);
} finally { rmSync(staging, { recursive: true, force: true }); }
