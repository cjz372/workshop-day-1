'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const cliPath = path.resolve(__dirname, '../cli.js');
const tempPaths = [];
const calls = [];

const server = http.createServer((request, response) => {
  calls.push({ method: request.method, url: request.url });
  if (request.method === 'POST' && request.url === '/api/links') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const { url } = JSON.parse(body);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        code: 'abc123',
        url,
        shortUrl: 'http://localhost:3000/abc123',
        hits: 0,
        createdAt: new Date(0).toISOString(),
      }));
    });
    return;
  }
  if (request.method === 'GET' && request.url === '/api/links') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify([
      { code: 'abc123', url: 'https://example.com', hits: 4 },
      { code: 'xy', url: 'https://short.test/path', hits: 0 },
    ]));
    return;
  }
  if (request.method === 'GET' && request.url === '/empty/api/links') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('[]');
    return;
  }
  if (request.method === 'GET' && request.url === '/abc123') {
    response.writeHead(302, { location: 'https://example.com/path' });
    response.end();
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

let apiBase;
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  apiBase = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  for (const pathToRemove of tempPaths) rmSync(pathToRemove, { recursive: true, force: true });
});

function runCli(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, SNIP_API: apiBase, ...env },
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data; });
    child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data; });
    child.once('error', reject);
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

test('help prints usage without contacting the API', async () => {
  const result = await runCli(['help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test('add validates URLs and prints the API shortUrl', async () => {
  const invalid = await runCli(['add', 'ftp://example.com']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /HTTP or HTTPS/);

  const result = await runCli(['add', 'https://example.com']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'http://localhost:3000/abc123');
  assert.deepEqual(calls.at(-1), { method: 'POST', url: '/api/links' });
});

test('ls prints an aligned table and handles an empty list', async () => {
  const result = await runCli(['ls']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CODE\s+HITS\s+URL/);
  assert.match(result.stdout, /abc123\s+4\s+https:\/\/example\.com/);

  const empty = await runCli(['ls'], { SNIP_API: `${apiBase}/empty` });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.stdout.trim(), 'No links yet.');
});

test('open requests a manual redirect and launches its Location target', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'snip-cli-test-'));
  tempPaths.push(tempDir);
  const binDir = path.join(tempDir, 'bin');
  const captureFile = path.join(tempDir, 'opened-url');
  mkdirSync(binDir);
  const browserCommand = process.platform === 'win32' ? 'start.cmd'
    : process.platform === 'darwin' ? 'open'
      : 'xdg-open';
  const browserPath = path.join(binDir, browserCommand);
  if (process.platform === 'win32') {
    writeFileSync(browserPath, '@echo off\r\necho %* > "%SNIP_TEST_CAPTURE%"\r\n');
  } else {
    writeFileSync(browserPath, '#!/bin/sh\nprintf "%s" "$*" > "$SNIP_TEST_CAPTURE"\n', { mode: 0o755 });
  }

  const result = await runCli(['open', 'abc123'], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    SNIP_TEST_CAPTURE: captureFile,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.at(-1), { method: 'GET', url: '/abc123' });

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      assert.match(readFileSync(captureFile, 'utf8'), /https:\/\/example\.com\/path/);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  assert.fail('Browser launcher did not receive the redirect Location.');
});

test('bad arguments and unknown codes fail on stderr with exit code 1', async () => {
  const badArgs = await runCli(['open']);
  assert.equal(badArgs.status, 1);
  assert.match(badArgs.stderr, /Usage: snip open/);

  const missing = await runCli(['open', 'missing']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No link found/);
});

test('unreachable backend fails cleanly with exit code 1', async () => {
  const result = await runCli(['ls'], { SNIP_API: 'http://127.0.0.1:1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Could not reach the Snip API/);
});
