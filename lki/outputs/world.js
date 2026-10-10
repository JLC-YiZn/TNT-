(() => {
  'use strict';
  const WIDTH=1200,HEIGHT=650,BOTTOM=607;
  const MATERIALS={
    1:{id:1,name:'土层',strength:20,grip:.95,friction:.7,color:[120,96,67],top:[135,162,97],description:'松软，容易炸开'},
    2:{id:2,name:'岩石',strength:90,grip:.98,friction:.78,color:[69,83,99],top:[126,140,153],description:'坚硬，需要多次爆破'},
    3:{id:3,name:'砖墙',strength:50,grip:.85,friction:.65,color:[140,89,75],top:[189,131,104],description:'中等强度，适合作为掩体'},
    4:{id:4,name:'冰层',strength:14,grip:.075,friction:.045,color:[115,177,193],top:[184,231,237],description:'易碎，坡面会滑行'}
  };
  const CATALOG=[
    {id:'ruins',name:'断层遗迹',description:'山丘、空中平台与洞穴；软土覆盖硬岩，砖柱阻挡低抛。'},
    {id:'bridge',name:'峡谷吊桥',description:'峡谷上的砖桥与桥墩，先打掉桥面还是绕过堡垒？'},
    {id:'glacier',name:'冰川裂谷',description:'覆冰斜坡、冰棚和岩脊；低摩擦会改变站位与仰角。'},
    {id:'quarry',name:'矿洞堡垒',description:'多层岩矿、地下矿洞和有窗口的砖堡，适合消耗战。'},
    {id:'islands',name:'浮岛阶梯',description:'三座主岛和错落的小平台，飞行换位与坠落风险并存。'}
  ];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function seedHash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function randomFrom(seed){let a=seedHash(seed);return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  function create(kind='ruins',seed='TNT-2026'){
    seed=String(seed||'TNT-2026').slice(0,32);
    const rand=randomFrom(seed+'|'+kind),range=(a,b)=>a+(b-a)*rand();
    if(kind==='random')kind=CATALOG[Math.floor(rand()*CATALOG.length)].id;
    if(!CATALOG.some(m=>m.id===kind))kind='ruins';
    const entry=CATALOG.find(m=>m.id===kind),cells=new Uint8Array(WIDTH*HEIGHT),durability=new Uint8Array(cells.length);
    const heights=new Float64Array(WIDTH),phase=range(0,6),frequency=range(75,115);
    const hill1=range(335,390),hill2=range(790,855),amp1=range(75,125),amp2=range(90,140);
    const spawnX=[160,1030];
    function set(x,y,id){x=Math.floor(x);y=Math.floor(y);if(x<0||x>=WIDTH||y<0||y>=BOTTOM)return;const i=y*WIDTH+x;cells[i]=id;durability[i]=id?MATERIALS[id].strength:0;}
    function rect(left,top,right,bottom,id){for(let y=Math.max(0,Math.floor(top));y<Math.min(BOTTOM,bottom);y++)for(let x=Math.max(0,Math.floor(left));x<Math.min(WIDTH,right);x++)set(x,y,id);}
    function ellipse(cx,cy,rx,ry,id){for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(BOTTOM,cy+ry);y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(WIDTH,cx+rx);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)set(x,y,id);}
    function safeBlend(x,top){for(const sx of spawnX){const d=Math.abs(x-sx);if(d<32)return 478;if(d<83){const t=(d-32)/51,s=t*t*(3-2*t);top=478*(1-s)+top*s;}}return top;}
    for(let x=0;x<WIDTH;x++){
      let top=480+24*Math.sin(x/frequency+phase)+10*Math.sin(x/34+phase/2)
        -amp1*Math.exp(-(((x-hill1)/100)**2))-amp2*Math.exp(-(((x-hill2)/110)**2));
      if(kind==='ruins')top-=rangeOnce(70,95)*Math.exp(-(((x-600)/70)**2));
      if(kind==='bridge')top-=60*Math.exp(-(((x-445)/110)**2))+50*Math.exp(-(((x-730)/90)**2));
      if(kind==='glacier')top-=80*Math.exp(-(((x-590)/165)**2));
      if(kind==='quarry')top-=50*Math.exp(-(((x-600)/140)**2));
      if(kind==='islands')top=468+18*Math.sin(x/65+phase)-85*Math.exp(-(((x-600)/150)**2));
      top=safeBlend(x,clamp(top,275,505));heights[x]=top;
      const island=kind!=='islands'||x<310||(x>425&&x<775)||x>895;
      if(!island)continue;
      const bottom=kind==='islands'?Math.min(BOTTOM,top+(x>425&&x<775?108:140)):BOTTOM;
      for(let y=Math.floor(top);y<bottom;y++){
        const depth=y-top;
        let id=depth<38?1:2;
        if(kind==='glacier'&&depth<45)id=4;
        if(kind==='quarry'&&depth>14)id=2;
        set(x,y,id);
      }
    }
    // A constant derived from the seed, never a random sample for each column.
    function rangeOnce(a,b){return a+(b-a)*(seedHash(seed+'peak')%10000)/10000;}
    const caveShift=range(-18,18);
    if(kind!=='islands'){
      ellipse(405+caveShift,522,range(65,96),range(26,38),0);
      ellipse(805-caveShift,523,range(60,92),range(24,37),0);
      if(kind==='quarry'){
        rect(390,525,825,548,0);ellipse(610,535,65,47,0);
        rect(486,501,496,548,3);rect(707,499,717,548,3);
      }
    }
    if(kind==='ruins'){
      rect(range(442,460),range(215,235),550,253,3);
      rect(658,range(193,215),range(735,758),229,2);
      rect(hill1-20,290,hill1+2,heights[Math.floor(hill1)]+24,3);
      rect(hill2+4,270,hill2+27,heights[Math.floor(hill2)]+25,3);
      ellipse(603,555,42,25,0);
    }else if(kind==='bridge'){
      const gapLeft=range(483,516),gapRight=range(682,713),deckY=range(390,410);
      rect(gapLeft,300,gapRight,BOTTOM,0);
      for(let x=430;x<775;x++){
        const top=deckY+.0008*(x-600)**2;
        rect(x,top,x+1,top+30,3);
      }
      rect(441,deckY+18,458,BOTTOM,2);rect(750,deckY+18,767,BOTTOM,2);
      rect(382,328,411,heights[390]+25,3);rect(799,314,832,heights[810]+25,3);
      rect(537,deckY+3,570,deckY+27,4);
    }else if(kind==='glacier'){
      rect(443,234,range(520,563),257,4);rect(681,205,range(744,777),228,4);
      rect(752,310,778,heights[762]+20,3);
      // A buried soil seam and a rock ridge visibly mix strengths on this map.
      ellipse(578,447,83,17,1);rect(580,305,601,heights[590]+50,2);
    }else if(kind==='quarry'){
      rect(510,293,693,322,3);rect(516,322,542,heights[520]+20,3);rect(657,322,685,heights[670]+20,3);
      rect(543,330,656,348,0);rect(548,373,653,390,3);
      rect(346,268,434,291,2);rect(786,247,865,270,2);
      ellipse(584,428,48,17,1);ellipse(711,479,42,18,4);
    }else if(kind==='islands'){
      rect(331,range(334,353),401,373,3);rect(799,range(302,324),869,342,4);
      rect(524,242,610,262,2);rect(615,368,639,430,3);
      ellipse(578,460,61,24,0);
    }
    if(kind!=='glacier'){
      // Patch of ice away from safe spawn areas: material variety has gameplay effects.
      const x0=kind==='islands'?450:range(250,283),x1=x0+range(48,75);
      for(let x=Math.floor(x0);x<x1;x++)for(let y=Math.floor(heights[x]);y<heights[x]+18;y++)if(cells[y*WIDTH+x])set(x,y,4);
    }
    // Keep spawn headroom and a thick support column; caves and structures cannot trap spawns.
    for(const sx of spawnX){
      rect(sx-30,0,sx+31,478,0);
      for(let x=sx-30;x<=sx+30;x++)for(let y=478;y<Math.min(BOTTOM,kind==='islands'?600:BOTTOM);y++)set(x,y,y<516?(kind==='glacier'?4:1):2);
    }
    const stats=()=>{const counts={1:0,2:0,3:0,4:0};let hash=2166136261;for(let i=0;i<cells.length;i++){if(cells[i])counts[cells[i]]++;hash=Math.imul(hash^cells[i],16777619);}return {counts,hash:(hash>>>0).toString(16)};};
    const originalStats=stats();
    function materialAt(x,y){x=Math.floor(x);y=Math.floor(y);if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return null;const i=y*WIDTH+x,id=cells[i];return id?{...MATERIALS[id],remaining:durability[i]}:null;}
    function solid(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&cells[y*WIDTH+x]!==0;}
    function surface(x,start=0,end=HEIGHT){x=Math.floor(x);if(x<0||x>=WIDTH)return HEIGHT+40;for(let y=Math.max(0,Math.floor(start));y<Math.min(HEIGHT,end);y++)if(cells[y*WIDTH+x])return y;return HEIGHT+40;}
    function blast(cx,cy,radius,energy){
      let removed=0,damaged=0;
      for(let y=Math.max(0,Math.floor(cy-radius));y<Math.min(HEIGHT,cy+radius);y++)for(let x=Math.max(0,Math.floor(cx-radius));x<Math.min(WIDTH,cx+radius);x++){
        const i=y*WIDTH+x;if(!cells[i])continue;
        const distance=Math.hypot(x-cx,y-cy);if(distance>=radius)continue;
        const impulse=energy*(1-distance/radius);
        durability[i]=Math.max(0,durability[i]-Math.max(1,Math.round(impulse)));
        damaged++;
        if(durability[i]===0){cells[i]=0;removed++;}
      }
      return {removed,damaged};
    }
    function render(context){
      const image=context.createImageData(WIDTH,HEIGHT),data=image.data;
      for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
        const cell=y*WIDTH+x,id=cells[cell];if(!id)continue;
        const def=MATERIALS[id],i=cell*4,edge=!solid(x,y-1)||!solid(x,y-3),color=edge?def.top:def.color;
        const noise=((x*17+y*31)%13)-6,damage=1-durability[cell]/def.strength;
        const crack=damage>.25&&((x+y*3)%17)<damage*6;
        const mortar=id===3&&((y%13===0)||((x+(Math.floor(y/13)%2)*12)%24===0));
        const offset=crack?-30:mortar?-16:noise;
        for(let c=0;c<3;c++)data[i+c]=clamp(color[c]+offset,0,255);
        data[i+3]=255;
      }
      context.putImageData(image,0,0);
    }
    return {kind,name:entry.name,description:entry.description,seed,cells,durability,spawnX,originalStats,
      materialAt,solid,surface,blast,render,stats,width:WIDTH,height:HEIGHT};
  }
  window.TNTWorld={create,catalog:CATALOG,materials:MATERIALS};
})();
