const fs=require('fs'),path=require('path');
const ids=["BC-101","BC-102","BC-103","BC-104","BC-105","BC-106","BC-107","BC-108","BC-109","BC-110","IC-201","IC-202","IC-203","IC-204","IC-205","IC-206","IC-207","IC-208","IC-209","IC-210","AC-301","AC-302","AC-303","AC-304","AC-305","AC-306","AC-307","AC-308","AC-309","AC-310"];
let ok=true;
for(const id of ids){
  const f=path.join(__dirname,id+'.js');
  if(!fs.existsSync(f)){console.log(id,'MISSING');ok=false;continue;}
  const w={};global.window=w;delete require.cache[require.resolve(f)];require(f);
  const c=w.COURSE_DATA[id];
  const errs=[];
  if(!c){console.log(id,'NO DATA');ok=false;continue;}
  if(c.mods.length!==15)errs.push('mods='+c.mods.length);
  if((c.cap||[]).length<10)errs.push('cap='+(c.cap||[]).length);
  c.mods.forEach((m,i)=>{
    if(!m.t||!m.d)errs.push('m'+i+' no title/desc');
    if((m.obj||[]).length<3)errs.push('m'+i+' obj');
    if((m.read||[]).length<2)errs.push('m'+i+' read');
    if((m.read||[]).join(' ').length<600)errs.push('m'+i+' read-short');
    if(!m.ex)errs.push('m'+i+' ex');
    if((m.refs||[]).length<2)errs.push('m'+i+' refs');
    if((m.kc||[]).length!==3)errs.push('m'+i+' kc='+(m.kc||[]).length);
    (m.kc||[]).forEach((q,j)=>{if(!q.q||(q.o||[]).length<3||q.a>=q.o.length||!q.x)errs.push('m'+i+'kc'+j);});
  });
  (c.cap||[]).forEach((q,j)=>{if(!q.q||(q.o||[]).length<3||q.a>=q.o.length||!q.x)errs.push('cap'+j);});
  if(errs.length){ok=false;console.log(id,'FAIL:',errs.join('; '));}
  else console.log(id,'OK (15 mods, '+c.cap.length+' cap)');
}
process.exit(ok?0:1);
