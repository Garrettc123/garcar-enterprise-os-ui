import http from 'node:http';
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
]);
const headers = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
const port = Number(process.env.PORT || 3000);
http.createServer(async (req,res)=>{
  const path = new URL(req.url||'/', 'http://localhost').pathname;
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
