// Garcar Revenue Control workbench: local-only, zero outbound side effects.
// No customer data, analytics, credentials, or payment requests leave the browser.
export const STORAGE_KEY='garcar-revenue-workflow-v1';
export const CLASS_BASE={sat:70,stalled:60,late:40,recent:55,on_time:10,unknown:0};
export const FIELDS={
  lead_id:['lead id','lead_id','id','record id','recordid','ref','reference'],
  received_at:['received','received_at','date received','created','created_at','date created','lead date','inquiry date','date of inquiry','submitted','request date','date'],
  first_contact_at:['first contact','first_contact','first contact at','first attempt','first touch','contacted','first contacted','initial contact','first response'],
  last_activity_at:['last activity','last_activity','last contact','last touch','last note','updated','last updated','modified','last action'],
  status:['status','stage','disposition','result','outcome'],
  channel:['channel','source','lead source','origin','medium'],
  value:['value','amount','deal value','dealvalue','price','revenue','est value','estimated value','job value'],
  phone:['phone','phone number','mobile','cell','telephone'],
  email:['email','e-mail','email address']
};
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const blank=s=>['','n/a','na','none','null','-','--','?'].includes(String(s??'').trim().toLowerCase());
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseCSV(input){
  if(typeof input!=='string')throw Error('CSV must be text');
  const text=input.replace(/^\uFEFF/,''); const rows=[]; let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c;}
    else if(c==='"'&&value==='')quoted=true;
    else if(c===','){row.push(value);value='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(quoted)throw Error('CSV has an unclosed quoted field');
  if(value!==''||row.length){row.push(value);if(row.some(v=>v.trim()!==''))rows.push(row);}
  if(!rows.length)throw Error('CSV is empty');
  const headers=rows.shift().map(v=>v.trim());
  if(!headers.some(Boolean)||new Set(headers).size!==headers.length)throw Error('CSV requires distinct, nonempty headers');
  if(rows.length>3000)throw Error('File exceeds 3,000 rows');
  const records=rows.map((r,i)=>{
    if(r.length!==headers.length)throw Error(`CSV row ${i+2} has ${r.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((h,n)=>[h,r[n]??'']));
  });
  return {headers,records};
}
export function columnMap(headers){
  const map={};const used=new Set();
  for(const [key,aliases] of Object.entries(FIELDS)){
    const set=new Set(aliases.map(norm));
    const found=headers.find(h=>!used.has(h)&&set.has(norm(h)));
    if(found){map[key]=found;used.add(found);}
  }
  return map;
}
export function parseTimestamp(raw){
  if(blank(raw))return null;
  const s=String(raw).trim();
  let parsed=NaN;
  if(/^\d{4}-\d\d-\d\d(?:[ T].*)?$/.test(s)){
    const date=s.replace(' ','T');
    const zoned=/(?:Z|[+-]\d\d:?\d\d)$/i.test(date);
    parsed=Date.parse(date+(zoned?'':date.includes('T')?'Z':'T00:00:00Z'));
  }else{
    const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(m){let year=Number(m[3]);if(year<100)year+=year>=70?1900:2000;
      parsed=Date.UTC(year,Number(m[1])-1,Number(m[2]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0));
      const dt=new Date(parsed);
      if(dt.getUTCFullYear()!==year||dt.getUTCMonth()!==Number(m[1])-1||dt.getUTCDate()!==Number(m[2]))return null;
    }
  }
  return Number.isFinite(parsed)?parsed:null;
}
const cell=(r,map,k)=>String(r[map[k]]??'').trim();
const monetary=raw=>{if(blank(raw))return null;const n=Number(String(raw).replace(/[$,%\s]/g,''));return Number.isFinite(n)&&n>=0?n:null;};
export function classifyRow(row,map,{now=Date.now(),sla=60,stall=7}={}){
  const leadId=cell(row,map,'lead_id');const received=parseTimestamp(cell(row,map,'received_at'));
  const first=parseTimestamp(cell(row,map,'first_contact_at'));
  const lastActivity=parseTimestamp(cell(row,map,'last_activity_at'));
  const contactable=Boolean(cell(row,map,'phone')||cell(row,map,'email'));
  const amount=monetary(cell(row,map,'value'));
  let label='unknown',reason='',hours=null,latency=null,evidence='missing';
  if(received===null){reason='Received date is missing or unparsable; source record needs correction.';}
  else if(received>now+60_000){reason='Received timestamp is in the future; verify export clock/timezone.';evidence='unverified';}
  else{
    hours=Math.max(0,(now-received)/3_600_000);
    if(first===null){
      if(hours<=sla/60){label='recent';reason=`No first-contact timestamp in export; response window has ${Math.max(0,Math.round(sla-hours*60))} min remaining.`;}
      else {label='sat';reason=`No first-contact timestamp in export; received ${hours.toFixed(1)} h ago, exceeding ${sla}-min response window.`;}
      evidence='unverified';// Absence of a timestamp is not proof that a person never called.
    }else{
      latency=Math.max(0,(first-received)/60_000);
      const last=lastActivity??first;
      const quietH=Math.max(0,(now-last)/3_600_000);
      if(first<received){evidence='unverified';reason='First contact predates receipt; verify CRM clock. ';}
      else evidence='confirmed';
      if(quietH>stall*24){label='stalled';reason+=`Last logged activity was ${quietH.toFixed(1)} h ago; exceeds ${stall}-day stall threshold.`;}
      else if(latency>sla){label='late';reason+=`First logged contact occurred ${Math.round(latency)} min after receipt; exceeds ${sla}-min response window.`;}
      else{label='on_time';reason+=`First logged contact occurred within ${sla}-min response window.`;}
    }
  }
  const points=[['class:'+label,CLASS_BASE[label]]];
  if(hours!==null){if(hours<=168)points.push(['fresh <=7 days',15]);else if(hours<=720)points.push(['received <=30 days',7]);}
  if(contactable)points.push(['contactable',10]);
  if(amount&&amount>0)points.push(['listed value',Math.min(10,Math.floor(amount/500))]);
  const score=Math.max(0,Math.min(100,points.reduce((n,p)=>n+p[1],0)));
  const next={sat:'Review ownership and contact record; propose callback',stalled:'Confirm owner, reopen conversation if authorized',late:'Review delayed response and next follow-up',recent:'Assign first-contact action immediately',on_time:'Maintain existing follow-up cadence',unknown:'Correct missing or inconsistent source data'}[label];
  return {leadId,label,reason,evidence,score,points,next,received,first,latency,hours,contactable,channel:cell(row,map,'channel'),amount};
}
export function priorityRows(records,map,config){
  return records.map(row=>({row,...classifyRow(row,map,config)})).sort((a,b)=>b.score-a.score||(a.leadId.localeCompare(b.leadId)));
}
export function csvSerialize(rows){
  return rows.map(row=>row.map(value=>{
    let s=String(value??'');
    // Neutralize CSV formulas when opened in Excel/Sheets; never execute buyer-supplied values.
    if(/^[\s\u0000-\u001f]*[=+@\-]/.test(s))s="'"+s;
    return /[,"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(',')).join('\r\n')+'\r\n';
}
export const CHECKS=['Confirm buyer authorization and scoped inputs','Validate source columns and missing records','Generate and review callback-priority CSV','Review evidence-based reasons and recommendations','Deliver files through buyer-approved channel','Record delivery receipt or note'];
function defaultState(){return {version:1,offers:{real_estate:{name:'Follow-Up Review',price:497,scope:'Review one buyer-authorized CRM lead export. Return a prioritized callback sheet and observations; targeted within 48 hours after usable data is received.'},contractor:{name:'Callback-Priority Review',price:'',scope:'Review one authorized contractor lead export and return a prioritized callback sheet. Pricing and scope require buyer agreement.'}},workspaces:[],selectedId:'',sla:60,stall:7};}
const $=id=>document.getElementById(id);
const randomId=()=>globalThis.crypto?.randomUUID?.()??`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let state=defaultState();let active='intake',toastTimer;
function work(){return state.workspaces.find(x=>x.id===state.selectedId)||null;}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('shown'),4200);}
function save(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('save-status').textContent='Saved on this browser · not synced';return true;}
  catch{$('save-status').textContent='Storage failed · export backup';notify('Browser storage is full or disabled. Export a backup; changes may not persist.');return false;}
}
function load(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(value?.version===1&&Array.isArray(value.workspaces)&&value.offers){state={...defaultState(),...value};}}catch{notify('Stored state could not be read; starting with empty workspaces.');}}
function newWorkspaceObj(){return {id:randomId(),buyer:'',list:'',source:'',segment:'real_estate',quotedPrice:null,authorized:false,storageConsent:false,rows:[],headers:[],map:{},importedAt:'',draft:{recipient:'',subject:'',body:'',approvedSnapshot:'',approvedAt:'',status:'not_sent',evidence:''},delivery:{checks:CHECKS.map(()=>false),status:'not_started',evidence:''},payment:{status:'unverified',amount:'',reference:'',date:'',verified:false},revisions:[],createdAt:new Date().toISOString()};}
function approved(w){if(!w?.draft)return false;const d=w.draft;return Boolean(d.approvedSnapshot&&d.approvedAt&&d.approvedSnapshot===JSON.stringify([d.recipient,d.subject,d.body])&&d.body.trim());}
export function isPaid(w){const p=w?.payment;if(!p||p.status!=='paid'||!p.verified||!p.reference?.trim()||!p.date)return false;const price=Number(w.quotedPrice);return Number.isFinite(price)&&price>0&&Number(p.amount)>=price;}
function refreshNav(){for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===active);for(const v of document.querySelectorAll('.view'))v.classList.toggle('hidden',v.id!=='view-'+active);const headings={intake:['Offer & intake','Manage one buyer-owned lead review from intake to a documented payment outcome.'],review:['Callback review','Prioritize verified source rows with explainable rules and no invented recovery figures.'],outreach:['Outreach approval','Govern every customer-facing draft with explicit, revocable operator approval.'],delivery:['Delivery & payment','Complete the agreed scope, record revisions and verify payment evidence.']};$('page-title').textContent=headings[active][0];$('page-description').textContent=headings[active][1];}
function refreshWorkspaceSelect(){const selector=$('workspace-select');selector.replaceChildren(new Option('Create a new workspace',''));for(const w of state.workspaces)selector.add(new Option(`${w.buyer||'Unnamed buyer'} — ${w.list||'Untitled list'}`,w.id));selector.value=state.selectedId||'';}
function fillOffer(){const seg=$('segment').value;const offer=state.offers[seg];$('offer-name').value=offer.name;$('price').value=offer.price;$('offer-scope').value=offer.scope;const real=seg==='real_estate';$('offer-context-title').textContent=real?'Published price reference':'Contractor quote requires agreement';$('offer-context').textContent=real?'The current public real-estate checkout is $497. Internal price edits do not update the live Stripe payment link.':'The contractor variant has no verified fixed public checkout. Agree pricing and scope with the buyer first; payment is not taken by this page.';}
function fillWorkspace(){const w=work();$('buyer-name').value=w?.buyer||'';$('list-name').value=w?.list||'';$('source-name').value=w?.source||'';$('buyer-authorized').checked=Boolean(w?.authorized);$('storage-consent').checked=Boolean(w?.storageConsent);$('segment').value=w?.segment||'real_estate';fillOffer();$('filename').textContent=w?.importedAt?`${w.rows.length} stored rows · ${w.importedAt.slice(0,10)}`:'No file selected';$('workspace-warning').textContent=w?'Selected buyer list is browser-local and not synchronized.':'No buyer workspace selected. No customer or sale has been established.';fillDraft();fillDelivery();fillPayment();refreshSummary();refreshReview();refreshRevisions();refreshCustomerTable();}
function fillDraft(){const d=work()?.draft||{};$('draft-recipient').value=d.recipient||'';$('draft-subject').value=d.subject||'';$('draft-body').value=d.body||'';$('outreach-status').value=d.status||'not_sent';$('outreach-evidence').value=d.evidence||'';refreshApproval();}
function fillDelivery(){const d=work()?.delivery||{};const checks=Array.isArray(d.checks)?d.checks:CHECKS.map(()=>false);$('delivery-checklist').innerHTML=CHECKS.map((text,i)=>`<label class="check-item"><input type="checkbox" data-check="${i}" ${checks[i]?'checked':''}><span>${escapeHtml(text)}</span></label>`).join('');$('delivery-status').value=d.status||'not_started';$('delivery-evidence').value=d.evidence||'';}
function fillPayment(){const p=work()?.payment||{};$('payment-status').value=p.status||'unverified';$('payment-amount').value=p.amount??'';$('payment-reference').value=p.reference||'';$('payment-date').value=p.date||'';$('payment-verified').checked=Boolean(p.verified);refreshPayment();}
function refreshApproval(){const w=work();const ok=approved(w);$('approval-badge').textContent=ok?'CONFIRMED · MANUAL APPROVAL':'BLOCKED · NOT APPROVED';$('approval-badge').className='chip '+(ok?'chip-good':'chip-blocked');$('copy-draft').disabled=!ok;$('approval-detail').textContent=ok?`Exact text approved ${w.draft.approvedAt}. Copy requires the approved version; no message has been sent.`:'Approval is absent or outdated. Edits revoke it. This app cannot send outbound messages.';}
function refreshSummary(){const w=work();const scored=w?.rows?.length?getRows():[];$('metric-leads').textContent=w?.rows?.length?String(w.rows.length):'—';$('metric-priority').textContent=scored.length?String(scored.filter(x=>['sat','stalled','late','recent'].includes(x.label)).length):'—';$('metric-leads-state').textContent=w?.rows?.length?'CONFIRMED CSV':'MISSING';$('metric-priority-state').textContent=scored.length?'COMPUTED':'MISSING';$('metric-outreach').textContent=approved(w)?'Approved':'Blocked';$('metric-outreach-state').textContent=approved(w)?'CONFIRMED':'BLOCKED';const paid=isPaid(w);$('metric-payment').textContent=paid?'Manually paid':w?.payment?.status==='paid'?'Evidence missing':w?.payment?.status==='pending'?'Pending':'Not recorded';$('metric-payment-state').textContent=paid?'MANUAL EVIDENCE':w?.payment?.status==='paid'?'BLOCKED':'UNVERIFIED';$('deal-state').textContent=!w?'MISSING · NO BUYER':paid?'PAID · MANUAL EVIDENCE':w.rows?.length?'CONFIRMED · CSV REVIEW':'MISSING · LEAD ROWS';}
function getRows(){const w=work();if(!w?.rows?.length)return [];return priorityRows(w.rows,w.map,{now:Date.now(),sla:state.sla,stall:state.stall});}
function refreshReview(){const w=work();const filter=$('review-filter').value;let rows=getRows();if(filter==='priority')rows=rows.filter(x=>['sat','stalled','late','recent'].includes(x.label));if(filter==='unknown')rows=rows.filter(x=>x.label==='unknown');$('review-count').textContent=w?.rows?.length?`${rows.length} of ${w.rows.length} buyer-owned records`:'No buyer-owned records';const body=$('lead-table');if(!rows.length){body.innerHTML='<tr><td colspan="7" class="empty">No qualifying buyer-owned lead rows. Import an authorized CSV to begin.</td></tr>';return;}
  body.innerHTML=rows.slice(0,150).map((r,i)=>`<tr><td>${i+1}</td><td><strong>${escapeHtml(r.leadId)}</strong></td><td><span class="row-label ${r.label}">${escapeHtml(r.label.replace('_',' '))}</span></td><td><span class="score-num">${r.score}</span></td><td class="reason">${escapeHtml(r.reason)}</td><td class="action">${escapeHtml(r.next)}</td><td><span class="evidence ${r.evidence}">${r.evidence.toUpperCase()}</span></td></tr>`).join('');
}
function refreshPayment(){const w=work(),p=w?.payment;const paid=isPaid(w);$('paid-customer').innerHTML=paid?'<strong>Paid customer · operator-confirmed evidence</strong><p>Payment evidence is recorded locally. This is not a live Stripe or bank reconciliation; financial reporting requires independent verification.</p>':p?.status==='paid'?'<strong>Blocked: paid status unverified</strong><p>Amount, reference, date, explicit verification, and full quoted price are required before counting a paid customer.</p>':'<strong>Payment unverified</strong><p>No provider-confirmed payment is available in this workspace. Enter genuine evidence to track a manually verified paid customer.</p>';}
function refreshCustomerTable(){const body=$('customer-table');if(!state.workspaces.length){body.innerHTML='<tr><td colspan="6" class="empty">No buyer records.</td></tr>';$('customer-summary').textContent='No buyer records';return;}const paid=state.workspaces.filter(isPaid).length;$('customer-summary').textContent=`${paid} manually verified paid / ${state.workspaces.length} buyer workspaces · no Stripe sync`;body.innerHTML=state.workspaces.map(w=>`<tr><td><strong>${escapeHtml(w.buyer)}</strong><br><small>${escapeHtml(w.list)}</small></td><td>${escapeHtml(w.segment==='real_estate'?'Real estate':'Contractor')}</td><td>${w.rows.length}</td><td>${escapeHtml(w.delivery.status.replaceAll('_',' '))}</td><td>${escapeHtml(w.payment.status.replaceAll('_',' '))}</td><td><span class="evidence ${isPaid(w)?'':'unverified'}">${isPaid(w)?'MANUAL CONFIRMED':'UNVERIFIED'}</span></td></tr>`).join('');}
function refreshRevisions(){const log=$('revision-log'),revs=work()?.revisions||[];$('revision-count').textContent=`${revs.length} LOGGED`;log.innerHTML=revs.length?revs.slice().reverse().map(r=>`<div class="revision-row"><div><strong>${escapeHtml(r.text)}</strong><small>${escapeHtml(r.createdAt)} · Evidence: ${escapeHtml(r.evidence||'missing')}</small></div><select data-revision="${escapeHtml(r.id)}" aria-label="Revision status"><option value="requested" ${r.status==='requested'?'selected':''}>Requested</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>In progress</option><option value="completed" ${r.status==='completed'?'selected':''}>Completed</option></select></div>`).join(''):'<div class="empty">No revisions recorded.</div>';}
function requireWork(){const w=work();if(!w){notify('Save a real buyer workspace first.');return null;}return w;}
function requireAuthorized(){const w=requireWork();if(!w)return null;if(!w.authorized||!w.storageConsent){notify('Buyer permission and trusted-device consent are required.');return null;}return w;}
function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function slug(s){return String(s||'buyer').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,38).replace(/^-|-$/g,'')||'buyer';}
function handleSaveWorkspace(){const buyer=$('buyer-name').value.trim(),list=$('list-name').value.trim();if(!buyer||!list){notify('Actual buyer/company and list name are required.');return;}if(!$('buyer-authorized').checked||!$('storage-consent').checked){notify('Confirm buyer authorization and trusted browser storage before saving.');return;}
  let w=work();if(!w){w=newWorkspaceObj();state.workspaces.push(w);state.selectedId=w.id;}
  Object.assign(w,{buyer,list,source:$('source-name').value.trim(),segment:$('segment').value,authorized:true,storageConsent:true,quotedPrice:state.offers[$('segment').value].price,updatedAt:new Date().toISOString()});save();refreshWorkspaceSelect();fillWorkspace();refreshCustomerTable();notify('Buyer workspace saved on this browser; no server sync.');}
