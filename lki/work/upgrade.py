from pathlib import Path
root=Path('outputs')
file=root/'game.js'
source=file.read_text(encoding='utf-8')
Path('work/v1-game.js').write_text(source,encoding='utf-8')
source=source.replace('const W=1200,H=650,G=260,DT=1/120;', '''const W=1200,H=650,G=260,DT=1/120;
const CHARGE_RATE=64,MAX_CHARGE_TIME=4*100/CHARGE_RATE;
const SHOT_COST=10,ENERGY_REGEN=60;
const BUFFS={boost:{cost:30,name:'强攻'},triple:{cost:30,name:'散射'},burst:{cost:35,name:'连射'},rage:{cost:0,name:'必杀'}};''')
source=source.replace("damage:270,radius:66", "damage:150,radius:42").replace("damage:340,radius:90", "damage:190,radius:58").replace("damage:360,radius:39", "damage:205,radius:24")
source=source.replace('charging,selected,modifier,flyMode,shots,', 'charging,chargeElapsed,selected,buffs,flyMode,shots,pending,volleyRageAwarded,')
functions={}
functions['reset']='''function reset(){
  terrain=new Uint8Array(W*H);
  for(let x=0;x<W;x++){
    let top=478+26*Math.sin(x/89)+12*Math.sin(x/34)
      -115*Math.exp(-(((x-380)/90)**2))-142*Math.exp(-(((x-785)/100)**2))
      -85*Math.exp(-(((x-600)/55)**2));
    if(Math.abs(x-160)<55||Math.abs(x-1030)<55)top=478;
    for(let y=Math.floor(top);y<H-43;y++)terrain[y*W+x]=1;
  }
  // Elevated shelves intercept high trajectories; cavities create alternate supports.
  for(const [left,right,top,bottom] of [[450,545,230,251],[655,750,205,228],[335,356,298,410],[837,857,276,398]])
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)terrain[y*W+x]=1;
  for(const [cx,cy,rx,ry] of [[405,510,94,36],[798,495,99,35],[600,556,45,26]])
    for(let y=cy-ry;y<cy+ry;y++)for(let x=cx-rx;x<cx+rx;x++)
      if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)terrain[y*W+x]=0;
  paintGround();
  players=[{name:'你',x:160,y:0,hp:1000,energy:100,rage:0,face:1,vy:0,color:'#f1c66d',healUsed:false,heals:2},
    {name:$('mode').value==='ai'?'电脑对手':'玩家二',x:1030,y:0,hp:1000,energy:100,rage:0,face:-1,vy:0,color:'#95d4e3',healUsed:false,heals:2}];
  players.forEach(p=>p.y=surface(p.x)-18);
  active=0;round=1;wind=0;phase='aim';angle=45;power=0;charging=false;chargeElapsed=0;
  selected=0;buffs=new Set();flyMode=false;shots=[];pending=[];volleyRageAwarded=false;
  particles=[];texts=[];trail=[];lastPower=null;age=0;aiDelay=0;shake=0;
  keys.clear();pointerMove=0;$('result').hidden=true;
  $('last').textContent='选好武器与增益，再按住空格蓄力';
  say('满蓄后等速回弹；最多蓄力 6.25 秒。散射与连射可叠加，每次发射另耗 10 体力。');ui();
}'''
functions['ui']='''function ui(){
  const p=players[active],w=weapons[selected],enabled=controllable();
  $('turn').textContent=phase==='over'?'对战结束':phase==='flight'?'炮弹飞行中':isHuman()?(active===0?'你的回合':'玩家二的回合'):'电脑正在瞄准';
  $('round').textContent=`第 ${round} 回合`;
  $('wind').textContent=`${wind<0?'←':wind>0?'→':'↔'} 风力 ${Math.abs(wind).toFixed(1)}`;
  $('angle').min=w.min;$('angle').max=w.max;$('angle').value=angle;$('angleValue').textContent=Math.round(angle);
  $('direction').textContent=p.face===1?'向右发射 →':'← 向左发射';
  $('powerValue').textContent=`${Math.round(power)} / 100`;$('powerFill').style.width=power+'%';
  const descending=(chargeElapsed*CHARGE_RATE)%200>=100;
  $('chargeHint').textContent=charging?`${descending?'↓ 回弹':'↑ 蓄力'} · ${(MAX_CHARGE_TIME-chargeElapsed).toFixed(2)} 秒后自动发射`:'满格等速回弹 · 最长 6.25 秒（4 次满蓄时间）';
  $('energy').textContent=Math.floor(p.energy);$('rageValue').textContent=Math.floor(p.rage)+' / 100';$('hp').textContent=Math.max(0,Math.round(p.hp));
  ['left','right','face','angle'].forEach(id=>$(id).disabled=!enabled||flyMode||charging);
  $('fire').disabled=!enabled||flyMode||p.energy<SHOT_COST;
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
  $('shotPlan').textContent=chosen.length?`${chosen.join(' + ')} · 已预付 ${spent} 体力${buffs.has('rage')?' + 100 怒气':''} · 发射另耗 10`:'普通发射 · 消耗 10 体力';
}'''
functions['charge']='''function charge(){
  if(!controllable()||flyMode||charging||players[active].energy<SHOT_COST)return;
  charging=true;power=0;chargeElapsed=0;ui();
}'''
functions['release']='''function release(){
  if(!charging)return;
  charging=false;
  if(controllable())fire(Math.max(5,power));
}'''
functions['fire']='''function fire(f){
  const p=players[active],w=weapons[selected];
  if(p.energy<SHOT_COST)return;
  p.energy-=SHOT_COST;charging=false;lastPower=f;power=f;phase='flight';age=0;trail=[];shots=[];pending=[];volleyRageAwarded=false;flyMode=false;
  const origin={x:p.x,y:p.y,face:p.face};
  const spread=buffs.has('triple')?[-6,0,6]:[0],count=buffs.has('burst')?3:1;
  const multiplier=(buffs.has('boost')?1.4:1)*(buffs.has('rage')?1.65:1)*(buffs.has('triple')?.45:1)*(buffs.has('burst')?.52:1);
  for(let volley=0;volley<count;volley++)for(const offset of spread){
    const shot={...initial(origin,angle+offset,f,w),owner:active,damage:w.damage*multiplier,
      radius:w.radius*(buffs.has('rage')?1.15:1)*(buffs.has('triple')?.82:1),color:w.color,t:0};
    if(volley===0)shots.push(shot);else pending.push({at:volley*.38,shot});
  }
  $('last').textContent=`${w.name} · ${Math.round(angle)}° / 力度 ${Math.round(f)}${count>1?' · 3 连射':''}`;
  say('已发射。增益只作用于本次攻击，下次发射前可重新选择。');sound(180,.08);ui();
}'''
functions['nextTurn']='''function nextTurn(){
  if(checkWin())return;
  active=1-active;round++;wind=Math.round((Math.random()*8-4)*10)/10;
  selected=0;buffs.clear();flyMode=false;charging=false;power=0;chargeElapsed=0;pending=[];
  players[active].energy=Math.min(100,players[active].energy+ENERGY_REGEN);players[active].healUsed=false;
  players[active].face=players[active].x<players[1-active].x?1:-1;
  angle=45;phase='aim';aiDelay=.9;keys.clear();pointerMove=0;
  say(isHuman()?'轮到你：回复 60 体力。可叠加散射与连射，留意掩体和剩余体力。':'电脑正在选择弹道与增益……');ui();
}'''
functions['ai']='''function ai(){
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
}'''
functions['update']='''function update(dt){
  elapsed+=dt;if(phase==='over'){particlesUpdate(dt);return;}
  settle(dt);
  if(phase==='aim'){
    if(checkWin())return;
    if(isHuman()){
      if(charging){
        chargeElapsed=Math.min(MAX_CHARGE_TIME,chargeElapsed+dt);
        const cycle=(chargeElapsed*CHARGE_RATE)%200;
        power=cycle<=100?cycle:200-cycle;
        if(chargeElapsed>=MAX_CHARGE_TIME-1e-8){
          fire(Math.max(5,power));say('达到 4 次满蓄时间（6.25 秒），已自动发射。');
        }else ui();
      }
      let dir=pointerMove||(+keys.has('ArrowRight')-+keys.has('ArrowLeft'))||(+keys.has('d')-+keys.has('a'));
      if(dir)move(dir,dt);
      if(!charging&&!flyMode&&phase==='aim'){
        const ad=(+keys.has('ArrowUp')-+keys.has('ArrowDown'))||(+keys.has('w')-+keys.has('s'));
        if(ad){angle=Math.max(weapons[selected].min,Math.min(weapons[selected].max,angle+ad*35*dt));ui();}
      }
    }else if((aiDelay-=dt)<=0)ai();
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
    if(!shots.length&&!pending.length&&particles.every(p=>p.life<.2)&&players.every(p=>p.vy===0||p.hp===0))nextTurn();
    if(age>15){shots=[];pending=[];nextTurn();}
  }
  particlesUpdate(dt);
}'''
functions['useSkill']='''function useSkill(id){
  if(!controllable()||charging||$(id).disabled)return;
  const p=players[active];
  if(BUFFS[id]){
    const def=BUFFS[id];
    if(buffs.has(id)){buffs.delete(id);if(id==='rage')p.rage+=100;else p.energy+=def.cost;say(`${def.name}已取消，返还消耗。`);}
    else{buffs.add(id);if(id==='rage')p.rage-=100;else p.energy-=def.cost;
      say(id==='triple'?'散射就绪：同时发出三枚，单枚伤害 45%。':id==='burst'?'连射就绪：分三次发射，单次伤害 52%。':'增益已就绪，可以继续组合散射 / 连射。');}
  }else if(id==='fly'){
    if(!flyMode){for(const buff of buffs){if(buff==='rage')p.rage+=100;else p.energy+=BUFFS[buff].cost;}buffs.clear();}
    flyMode=!flyMode;say(flyMode?'点击 320 距离内的地面飞行，结束本回合；已返还攻击增益。':'已取消飞行。');
  }else if(id==='heal'){
    p.energy-=40;p.hp=Math.min(1000,p.hp+180);p.healUsed=true;p.heals--;
    texts.push({x:p.x,y:p.y-40,text:'+180',color:'#a9efc0',life:1.8});say(`恢复生命，仍可发射。本局剩余治疗 ${p.heals} 次。`);
  }
  ui();
}'''
functions['move']='''function move(dir,dt){
  if(!controllable()||charging||flyMode)return;
  const p=players[active];if(p.energy<=SHOT_COST+1)return;
  const nx=Math.max(15,Math.min(W-15,p.x+dir*70*dt));
  // Check the body too, so steep cover cannot be walked through.
  if(solid(nx,p.y-12)||solid(nx,p.y))return;
  const ny=surface(nx,p.y+4)-18;if(ny<p.y-14||ny>p.y+100)return;
  p.face=dir;const cost=Math.abs(nx-p.x)*.32;if(p.energy-cost<SHOT_COST)return;
  p.energy-=cost;p.x=nx;if(ny<p.y)p.y=ny;ui();
}'''
lines=source.splitlines()
for name,body in functions.items():
    found=[i for i,line in enumerate(lines) if line.startswith('function '+name+'(')]
    assert len(found)==1,name
    lines[found[0]]=body
