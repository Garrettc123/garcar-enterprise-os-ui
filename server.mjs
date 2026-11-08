import http from 'node:http';
import { createRateLimiter } from './rate-limit.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const routes = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/more', ['more.html','text/html; charset=utf-8']],
  ['/start', ['start.html','text/html; charset=utf-8']],
  ['/support', ['support.html','text/html; charset=utf-8']],
  ['/privacy', ['privacy.html','text/html; charset=utf-8']],
  ['/terms', ['terms.html','text/html; charset=utf-8']],
  ['/style.css', ['style.css','text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg','image/svg+xml']],
  ['/acquisition.js', ['acquisition.js','text/javascript; charset=utf-8']],
  ['/robots.txt', ['robots.txt','text/plain; charset=utf-8']],
  ['/sitemap.xml', ['sitemap.xml','application/xml; charset=utf-8']],
  ['/llms.txt', ['llms.txt','text/plain; charset=utf-8']],
]);
const headers = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
const port = Number(process.env.PORT || 3000);

const acquisitionToken = process.env.GARCAR_ACQUISITION_TOKEN || '';
const posthogToken = process.env.POSTHOG_PROJECT_TOKEN || '';
const posthogHost = process.env.POSTHOG_HOST || '';
async function trackConfirmedInquiry(leadId, attributes){
  if (!/^lead_[a-f0-9]{32}$/.test(String(leadId)) || !posthogToken.startsWith('phc_') || !/^https:\/\/((us|eu)\.i\.posthog\.com)$/.test(posthogHost)) return;
  const event={
    api_key:posthogToken,
    event:'garcar_inquiry_received',
    distinct_id:leadId,
    timestamp:new Date().toISOString(),
    properties:{
      $lib:'garcar-commerce-server',
      offer_sku:'REV-497',
      source:'first_party_form',
      utm_source:attributes.utm_source || '',
      utm_medium:attributes.utm_medium || '',
      utm_campaign:attributes.utm_campaign || '',
      crm:attributes.crm || 'unsure',
      marketing_consent:attributes.marketing_consent===true,
      $process_person_profile:false
    }
  };
  try{await fetch(posthogHost+'/capture/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(2500)});}catch{ /* analytics failure never blocks customer intake */ }
}

const acquisitionEndpoint = process.env.GARCAR_ACQUISITION_ENDPOINT || '';
const acceptedOrigin = 'https://garcar-enterprise.up.railway.app';
const enforceRateLimit = createRateLimiter();
const inquiryHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers};
const writeJson = (res,code,body) => {res.writeHead(code,inquiryHeaders);res.end(JSON.stringify(body));};
function acquisitionConfigured(){
  if(acquisitionToken.length<32) return false;
  try {
    const url = new URL(acquisitionEndpoint);
    return url.protocol==='https:' && Boolean(url.hostname) &&
      !url.username && !url.password && !url.hash;
  }catch{return false;}
}
// Read-only handshake with the production dispatcher. No lead payloads,
// Stripe requests, database writes, or outbound customer communications.
// Cache for 45 seconds to prevent public checks from flooding the dispatcher.
let integrationCache = {expiresAt:0, result:null};
let integrationInFlight = null;
async function acquisitionIntegrationCheck(){
  if(!acquisitionConfigured()) return {status:'not_verified',reason:'not_configured'};
  const now=Date.now();
  if(integrationCache.result && now<integrationCache.expiresAt) return integrationCache.result;
  if(integrationInFlight) return integrationInFlight;
  integrationInFlight = (async()=>{
    let result = {status:'not_verified',reason:'connection_unverified'};
    try{
      const endpoint=new URL(acquisitionEndpoint);
      // Fail closed for nonstandard paths: never send an intake credential to
      // a guessed destination, and never follow redirects with a secret header.
      if(endpoint.pathname.endsWith('/acquisition/intake')){
        endpoint.pathname=endpoint.pathname.replace(/\/intake$/, '/handshake');
        const response=await fetch(endpoint.toString(),{
          method:'GET',headers:{'X-Acquisition-Token':acquisitionToken},
          redirect:'manual',signal:AbortSignal.timeout(4000)
        });
        if(response.status===200){
          const data=await response.json();
          if(data?.status==='authenticated' && data?.service==='garcar-dispatch' &&
             data?.scope==='first_party_acquisition' && data?.read_only===true &&
             data?.lead_created===false && data?.outbound_sent===false &&
             data?.payment_attempted===false){
            result={status:'authenticated_read_only',credential_match:true,
                    lead_created:false,payment_attempted:false,
                    customer_intake:'not_tested'};
          }
        }
      }
    }catch{ /* No error details or tokens in public diagnostics. */ }
    integrationCache={expiresAt:Date.now()+45000,result};
    return result;
  })();
  try{return await integrationInFlight;}finally{integrationInFlight=null;}
}
async function handleAcquisition(req,res){
  if(req.method!=='POST'){res.writeHead(405,{Allow:'POST',...headers});return res.end();}
  if(!acquisitionConfigured())
    return writeJson(res,503,{error:'acquisition_temporarily_unavailable'});
  const origin=req.headers.origin;
  if(origin && origin!==acceptedOrigin) return writeJson(res,403,{error:'invalid_origin'});
  if(!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||'')))
    return writeJson(res,415,{error:'json_required'});
  if(!enforceRateLimit(req)) return writeJson(res,429,{error:'rate_limit_exceeded'});
  if(Number(req.headers['content-length']||0)>4096)return writeJson(res,413,{error:'request_too_large'});
  let total=0,parts=[];
  for await (const chunk of req){total+=chunk.length;if(total>4096)return writeJson(res,413,{error:'request_too_large'});parts.push(chunk);}
  let payload;
  try{payload=JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{return writeJson(res,400,{error:'invalid_json'});}
  if(!payload || typeof payload!=='object' || Array.isArray(payload))return writeJson(res,422,{error:'invalid_request'});
  // Honeypot: do not create fake leads or contacts.
  if(payload.company_website_fax) return writeJson(res,202,{accepted:false,reason:'not_processed'});
  const allowed=['company','full_name','email','crm','contact_permission','marketing_consent','utm_source','utm_medium','utm_campaign'];
  const clean=Object.fromEntries(allowed.filter(k=>Object.hasOwn(payload,k)).map(k=>[k,payload[k]]));
  try{
    const remote=await fetch(acquisitionEndpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Acquisition-Token':acquisitionToken},
      body:JSON.stringify(clean),signal:AbortSignal.timeout(9500)});
    if(remote.status===422)return writeJson(res,422,{error:'invalid_inquiry'});
    if(!remote.ok)return writeJson(res,503,{error:'acquisition_temporarily_unavailable'});
    const data=await remote.json();
    if(data?.accepted!==true || !/^lead_[a-f0-9]{32}$/.test(data.lead_id||'') ||
       !String(data.checkout_url||'').startsWith('https://buy.stripe.com/'))
      return writeJson(res,502,{error:'acquisition_invalid_response'});
    void trackConfirmedInquiry(data.lead_id,clean);
    return writeJson(res,201,{accepted:true,lead_id:data.lead_id,
      checkout_url:data.checkout_url,duplicate:data.duplicate===true,
      next_step:'optional_stripe_checkout',outbound_sent:false});
  }catch{return writeJson(res,503,{error:'acquisition_temporarily_unavailable'});}
}

