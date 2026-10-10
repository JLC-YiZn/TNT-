from pathlib import Path
import re
root=Path('outputs')
source=(root/'game.js').read_text(encoding='utf-8')
Path('work/v2-game.js').write_text(source,encoding='utf-8')
def replace_function(name,body):
    global source
    pattern=r'^function '+re.escape(name)+r'\([^\n]*[\s\S]*?(?=^function |^\$\(\x27angle\x27\)|^window\.TNT=)'
    source,count=re.subn(pattern,lambda _:body+'\n',source,count=1,flags=re.M)
    assert count==1,name

source=source.replace("damage:150,radius:42", "damage:150,radius:42,excavation:80").replace("damage:190,radius:58", "damage:190,radius:58,excavation:145").replace("damage:205,radius:24", "damage:205,radius:24,excavation:50")
source=source.replace('let terrain,players,', 'let world,terrain,players,')
replace_function('solid','function solid(x,y){return world.solid(x,y);}')
replace_function('surface','function surface(x,start=0){return world.surface(x,start);}')
replace_function('paintGround','function paintGround(){world.render(gc);}')
replace_function('reset','''function reset(){
  const kind=$('mapType').value||'ruins',seed=String($('mapSeed').value||'TNT-2026').trim().slice(0,32)||'TNT-2026';
  $('mapSeed').value=seed;world=window.TNTWorld.create(kind,seed);terrain=world.cells;paintGround();
  players=[{name:'你',x:160,y:0,hp:1000,energy:100,rage:0,face:1,vy:0,vx:0,vt:0,slope:0,grounded:false,color:'#f1c66d',healUsed:false,heals:2},
    {name:$('mode').value==='ai'?'电脑对手':'玩家二',x:1030,y:0,hp:1000,energy:100,rage:0,face:-1,vy:0,vx:0,vt:0,slope:0,grounded:false,color:'#95d4e3',healUsed:false,heals:2}];
  players.forEach((p,i)=>{if(!window.TNTPhysics.place(world,p,world.spawnX[i]))throw new Error('地图出生点缺少安全支撑');});
  active=0;round=1;wind=0;phase='aim';angle=45;power=0;charging=false;chargeElapsed=0;
  selected=0;buffs=new Set();flyMode=false;shots=[];pending=[];volleyRageAwarded=false;
  particles=[];texts=[];trail=[];lastPower=null;age=0;aiDelay=0;shake=0;
  keys.clear();pointerMove=0;$('result').hidden=true;
  $('last').textContent='选好武器与增益，再按住空格蓄力';
  $('mapName').textContent=world.name;$('currentSeed').textContent='种子 '+world.seed;
  say('已生成 '+world.name+'。行走会随坡面改变实际仰角；不同材质的抗爆与摩擦不同。');
  previewMap();ui();canvas.focus({preventScroll:true});
}''')
# A launch uses the character's surface frame and momentum, including on an icy slope.
replace_function('initial','function initial(p,a,f,w){return window.TNTPhysics.launch(p,a,f,w);}')
source=source.replace('const origin={x:p.x,y:p.y,face:p.face};', 'const origin={...p};')
source=source.replace('radius:w.radius*(buffs.has(\'rage\')?1.15:1)*(buffs.has(\'triple\')?.82:1),color:w.color,t:0', "radius:w.radius*(buffs.has('rage')?1.15:1)*(buffs.has('triple')?.82:1),excavation:w.excavation*(buffs.has('boost')?1.2:1)*(buffs.has('rage')?1.4:1)*(buffs.has('triple')?.55:1)*(buffs.has('burst')?.65:1),color:w.color,t:0")
source=source.replace("${Math.round(angle)}° / 力度", "${Math.round(window.TNTPhysics.elevation(p,angle))}° 实际 / 力度")
replace_function('explode','''function explode(s){
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
}''')
replace_function('settle','''function settle(dt,input=0){
  let changed=false;
  for(let i=0;i<players.length;i++){
    const p=players[i],before=p.hp;
    const moved=window.TNTPhysics.update(world,p,dt,i===active?input:0,SHOT_COST);
    if(i===active&&moved)changed=true;
    if(before>0&&p.hp===0)say(p.name+'掉出了地图！');
  }
  if(changed)ui();
}''')
# Locomotion is integrated once per fixed step inside settle, never as a second displacement.
replace_function('move','''function walkingInput(){
  if(!controllable()||charging||flyMode)return 0;
  return pointerMove||(+keys.has('ArrowRight')-+keys.has('ArrowLeft'))||(+keys.has('d')-+keys.has('a'));
}''')
source=source.replace('settle(dt);', 'settle(dt,walkingInput());')
source=source.replace("      let dir=pointerMove||(+keys.has('ArrowRight')-+keys.has('ArrowLeft'))||(+keys.has('d')-+keys.has('a'));\n      if(dir)move(dir,dt);\n", '')
source=source.replace('players.every(p=>p.vy===0||p.hp===0)', 'players.every(p=>p.grounded||p.hp===0)')
source=source.replace("$('direction').textContent=p.face===1?'向右发射 →':'← 向左发射';", "$('direction').textContent=p.face===1?'向右发射 →':'← 向左发射';\n  const actual=window.TNTPhysics.elevation(p,angle);\n  $('actualAngle').textContent=actual.toFixed(1)+'°';\n  $('slopeValue').textContent=(p.slope*180/Math.PI).toFixed(1)+'°';\n  const mat=window.TNTWorld.materials[p.groundMaterial];\n  $('footing').textContent=p.grounded?(mat?mat.name:'地面'):'空中';")
# Draw the body and barrel in the contact frame, but keep health text upright.
source=source.replace("ctx.fillStyle=p.color;ctx.beginPath();ctx.roundRect(-13,-4,26,25,8)", "ctx.save();ctx.rotate(p.slope||0);ctx.fillStyle=p.color;ctx.beginPath();ctx.roundRect(-13,-4,26,22,8)")
source=source.replace("ctx.lineTo(Math.cos(a)*p.face*24,-9-Math.sin(a)*24);ctx.stroke();ctx.fillStyle='#122833';", "ctx.lineTo(Math.cos(a)*p.face*24,-9-Math.sin(a)*24);ctx.stroke();ctx.restore();ctx.fillStyle='#122833';")
start=source.index("canvas.addEventListener('pointerdown'")
end=source.index("\nwindow.addEventListener('keydown'",start)
source=source[:start]+'''function inspectTerrain(e){
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
  const mat=world.materialAt(x,y);
  $('terrainInfo').textContent=mat?`${mat.name} · ${mat.description} · 剩余强度 ${mat.remaining}/${mat.strength}`:'移动鼠标到地形上，查看材质与剩余强度';
}
canvas.addEventListener('pointermove',inspectTerrain);
canvas.addEventListener('pointerdown',e=>{
  canvas.focus({preventScroll:true});
  if(!flyMode||!controllable()){inspectTerrain(e);return;}
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
  const p=players[active],destination={...p};
  if(x<15||x>W-15||!window.TNTPhysics.place(world,destination,x,Math.max(0,y-55))||Math.hypot(destination.x-p.x,destination.y-p.y)>320){
    say('落点无效：请选择距离 320 内、有足够站立空间的地面。');return;
  }
  Object.assign(p,destination);p.energy-=35;flyMode=false;nextTurn();
});
''' +source[end:]
source=source.replace("if(e.target.matches('select,input,button')&&e.code!=='Space')return;", "if(e.target.matches('select,input,textarea')||(e.target.matches('button')&&e.target.id!=='fire'))return;")
# Return keyboard focus after using attack buffs or switching weapons.
source=source.replace("angle));ui();}\nfunction charge", "angle));ui();canvas.focus({preventScroll:true});}\nfunction charge")
source=source.replace("  ui();\n}\nfunction draw", "  ui();canvas.focus({preventScroll:true});\n}\nfunction draw")
preview='''function previewMap(){
  const kind=$('mapType').value||'ruins',seed=$('mapSeed').value||'TNT-2026';
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
'''
source=source.replace('function frame(now)', preview+'function frame(now)')
old=source[source.index('window.TNT='):source.index('\n})();',source.index('window.TNT='))]
new='''window.TNT={
  getState:()=>({phase,active,round,wind,angle,actualAngle:window.TNTPhysics.elevation(players[active],angle),power,charging,chargeElapsed,
    chargeDirection:(chargeElapsed*CHARGE_RATE)%200>=100?-1:1,lastPower,weapon:weapons[selected].name,buffs:[...buffs],flyMode,
    players:players.map(p=>({...p})),projectiles:shots.length,queuedProjectiles:pending.length,
    projectileDetails:shots.map(s=>({x:s.x,y:s.y,vx:s.vx,vy:s.vy,damage:s.damage,radius:s.radius})),
    terrainCells:terrain.reduce((n,id)=>n+(id!==0),0),map:{kind:world.kind,name:world.name,seed:world.seed,initialHash:world.originalStats.hash,materials:world.originalStats.counts}}),
  getTerrainAt:(x,y)=>world.materialAt(x,y),
  physics:{gravity:G,timestep:DT,chargeRate:CHARGE_RATE,maxChargeTime:MAX_CHARGE_TIME},reset
};'''
source=source.replace(old,new)
(root/'game.js').write_text(source,encoding='utf-8')
html=(root/'index.html').read_text(encoding='utf-8').replace('v0.2','v0.3')
workshop='''<section class="map-maker" aria-label="地图生成器">
<canvas id="mapPreview" width="240" height="130" aria-label="待生成地图预览"></canvas>
<div class="map-settings"><div class="panel-title"><b>地图工坊</b><span>选择结构与种子，生成后开始新对局</span></div>
<div class="map-controls"><label>地图结构 <select id="mapType"><option value="ruins">断层遗迹</option><option value="bridge">峡谷吊桥</option><option value="glacier">冰川裂谷</option><option value="quarry">矿洞堡垒</option><option value="islands">浮岛阶梯</option><option value="random">随机结构</option></select></label><label>地图种子 <input id="mapSeed" type="text" value="TNT-2026" maxlength="32" aria-label="地图种子"></label><button id="generateMap">生成并开局</button><button id="randomMap">随机地图</button></div>
<p id="mapDescription"></p><div class="terrain-legend"><span class="soil">土层 · 易碎</span><span class="rock">岩石 · 坚硬</span><span class="brick">砖墙 · 中等</span><span class="ice">冰层 · 易碎易滑</span></div><p id="terrainInfo">移动鼠标到地形上，查看材质与剩余强度</p></div>
</section>
'''
html=html.replace('<section class="arena">',workshop+'<section class="arena">')
html=html.replace('<canvas id="game"', '<canvas id="game" tabindex="0"')
html=html.replace('<div class="map-label">02 / 断层遗迹 <span>高台 · 石柱 · 地下空洞</span></div>', '<div class="map-label"><b id="mapName">断层遗迹</b><span id="currentSeed">种子 TNT-2026</span></div>')
html=html.replace('发射角度 <strong>', '武器相对角度 <strong>')
html=html.replace('<input id="angle"', '<div class="stance">实际仰角 <b id="actualAngle">45.0°</b><span>坡度 <b id="slopeValue">0.0°</b> · <b id="footing">土层</b></span></div><input id="angle"')
html=html.replace('<script src="game.js"></script>', '<script src="world.js"></script><script src="physics.js"></script><script src="game.js"></script>')
(root/'index.html').write_text(html,encoding='utf-8')
with (root/'style.css').open('a',encoding='utf-8') as css:
    css.write('''
.map-maker{display:flex;gap:20px;margin-bottom:18px;padding:17px;background:#19242e;border:1px solid #303e49;border-radius:10px;align-items:center}
#mapPreview{width:240px;height:130px;aspect-ratio:240/130;flex-shrink:0;border-radius:5px;background:#254654}.map-settings{min-width:0;flex:1}.map-settings .panel-title{margin-bottom:12px}
.map-controls{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}.map-controls label{font-size:11px;color:#b8c6cf;display:flex;flex-direction:column;gap:5px}.map-controls select,.map-controls input{max-width:100%;font-size:12px;padding:8px 10px}.map-controls input{width:160px;background:#101c27;color:#e6edf3;border:1px solid #354351;border-radius:6px}.map-controls button{font-size:12px;padding:9px 12px}#generateMap{background:#eeba54;color:#18212b;border-color:#eeba54}
#mapDescription{margin-top:10px;line-height:1.5}.terrain-legend{display:flex;gap:14px;flex-wrap:wrap;margin:9px 0;font-size:11px;color:#c6d1d9}.terrain-legend span:before{content:'';display:inline-block;width:9px;height:9px;margin-right:6px;border-radius:2px}.soil:before{background:#9b855c}.rock:before{background:#8391a0}.brick:before{background:#bd8368}.ice:before{background:#b8e7ed}#terrainInfo{font-size:11px;min-height:17px;color:#b3c4d0}
.stance{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;margin:8px 0;color:#c2cfd8}.stance>b{color:#f2c76a;margin-right:auto}.stance span{font-size:11px;color:#96b0bd}#game:focus-visible{outline:2px solid #eeba54;outline-offset:-2px}
@media(max-width:1000px){.map-maker{align-items:flex-start}#mapPreview{width:180px;height:98px}.map-settings .panel-title span{display:none}}
@media(max-width:650px){.map-maker{flex-direction:column;gap:12px}#mapPreview{width:100%;height:auto;max-height:160px;object-fit:contain}.map-settings{width:100%}.map-controls{display:grid;grid-template-columns:1fr 1fr}.map-controls input{width:100%}.map-controls select{width:100%}.terrain-legend{gap:10px}.map-controls input{font-size:16px}.map-label{letter-spacing:0}.map-label span{margin-left:10px}}
''')
