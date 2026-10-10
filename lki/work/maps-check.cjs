const {createGame}=require('./harness.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const near=(actual,expected,epsilon=1)=>assert(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const g=createGame(),World=g.worlds,Physics=g.physics;

// Generated layouts must have variation, all material types and genuinely safe spawns.
const hashes=new Set();
for(const map of World.catalog){
  const a=World.create(map.id,'same-seed'),b=World.create(map.id,'same-seed');
  assert.equal(a.originalStats.hash,b.originalStats.hash);
  for(let n=0;n<8;n++){
    const w=World.create(map.id,'check-seed-'+n);hashes.add(w.originalStats.hash);
    for(const id of [1,2,3,4])assert(w.originalStats.counts[id]>0,`${map.id} missing ${id}`);
    for(const x of w.spawnX){const p={hp:1000,energy:100,face:1};assert(Physics.place(w,p,x),`${map.id} bad spawn at ${x}`);assert(Physics.bodyClear(w,p.x,p.y));near(p.slope,0,.001);for(let t=0;t<120;t++)Physics.update(w,p,1/120);assert.equal(p.hp,1000);near(p.x,x,.1);assert(p.grounded);}
  }
  console.log('PASS seeded map and safe spawns:',map.name);
}
assert.equal(hashes.size,40);
assert.equal(World.create('random','fixed').originalStats.hash,World.create('random','fixed').originalStats.hash);
console.log('PASS 40 distinct generated maps, deterministic random archetype, 4 mixed materials per map');

// Equal impact energy must excavate soft terrain but leave stronger terrain damaged.
{
  const w=World.create('ruins','blast-tests'),x=100,y=550;
  for(const [dx,id] of [[0,1],[100,2],[200,3],[300,4]]){
    for(let yy=y-4;yy<=y+4;yy++)for(let xx=x+dx-4;xx<=x+dx+4;xx++){
      const index=yy*1200+xx;w.cells[index]=id;w.durability[index]=World.materials[id].strength;
    }
    w.blast(x+dx,y,10,35);
  }
  assert.equal(w.materialAt(x,y),null);assert.equal(w.materialAt(x+300,y),null);
  assert.equal(w.materialAt(x+100,y).remaining,55);assert.equal(w.materialAt(x+200,y).remaining,15);
  w.blast(x+100,y,10,35);assert.equal(w.materialAt(x+100,y).remaining,20);
  w.blast(x+100,y,10,35);assert.equal(w.materialAt(x+100,y),null);
  console.log('PASS soft soil/ice excavation, brick resistance, rock cumulative damage');
}
function ramp(slope,id=1){
  const w=World.create('ruins','ramp');w.cells.fill(0);w.durability.fill(0);
  for(let x=0;x<1200;x++)for(let y=Math.floor(440+slope*(x-300));y<607;y++)if(y>=0){w.cells[y*1200+x]=id;w.durability[y*1200+x]=World.materials[id].strength;}
  return w;
}
function player(w,x=300){const p={name:'test',hp:1000,energy:100,face:1};assert(Physics.place(w,p,x));return p;}
{
  const w=ramp(-.35),p=player(w),x=p.x;
  assert(p.slope<0);near(Physics.elevation(p,45),45+Math.atan(.35)*180/Math.PI,2);
  for(let i=0;i<120;i++)Physics.update(w,p,1/120,1);
  assert(p.x>x+20);assert(p.y<422);assert(p.energy<100);assert(p.grounded);assert(Physics.bodyClear(w,p.x,p.y));
  p.face=-1;near(Physics.elevation(p,45),45-Math.atan(.35)*180/Math.PI,2);
  p.vx=0;p.vt=0;p.face=1;
  const s=Physics.launch(p,45,65,{speed:1});near(Math.atan2(-s.vy,s.vx)*180/Math.PI,Physics.elevation(p,45),.001);
  console.log('PASS uphill locomotion, stance, facing inversion and actual projectile velocity');
}
{
  const ice=ramp(.18,4),soil=ramp(.18,1),a=player(ice),b=player(soil);
  for(let i=0;i<240;i++){Physics.update(ice,a,1/120);Physics.update(soil,b,1/120);}
  assert(a.x>330);near(b.x,300,.01);assert(a.vt>0);assert(a.energy===100);assert(Physics.elevation(a,45)<45);
  const steep=ramp(1.1,1),c=player(steep);for(let i=0;i<240;i++)Physics.update(steep,c,1/120);
  assert(c.x>300);console.log('PASS gravity-driven ice and steep-slope sliding, static friction on soil');
}
{
  const w=ramp(0),p=player(w);for(let y=0;y<607;y++)for(let x=280;x<321;x++)w.cells[y*1200+x]=0;
  for(let i=0;i<300;i++)Physics.update(w,p,1/120);
  assert.equal(p.hp,0);assert(!p.grounded);
  const ceiling=ramp(0);for(let y=393;y<432;y++)for(let x=290;x<312;x++){ceiling.cells[y*1200+x]=2;ceiling.durability[y*1200+x]=90;}
  const candidate={hp:1000,energy:100,face:1};assert.equal(Physics.place(ceiling,candidate,300,432),false);
  console.log('PASS lost support falls under gravity; blocked headroom rejects placement');
}
{
  g.node('mapType').value='glacier';g.node('mapSeed').value='my-test-map';g.click('generateMap');assert.equal(g.state().map.kind,'glacier');const hash=g.state().map.initialHash;g.reset();assert.equal(g.state().map.initialHash,hash);
  g.node('mapSeed').value='different-seed';g.click('generateMap');assert.notEqual(g.state().map.initialHash,hash);
  g.click('randomMap');assert(g.state().map.seed.startsWith('TNT-'));assert(g.state().players.every(p=>p.grounded));
  g.node('mapType').value='ruins';g.node('mapSeed').value='TNT-2026';g.reset();
  g.key('keydown','ArrowRight');g.tick(1.7);g.key('keyup','ArrowRight');g.tick(.4);
  const stance=g.state();assert(stance.players[0].x>205);assert(Math.abs(stance.players[0].slope)>0.02);assert(Math.abs(stance.actualAngle-stance.angle)>1);
  g.shoot(.6);assert.equal(g.state().phase,'flight');assert(g.state().projectileDetails.every(s=>Number.isFinite(s.vx)&&Number.isFinite(s.vy)));
  g.tick(14);assert(g.state().round>=2);console.log('PASS map UI generates/replays/shuffles, walking changes aim, gameplay fires and advances');
}

// Write seeded map images for offline geometry inspection without relying on browser access.
const previews=[];
for(const map of World.catalog){const w=World.create(map.id,'TNT-2026');const image={data:new Uint8ClampedArray(1200*650*4)};w.render({createImageData:()=>image,putImageData(){}});fs.writeFileSync('work/'+map.id+'.rgba',image.data);previews.push({name:map.name,file:map.id+'.rgba'});}
fs.writeFileSync('work/map-previews.json',JSON.stringify(previews));
console.log('All map and contact-physics checks passed.');