source='\n'.join(lines)+'\n'
source=source.replace('players[s.owner].rage=Math.min(100,players[s.owner].rage+12);', 'if(!volleyRageAwarded){players[s.owner].rage=Math.min(100,players[s.owner].rage+12);volleyRageAwarded=true;}')
source=source.replace('damage*.13', 'damage*.10')
source=source.replace("['boost','triple','heal','fly','rage'].forEach", "['boost','triple','burst','heal','fly','rage'].forEach")
source=source.replace("charging=false;power=0;ui();", "charging=false;power=0;chargeElapsed=0;ui();")
source=source.replace('charging,weapon:weapons[selected].name,modifier,flyMode,', 'charging,chargeElapsed,chargeDirection:(chargeElapsed*CHARGE_RATE)%200>=100?-1:1,lastPower,weapon:weapons[selected].name,buffs:[...buffs],flyMode,')
source=source.replace('projectiles:shots.length,terrainCells:', 'projectiles:shots.length,queuedProjectiles:pending.length,projectileDetails:shots.map(s=>({x:s.x,y:s.y,damage:s.damage,radius:s.radius})),terrainCells:')
source=source.replace('physics:{gravity:G,timestep:DT},reset', 'physics:{gravity:G,timestep:DT,chargeRate:CHARGE_RATE,maxChargeTime:MAX_CHARGE_TIME},reset')
file.write_text(source,encoding='utf-8')
html=(root/'index.html').read_text(encoding='utf-8')
html=html.replace('01 / 浮岛山谷', '02 / 断层遗迹')
html=html.replace('可破坏地形</span>', '高台 · 石柱 · 地下空洞</span>')
html=html.replace('<button id="fire"', '<p id="chargeHint" class="charge-hint">满格等速回弹 · 最长 6.25 秒</p><button id="fire"')
html=html.replace('<button id="triple">三叉弹 <small>45 体力</small></button>', '<button id="triple">散射 ×3 <small>30 体力</small></button><button id="burst">连射 ×3 <small>35 体力</small></button>')
html=html.replace('治疗 <small>40 体力</small>', '治疗 <small>40 体力 · 余 2 次</small>')
html=html.replace('<p id="skillHint">强攻增加伤害；三叉弹散射；飞行选点后消耗本回合。</p>', '<p id="shotPlan" class="shot-plan" aria-live="polite">普通发射 · 消耗 10 体力</p><p id="skillHint">散射与连射可叠加，点击取消返还消耗。体力跨回合保留，每轮回复 60，上限 100。</p>')
html=html.replace('高伤害 / 10–65°','精准 / 10–65°').replace('大弹坑 / 30–80°','破掩体 / 30–80°')
(root/'index.html').write_text(html,encoding='utf-8')
with (root/'style.css').open('a',encoding='utf-8') as css:
    css.write('\n.charge-hint{margin:9px 0 0;line-height:1.6;color:#c3cdd5;min-height:20px}.shot-plan{color:#f0cf85;margin:0 0 8px;line-height:1.65}.skills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.skills small{font-size:11px}.skills button{min-height:48px}@media(max-width:400px){.panel-title span{max-width:45%;text-align:right}.resources{gap:6px}.resources b{margin-left:4px}}\n')
