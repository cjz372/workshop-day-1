import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(root, 'bundle');
const frontend = join(root, 'frontend');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--push') || args.length > 1) {
  throw new Error('Usage: node scripts/build-bundle.mjs [--push]');
}

function run(command, commandArgs, cwd = root) {
  console.log(`> ${command} ${commandArgs.join(' ')}`);
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === 'npm',
  });
}

function gitOutput(cwd, ...gitArgs) {
  return execFileSync('git', gitArgs, { cwd, encoding: 'utf8' }).trim();
}

function commitStaged(cwd, message) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet', '--exit-code'], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status === 0) {
    console.log(`${message}: unchanged`);
    return;
  }
  if (result.status !== 1) throw new Error('Could not inspect staged changes');
  run('git', [
    'commit', '-m', message,
    '-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>',
    '-m', 'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>',
  ], cwd);
}

if (gitOutput(root, 'branch', '--show-current') !== 'main') {
  throw new Error('Run this script from a main branch checkout');
}
if (gitOutput(root, 'diff', '--cached', '--name-only')) {
  throw new Error('Refusing to commit unrelated staged changes in the superproject');
}
run('git', ['submodule', 'update', '--init', 'backend', 'frontend', 'cli', 'bundle']);
for (const name of ['backend', 'frontend', 'cli', 'bundle']) {
  if (gitOutput(join(root, name), 'status', '--porcelain')) {
    throw new Error(`Refusing to update dirty ${name} submodule`);
  }
}
run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);
run('npm', ['ci'], frontend);
run('npm', ['run', 'build'], frontend);
const builtFrontend = join(frontend, 'dist', 'snip-frontend', 'browser');
if (!existsSync(join(builtFrontend, 'index.html'))) {
  throw new Error('Missing frontend/dist/snip-frontend/browser/index.html');
}

rmSync(join(bundle, 'public'), { recursive: true, force: true });
mkdirSync(join(bundle, 'public'), { recursive: true });
cpSync(builtFrontend, join(bundle, 'public'), { recursive: true });
cpSync(join(root, 'backend', 'server.js'), join(bundle, 'server.js'));
cpSync(join(root, 'cli', 'cli.js'), join(bundle, 'cli.js'));
writeFileSync(join(bundle, '.env'), 'PUBLIC_DIR=./public\n');
writeFileSync(join(bundle, 'package.json'), JSON.stringify({
  name: 'snip-bundle',
  private: true,
  scripts: { start: 'bun server.js' },
}, null, 2) + '\n');
writeFileSync(join(bundle, 'Dockerfile'), [
  'FROM oven/bun:1-alpine',
  'WORKDIR /app',
  'COPY . .',
  'ENV PORT=3000',
  'EXPOSE 3000',
  'CMD ["bun", "server.js"]',
  '',
].join('\n'));
writeFileSync(join(bundle, '.dockerignore'), '.git\nnode_modules\n.DS_Store\n');
writeFileSync(join(bundle, 'railway.json'), JSON.stringify({
  $schema: 'https://railway.com/railway.schema.json',
  build: { builder: 'DOCKERFILE' },
}, null, 2) + '\n');

run('git', ['add', '-A', '--', 'server.js', 'cli.js', 'public', 'package.json',
  'Dockerfile', '.dockerignore', 'railway.json'], bundle);
run('git', ['add', '-f', '--', '.env'], bundle);
commitStaged(bundle, 'Build generated bundle');
run('git', ['add', '--', 'backend', 'frontend', 'cli', 'bundle']);
commitStaged(root, 'Update source and bundle submodules');
if (args.includes('--push')) {
  run('git', ['push', 'origin', 'HEAD:refs/heads/bundle'], bundle);
  run('git', ['push', 'origin', 'HEAD:refs/heads/main']);
}
