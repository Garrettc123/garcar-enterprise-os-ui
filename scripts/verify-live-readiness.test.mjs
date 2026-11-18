import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEndpoint, verifyLiveReadiness } from './verify-live-readiness.mjs';

const origin = 'https://garcar-enterprise.up.railway.app';
const good = {
  '/health': { status: 'ok', service: 'garcar-texas-followup' },
  '/readyz': { status: 'configured', acquisition: 'configured_unverified' },
  '/integrationz': { status: 'authenticated_read_only', credential_match: true, lead_created: false, payment_attempted: false, customer_intake: 'not_tested' },
};
const csv = 'rank,lead_id,class,received_at,contact_latency_minutes,hours_since_received,score,contactable,channel,value,reason,draft_action\n';
const fake = (status = 200, data = good, csvBody = csv) => async url => {
  const path = new URL(url).pathname;
  return {
    status,
    json: async () => data[path],
    text: async () => csvBody,
  };
};

test('all read-only probes pass while paid fulfillment and CSV upload remain unverified', async () => {
  const r = await verifyLiveReadiness(origin, { fetchImpl: fake() });
  assert.equal(r.readiness, 'read_only_preflight_passed');
  assert.equal(r.customer_csv_upload, 'not_implemented_on_public_site');
  assert.equal(r.stripe_payment, 'not_tested');
  assert.equal(r.mutations_performed, false);
});

test('upstream 503 blocks readiness even if process health is good', async () => {
  const fetchImpl = async url => new URL(url).pathname === '/integrationz'
    ? { status: 503 } : fake()(url);
  const r = await verifyLiveReadiness(origin, { fetchImpl });
  assert.equal(r.readiness, 'blocked');
  assert.equal(r.checks.http_health.ok, true);
  assert.equal(r.checks.authenticated_upstream.reason, 'http_not_ready');
});

test('readiness rejects wrong origin and credentials in URL', async () => {
  for (const bad of ['http://garcar-enterprise.up.railway.app', 'https://user:pass@garcar-enterprise.up.railway.app', 'https://garcar-enterprise.up.railway.app/path']) {
    const r = await checkEndpoint(bad, '/health', { fetchImpl: fake() });
    assert.equal(r.ok, false);
  }
});

test('readiness rejects cross-origin paths', async () => {
  const r = await checkEndpoint(origin, 'https://evil.invalid/health', { fetchImpl: fake() });
  assert.equal(r.reason, 'cross_origin_path');
});

test('integrationz must attest to zero writes and no payment attempts', async () => {
  for (const [key, value] of [['credential_match', false], ['lead_created', true], ['payment_attempted', true], ['customer_intake', 'passed']]) {
    const d = structuredClone(good);
    d['/integrationz'][key] = value;
    const r = await checkEndpoint(origin, '/integrationz', { fetchImpl: fake(200, d) });
    assert.equal(r.ok, false, key);
  }
});

test('CSV template validates required headers, not fabricated customer rows', async () => {
  const ok = await checkEndpoint(origin, '/callback-sheet-columns.csv', { fetchImpl: fake() });
  assert.equal(ok.ok, true);
  const bad = await checkEndpoint(origin, '/callback-sheet-columns.csv', { fetchImpl: fake(200, good, 'name,email\n') });
  assert.equal(bad.reason, 'csv_template_columns_mismatch');
});

test('network and JSON errors fail closed', async () => {
  const network = await checkEndpoint(origin, '/health', { fetchImpl: async () => { throw new Error('secret should not be logged'); } });
  assert.equal(network.reason, 'request_failed');
  const malformed = await checkEndpoint(origin, '/health', { fetchImpl: async () => ({ status: 200, json: async () => { throw Error('bad'); } }) });
  assert.equal(malformed.reason, 'invalid_json');
});

test('GET only, no redirects, no secret headers', async () => {
  let seen;
  await checkEndpoint(origin, '/health', { fetchImpl: async (_url, init) => { seen = init; return { status: 200, json: async () => good['/health'] }; } });
  assert.equal(seen.method, 'GET');
  assert.equal(seen.redirect, 'manual');
  assert.deepEqual(Object.keys(seen.headers), ['accept']);
});
