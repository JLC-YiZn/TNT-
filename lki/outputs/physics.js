(() => {
  'use strict';
  const GRAVITY=260,RADIUS=14,FOOT=18,STEP_HEIGHT=7;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function support(world,x,y,rise=STEP_HEIGHT,drop=24){
    const foot=y+FOOT,points=[];let center=Infinity,material=null;
    for(const dx of [-12,-8,-4,0,4,8,12]){
      // Probe far enough above the center foot to find the real surface on steep slopes.
      // Allowed step height is checked separately against the resulting body pose.
      const floor=world.surface(x+dx,foot-rise-RADIUS,foot+drop+1);
      if(floor>world.height)continue;
      const candidate=floor-4-Math.sqrt(RADIUS*RADIUS-dx*dx);
      points.push({dx,floor});
      if(candidate<center){center=candidate;material=world.materialAt(x+dx,floor);}
    }
    if(!points.length)return null;
    const meanX=points.reduce((s,p)=>s+p.dx,0)/points.length;
    const meanY=points.reduce((s,p)=>s+p.floor,0)/points.length;
    let covariance=0,variance=0;
    for(const point of points){covariance+=(point.dx-meanX)*(point.floor-meanY);variance+=(point.dx-meanX)**2;}
    const slope=clamp(Math.atan(variance?covariance/variance:0),-Math.PI*.42,Math.PI*.42);
    return {y:center,slope,material};
  }
  function bodyClear(world,x,y){
    for(const dx of [-12,-8,-4,0,4,8,12]){
      const top=-12-Math.sqrt(Math.max(0,144-dx*dx));
      const bottom=4+Math.sqrt(196-dx*dx)-.8;
      for(let dy=top;dy<=bottom;dy+=4)if(world.solid(x+dx,y+dy))return false;
      if(world.solid(x+dx,y+bottom))return false;
    }
    return true;
  }
  function place(world,p,x,start=0){
    const floor=world.surface(x,start);
    if(floor>=world.height)return false;
    const pose=support(world,x,floor-FOOT,10,25);
    if(!pose||!bodyClear(world,x,pose.y))return false;
    p.x=x;p.y=pose.y;p.slope=pose.slope;p.grounded=true;p.groundMaterial=pose.material.id;
    p.vx=0;p.vy=0;p.vt=0;return true;
  }
  function elevation(p,localAngle){return localAngle-p.face*(p.slope||0)*180/Math.PI;}
  function launch(p,localAngle,power,weapon){
    const angle=localAngle*Math.PI/180,slope=p.slope||0,c=Math.cos(slope),s=Math.sin(slope);
    const speed=(130+power*5.6)*weapon.speed;
    const localX=p.face*Math.cos(angle),localY=-Math.sin(angle);
    const tipX=localX*24,tipY=-9+localY*24;
    const verticalMotion=p.grounded?(p.vt||0)*Math.sin(slope):(p.vy||0);
    return {x:p.x+tipX*c-tipY*s,y:p.y+tipX*s+tipY*c,
      vx:speed*(localX*c-localY*s)+(p.vx||0),vy:speed*(localX*s+localY*c)+verticalMotion};
  }
  function update(world,p,dt,input=0,reserve=10){
    if(p.hp<=0)return false;
    const oldX=p.x,oldY=p.y,oldSlope=p.slope||0;
    const walking=input!==0&&p.energy>reserve+1;
    if(p.grounded){
      const here=support(world,p.x,p.y);
      if(!here||here.y-p.y>10||here.y-p.y<-STEP_HEIGHT){
        p.grounded=false;p.vx=(p.vt||0)*Math.cos(p.slope||0);p.vy=(p.vt||0)*Math.sin(p.slope||0);
      }else{
        p.y=here.y;p.slope=here.slope;p.groundMaterial=here.material.id;
        const along=GRAVITY*Math.sin(p.slope),normal=GRAVITY*Math.cos(p.slope);
        let acceleration=along;
        if(walking){
          // The leg drive is limited by available static traction; ice cannot supply it.
          const drive=clamp((input*70-(p.vt||0))*8-along,-here.material.grip*normal,here.material.grip*normal);
          acceleration+=drive;p.face=input;
        }else if(Math.abs(p.vt||0)<1.5&&Math.abs(along)<=here.material.grip*normal){
          p.vt=0;acceleration=0;
        }else{
          const sign=Math.sign(p.vt||along);
          acceleration-=sign*here.material.friction*normal;
        }
        const previous=p.vt||0;
        p.vt=clamp(previous+acceleration*dt,-300,300);
        if(!walking&&previous*p.vt<0&&Math.abs(along)<=here.material.grip*normal)p.vt=0;
        const dx=p.vt*Math.cos(p.slope)*dt,nx=clamp(p.x+dx,RADIUS,world.width-RADIUS);
        const next=support(world,nx,p.y);
        const cost=walking?Math.abs(nx-p.x)*.32:0;
        if(cost>p.energy-reserve){p.vt=0;p.vx=0;}
        else if(next&&Math.abs(next.y-p.y)<=STEP_HEIGHT&&bodyClear(world,nx,next.y)){
          p.x=nx;p.y=next.y;p.slope=next.slope;p.groundMaterial=next.material.id;p.energy-=cost;p.vy=0;
          p.vx=p.vt*Math.cos(p.slope);
        }else if(!next||(next.y-p.y>STEP_HEIGHT&&!world.solid(nx,p.y))){
          if(bodyClear(world,nx,p.y)){p.x=nx;p.energy-=cost;p.grounded=false;p.vx=p.vt*Math.cos(p.slope);p.vy=p.vt*Math.sin(p.slope);}
          else {p.vt=0;p.vx=0;}
        }else {p.vt=0;p.vx=0;}
      }
    }
    if(!p.grounded){
      p.vy+=GRAVITY*dt;
      const nx=clamp(p.x+(p.vx||0)*dt,RADIUS,world.width-RADIUS);
      if(bodyClear(world,nx,p.y))p.x=nx;else p.vx=0;
      const ny=p.y+p.vy*dt;
      const landing=p.vy>=0?support(world,p.x,p.y,0,Math.max(2,ny-p.y+2)):null;
      if(landing&&ny>=landing.y&&landing.y>=p.y-2&&bodyClear(world,p.x,landing.y)){
        p.y=landing.y;p.slope=landing.slope;p.groundMaterial=landing.material.id;p.grounded=true;
        p.vt=((p.vx||0)*Math.cos(p.slope)+p.vy*Math.sin(p.slope))*(landing.material.id===4?.9:.65);
        p.vy=0;
      }else if(bodyClear(world,p.x,ny)){p.y=ny;}
      else {p.vy=0;}
    }
    if(p.y>world.height+25)p.hp=0;
    return Math.abs(p.x-oldX)>.001||Math.abs(p.y-oldY)>.001||Math.abs(p.slope-oldSlope)>.001;
  }
  function startFlight(p,localAngle,power){
    const actualAngle=elevation(p,localAngle),angle=actualAngle*Math.PI/180;
    const force=420+clamp(power,5,100)*2.4,poweredFor=.72;
    const vx=p.vx||0,vy=p.grounded?(p.vt||0)*Math.sin(p.slope||0):(p.vy||0);
    const ax=p.face*Math.cos(angle)*force,ay=-Math.sin(angle)*force;
    p.vx=vx;p.vy=vy;p.vt=0;p.grounded=false;p.slope=0;
    return {ax,ay,poweredFor,elapsed:0,stage:'powered',hit:false,localAngle,actualAngle,power};
  }
  function stepFlight(world,p,jet,dt,wind=0){
    jet.elapsed+=dt;
    const powered=!jet.hit&&jet.elapsed<=jet.poweredFor;
    jet.stage=powered?'powered':jet.hit?'collision':'coast';
    // Thrust acts as acceleration; once fuel runs out, gravity and drag remain.
    p.vx+=((powered?jet.ax:0)+wind*6-p.vx*.025)*dt;
    p.vy+=((powered?jet.ay:0)+GRAVITY-p.vy*.025)*dt;
    const dx=p.vx*dt,dy=p.vy*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.5));
    for(let i=0;i<steps;i++){
      const nx=clamp(p.x+dx/steps,RADIUS,world.width-RADIUS),ny=p.y+dy/steps;
      const landing=p.vy>=0?support(world,nx,p.y,0,Math.max(2,dy/steps+2)):null;
      if(landing&&ny>=landing.y&&landing.y>=p.y-2&&bodyClear(world,nx,landing.y)){
        p.x=nx;p.y=landing.y;p.slope=landing.slope;p.groundMaterial=landing.material.id;p.grounded=true;
        p.vt=(p.vx*Math.cos(p.slope)+p.vy*Math.sin(p.slope))*.25;p.vy=0;
        jet.stage='landed';return 'landed';
      }
      if(!bodyClear(world,nx,ny)){
        jet.hit=true;jet.stage='collision';
        // Axis tests distinguish a wall from a ceiling. No displacement penetrates terrain.
        if(!bodyClear(world,nx,p.y))p.vx=0;
        if(!bodyClear(world,p.x,ny))p.vy=Math.max(0,p.vy*.15);
        if(bodyClear(world,nx,p.y))p.x=nx;
        if(bodyClear(world,p.x,ny))p.y=ny;
        break;
      }
      p.x=nx;p.y=ny;
    }
    if(p.y>world.height+25){p.hp=0;jet.stage='lost';return 'lost';}
    return 'airborne';
  }
  window.TNTPhysics={support,bodyClear,place,elevation,launch,update,startFlight,stepFlight,gravity:GRAVITY};
})();
