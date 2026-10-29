const assert=require('node:assert/strict');const fs=require('node:fs');const {validate,total,change}=require('../assets/js/metrics.js');
const d=JSON.parse(fs.readFileSync('data/manual/metrics.json'));validate(d);const s=structuredClone(d.snapshots[0]);assert.equal(total(s),null);assert.equal(change(s),null);
s.poam.totalOpen=500;const next=structuredClone(s);next.reportingDate='2026-11-12';next.poam.totalOpen=450;assert.deepEqual(change(next,s),{net:-50,percent:-10});
s.poam.totalOpen=0;assert.deepEqual(change(next,s),{net:450,percent:null});
s.portfolio.activeSystems=2;s.poam.systemCountsComplete=true;s.systems=[{name:'Example A',atoExpiration:null,openPoam:2},{name:'Example B',atoExpiration:null,openPoam:3}];s.poam.totalOpen=null;assert.equal(total(s),5);validate({schemaVersion:1,snapshots:[s]});
s.systems[0].description='Finding detail';assert.throws(()=>validate({schemaVersion:1,snapshots:[s]}));delete s.systems[0].description;
s.systems[0].openPoam=null;assert.throws(()=>validate({schemaVersion:1,snapshots:[s]}));
assert.throws(()=>validate({schemaVersion:1,snapshots:[next,next]}));console.log('Metrics: unknown values, zero baseline, skipped weeks, aggregation, privacy schema and duplicate dates passed');
