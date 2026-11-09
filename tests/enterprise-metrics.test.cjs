const assert=require('node:assert/strict');const fs=require('node:fs');
const m=require('../assets/js/metrics.js');const e=require('../assets/js/enterprise-metrics.js');
for(const f of ['data/manual/metrics.json','data/manual/metrics.sample.json']){const d=JSON.parse(fs.readFileSync(f));m.validate(d);e.validate(d);}
const s=structuredClone(JSON.parse(fs.readFileSync('data/manual/metrics.sample.json')).snapshots[0]);
// KPI math
const c={slaTargetPercent:90,status:{open:6,late:4,completed:50},completedOnTime:45,monthly:[{month:'2026-10',open:6,late:4,completed:20,assigned:25}],lateTasks:[{id:'A',severity:'Critical',dueDate:'2026-10-01'},{id:'B',severity:'Low',dueDate:'2026-10-21'}]};
const k=e.ctoKpis(c,'2026-10-31');
assert.equal(k.slaRate,90);assert.equal(k.overdueRatio,40);assert.equal(k.backlogAgingDays,20);assert.equal(k.lateCritical,1);assert.equal(k.lateListComplete,false);assert.deepEqual([k.velocity.net,k.velocity.completed,k.velocity.assigned],[-5,20,25]);
// unknowns stay unknown; zero denominators give N/A, not 0%
const u=e.ctoKpis({status:{open:0,late:0,completed:0},completedOnTime:0},'2026-10-31');assert.equal(u.slaRate,null);assert.equal(u.overdueRatio,null);assert.equal(u.backlogAgingDays,null);
assert.equal(e.sum({a:1,b:null}),null);assert.equal(e.sum({a:1,b:2}),3);
// schema guards
const bad=(mut)=>{const x=structuredClone(s);mut(x);assert.throws(()=>e.validate({snapshots:[x]}));};
bad(x=>x.enterprise.workflowsInQueue.JWICS=1);
bad(x=>x.enterprise.totalSystems=-1);
bad(x=>x.enterprise.vulnerabilityTrend.push({...x.enterprise.vulnerabilityTrend[0]}));
bad(x=>x.enterprise.overduePoamLeaderboard[0].owner='Name');
bad(x=>x.cyberTaskOrders.completedOnTime=999);
bad(x=>x.cyberTaskOrders.lateTasks[0].severity='Urgent');
bad(x=>x.cyberTaskOrders.lateTasks[0].dueDate='10/01/2026');
bad(x=>x.cyberTaskOrders.slaTargetPercent=120);
console.log('Enterprise metrics: CTO KPIs, unknown handling and schema guards passed');
