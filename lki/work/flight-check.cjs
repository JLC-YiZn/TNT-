const {createGame}=require('./harness.cjs'),assert=require('node:assert/strict');
const g=createGame();
g.click('triple');g.click('fly');const before=g.state().players[0];
g.node('game').handlers.pointerdown({clientX:265,clientY:450});
let s=g.state();assert.equal(s.phase,'jet');assert.equal(s.active,0);assert.equal(s.players[0].x,before.x);assert.equal(s.players[0].y,before.y);assert.equal(s.players[0].energy,65);assert.equal(s.buffs.length,0);
g.tick(.2);s=g.state();assert(s.players[0].x>before.x);assert(s.players[0].x<265);assert(s.players[0].y<before.y);assert.equal(s.jet.stage,'powered');assert(s.players[0].vy<0);
g.tick(.65);s=g.state();assert.equal(s.jet.stage,'coast');assert.equal(s.active,0);assert(s.players[0].vx>0);
g.tick(5);s=g.state();assert.equal(s.active,1);assert.equal(s.phase,'aim');assert(s.players[0].grounded);assert(Math.abs(s.players[0].x-265)<22);assert.equal(s.players[0].energy,65);console.log('PASS real acceleration, rise, fuel cutoff, inertia, landing, single cost and delayed turn switch');
g.reset();g.click('fly');g.node('game').handlers.pointerdown({clientX:800,clientY:450});assert.equal(g.state().phase,'aim');assert.equal(g.state().players[0].energy,100);console.log('PASS invalid destination does not spend energy');
const w=g.worlds.create('ruins','flight-wall');w.cells.fill(0);w.durability.fill(0);
for(let y=478;y<607;y++)for(let x=0;x<1200;x++){w.cells[y*1200+x]=1;w.durability[y*1200+x]=20;}
for(let y=260;y<478;y++)for(let x=215;x<233;x++){w.cells[y*1200+x]=2;w.durability[y*1200+x]=90;}
const p={hp:1000,energy:100,face:1},destination={hp:1000,energy:100,face:1};assert(g.physics.place(w,p,160));assert(g.physics.place(w,destination,300));const jet=g.physics.startFlight(p,destination);
let outcome;for(let i=0;i<700;i++){outcome=g.physics.stepFlight(w,p,jet,1/120);assert(g.physics.bodyClear(w,p.x,p.y));if(outcome!=='airborne')break;}
assert(jet.hit);assert(p.x<215);assert.equal(outcome,'landed');console.log('PASS swept capsule collision interrupts engine, prevents tunneling, falls and lands before wall');
// The reset must discard the pending flight, including after map changes.
g.reset();g.click('fly');g.node('game').handlers.pointerdown({clientX:265,clientY:450});g.tick(.1);g.reset();assert.equal(g.state().jet,null);assert.equal(g.state().phase,'aim');assert.equal(g.state().players[0].x,160);console.log('PASS reset during propulsion clears flight state');
