from pathlib import Path
r=Path('outputs');p=r/'game.js';s=p.read_text(encoding='utf-8')
s=s.replace("$('angle').min=w.min;$('angle').max=w.max;", "$('angle').min=flyMode?15:w.min;$('angle').max=flyMode?85:w.max;")
s=s.replace("['left','right','face','angle'].forEach(id=>$(id).disabled=!enabled||flyMode||charging);", "['left','right'].forEach(id=>$(id).disabled=!enabled||flyMode||charging);\n  ['face','angle'].forEach(id=>$(id).disabled=!enabled||charging);")
s=s.replace("$('fire').disabled=!enabled||flyMode||p.energy<SHOT_COST;", "$('fire').disabled=!enabled||p.energy<(flyMode?35:SHOT_COST);\n  $('fire').innerHTML=flyMode?'按住蓄力 · 松开起飞 <kbd>SPACE</kbd>':'按住蓄力 · 松开发射 <kbd>SPACE</kbd>';")
s=s.replace("if(!controllable()||flyMode||charging||players[active].energy<SHOT_COST)return;", "if(!controllable()||charging||players[active].energy<(flyMode?35:SHOT_COST))return;")
s=s.replace('if(controllable())fire(Math.max(5,power));', 'if(controllable())launchAction(Math.max(5,power));')
s=s.replace('function initial(p,a,f,w)', '''function launchAction(f){
  if(!flyMode){fire(f);return;}
  const p=players[active];if(p.energy<35)return;
  jet=window.TNTPhysics.startFlight(p,angle,f);p.energy-=35;flyMode=false;phase='jet';
  power=f;lastPower=f;charging=false;keys.clear();pointerMove=0;
  $('last').textContent=`推进飞行 · 实际 ${jet.actualAngle.toFixed(1)}° / 力度 ${Math.round(f)}`;
  say('推进器已按所选角度启动；航程由力度、坡面、风力与途中碰撞决定。');sound(130,.3);ui();
}
function initial(p,a,f,w)''')
s=s.replace("fire(Math.max(5,power));say('达到 4 次满蓄时间（6.25 秒），已自动发射。');", "launchAction(Math.max(5,power));say('达到最长蓄力时间，已自动启动。');")
s=s.replace("if(!charging&&!flyMode&&phase==='aim'){", "if(!charging&&phase==='aim'){")
s=s.replace('Math.max(weapons[selected].min,Math.min(weapons[selected].max,angle+ad*35*dt))', 'Math.max(flyMode?15:weapons[selected].min,Math.min(flyMode?85:weapons[selected].max,angle+ad*35*dt))')
s=s.replace("flyMode=!flyMode;say(flyMode?'点击 320 距离内的落点，启动推进飞行；途中碰撞会中断推进，落地后结束回合。':'已取消飞行。');", "flyMode=!flyMode;angle=Math.max(flyMode?15:weapons[selected].min,Math.min(flyMode?85:weapons[selected].max,angle));say(flyMode?'调整飞行角度与朝向，再按住空格蓄力、松开起飞。低仰角可能无法离地。':'已取消飞行。');")
s=s.replace("  ctx.strokeStyle='#9ed7e3aa';ctx.lineWidth=2;ctx.setLineDash([4,5]);\n  ctx.beginPath();ctx.arc(jet.target.x,jet.target.y+18,10,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);\n", '')
start=s.index("if(flyMode){ctx.strokeStyle='#9ed7e388'")
end=s.index('ctx.restore();}',start)
s=s[:start]+"if(flyMode){const p=players[active],a=window.TNTPhysics.elevation(p,angle)*Math.PI/180;ctx.strokeStyle='#9ed7e3';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.face*Math.cos(a)*72,p.y-Math.sin(a)*72);ctx.stroke();}"+s[end:]
start=s.index("canvas.addEventListener('pointerdown'")
end=s.index("\nwindow.addEventListener('keydown'",start)
s=s[:start]+"canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});inspectTerrain(e);});\n"+s[end:]
s=s.replace("k==='q'&&!e.repeat&&!charging&&!flyMode", "k==='q'&&!e.repeat&&!charging")
s=s.replace("hit:jet.hit,target:{...jet.target}", "hit:jet.hit,localAngle:jet.localAngle,actualAngle:jet.actualAngle,power:jet.power")
s=s.replace("$('shotPlan').textContent=chosen.length?", "$('shotPlan').textContent=flyMode?'推进飞行 · 35 体力 · 按角度和力度起飞':chosen.length?")
p.write_text(s,encoding='utf-8')
p=r/'index.html';s=p.read_text(encoding='utf-8').replace('v0.4','v0.5').replace('武器相对角度','相对发射角度');p.write_text(s,encoding='utf-8')
p=Path('work/build-offline.py');s=p.read_text(encoding='utf-8').replace("'tnt-v0.4.html']","'tnt-v0.4.html','tnt-v0.5.html']").replace('Built offline v0.4','Built offline v0.5');p.write_text(s,encoding='utf-8')
p=Path('work/package-check.py');s=p.read_text(encoding='utf-8').replace("'v0.4'","'v0.5'").replace('v0.4 controls','v0.5 controls');s+="\nassert (root/'tnt-v0.5.html').read_text(encoding='utf-8')==single\n";p.write_text(s,encoding='utf-8')
