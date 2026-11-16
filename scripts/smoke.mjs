import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/smoke.mjs <base-url>');

const page = await fetch(base);
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /<app-root/);
const script = html.match(/src="(main-[^"]+\.js)"/);
assert.ok(script, 'missing frontend JavaScript');
const js = await (await fetch(new URL(script[1], base))).text();
assert.ok(js.includes('/api/links'), 'frontend does not reference the API');
assert.ok(!js.includes('http://localhost:3000/api/links'), 'production UI uses localhost');

const response = await fetch(new URL('/api/links', base), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com/snip-smoke' }),
});
assert.equal(response.status, 201);
const link = await response.json();
assert.match(link.code, /^[a-zA-Z0-9]{6}$/);
assert.equal(link.hits, 0);
const redirect = await fetch(new URL(`/${link.code}`, base), { redirect: 'manual' });
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), link.url);
const links = await (await fetch(new URL('/api/links', base))).json();
assert.equal(links.find((item) => item.code === link.code)?.hits, 1);
const cli = execFileSync('node', [join(root, 'cli', 'cli.js'), 'ls'], {
  env: { ...process.env, SNIP_API: base },
  encoding: 'utf8',
});
assert.ok(cli.includes(link.code) && cli.includes(link.url));
console.log('Smoke test passed: UI assets, API, redirect, hits, and CLI');
