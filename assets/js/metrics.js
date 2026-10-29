/* Shared, summary-only reporting snapshots. No finding-level data. */
(function(root){
'use strict';
const known=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function total(s){const rows=s.systems||[];return s.poam.systemCountsComplete&&rows.length===s.portfolio.activeSystems&&rows.every(r=>known(r.openPoam))?rows.reduce((n,r)=>n+r.openPoam,0):s.poam.totalOpen;}
function validate(d){
 if(d.schemaVersion!==1||!Array.isArray(d.snapshots))throw Error('Invalid snapshot format');
 const seen=new Set();
 for(const s of d.snapshots){
  if(!date(s.reportingDate)||seen.has(s.reportingDate))throw Error('Reporting dates must be valid and unique');seen.add(s.reportingDate);
  for(const [obj,allowed] of [[s,['reportingDate','portfolio','poam','workforce','systems']],[s.portfolio,['activeSystems','currentAuthorizations','expiredAuthorizations','assessmentQueue','highRiskSystems','authorizationDatesComplete']],[s.poam,['totalOpen','overdue','dueWithin30Days','systemCountsComplete','bySeverity']],[s.workforce,['systemsPerIsso','assessorSaturationPercent','qualified8140Percent','firstPassAcceptancePercent']]]){
   if(!obj||Object.keys(obj).some(k=>!allowed.includes(k)))throw Error('Unsupported summary field');
  }
  if(!Array.isArray(s.systems)||!s.poam.bySeverity||Object.keys(s.poam.bySeverity).some(k=>!['CAT I','CAT II','CAT III'].includes(k))||typeof s.poam.systemCountsComplete!=='boolean'||typeof s.portfolio.authorizationDatesComplete!=='boolean')throw Error('Invalid completeness flags or severity summary');
  const names=new Set();for(const r of s.systems){if(Object.keys(r).some(k=>!['name','atoExpiration','openPoam'].includes(k))||!r.name||names.has(r.name))throw Error('Invalid or duplicate system');names.add(r.name);if(r.atoExpiration!==null&&!date(r.atoExpiration))throw Error('Invalid expiration');}
  for(const obj of [s.portfolio,s.poam.bySeverity,s.workforce,...s.systems,s.poam])for(const [k,v] of Object.entries(obj)){if(['name','atoExpiration','bySeverity','systemCountsComplete','authorizationDatesComplete'].includes(k))continue;if(v!==null&&!known(v))throw Error('Use nonnegative numbers or null');}
  if(s.poam.systemCountsComplete&&(s.systems.length!==s.portfolio.activeSystems||s.systems.some(r=>!known(r.openPoam))))throw Error('Complete counts require every active system');
  if(s.poam.systemCountsComplete&&known(s.poam.totalOpen)&&total(s)!==s.poam.totalOpen)throw Error('Portfolio and system totals disagree');
  if(s.portfolio.authorizationDatesComplete&&(s.systems.length!==s.portfolio.activeSystems||s.systems.some(r=>!r.atoExpiration)))throw Error('Complete dates require every active system');
  if(known(total(s))&&((s.poam.overdue||0)+(s.poam.dueWithin30Days||0)>total(s)))throw Error('Due and overdue exceed backlog');
 }return d.snapshots.slice().sort((a,b)=>a.reportingDate.localeCompare(b.reportingDate));
}
function change(a,b){const x=total(a),y=b&&total(b);return known(x)&&known(y)?{net:x-y,percent:y?100*(x-y)/y:null}:null;}
const api={validate,total,change};if(typeof module!=='undefined')module.exports=api;
if(typeof document==='undefined')return;
const number=v=>known(v)?v.toLocaleString():'Not available';
const card=(label,value)=>'<div class="card"><h3>'+esc(label)+'</h3><p style="font-size:1.6rem;font-weight:700">'+esc(value)+'</p></div>';
const fill=(sel,html)=>document.querySelectorAll(sel).forEach(e=>e.innerHTML=html);
const table=(headers,rows)=>'<div style="overflow-x:auto"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
async function hydrate(){try{
 const response=await fetch('data/manual/metrics.json',{cache:'no-store'});if(!response.ok)throw Error('Metrics unavailable');
 const snapshots=validate(await response.json());if(!snapshots.length)return;const s=snapshots.at(-1),previous=snapshots.at(-2),p=s.portfolio,delta=change(s,previous);
 fill('[data-metrics-date]','As of '+esc(s.reportingDate));
 const exp=s.systems.filter(r=>r.atoExpiration).map(r=>({...r,days:Math.round((Date.parse(r.atoExpiration)-Date.parse(s.reportingDate))/86400000)})).sort((a,b)=>a.days-b.days);
 const soon=exp.filter(r=>r.days>=0&&r.days<=60).length;
 const expiry=p.authorizationDatesComplete?number(soon):'Not available (dates incomplete)';
 fill('[data-portfolio-cards]',card('Active systems',number(p.activeSystems))+card('ATOs expiring within 60 days',expiry)+card('Overdue POA&M',number(s.poam.overdue))+card('POA&M due within 30 days',number(s.poam.dueWithin30Days)));
 fill('[data-hero-metrics]',card('Active systems',number(p.activeSystems))+card('Current authorizations',number(p.currentAuthorizations))+card('Open POA&M',number(total(s))));
 fill('[data-authorization-summary]',table(['Authorization status','Systems'],[['Current',number(p.currentAuthorizations)],['Expired',number(p.expiredAuthorizations)],['Assessment queue',number(p.assessmentQueue)]]));
 fill('[data-severity-summary]',table(['Severity','Open items'],Object.entries(s.poam.bySeverity).map(([k,v])=>[k,number(v)])));
 fill('[data-workforce-metrics]',table(['Metric','Value'],[['Systems per ISSO',number(s.workforce.systemsPerIsso)],['Assessor saturation (%)',number(s.workforce.assessorSaturationPercent)],['8140 qualified (%)',number(s.workforce.qualified8140Percent)],['First-pass acceptance (%)',number(s.workforce.firstPassAcceptancePercent)]]));
 fill('[data-poam-cards]',card('Open backlog',number(total(s)))+card('Change since '+(previous?previous.reportingDate:'previous update'),delta?(delta.net>0?'+':'')+delta.net+(delta.percent===null?'':' ('+delta.percent.toFixed(1)+'%)'):'Not available')+card('Overdue',number(s.poam.overdue))+card('Due within 30 days',number(s.poam.dueWithin30Days)));
 fill('[data-ato-expirations]',exp.length?exp.slice(0,10).map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.atoExpiration)+'</td><td>'+r.days+(r.days<0?' (expired)':'')+'</td></tr>').join(''):'<tr><td colspan="3">No authorization dates entered.</td></tr>');
 const ranked=s.systems.filter(r=>known(r.openPoam)).sort((a,b)=>b.openPoam-a.openPoam||a.name.localeCompare(b.name));
 fill('[data-system-ranking]',ranked.length?'<p>'+ (s.poam.systemCountsComplete?'All active systems.':'Partial list — reported systems only.')+'</p><h3>Highest counts</h3>'+table(['System','Open POA&M'],ranked.slice(0,5).map(r=>[r.name,r.openPoam]))+'<h3>Lowest counts</h3>'+table(['System','Open POA&M'],ranked.slice().reverse().slice(0,5).map(r=>[r.name,r.openPoam])):'<p>No system totals entered.</p>');
 const history=snapshots.filter(r=>known(total(r)));let chart='';
 if(history.length>1){const max=Math.max(1,...history.map(total)),first=Date.parse(history[0].reportingDate),last=Date.parse(history.at(-1).reportingDate);const scaled=history.map(r=>(20+560*(Date.parse(r.reportingDate)-first)/(last-first))+','+(170-150*total(r)/max)).join(' ');chart='<svg viewBox="0 0 600 190" role="img" aria-label="Open backlog by reporting date; exact values follow in the table" style="width:100%;height:auto"><polyline fill="none" stroke="currentColor" stroke-width="3" points="'+scaled+'"/></svg>';}
 fill('[data-backlog-trend]',chart+(history.length?table(['Reporting date','Open backlog'],history.map(r=>[r.reportingDate,total(r)])):'<p>No backlog data entered.</p>')+(history.length<2?'<p>Trend appears after two reported totals. No prior history is assumed.</p>':''));
 }catch(e){console.error(e);fill('[data-metrics-date]','Reporting data unavailable — check the metrics file.');}}
 document.addEventListener('DOMContentLoaded',hydrate);
})(typeof window==='undefined'?globalThis:window);
