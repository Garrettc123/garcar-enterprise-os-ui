#!/usr/bin/env node
/**
 * Read-only production readiness verification. No customer records, credentials,
 * Stripe API calls, database writes, or outbound messages are involved.
 */
import { pathToFileURL } from 'node:url';

export const DEFAULT_ORIGIN = 'https://garcar-enterprise.up.railway.app';
const EXPECTED_CSV_COLUMNS = ['rank', 'lead_id', 'class', 'received_at', 'contact_latency_minutes', 'hours_since_received', 'score', 'contactable', 'channel', 'value', 'reason', 'draft_action'];

function fail(reason, status = null) { return { ok: false, reason, http_status: status }; }

export async function checkEndpoint(origin, path, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  let url;
  try {
    const base = new URL(origin);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/')
      return fail('invalid_https_origin');
    url = new URL(path, base);
    if (url.origin !== base.origin) return fail('cross_origin_path');
  } catch { return fail('invalid_origin'); }

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: { accept: path.endsWith('.csv') ? 'text/csv' : 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch { return fail('request_failed'); }
  if (response.status !== 200) return fail('http_not_ready', response.status);

  if (path.endsWith('.csv')) {
    let body;
    try { body = await response.text(); } catch { return fail('invalid_csv_response', response.status); }
    if (body.length > 100_000) return fail('csv_template_too_large', response.status);
    const header = body.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    // Check only a public, header-only template. Never upload customer data.
    if (!EXPECTED_CSV_COLUMNS.every(v => header.includes(v))) return fail('csv_template_columns_mismatch', response.status);
    return { ok: true, reason: 'public_template_available', http_status: response.status };
  }

  let data;
  try { data = await response.json(); } catch { return fail('invalid_json', response.status); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('invalid_response_shape', response.status);

  if (path === '/health')
    return data.status === 'ok' && data.service === 'garcar-texas-followup'
      ? { ok: true, reason: 'process_healthy', http_status: 200 } : fail('unexpected_health_contract', 200);
  if (path === '/readyz')
    return data.status === 'configured' && data.acquisition === 'configured_unverified'
      ? { ok: true, reason: 'configuration_present_only', http_status: 200 } : fail('acquisition_not_configured', 200);
  if (path === '/integrationz')
    return data.status === 'authenticated_read_only' && data.credential_match === true &&
      data.lead_created === false && data.payment_attempted === false && data.customer_intake === 'not_tested'
      ? { ok: true, reason: 'upstream_read_only_handshake', http_status: 200 } : fail('integration_contract_mismatch', 200);
  return fail('unknown_probe', 200);
}

export async function verifyLiveReadiness(origin = DEFAULT_ORIGIN, options = {}) {
  const checks = {};
  // Sequential probes reduce upstream pressure; integrationz caches the handshake.
  for (const [name, path] of [
    ['http_health', '/health'],
    ['acquisition_config', '/readyz'],
    ['authenticated_upstream', '/integrationz'],
    ['public_csv_template', '/callback-sheet-columns.csv'],
  ]) checks[name] = await checkEndpoint(origin, path, options);

  return {
    site: 'garcar-texas-followup',
    origin,
    readiness: Object.values(checks).every(c => c.ok) ? 'read_only_preflight_passed' : 'blocked',
    checks,
    // These cannot be inferred from a GET request, even when every check passes.
    customer_csv_upload: 'not_implemented_on_public_site',
    customer_intake_write: 'not_tested',
    stripe_payment: 'not_tested',
    fulfillment: 'not_tested',
    mutations_performed: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origin = process.env.GARCAR_READINESS_ORIGIN || DEFAULT_ORIGIN;
  const report = await verifyLiveReadiness(origin);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.readiness !== 'read_only_preflight_passed') process.exitCode = 1;
}
