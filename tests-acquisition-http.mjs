// Local-only HTTP contract tests. Never contact production, Stripe, or real buyers.
// All input values are deliberately invalid or synthetic fixtures.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const fixtureToken = 'local-negative-path-fixture-'.padEnd(40, 'x');

async function unusedPort() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function withIsolatedServer(configured, exercise) {
  const port = await unusedPort();
  // Do not inherit live Stripe, PostHog, database, or acquisition credentials.
  const env = {
    PATH: process.env.PATH || '',
    PORT: String(port),
    NODE_ENV: 'test',
    GARCAR_ACQUISITION_TOKEN: configured ? fixtureToken : '',
    GARCAR_ACQUISITION_ENDPOINT: configured ? 'https://127.0.0.1:9/acquisition/intake' : '',
    POSTHOG_PROJECT_TOKEN: '',
    POSTHOG_HOST: ''
  };
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = (output + String(chunk)).slice(-1500); });
  }
  const base = 'http://127.0.0.1:' + port;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Test server exited: ' + output);
      try {
        const response = await fetch(base + '/health', { signal: AbortSignal.timeout(250) });
        if (response.status === 200) { ready = true; break; }
      } catch { /* Await local startup only. */ }
      await delay(50);
    }
    assert(ready, 'Local test server did not become ready: ' + output);
    await exercise(base);
  } finally {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
    if (child.exitCode === null) {
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        delay(1500)
      ]);
    }
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

async function request(base, path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, {
    method, body, headers, redirect: 'manual', signal: AbortSignal.timeout(3000)
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 405 may have no response body. */ }
  return { status: response.status, headers: response.headers, json, text };
}

await withIsolatedServer(true, async base => {
  const health = await request(base, '/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');

  const readiness = await request(base, '/readyz');
  assert.equal(readiness.status, 200);
  assert.equal(readiness.json.status, 'configured');
  assert.equal(readiness.json.acquisition, 'configured_unverified');
  assert.equal(readiness.json.upstream_probe, 'not_performed');
  assert(!readiness.text.includes(fixtureToken), 'Public readiness leaked a credential');

  const unsupported = await request(base, '/api/acquisition');
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('allow'), 'POST');

  const badOrigin = await request(base, '/api/acquisition', 'POST', '{}', {
    'Content-Type': 'application/json',
    Origin: 'https://other.example'
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(badOrigin.json.error, 'invalid_origin');

  const badType = await request(base, '/api/acquisition', 'POST', '{}', {
    'Content-Type': 'text/plain'
  });
  assert.equal(badType.status, 415);
  assert.equal(badType.json.error, 'json_required');

  const invalidJson = await request(base, '/api/acquisition', 'POST', '{invalid', {
    'Content-Type': 'application/json'
  });
  assert.equal(invalidJson.status, 400);
  assert.equal(invalidJson.json.error, 'invalid_json');

  const arrayPayload = await request(base, '/api/acquisition', 'POST', '[]', {
    'Content-Type': 'application/json'
  });
  assert.equal(arrayPayload.status, 422);
  assert.equal(arrayPayload.json.error, 'invalid_request');

  const trap = await request(base, '/api/acquisition', 'POST',
    JSON.stringify({ company_website_fax: 'automated-form-fill' }), {
      'Content-Type': 'application/json'
    });
  assert.equal(trap.status, 202);
  assert.equal(trap.json.accepted, false);

  const oversized = await request(base, '/api/acquisition', 'POST',
    JSON.stringify({ filler: 'x'.repeat(5000) }), {
      'Content-Type': 'application/json'
    });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.json.error, 'request_too_large');

  // An unreachable test-only loopback endpoint must never become an accepted lead.
  const noUpstream = await request(base, '/api/acquisition', 'POST',
    JSON.stringify({ company: 'Fixture Company', full_name: 'Fixture Person',
      email: 'fixture@example.invalid', crm: 'other', contact_permission: true }), {
      'Content-Type': 'application/json'
    });
  assert.equal(noUpstream.status, 503);
  assert.equal(noUpstream.json.error, 'acquisition_temporarily_unavailable');
  assert.equal(noUpstream.json.accepted, undefined);
});

await withIsolatedServer(false, async base => {
  const readiness = await request(base, '/readyz');
  assert.equal(readiness.status, 503);
  assert.equal(readiness.json.status, 'not_ready');
  const intake = await request(base, '/api/acquisition', 'POST', '{}', {
    'Content-Type': 'application/json'
  });
  assert.equal(intake.status, 503);
  assert.equal(intake.json.error, 'acquisition_temporarily_unavailable');
});

await withIsolatedServer(true, async base => {
  // The caller-controlled X-Forwarded-For header cannot bypass per-IP throttling.
  for (let index = 0; index < 7; index++) {
    const response = await request(base, '/api/acquisition', 'POST', '{invalid', {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.' + (index + 10)
    });
    if (index < 6) assert.equal(response.status, 400);
    else {
      assert.equal(response.status, 429);
      assert.equal(response.json.error, 'rate_limit_exceeded');
    }
  }
});

console.log('PASS: isolated acquisition HTTP negative paths; no real credentials, leads, Stripe requests, or outbound messages');
