import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const home = load('index.html');
const support = load('support.html');
const start = load('start.html');
const terms = load('terms.html');
const privacy = load('privacy.html');
const more = load('more.html');
const server = load('server.mjs');

const checks = [
  ['Homepage presents exactly one primary headline', () => assert.equal((home.match(/<h1\\b/gi) || []).length, 1)],
  ['Only one checkout link appears on homepage', () => assert.equal((home.match(/https:\/\/buy\\.stripe\\.com\//g) || []).length, 1)],
  ['Live checkout link equals approved $497 SKU link', () => assert.ok(home.includes('https://buy.stripe.com/8x2eVddjf0hQ86Tf0f43S2h'))],
  ['Offer, install and credit arithmetic are consistent', () => {
    assert.ok(home.includes('$497') && home.includes('$2,500') && home.includes('$2,003'));
    assert.equal(2500 - 497, 2003);
  }],
  ['Home keeps internal technology brand names off the primary offer', () => assert.ok(!/RHNS|NEXUS|Wealth Forge/i.test(home))],
  ['Additional divisions have their own archive page', () => assert.ok(more.includes('RHNS') && more.includes('NEXUS') && more.includes('WEALTH FORGE'))],
  ['Support warns against sensitive emailed data', () => assert.match(support, /Do not email raw CRM lead exports/i)],
  ['Privacy requires an approved secure CRM transfer', () => assert.match(privacy, /secure transfer|restricted CRM access/i)],
  ['Post-checkout page warns that payment must be independently verified', () => assert.match(start, /does not confirm payment/i)],
  ['Terms specify authorized data and 48-hour scope', () => {
    assert.match(terms, /authorized lead list/i); assert.match(terms, /48 hours/i);
  }],
  ['No runtime code evaluates arbitrary script input', () => assert.ok(!server.includes('eval('))],
  ['HTTP server has security and health checks', () => {
    for (const token of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', '/health']) assert.ok(server.includes(token));
  }],
  ['Home links to customer support and legal pages', () => {
    for (const route of ['/support', '/privacy', '/terms', '/more']) assert.ok(home.includes('href="' + route + '"'));
  }],
];

let failed = 0;
for (const [label, fn] of checks) {
  try { fn(); console.log('PASS: ' + label); }
  catch (error) { failed++; console.error('FAIL: ' + label + '\\n' + error.message); }
}
if (failed) { console.error('LOCAL STATIC PRE-FLIGHT FAILED: ' + failed + ' checks'); process.exitCode = 1; }
else {
  console.log('LOCAL STATIC PRE-FLIGHT PASSED (' + checks.length + ' checks)');
  console.log('NOTE: Live Stripe confirmation, webhook reconciliation, external HTTP reachability, privacy approval, and owner canary are MANUAL GATES. A static pass is NOT launch authorization.');
}
