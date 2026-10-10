from pathlib import Path
root=Path('outputs')
p=root/'game.js';s=p.read_text(encoding='utf-8')
s=s.replace('buffs,flyMode,shots,','buffs,flyMode,jet,shots,')
s=s.replace('buffs=new Set();flyMode=false;shots=[];', 'buffs=new Set();flyMode=false;jet=null;shots=[];')
s=s.replace("phase==='flight'?'炮弹飞行中':", "phase==='jet'?(jet.stage==='powered'?'推进飞行中':jet.hit?'推进中断 · 下落中':'惯性滑翔中'):phase==='flight'?'炮弹飞行中':")
s=s.replace('const p=players[i],before=p.hp;', "const p=players[i],before=p.hp;\n    if(phase==='jet'&&i===active)continue;")
s=s.replace('selected=0;buffs.clear();flyMode=false;charging=false;', 'selected=0;buffs.clear();flyMode=false;jet=null;charging=false;')
s=s.replace("  }else if(phase==='flight'){", """  }else if(phase==='jet'){
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
  }else if(phase==='flight'){""")
s=s.replace("点击 320 距离内的地面飞行，结束本回合；已返还攻击增益。", "点击 320 距离内的落点，启动推进飞行；途中碰撞会中断推进，落地后结束回合。")
s=s.replace('Object.assign(p,destination);p.energy-=35;flyMode=false;nextTurn();', """p.energy-=35;flyMode=false;jet=window.TNTPhysics.startFlight(p,destination);phase='jet';
  keys.clear();pointerMove=0;charging=false;
  $('last').textContent='推进飞行 · 35 体力';
  say('推进器启动：先加速升空，再依靠惯性和重力落地。落点仅为预计位置，风和障碍物会改变航程。');sound(130,.3);ui();""")
# Marker and exhaust are part of the real flight state, never a position tween.
s=s.replace('for(const p of players){if(p.hp<=0)continue;', """if(phase==='jet'&&jet){
  ctx.strokeStyle='#9ed7e3aa';ctx.lineWidth=2;ctx.setLineDash([4,5]);
  ctx.beginPath();ctx.arc(jet.target.x,jet.target.y+18,10,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  if(jet.stage==='powered'){
    const p=players[active],len=Math.hypot(jet.ax,jet.ay)||1,ex=-jet.ax/len,ey=-jet.ay/len;
    ctx.fillStyle='#f7b65e';ctx.beginPath();ctx.moveTo(p.x-5,p.y+10);ctx.lineTo(p.x+ex*27,p.y+13+ey*27);ctx.lineTo(p.x+5,p.y+10);ctx.fill();
  }
}
for(const p of players){if(p.hp<=0)continue;""")
s=s.replace('players:players.map(p=>({...p})),projectiles:', "jet:jet?{stage:jet.stage,elapsed:jet.elapsed,hit:jet.hit,target:{...jet.target}}:null,players:players.map(p=>({...p})),projectiles:")
p.write_text(s,encoding='utf-8')
p=root/'index.html';s=p.read_text(encoding='utf-8').replace('v0.3','v0.4').replace('id="fly">飞行','id="fly">推进飞行');p.write_text(s,encoding='utf-8')
p=Path('work/build-offline.py');s=p.read_text(encoding='utf-8').replace("['tnt.html','tnt-v0.3.html']","['tnt.html','tnt-v0.3.html','tnt-v0.4.html']").replace('v0.3','v0.4');p.write_text(s,encoding='utf-8')
# Keep the old entry point updated for anyone with it open.
s=p.read_text(encoding='utf-8').replace("['tnt.html','tnt-v0.4.html','tnt-v0.4.html']","['tnt.html','tnt-v0.3.html','tnt-v0.4.html']");p.write_text(s,encoding='utf-8')
