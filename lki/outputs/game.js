(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const W=1200,H=650,G=260,DT=1/120;
const CHARGE_RATE=64,MAX_CHARGE_TIME=4*100/CHARGE_RATE;
const SHOT_COST=10,ENERGY_REGEN=60;
const BUFFS={boost:{cost:30,name:'强攻'},triple:{cost:30,name:'散射'},burst:{cost:35,name:'连射'},rage:{cost:0,name:'必杀'}};
const weapons=[{name:'标准炮弹',damage:150,radius:42,excavation:80,min:15,max:75,speed:1,color:'#ffd06a'}, {name:'重型炸弹',damage:190,radius:58,excavation:145,min:30,max:80,speed:.91,color:'#ef9761'}, {name:'飞镖',damage:205,radius:24,excavation:50,min:10,max:65,speed:1.12,color:'#9ce5da'}];
const ground=document.createElement('canvas');ground.width=W;ground.height=H;const gc=ground.getContext('2d');
let world,terrain,players,active,round,wind,phase,angle,power,charging,chargeElapsed,selected,buffs,flyMode,jet,shots,pending,volleyRageAwarded,particles,texts,trail,lastPower,age,aiDelay,elapsed=0,stamp=0,acc=0,shake=0;
const keys=new Set();let pointerMove=0;let audio;
function say(msg){$('notice').textContent=msg;}
function solid(x,y){return world.solid(x,y);}
function surface(x,start=0){return world.surface(x,start);}
function paintGround(){world.render(gc);}
function reset(){
  const kind=$('mapType').value||'ruins',seed=String($('mapSeed').value||'TNT-2026').trim().slice(0,32)||'TNT-2026';
  $('mapSeed').value=seed;world=window.TNTWorld.create(kind,seed);terrain=world.cells;paintGround();
  players=[{name:'你',x:160,y:0,hp:1000,energy:100,rage:0,face:1,vy:0,vx:0,vt:0,slope:0,grounded:false,color:'#f1c66d',healUsed:false,heals:2},
    {name:$('mode').value==='ai'?'电脑对手':'玩家二',x:1030,y:0,hp:1000,energy:100,rage:0,face:-1,vy:0,vx:0,vt:0,slope:0,grounded:false,color:'#95d4e3',healUsed:false,heals:2}];
  players.forEach((p,i)=>{if(!window.TNTPhysics.place(world,p,world.spawnX[i]))throw new Error('地图出生点缺少安全支撑');});
  active=0;round=1;wind=0;phase='aim';angle=45;power=0;charging=false;chargeElapsed=0;
  selected=0;buffs=new Set();flyMode=false;jet=null;shots=[];pending=[];volleyRageAwarded=false;
  particles=[];texts=[];trail=[];lastPower=null;age=0;aiDelay=0;shake=0;
  keys.clear();pointerMove=0;$('result').hidden=true;
  $('last').textContent='选好武器与增益，再按住空格蓄力';
  $('mapName').textContent=world.name;$('currentSeed').textContent='种子 '+world.seed;
  say('已生成 '+world.name+'。行走会随坡面改变实际仰角；不同材质的抗爆与摩擦不同。');
  previewMap();ui();canvas.focus({preventScroll:true});
}
function isHuman(){return active===0||$('mode').value==='local';}
function controllable(){return phase==='aim'&&isHuman();}
function ui(){
  const p=players[active],w=weapons[selected],enabled=controllable();
  $('turn').textContent=phase==='over'?'对战结束':phase==='jet'?(jet.stage==='powered'?'推进飞行中':jet.hit?'推进中断 · 下落中':'惯性滑翔中'):phase==='flight'?'炮弹飞行中':isHuman()?(active===0?'你的回合':'玩家二的回合'):'电脑正在瞄准';
  $('round').textContent=`第 ${round} 回合`;
  $('wind').textContent=`${wind<0?'←':wind>0?'→':'↔'} 风力 ${Math.abs(wind).toFixed(1)}`;
  $('angle').min=flyMode?15:w.min;$('angle').max=flyMode?85:w.max;$('angle').value=angle;$('angleValue').textContent=Math.round(angle);
  $('direction').textContent=p.face===1?'角色朝向 →':'← 角色朝向';
  const actual=window.TNTPhysics.elevation(p,angle);
  $('actualAngle').textContent=actual.toFixed(1)+'°';
  $('slopeValue').textContent=(p.slope*180/Math.PI).toFixed(1)+'°';
  const mat=window.TNTWorld.materials[p.groundMaterial];
  $('footing').textContent=p.grounded?(mat?mat.name:'地面'):'空中';
  $('powerValue').textContent=`${Math.round(power)} / 100`;$('powerFill').style.width=power+'%';
  const descending=(chargeElapsed*CHARGE_RATE)%200>=100;
  $('chargeHint').textContent=charging?`${descending?'↓ 回弹':'↑ 蓄力'} · ${(MAX_CHARGE_TIME-chargeElapsed).toFixed(2)} 秒后自动发射`:'满格等速回弹 · 最长 6.25 秒（4 次满蓄时间）';
  $('energy').textContent=Math.floor(p.energy);$('rageValue').textContent=Math.floor(p.rage)+' / 100';$('hp').textContent=Math.max(0,Math.round(p.hp));
  ['left','right'].forEach(id=>$(id).disabled=!enabled||flyMode||charging);
  ['face','angle'].forEach(id=>$(id).disabled=!enabled||charging);
  $('fire').disabled=!enabled||p.energy<(flyMode?35:SHOT_COST);
  $('fire').innerHTML=flyMode?'按住蓄力 · 松开起飞 <kbd>SPACE</kbd>':'按住蓄力 · 松开发射 <kbd>SPACE</kbd>';
  document.querySelectorAll('[data-weapon]').forEach(b=>{
    b.disabled=!enabled||charging||flyMode;b.classList.toggle('selected',+b.dataset.weapon===selected);
    b.setAttribute('aria-pressed',+b.dataset.weapon===selected);
  });
  for(const [id,def] of Object.entries(BUFFS)){
    $(id).disabled=!enabled||charging||flyMode||(!buffs.has(id)&&(id==='rage'?p.rage<100:p.energy<def.cost+SHOT_COST));
    $(id).classList.toggle('selected',buffs.has(id));$(id).setAttribute('aria-pressed',buffs.has(id));
  }
  $('heal').disabled=!enabled||charging||flyMode||p.energy<40+SHOT_COST||p.healUsed||p.heals<=0||p.hp>=1000;
  $('heal').querySelector('small').textContent=`40 体力 · 余 ${p.heals} 次`;
  $('fly').disabled=!enabled||charging||(!flyMode&&p.energy<35);
  $('fly').classList.toggle('selected',flyMode);$('fly').setAttribute('aria-pressed',flyMode);
  const chosen=[...buffs].map(id=>BUFFS[id].name);
  const spent=[...buffs].reduce((n,id)=>n+BUFFS[id].cost,0);
  $('shotPlan').textContent=phase==='jet'?'推进飞行中 · 已消耗 35 体力':flyMode?'推进飞行 · 35 体力 · 按角度和力度起飞':chosen.length?`${chosen.join(' + ')} · 已预付 ${spent} 体力${buffs.has('rage')?' + 100 怒气':''} · 发射另耗 10`:'普通发射 · 消耗 10 体力';
}
function setWeapon(i){if(!controllable()||charging||flyMode)return;selected=i;angle=Math.max(weapons[i].min,Math.min(weapons[i].max,angle));ui();canvas.focus({preventScroll:true});}
function charge(){
  if(!controllable()||charging||players[active].energy<(flyMode?35:SHOT_COST))return;
  charging=true;power=0;chargeElapsed=0;ui();
}
function release(){
  if(!charging)return;
  charging=false;
  if(controllable())launchAction(Math.max(5,power));
}
function launchAction(f){
  if(!flyMode){fire(f);return;}
  const p=players[active];if(p.energy<35)return;
  jet=window.TNTPhysics.startFlight(p,angle,f);p.energy-=35;flyMode=false;phase='jet';
  power=f;lastPower=f;charging=false;keys.clear();pointerMove=0;
  $('last').textContent=`推进飞行 · 实际 ${jet.actualAngle.toFixed(1)}° / 力度 ${Math.round(f)}`;
  say('推进器已按所选角度启动；航程由力度、坡面、风力与途中碰撞决定。');sound(130,.3);ui();
}
function initial(p,a,f,w){return window.TNTPhysics.launch(p,a,f,w);}
function fire(f){
  const p=players[active],w=weapons[selected];
  if(p.energy<SHOT_COST)return;
  p.energy-=SHOT_COST;charging=false;lastPower=f;power=f;phase='flight';age=0;trail=[];shots=[];pending=[];volleyRageAwarded=false;flyMode=false;
  const origin={...p};
  const spread=buffs.has('triple')?[-6,0,6]:[0],count=buffs.has('burst')?3:1;
  const multiplier=(buffs.has('boost')?1.4:1)*(buffs.has('rage')?1.65:1)*(buffs.has('triple')?.45:1)*(buffs.has('burst')?.52:1);
  for(let volley=0;volley<count;volley++)for(const offset of spread){
    const shot={...initial(origin,angle+offset,f,w),owner:active,damage:w.damage*multiplier,
      radius:w.radius*(buffs.has('rage')?1.15:1)*(buffs.has('triple')?.82:1),excavation:w.excavation*(buffs.has('boost')?1.2:1)*(buffs.has('rage')?1.4:1)*(buffs.has('triple')?.55:1)*(buffs.has('burst')?.65:1),color:w.color,t:0};
    if(volley===0)shots.push(shot);else pending.push({at:volley*.38,shot});
  }
  $('last').textContent=`${w.name} · ${Math.round(window.TNTPhysics.elevation(p,angle))}° 实际 / 力度 ${Math.round(f)}${count>1?' · 3 连射':''}`;
  say('已发射。增益只作用于本次攻击，下次发射前可重新选择。');sound(180,.08);ui();
}
function sound(freq,duration){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(40,audio.currentTime+duration);gain.gain.setValueAtTime(.06,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function explode(s){
  const {x,y,radius:r}=s;
  world.blast(x,y,r,s.excavation);paintGround();
  for(const p of players){
    const d=Math.hypot(p.x-x,p.y-y);
    if(d<r+25){
      const damage=Math.round(s.damage*Math.max(.12,1-d/(r+25)));
      p.hp=Math.max(0,p.hp-damage);p.rage=Math.min(100,p.rage+damage*.10);
      texts.push({x:p.x,y:p.y-45,text:'−'+damage,color:'#ffd497',life:1.8});
    }
  }
  if(!volleyRageAwarded){players[s.owner].rage=Math.min(100,players[s.owner].rage+12);volleyRageAwarded=true;}
  for(let i=0;i<34;i++){
    const a=Math.random()*Math.PI*2,v=30+Math.random()*180;
    particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color:i%3?'#ffc16b':'#e4dfb0',life:.4+Math.random()*.7,max:1});
  }
  shake=7;sound(95,.25);
}
function settle(dt,input=0){
  let changed=false;
  for(let i=0;i<players.length;i++){
    const p=players[i],before=p.hp;
    if(phase==='jet'&&i===active)continue;
    const moved=window.TNTPhysics.update(world,p,dt,i===active?input:0,SHOT_COST);
    if(i===active&&moved)changed=true;
    if(before>0&&p.hp===0)say(p.name+'掉出了地图！');
  }
  if(changed)ui();
}
function checkWin(){if(players.every(p=>p.hp>0))return false;phase='over';charging=false;keys.clear();pointerMove=0;const winner=players[0].hp<=0&&players[1].hp<=0?'双方同归于尽':players[1].hp<=0?'你获胜了！':$('mode').value==='local'?'玩家二获胜！':'电脑对手获胜';$('winner').textContent=winner;$('result').hidden=false;say(winner+' 点击“再来一局”重新挑战。');ui();return true;}
function nextTurn(){
  if(checkWin())return;
  active=1-active;round++;wind=Math.round((Math.random()*8-4)*10)/10;
  selected=0;buffs.clear();flyMode=false;jet=null;charging=false;power=0;chargeElapsed=0;pending=[];
  players[active].energy=Math.min(100,players[active].energy+ENERGY_REGEN);players[active].healUsed=false;
  players[active].face=players[active].x<players[1-active].x?1:-1;
  angle=45;phase='aim';aiDelay=.9;keys.clear();pointerMove=0;
  say(isHuman()?'轮到你：回复 60 体力。可叠加散射与连射，留意掩体和剩余体力。':'电脑正在选择弹道与增益……');ui();
}
function walkingInput(){
  if(!controllable()||charging||flyMode)return 0;
  return pointerMove||(+keys.has('ArrowRight')-+keys.has('ArrowLeft'))||(+keys.has('d')-+keys.has('a'));
}
function predict(p,a,f,w,target){const s=initial(p,a,f,w);let distance=Infinity,hit=null;for(let t=0;t<12;t+=1/60){s.vx+=wind*12/60;s.vy+=G/60;s.x+=s.vx/60;s.y+=s.vy/60;distance=Math.min(distance,Math.hypot(s.x-target.x,s.y-target.y));if(s.x<0||s.x>=W||s.y>H+30)break;if(solid(s.x,s.y)){hit={x:s.x,y:s.y};break;}}return hit?Math.hypot(hit.x-target.x,hit.y-target.y):distance+180;}
function ai(){
  const p=players[active],target=players[1-active];selected=round%3;const w=weapons[selected];
  let best={score:Infinity,a:45,f:65};
  for(let a=w.min;a<=w.max;a+=3)for(let f=25;f<=100;f+=3){const score=predict(p,a,f,w,target);if(score<best.score)best={score,a,f};}
  angle=Math.max(w.min,Math.min(w.max,best.a+(Math.random()-.5)*3));
  const f=Math.max(5,Math.min(100,best.f+(Math.random()-.5)*5));
  if(p.hp<450&&p.energy>=40+SHOT_COST&&p.heals>0){p.hp=Math.min(1000,p.hp+180);p.energy-=40;p.heals--;}
  if(p.rage>=100){buffs.add('rage');p.rage-=100;}
  const id=best.score>80?'triple':round%4===0?'burst':'boost';
  if(p.energy>=BUFFS[id].cost+SHOT_COST){buffs.add(id);p.energy-=BUFFS[id].cost;}
  fire(f);
}
function update(dt){
  elapsed+=dt;if(phase==='over'){particlesUpdate(dt);return;}
  settle(dt,walkingInput());
  if(phase==='aim'){
    if(checkWin())return;
    if(isHuman()){
      if(charging){
        chargeElapsed=Math.min(MAX_CHARGE_TIME,chargeElapsed+dt);
        const cycle=(chargeElapsed*CHARGE_RATE)%200;
        power=cycle<=100?cycle:200-cycle;
        if(chargeElapsed>=MAX_CHARGE_TIME-1e-8){
          launchAction(Math.max(5,power));say('达到最长蓄力时间，已自动启动。');
        }else ui();
      }
      if(!charging&&phase==='aim'){
        const ad=(+keys.has('ArrowUp')-+keys.has('ArrowDown'))||(+keys.has('w')-+keys.has('s'));
        if(ad){angle=Math.max(flyMode?15:weapons[selected].min,Math.min(flyMode?85:weapons[selected].max,angle+ad*35*dt));ui();}
      }
    }else if((aiDelay-=dt)<=0)ai();
  }else if(phase==='jet'){
    const result=window.TNTPhysics.stepFlight(world,players[active],jet,dt,wind);
    if(jet.stage==='powered'&&Math.floor(jet.elapsed/DT)%4===0){
      const p=players[active],len=Math.hypot(jet.ax,jet.ay)||1;
      particles.push({x:p.x,y:p.y+13,vx:-jet.ax/len*60,vy:-jet.ay/len*60,color:'#ffca75',life:.25,max:.25});
    }
    ui();
    if(checkWin())return;
    if(result==='landed'){
      say(jet.hit?'飞行受到地形阻挡，已落地。':'飞行已落地。');nextTurn();
    }
  }else if(phase==='flight'){
    age+=dt;
    for(let i=pending.length-1;i>=0;i--)if(pending[i].at<=age){shots.push(pending[i].shot);pending.splice(i,1);sound(180,.08);}
    for(let i=shots.length-1;i>=0;i--){
      const s=shots[i];s.t+=dt;s.vx+=wind*12*dt;s.vy+=G*dt;
      const nx=s.x+s.vx*dt,ny=s.y+s.vy*dt,steps=Math.ceil(Math.hypot(nx-s.x,ny-s.y)/2);let hit=false;
      for(let j=1;j<=steps;j++){
        const x=s.x+(nx-s.x)*j/steps,y=s.y+(ny-s.y)*j/steps;
        const target=players.some((p,k)=>(k!==s.owner||s.t>.25)&&p.hp>0&&Math.hypot(x-p.x,y-p.y)<18);
        if(solid(x,y)||target){s.x=x;s.y=y;hit=true;break;}
      }
      if(hit){explode(s);shots.splice(i,1);}else{
        s.x=nx;s.y=ny;if(Math.round(s.t/DT)%4===0)trail.push({x:s.x,y:s.y,color:s.color});
        if(s.x<-80||s.x>W+80||s.y>H+90||s.t>12)shots.splice(i,1);
      }
    }
    if(!shots.length&&!pending.length&&particles.every(p=>p.life<.2)&&players.every(p=>p.grounded||p.hp===0))nextTurn();
    if(age>15){shots=[];pending=[];nextTurn();}
  }
  particlesUpdate(dt);
}
function particlesUpdate(dt){for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;}particles=particles.filter(p=>p.life>0);for(const t of texts){t.life-=dt;t.y-=22*dt;}texts=texts.filter(t=>t.life>0);shake=Math.max(0,shake-dt*25);}
function useSkill(id){
  if(!controllable()||charging||$(id).disabled)return;
  const p=players[active];
  if(BUFFS[id]){
    const def=BUFFS[id];
    if(buffs.has(id)){buffs.delete(id);if(id==='rage')p.rage+=100;else p.energy+=def.cost;say(`${def.name}已取消，返还消耗。`);}
    else{buffs.add(id);if(id==='rage')p.rage-=100;else p.energy-=def.cost;
      say(id==='triple'?'散射就绪：同时发出三枚，单枚伤害 45%。':id==='burst'?'连射就绪：分三次发射，单次伤害 52%。':'增益已就绪，可以继续组合散射 / 连射。');}
  }else if(id==='fly'){
    if(!flyMode){for(const buff of buffs){if(buff==='rage')p.rage+=100;else p.energy+=BUFFS[buff].cost;}buffs.clear();}
    flyMode=!flyMode;angle=Math.max(flyMode?15:weapons[selected].min,Math.min(flyMode?85:weapons[selected].max,angle));say(flyMode?'调整飞行角度与朝向，再按住空格蓄力、松开起飞。低仰角可能无法离地。':'已取消飞行。');
  }else if(id==='heal'){
    p.energy-=40;p.hp=Math.min(1000,p.hp+180);p.healUsed=true;p.heals--;
    texts.push({x:p.x,y:p.y-40,text:'+180',color:'#a9efc0',life:1.8});say(`恢复生命，仍可发射。本局剩余治疗 ${p.heals} 次。`);
  }
  ui();canvas.focus({preventScroll:true});
}
function draw(){ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#173544');bg.addColorStop(.7,'#497d82');bg.addColorStop(1,'#254654');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);ctx.fillStyle='#d4e3c422';ctx.beginPath();ctx.arc(965,128,53,0,Math.PI*2);ctx.fill();for(let l=0;l<3;l++){ctx.fillStyle=['#28505a','#315f66','#3d7375'][l];ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W;x+=12)ctx.lineTo(x,330+l*46+Math.sin(x/(120-l*20)+l)*45+Math.sin(x/43)*13);ctx.lineTo(W,H);ctx.fill();}ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.drawImage(ground,0,0);ctx.fillStyle='#162c3b';ctx.fillRect(0,H-40,W,40);ctx.strokeStyle='#72aeb066';ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<=W;x+=8){const y=H-40+Math.sin(x/30+elapsed)*2;if(!x)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
if($('practice').checked&&phase==='aim'&&isHuman()&&!flyMode){const p=players[active],s=initial(p,angle,charging?power:(lastPower||65),weapons[selected]);ctx.fillStyle='#f4dc99aa';for(let t=0;t<12;t+=1/60){s.vx+=wind*12/60;s.vy+=G/60;s.x+=s.vx/60;s.y+=s.vy/60;if(s.x<0||s.x>W||s.y>H)break;if(Math.round(t*60)%8===0){ctx.beginPath();ctx.arc(s.x,s.y,2.5,0,Math.PI*2);ctx.fill();}if(solid(s.x,s.y))break;}}
if(phase==='jet'&&jet){
  if(jet.stage==='powered'){
    const p=players[active],len=Math.hypot(jet.ax,jet.ay)||1,ex=-jet.ax/len,ey=-jet.ay/len;
    ctx.fillStyle='#f7b65e';ctx.beginPath();ctx.moveTo(p.x-5,p.y+10);ctx.lineTo(p.x+ex*27,p.y+13+ey*27);ctx.lineTo(p.x+5,p.y+10);ctx.fill();
  }
}
for(const p of players){if(p.hp<=0)continue;ctx.save();ctx.translate(p.x,p.y);if(players[active]===p&&phase==='aim'){ctx.fillStyle='#efcb77';ctx.beginPath();ctx.moveTo(-6,-73);ctx.lineTo(6,-73);ctx.lineTo(0,-65);ctx.fill();}ctx.fillStyle='#142732';ctx.beginPath();ctx.ellipse(0,18,19,5,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.rotate(p.slope||0);ctx.fillStyle=p.color;ctx.beginPath();ctx.roundRect(-13,-4,26,22,8);ctx.fill();ctx.fillStyle='#efdab4';ctx.beginPath();ctx.arc(0,-13,14,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,-17,15,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-16,-19,32,5);ctx.fillStyle='#233746';ctx.beginPath();ctx.arc(p.face*5,-11,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#263943';ctx.lineWidth=9;const a=(players[active]===p?angle:45)*Math.PI/180;ctx.beginPath();ctx.moveTo(p.face*5,2);ctx.lineTo(Math.cos(a)*p.face*24,-9-Math.sin(a)*24);ctx.stroke();ctx.restore();ctx.fillStyle='#122833';ctx.fillRect(-34,-54,68,6);ctx.fillStyle=p.color;ctx.fillRect(-34,-54,68*p.hp/1000,6);ctx.fillStyle='#e2efef';ctx.font='12px Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.fillText(`${p.name} · ${Math.ceil(p.hp)}`,0,-59);ctx.restore();}
for(const t of trail){ctx.fillStyle=t.color+'65';ctx.beginPath();ctx.arc(t.x,t.y,2,0,Math.PI*2);ctx.fill();}for(const s of shots){ctx.fillStyle=s.color;ctx.shadowBlur=15;ctx.shadowColor=s.color;ctx.beginPath();ctx.arc(s.x,s.y,6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;for(const t of texts){ctx.fillStyle=t.color;ctx.font='bold 24px Microsoft YaHei, sans-serif';ctx.textAlign='center';ctx.globalAlpha=Math.min(1,t.life);ctx.fillText(t.text,t.x,t.y);}ctx.globalAlpha=1;if(flyMode){const p=players[active],a=window.TNTPhysics.elevation(p,angle)*Math.PI/180;ctx.strokeStyle='#9ed7e3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.face*Math.cos(a)*72,p.y-Math.sin(a)*72);ctx.stroke();}ctx.restore();}
$('angle').addEventListener('input',()=>{angle=+$('angle').value;ui();});document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>setWeapon(+b.dataset.weapon));['boost','triple','burst','heal','fly','rage'].forEach(id=>$(id).onclick=()=>useSkill(id));$('face').onclick=()=>{players[active].face*=-1;ui();};$('restart').onclick=reset;$('again').onclick=reset;$('mode').onchange=reset;
$('fire').addEventListener('pointerdown',e=>{e.preventDefault();$('fire').setPointerCapture(e.pointerId);charge();});$('fire').addEventListener('pointerup',release);$('fire').addEventListener('pointercancel',()=>{charging=false;power=0;chargeElapsed=0;ui();});for(const [id,d] of [['left',-1],['right',1]]){$(id).addEventListener('pointerdown',e=>{e.preventDefault();$(id).setPointerCapture(e.pointerId);pointerMove=d;});$(id).addEventListener('pointerup',()=>pointerMove=0);$(id).addEventListener('pointercancel',()=>pointerMove=0);}
function inspectTerrain(e){
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
  const mat=world.materialAt(x,y);
  $('terrainInfo').textContent=mat?`${mat.name} · ${mat.description} · 剩余强度 ${mat.remaining}/${mat.strength}`:'移动鼠标到地形上，查看材质与剩余强度';
}
canvas.addEventListener('pointermove',inspectTerrain);
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});inspectTerrain(e);});

window.addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea')||(e.target.matches('button')&&e.target.id!=='fire'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();if(!controllable())return;if(k===' '){if(!e.repeat)charge();}else if(['1','2','3'].includes(k))setWeapon(+k-1);else if(k==='q'&&!e.repeat&&!charging){players[active].face*=-1;ui();}else keys.add(k);});window.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);if(e.code==='Space'){e.preventDefault();release();}});window.addEventListener('blur',()=>{keys.clear();pointerMove=0;charging=false;power=0;chargeElapsed=0;ui();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pointerMove=0;charging=false;power=0;chargeElapsed=0;ui();}});
function previewMap(){
  const kind=$('mapType').value||'ruins',seed=String($('mapSeed').value||'TNT-2026').trim().slice(0,32)||'TNT-2026';
  const preview=window.TNTWorld.create(kind,seed),buffer=document.createElement('canvas');buffer.width=W;buffer.height=H;
  preview.render(buffer.getContext('2d'));
  const pc=$('mapPreview').getContext('2d');pc.clearRect(0,0,240,130);pc.fillStyle='#254654';pc.fillRect(0,0,240,130);pc.drawImage(buffer,0,0,240,130);
  $('mapDescription').textContent=preview.name+' · '+preview.description;
}
function randomMap(){
  $('mapType').value='random';$('mapSeed').value='TNT-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*65536).toString(36);reset();
}
$('mapType').addEventListener('change',previewMap);$('mapSeed').addEventListener('change',previewMap);
$('generateMap').onclick=reset;$('randomMap').onclick=randomMap;
function frame(now){if(!stamp)stamp=now;acc+=Math.min(.06,(now-stamp)/1000);stamp=now;while(acc>=DT){update(DT);acc-=DT;}draw();requestAnimationFrame(frame);}reset();requestAnimationFrame(frame);
window.TNT={
  getState:()=>({phase,active,round,wind,angle,actualAngle:window.TNTPhysics.elevation(players[active],angle),power,charging,chargeElapsed,
    chargeDirection:(chargeElapsed*CHARGE_RATE)%200>=100?-1:1,lastPower,weapon:weapons[selected].name,buffs:[...buffs],flyMode,
    jet:jet?{stage:jet.stage,elapsed:jet.elapsed,hit:jet.hit,localAngle:jet.localAngle,actualAngle:jet.actualAngle,power:jet.power}:null,players:players.map(p=>({...p})),projectiles:shots.length,queuedProjectiles:pending.length,
    projectileDetails:shots.map(s=>({x:s.x,y:s.y,vx:s.vx,vy:s.vy,damage:s.damage,radius:s.radius})),
    terrainCells:terrain.reduce((n,id)=>n+(id!==0),0),map:{kind:world.kind,name:world.name,seed:world.seed,initialHash:world.originalStats.hash,materials:world.originalStats.counts}}),
  getTerrainAt:(x,y)=>world.materialAt(x,y),
  physics:{gravity:G,timestep:DT,chargeRate:CHARGE_RATE,maxChargeTime:MAX_CHARGE_TIME},reset
};
})();
