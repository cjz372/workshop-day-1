#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_API = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10000;

function usage() {
  return [
    'Usage:',
    '  snip add <url>    Create a short link',
    '  snip ls           List links and hit counts',
    '  snip open <code>  Open a short link in your browser',
    '  snip help         Show this help',
  ].join('\n');
}

function apiBase() {
  const raw = process.env.SNIP_API || DEFAULT_API;
  let base;
  try {
    base = new URL(raw);
  } catch {
    throw new Error('SNIP_API must be a valid HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('SNIP_API must be a valid HTTP(S) URL.');
  }
  return base.toString().replace(/\/+$/, '');
}

function validateHttpUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL must be a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL must be a valid HTTP or HTTPS URL.');
  }
  return url.toString();
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('Request timed out while contacting the Snip API.');
    }
    throw new Error(`Could not reach the Snip API: ${error.message}`);
  }
  return response;
}

async function errorMessage(response) {
  let detail = '';
  try {
    const body = await response.json();
    if (typeof body.error === 'string') detail = `: ${body.error}`;
  } catch {
    // Error responses may not contain JSON.
  }
  return `Snip API returned ${response.status}${detail}`;
}

async function add(rawUrl) {
  const url = validateHttpUrl(rawUrl);
  const response = await request('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const link = await response.json();
  if (typeof link.shortUrl !== 'string' || !link.shortUrl) {
    throw new Error('Snip API response did not include a shortUrl.');
  }
  console.log(link.shortUrl);
}

function formatLinks(links) {
  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }
  const codeWidth = Math.max(4, ...links.map((link) => String(link.code ?? '').length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits ?? '').length));
  const codeHeader = 'CODE'.padEnd(codeWidth);
  const hitsHeader = 'HITS'.padStart(hitsWidth);
  console.log(`${codeHeader}  ${hitsHeader}  URL`);
  for (const link of links) {
    console.log(
      `${String(link.code ?? '').padEnd(codeWidth)}  ${String(link.hits ?? '').padStart(hitsWidth)}  ${link.url ?? ''}`,
    );
  }
}

async function list() {
  const response = await request('/api/links');
  if (!response.ok) throw new Error(await errorMessage(response));
  const links = await response.json();
  if (!Array.isArray(links)) throw new Error('Snip API returned an invalid links list.');
  formatLinks(links);
}

function launchBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '""', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.once('error', (error) => {
    console.error(`Could not open the browser: ${error.message}`);
    process.exitCode = 1;
  });
  child.unref();
}

async function open(code) {
  const response = await request(`/${encodeURIComponent(code)}`, { redirect: 'manual' });
  if (response.status === 404) throw new Error(`No link found for code "${code}".`);
  if (response.status !== 302) throw new Error(await errorMessage(response));
  const location = response.headers.get('location');
  if (!location) throw new Error('Snip API redirect did not include a Location header.');
  const target = validateHttpUrl(location);
  launchBrowser(target);
}

async function run(args) {
  const [command, ...rest] = args;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(usage());
    return;
  }

  if (command === 'add') {
    if (rest.length !== 1) throw new Error('Usage: snip add <url>');
    await add(rest[0]);
    return;
  }
  if (command === 'ls') {
    if (rest.length !== 0) throw new Error('Usage: snip ls');
    await list();
    return;
  }
  if (command === 'open') {
    if (rest.length !== 1 || !rest[0]) throw new Error('Usage: snip open <code>');
    await open(rest[0]);
    return;
  }
  throw new Error(`Unknown command "${command}".\n${usage()}`);
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