http.createServer(async (req,res)=>{
  const path = new URL(req.url||'/', 'http://localhost').pathname;
  if(path==='/api/acquisition')return handleAcquisition(req,res);
  if (path === '/integrationz') {
    if(req.method!=='GET'){res.writeHead(405,{Allow:'GET',...headers});return res.end();}
    const result=await acquisitionIntegrationCheck();
    return writeJson(res,result.status==='authenticated_read_only'?200:503,{
      service:'garcar-texas-followup',...result
    });
  }
  if (path === '/readyz') {
    // Configuration gate only: do not claim that an upstream inquiry was accepted.
    const configured = acquisitionConfigured();
    return writeJson(res,configured?200:503,{
      status:configured?'configured':'not_ready',
      service:'garcar-texas-followup',
      acquisition:configured?'configured_unverified':'unavailable',
      upstream_probe:'not_performed'
    });
  }
  if (path === '/health') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
    return res.end(JSON.stringify({status:'ok',service:'garcar-texas-followup'}));
  }
  if (!['GET','HEAD'].includes(req.method)) {
    res.writeHead(405, {'Allow':'GET, HEAD',...headers}); return res.end();
  }
  const file = routes.get(path);
  if (!file) {res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8',...headers});return res.end('Not found');}
  try {
    const body = await readFile(join(root,file[0]));
    res.writeHead(200, {'Content-Type':file[1], 'Cache-Control':path==='/style.css'||path==='/favicon.svg'?'public, max-age=600':'no-store',...headers});
    if(req.method==='HEAD')return res.end();
    res.end(body);
  } catch {
    res.writeHead(503, {'Content-Type':'text/plain; charset=utf-8',...headers}); res.end('Temporarily unavailable');
  }
}).listen(port,'0.0.0.0',()=>{console.log('garcar-texas-followup listening on '+port)});