function onSegment(){fillOffer();}
function handleFile(file){if(!file)return;const w=requireAuthorized();if(!w){$('lead-file').value='';return;}if(file.size>2_000_000){notify('CSV exceeds 2 MB maximum.');return;}file.text().then(input=>{const {headers,records}=parseCSV(input);const map=columnMap(headers);if(!map.lead_id)throw Error('Missing lead ID column: provide one of lead_id, id, record ID or reference.');const ids=new Set();let skipped=0,missingReceived=0;const filtered=[];for(const row of records){const id=cell(row,map,'lead_id');if(!id){skipped++;continue;}if(ids.has(id))throw Error('Duplicate lead ID found: '+id.slice(0,60));ids.add(id);if(parseTimestamp(cell(row,map,'received_at'))===null)missingReceived++;filtered.push(row);}if(!filtered.length)throw Error('CSV contains no rows with lead identifiers.');if(!window.confirm(`Import ${filtered.length} buyer-owned rows into ${w.buyer}? This replaces the selected list's previous rows. No upload will occur.`))return;w.headers=headers;w.rows=filtered;w.map=map;w.importedAt=new Date().toISOString();w.source=w.source||file.name;w.delivery.checks=CHECKS.map(()=>false);save();fillWorkspace();$('import-result').textContent=`Imported ${filtered.length} actual rows. ${skipped} missing IDs skipped; ${missingReceived} missing/unparseable received dates need review. Mapped fields: ${Object.keys(map).join(', ')}.`;notify('Buyer CSV imported locally. No messages or payments sent.');}).catch(e=>notify('Import blocked: '+e.message)).finally(()=>{$('lead-file').value='';});}
function exportOriginal(){const w=requireWork();if(!w)return;if(!w.rows.length)return notify('No real CSV rows to export.');download(`${slug(w.buyer)}-source-rows.csv`,csvSerialize([w.headers,...w.rows.map(r=>w.headers.map(h=>r[h]))]),'text/csv;charset=utf-8');}
function exportPriority(){const w=requireWork();if(!w)return;if(!w.rows.length)return notify('Import buyer-owned rows before creating a priority sheet.');const headers=['rank','lead_id','class','score','received_at','first_contact_at','latency_minutes','contactable','channel','listed_value','reason','recommended_draft_action','evidence_status','scoring_breakdown'];const rows=getRows().map((r,i)=>[i+1,r.leadId,r.label,r.score,cell(r.row,w.map,'received_at'),cell(r.row,w.map,'first_contact_at'),r.latency===null?'':r.latency.toFixed(1),r.contactable?'yes':'no',r.channel,r.amount??'',r.reason,r.next,r.evidence,r.points.map(x=>x.join(':')).join('; ')]);download(`${slug(w.buyer)}-callback-priority.csv`,csvSerialize([headers,...rows]),'text/csv;charset=utf-8');notify('Priority sheet exported from imported rows; nothing sent.');}
function draftSnapshot(){return JSON.stringify([$('draft-recipient').value.trim(),$('draft-subject').value.trim(),$('draft-body').value.trim()]);}
function handleDraftChange(){const w=work();if(!w)return;w.draft.recipient=$('draft-recipient').value.trim();w.draft.subject=$('draft-subject').value.trim();w.draft.body=$('draft-body').value.trim();w.draft.approvedSnapshot='';w.draft.approvedAt='';save();refreshApproval();refreshSummary();}
function createDraft(){const w=requireWork();if(!w)return;const offer=state.offers[w.segment],price=Number(w.quotedPrice);if(!price||price<=0)return notify('Set a genuine agreed price first.');const subject=`${offer.name} — ${w.buyer}`;const body=`Hello,\n\nGarcar Enterprise can review an authorized export from your existing lead system and return a prioritized callback sheet with the source evidence behind each recommendation.\n\nScope: ${offer.scope}\nAgreed review price (subject to your approval): $${price.toFixed(2)}.\n\nIf this is useful, we can confirm the scope, secure data-handling arrangement, and next step. No CRM migration or unapproved customer outreach is required.\n\nGarcar Enterprise`;w.draft.subject=subject;w.draft.body=body;w.draft.approvedSnapshot='';w.draft.approvedAt='';save();fillDraft();refreshSummary();notify('Draft prepared, not approved and not sent.');}
function approveDraft(){const w=requireWork();if(!w)return;handleDraftChange();if(!w.draft.body||!w.draft.recipient||!w.draft.subject)return notify('Recipient, subject and message are required.');if(!window.confirm('Approve this exact recipient, subject and message for manual use? This does NOT send it. Any edit will revoke approval.'))return;w.draft.approvedSnapshot=draftSnapshot();w.draft.approvedAt=new Date().toISOString();save();refreshApproval();refreshSummary();notify('Exact draft approved. It has NOT been sent.');}
async function copyDraft(){const w=requireWork();if(!w)return;if(!approved(w))return notify('Approval required before copy.');const content=`To: ${w.draft.recipient}\nSubject: ${w.draft.subject}\n\n${w.draft.body}`;try{await navigator.clipboard.writeText(content);notify('Approved draft copied; no message sent.');}catch{notify('Clipboard unavailable; approval still recorded.');}}
function saveOutreach(){const w=requireWork();if(!w)return;const status=$('outreach-status').value,evidence=$('outreach-evidence').value.trim();if(['sent','replied'].includes(status)){if(!approved(w))return notify('Explicit approval must exist before recording outbound activity.');if(!evidence)return notify('Outbound activity requires real supporting evidence.');if(!window.confirm('Confirm this activity happened outside the app and evidence is accurate?'))return;}w.draft.status=status;w.draft.evidence=evidence;save();notify('Outreach status recorded manually; no message sent.');}
function saveDelivery(){const w=requireWork();if(!w)return;const status=$('delivery-status').value,evidence=$('delivery-evidence').value.trim();if(status==='delivered'&&!evidence)return notify('Delivery needs a real evidence/reference value.');if(status==='delivered'&&!w.delivery.checks.every(Boolean))return notify('Complete the delivery checklist before marking delivered.');w.delivery.status=status;w.delivery.evidence=evidence;save();notify('Delivery record updated locally.');}
function savePayment(){const w=requireWork();if(!w)return;const status=$('payment-status').value,amount=$('payment-amount').value,reference=$('payment-reference').value.trim(),date=$('payment-date').value,verified=$('payment-verified').checked;if(amount&&(!Number.isFinite(Number(amount))||Number(amount)<0))return notify('Enter a valid nonnegative payment amount.');if(status==='paid'&&(!reference||!date||!verified||Number(amount)<=0))return notify('To mark paid, confirm amount, date, reference and personal verification.');if(status==='paid'&&!window.confirm('Confirm you personally verified this payment with your payment provider or an authentic receipt. No API reconciliation occurs here.'))return;w.payment={status,amount,reference,date,verified:status==='paid'&&verified};save();refreshPayment();refreshSummary();refreshCustomerTable();notify('Payment status saved as an operator record, not Stripe verification.');}
function addRevision(){const w=requireWork();if(!w)return;const note=$('revision-note').value.trim(),evidence=$('revision-evidence').value.trim();if(!note)return notify('Enter an actual requested revision.');w.revisions.push({id:randomId(),text:note,evidence,status:'requested',createdAt:new Date().toISOString()});save();$('revision-note').value='';$('revision-evidence').value='';refreshRevisions();notify('Revision recorded.');}
function exportBackup(){const output={kind:'garcar-browser-local-workflow-backup',createdAt:new Date().toISOString(),data:state};if(!window.confirm('This JSON backup contains unencrypted buyer records and may include personal information. Save it only in an approved secure location?'))return;download('garcar-workflow-browser-backup.json',JSON.stringify(output,null,2),'application/json');}
function setup(){load();$('sla').value=state.sla;$('stall').value=state.stall;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.view;refreshNav();}));
  $('segment').addEventListener('change',onSegment);
  $('save-offer').addEventListener('click',()=>{const seg=$('segment').value;const name=$('offer-name').value.trim(),scope=$('offer-scope').value.trim(),raw=$('price').value;const price=raw===''?'':Number(raw);if(!name||!scope||price!==''&&(!Number.isFinite(price)||price<=0))return notify('Offer name, scope, and a valid positive price (if set) are required.');state.offers[seg]={name,scope,price};const w=work();if(w?.segment===seg)w.quotedPrice=price;save();notify('Offer saved internally. Public Stripe price unchanged.');});
  $('workspace-select').addEventListener('change',()=>{state.selectedId=$('workspace-select').value;save();fillWorkspace();});
  $('new-workspace').addEventListener('click',()=>{state.selectedId='';save();refreshWorkspaceSelect();fillWorkspace();});
  $('save-workspace').addEventListener('click',handleSaveWorkspace);
  $('delete-workspace').addEventListener('click',()=>{const w=work();if(!w)return notify('No buyer workspace selected.');if(!window.confirm(`Permanently erase browser-local workspace for ${w.buyer}? This cannot be undone unless you have a backup.`))return;state.workspaces=state.workspaces.filter(x=>x.id!==w.id);state.selectedId='';save();refreshWorkspaceSelect();fillWorkspace();refreshCustomerTable();});
  $('lead-file').addEventListener('change',e=>handleFile(e.target.files?.[0]));
  $('export-original').addEventListener('click',exportOriginal);$('export-priority').addEventListener('click',exportPriority);
  $('recalculate').addEventListener('click',()=>{state.sla=Number($('sla').value);state.stall=Number($('stall').value);if(!Number.isInteger(state.sla)||state.sla<1||state.sla>10080||!Number.isInteger(state.stall)||state.stall<1||state.stall>365)return notify('Enter valid integer thresholds.');save();refreshReview();refreshSummary();notify('Computed priorities refreshed from buyer rows.');});$('review-filter').addEventListener('change',refreshReview);
  for(const id of ['draft-recipient','draft-subject','draft-body'])$(id).addEventListener('input',handleDraftChange);
  $('create-draft').addEventListener('click',createDraft);$('approve-draft').addEventListener('click',approveDraft);$('copy-draft').addEventListener('click',copyDraft);$('save-outreach').addEventListener('click',saveOutreach);
  $('delivery-checklist').addEventListener('change',e=>{const index=Number(e.target.dataset.check);const w=work();if(w&&Number.isInteger(index)&&index>=0&&index<CHECKS.length){w.delivery.checks[index]=e.target.checked;save();}});
  $('save-delivery').addEventListener('click',saveDelivery);$('save-payment').addEventListener('click',savePayment);$('add-revision').addEventListener('click',addRevision);
  $('revision-log').addEventListener('change',e=>{const w=work();const r=w?.revisions.find(x=>x.id===e.target.dataset.revision);if(r){r.status=e.target.value;save();refreshRevisions();}});
  $('export-backup').addEventListener('click',exportBackup);
  $('clear-all').addEventListener('click',()=>{if(!window.confirm('Delete ALL buyer records from this browser, including drafts, delivery and payment records?'))return;localStorage.removeItem(STORAGE_KEY);state=defaultState();refreshWorkspaceSelect();fillWorkspace();$('save-status').textContent='No stored records';notify('All local workspaces erased.');});
  refreshWorkspaceSelect();fillWorkspace();refreshNav();
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',setup);
