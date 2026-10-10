const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {createGame}=require('./harness.cjs');
const near=(actual,expected,epsilon=1)=>assert(Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
{
  const g=createGame();g.key('keydown',' ','Space');g.tick(1.5625);near(g.state().power,100);g.tick(.25);near(g.state().power,84);assert.equal(g.state().chargeDirection,-1);g.tick(.25);near(g.state().power,68);g.key('keyup',' ','Space');near(g.state().lastPower,68);assert.equal(g.state().phase,'flight');console.log('PASS full charge rebounds at same rate; manual release uses descending power');
  g.reset();g.key('keydown',' ','Space');g.tick(3.125);near(g.state().power,0);g.tick(.25);near(g.state().power,16);assert.equal(g.state().chargeDirection,1);g.tick(2.8);assert.equal(g.state().phase,'aim');g.tick(.1);assert.equal(g.state().phase,'flight');assert.equal(g.state().charging,false);near(g.state().chargeElapsed,6.25,.02);assert.equal(g.state().lastPower,5);assert.equal(g.state().players[0].energy,90);g.key('keyup',' ','Space');assert.equal(g.state().players[0].energy,90);console.log('PASS lower bounce, 4-full-charge deadline, automatic shot fires once');
  g.reset();g.key('keydown',' ','Space');g.tick(1);g.events.blur();assert.equal(g.state().charging,false);assert.equal(g.state().chargeElapsed,0);g.key('keyup',' ','Space');assert.equal(g.state().phase,'aim');console.log('PASS blur cancels held charge safely');
}
{
  const g=createGame();g.click('triple');g.click('burst');assert.equal(g.state().players[0].energy,35);assert.deepEqual(Array.from(g.state().buffs),['triple','burst']);assert.equal(g.node('boost').disabled,true);g.click('boost');assert.equal(g.state().players[0].energy,35);g.click('triple');assert.equal(g.state().players[0].energy,65);g.click('triple');g.shoot(.6);let s=g.state();assert.equal(s.players[0].energy,25);assert.equal(s.projectiles,3);assert.equal(s.queuedProjectiles,6);near(s.projectileDetails[0].damage,150*.45*.52,.00001);g.tick(.4);assert.equal(g.state().queuedProjectiles,3);g.tick(.4);assert.equal(g.state().queuedProjectiles,0);g.tick(12);assert.equal(g.state().active,1);assert.equal(g.state().buffs.length,0);g.shoot(1);g.tick(14);assert.equal(g.state().active,0);assert.equal(g.state().players[0].energy,85);console.log('PASS stackable buffs, budget guard, refund, staggered 9-shot volley, per-shot consumption, carryover +60 recovery');
}
{
  const g=createGame();const starting=g.state().terrainCells;
  assert.equal(g.pixel(160,478),255);assert.equal(g.pixel(1030,478),255);assert(Object.values(g.state().map.materials).every(n=>n>0));
  for(let i=0;i<3;i++){g.buttons[i].onclick();g.shoot(.6);assert(g.state().projectileDetails[0].damage<210);assert(g.state().projectileDetails[0].radius<=58);g.tick(14);}
  assert(g.state().terrainCells<starting);console.log('PASS suspended shelves, pillars, cave roofs, safe spawn platforms, reduced weapon damage/radius, destructive terrain');
}
{
  const g=createGame();g.click('triple');g.click('burst');g.click('fly');assert.equal(g.state().buffs.length,0);assert.equal(g.state().players[0].energy,100);g.node('game').handlers.pointerdown({clientX:265,clientY:450});assert.equal(g.state().phase,'jet');g.tick(5);assert.equal(g.state().active,1);assert.equal(g.state().players[0].energy,65);assert(Math.abs(g.state().players[0].x-265)<22);g.shoot(1);g.tick(14);assert.equal(g.state().players[0].energy,100);const moveStart=g.state().players[0].x;g.key('keydown','ArrowRight');g.tick(.4);g.key('keyup','ArrowRight');assert(g.state().players[0].x>moveStart);assert(g.state().players[0].energy<100);console.log('PASS flight refunds attack buffs, local turn transition, movement cost');
}
{
  const g=createGame('ai');g.shoot(1);g.tick(15);assert.equal(g.state().active,0);assert(g.state().round>=3);assert(g.state().players[0].hp<1000||g.state().terrainCells<255000);console.log('PASS AI response on new complex map');
  let rounds=0;while(g.state().phase!=='over'&&rounds<50){if(g.state().phase==='aim'&&g.state().active===0){g.shoot(1);}g.tick(16);rounds++;}
  assert.equal(g.state().phase,'over');assert.equal(g.node('result').hidden,false);g.click('again');assert.equal(g.state().phase,'aim');assert.equal(g.state().players[0].hp,1000);assert.equal(g.state().buffs.length,0);assert.equal(g.state().queuedProjectiles,0);console.log('PASS completed match and clean restart');
}
console.log('All upgrade regression checks passed.');
