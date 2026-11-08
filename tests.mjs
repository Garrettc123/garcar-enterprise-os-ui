import assert from 'node:assert/strict';
import { clientIp, createRateLimiter } from './rate-limit.mjs';
import { readFileSync } from 'node:fs';
const get=(name)=>readFileSync(new URL(name,import.meta.url),'utf8');
const home=get('./index.html'),more=get('./more.html'),server=get('./server.mjs'),support=get('./support.html'),start=get('./start.html');
assert.equal((home.match(/<h1\b/g)||[]).length,1);
assert.equal((home.match(/buy\.stripe\.com/g)||[]).length,1);
assert(home.includes('$497')&&home.includes('$2,500')&&home.includes('$2,003'));
assert(!/RHNS|NEXUS|Wealth Forge/i.test(home));
assert(more.includes('RHNS')&&more.includes('NEXUS')&&more.includes('WEALTH FORGE'));
assert.equal((more.match(/class="listing"/g)||[]).length,50);
assert.equal((more.match(/class="arch-card"><span class="num"/g)||[]).length,7);
assert(home.indexOf('href="/more"') > home.indexOf('</main>'));
assert(!server.includes('eval('));
assert(server.includes("'/support'"));
assert(home.includes('href="/support"'));
assert(support.includes('Do not email raw CRM lead exports'));
assert(start.includes('does not confirm payment'));
const acquisition=get('./acquisition.js'),privacy=get('./privacy.html');
assert(home.includes('id="acquisition-form"'));
assert(home.includes('name="contact_permission"'));
assert(home.includes('name="marketing_consent"'));
assert(home.includes('src="/acquisition.js"'));
assert(server.includes("handleAcquisition(req,res)"));
assert(server.includes("acquisitionToken.length<32"));
assert(server.includes("String(req.headers['content-type']"));
assert(server.includes("startsWith('https://buy.stripe.com/')"));
assert(acquisition.includes("credentials: 'same-origin'"));
assert(acquisition.includes('contact_permission'));
assert(privacy.includes('promotional updates are optional'));
const terms=get('./terms.html');
for(const p of [home,more,start,terms,privacy]) {
  assert(p.includes('SERVING REAL ESTATE TEAMS ACROSS TEXAS'),'A page header reverted to DFW-only messaging');
  assert(!p.includes('DFW REAL ESTATE TEAMS'),'DFW-only header cannot return');
}
assert(home.includes('id="texas-service-area"'));
assert(home.includes('BUILT FOR TEXAS / STATEWIDE SERVICE'));
assert(home.includes('Every other Texas county'));
assert(home.includes('Rio Grande Valley')&&home.includes('El Paso')&&home.includes('Houston')&&home.includes('Waco'));
assert(home.includes('Serving Texas statewide'));
assert(home.includes('GARCAR ENTERPRISE / SERVING ALL OF TEXAS'));
assert(home.includes('Texas Real Estate Lead Follow-Up Review'));
assert(terms.includes('Texas-wide availability'));
assert(more.includes('Texas-wide, remote real estate Follow-Up Review'));
assert(server.includes('handleAcquisition(req,res)'),'Customer inquiry route must remain in place');

// Technical SEO regression coverage: public discovery files and route MIME types.
const robots=get('./robots.txt'), sitemap=get('./sitemap.xml'), llms=get('./llms.txt');
const canonical='https://garcar-enterprise.up.railway.app';
assert(robots.includes('User-agent: *'));
assert(robots.includes('User-agent: OAI-SearchBot'));
assert(robots.includes('Sitemap: '+canonical+'/sitemap.xml'));
const indexedPaths=['/','/more','/support','/privacy','/terms'];
for(const path of indexedPaths)assert(sitemap.includes('<loc>'+canonical+path+'</loc>'),'Sitemap missing '+path);
assert.equal((sitemap.match(/<url>/g)||[]).length,5,'Sitemap must contain five canonical pages');
assert(!sitemap.includes('<loc>'+canonical+'/start</loc>'),'Post-checkout instructions must not be in the sitemap');
assert(server.includes("['/robots.txt', ['robots.txt','text/plain; charset=utf-8']]"));
assert(server.includes("['/sitemap.xml', ['sitemap.xml','application/xml; charset=utf-8']]"));
assert(server.includes("['/llms.txt', ['llms.txt','text/plain; charset=utf-8']]"));
assert(llms.includes('$497')&&llms.includes('$2,500')&&llms.includes('$2,003'));
assert(llms.includes('does not guarantee additional revenue'));

// Payment instructions must remain secure even while Stripe-hosted copy awaits alignment.
assert(home.includes('href="/start"') && home.includes('Never email raw CRM lead lists or customer records'));
assert(acquisition.includes("intakeLink.href = '/start'"));
assert(acquisition.includes('Do not email raw lead lists or customer data'));
assert(start.includes('does not confirm payment'));
assert(start.includes('Do not email raw lead lists or customer personal information'));


const request = (edgeIp, claimedIp = '203.0.113.99') => ({
  headers:{'x-real-ip':edgeIp, 'x-forwarded-for':claimedIp},
  socket:{remoteAddress:'100.64.0.1'}
});
assert.equal(clientIp(request('198.51.100.12')), '198.51.100.12');
assert.equal(clientIp(request('2001:db8::1')), '2001:db8::1');
assert.equal(clientIp(request('invalid-ip','198.51.100.222')), '100.64.0.1');
// The caller-controlled X-Forwarded-For is never allowed to partition the rate-limit bucket.
let timestamp=0;
const allow = createRateLimiter({clock:()=>timestamp});
for(let i=0;i<6;i++) assert.equal(allow(request('198.51.100.12', '198.51.100.'+i)), true);
assert.equal(allow(request('198.51.100.12','198.51.100.250')), false);
assert.equal(allow(request('198.51.100.13','198.51.100.12')), true);
timestamp=600_000;
assert.equal(allow(request('198.51.100.12')), true);
const bounded = createRateLimiter({maxEntries:2,clock:()=>timestamp});
assert.equal(bounded(request('198.51.100.1')), true);
assert.equal(bounded(request('198.51.100.2')), true);
assert.equal(bounded(request('198.51.100.3')), true);
assert(server.includes("if (path === '/readyz')"));
assert(server.includes('configured_unverified'));
assert(server.includes('upstream_probe'));
assert(!server.includes("req.headers['x-forwarded-for']"));
assert(server.includes("if(!acquisitionConfigured())"));

// Authenticated real-integration proof must be read-only and isolated from intake.
assert(server.includes("if (path === '/integrationz')"));
assert(server.includes("endpoint.pathname.replace(/\\/intake$/, '/handshake')"));
assert(server.includes("'X-Acquisition-Token':acquisitionToken"));
assert(server.includes("redirect:'manual'"),'Secret-bearing handshake may not follow redirects');
assert(server.includes("credential_match:true"));
assert(server.includes("customer_intake:'not_tested'"));
assert(server.includes("read_only===true"));
assert(server.includes("lead_created===false"));
assert(server.includes("payment_attempted===false"));
assert(server.includes("expiresAt:Date.now()+45000"));
assert(server.includes("if(integrationInFlight) return integrationInFlight"));
assert(server.includes("if (path === '/readyz')"),'Existing config-only readiness must remain');
assert(server.includes("if(path==='/api/acquisition')return handleAcquisition(req,res);"),
       'Actual inquiry intake must remain distinct from read-only check');

console.log('PASS: statewide Texas coverage, $497 checkout, consent, catalog, ingress safeguards, and read-only bridge diagnostic');
