import http from 'node:http';
import { createHash } from 'node:crypto';
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
const acquisitionEndpoint = process.env.GARCAR_ACQUISITION_ENDPOINT || '';
const acceptedOrigin = 'https://garcar-enterprise.up.railway.app';
const requestBuckets = new Map();
const inquiryHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers};
const writeJson = (res,code,body) => {res.writeHead(code,inquiryHeaders);res.end(JSON.stringify(body));};
function enforceRateLimit(req){
  // Railway is the TLS reverse proxy. This throttles by the forwarded client
  // address and is an abuse deterrent, not a substitute for CAPTCHA/WAF.
  const address=String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().slice(0,120);
  const key=createHash('sha256').update(address).digest('hex');
  const now=Date.now(), current=requestBuckets.get(key);
  if(requestBuckets.size>2000) for(const [k,v] of requestBuckets) if(now-v.since>600000)requestBuckets.delete(k);
  if(!current || now-current.since>600000){requestBuckets.set(key,{since:now,hits:1});return true;}
  current.hits++;
  return current.hits<=6;
}
async function handleAcquisition(req,res){
  if(req.method!=='POST'){res.writeHead(405,{Allow:'POST',...headers});return res.end();}
  if(!acquisitionEndpoint.startsWith('https://') || acquisitionToken.length<32)
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
    return writeJson(res,201,{accepted:true,lead_id:data.lead_id,
      checkout_url:data.checkout_url,duplicate:data.duplicate===true,
      next_step:'optional_stripe_checkout',outbound_sent:false});
  }catch{return writeJson(res,503,{error:'acquisition_temporarily_unavailable'});}
}

http.createServer(async (req,res)=>{
  const path = new URL(req.url||'/', 'http://localhost').pathname;
  if(path==='/api/acquisition')return handleAcquisition(req,res);
  if (path === '/health') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
    return res.end(JSON.stringify({status:'ok',service:'garcar-dfw-followup'}));
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
}).listen(port,'0.0.0.0',()=>{console.log('garcar-dfw-followup listening on '+port)});
